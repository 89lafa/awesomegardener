import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Search, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVarietyDisplayName } from '@/components/utils/varietyHelpers';

export function PlantSeedsDialog({ isOpen, onClose, trayId, trayName, onSeedPlanted }) {
  const [seedLots, setSeedLots] = useState([]);
  const [growListItems, setGrowListItems] = useState([]);
  const [seedlings, setSeedlings] = useState([]);
  const [loadingSeeds, setLoadingSeeds] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('stash');
  const [displayNames, setDisplayNames] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoadingSeeds(true);
      const user = await base44.auth.me();
      
      // Load all sources
      const [lots, lists, containers, trayCells] = await Promise.all([
        base44.entities.SeedLot.filter({ created_by: user.email }, '-updated_date'),
        base44.entities.GrowList.filter({ created_by: user.email }),
        base44.entities.IndoorContainer.filter({ created_by: user.email, status: 'ready_to_transplant' }),
        base44.entities.TrayCell.filter({ created_by: user.email, status: 'ready_to_transplant' })
      ]);
      
      setSeedLots(lots);

      // Extract unique grow list items (deduplicate by variety_id)
      const allItems = [];
      const seen = new Set();
      for (const list of lists) {
        if (list.items && Array.isArray(list.items)) {
          for (const item of list.items) {
            const key = item.variety_id || item.plant_profile_id || item.variety_name;
            if (key && !seen.has(key)) {
              seen.add(key);
              allItems.push({ ...item, source_list: list.name });
            }
          }
        }
      }
      setGrowListItems(allItems);
      
      // Combine seedlings
      const allSeedlings = [
        ...containers.map(c => ({ ...c, source: 'container', type: 'container' })),
        ...trayCells.map(c => ({ ...c, source: 'tray', type: 'cell' }))
      ];
      setSeedlings(allSeedlings);
      
      // Load display names
      await loadDisplayNames([...lots, ...allItems, ...allSeedlings]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoadingSeeds(false);
    }
  };

  const loadDisplayNames = async (items) => {
    const names = {};
    
    // Collect all unique IDs we need to fetch
    const varietyIds = new Set();
    const profileIds = new Set();
    
    for (const item of items) {
      if (item.variety_id) varietyIds.add(item.variety_id);
      if (item.plant_profile_id) profileIds.add(item.plant_profile_id);
    }
    
    // Batch fetch all varieties and profiles at once
    const [varieties, profiles] = await Promise.all([
      varietyIds.size > 0 ? base44.entities.Variety.list() : Promise.resolve([]),
      profileIds.size > 0 ? base44.entities.PlantProfile.list() : Promise.resolve([])
    ]);
    
    const varietyMap = new Map(varieties.map(v => [v.id, v]));
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    
    // Build display names from cached data
    for (const item of items) {
      try {
        if (item.variety_id && varietyMap.has(item.variety_id)) {
          names[item.id] = await getVarietyDisplayName(varietyMap.get(item.variety_id));
        } else if (item.plant_profile_id && profileMap.has(item.plant_profile_id)) {
          names[item.id] = await getVarietyDisplayName(profileMap.get(item.plant_profile_id));
        } else {
          names[item.id] = item.variety_name || item.custom_label || item.name || 'Unknown';
        }
      } catch (error) {
        names[item.id] = item.variety_name || item.custom_label || item.name || 'Unknown';
      }
    }
    
    setDisplayNames(names);
  };

  const handlePlantSeeds = async () => {
    if (!selectedLot) {
      toast.error('Please select a seed');
      return;
    }
    if (selectedCells.length === 0) {
      toast.error('Please select at least one cell');
      return;
    }

    setLoading(true);
    try {
      // Get all cells first to avoid multiple queries
      const allCells = await base44.entities.TrayCell.filter({ tray_id: trayId });
      
      // Load variety/plant type names for caching
      let varietyName = null;
      let plantTypeName = null;
      let plantTypeId = null;
      
      if (selectedLot.variety_id) {
        const varieties = await base44.entities.Variety.filter({ id: selectedLot.variety_id });
        if (varieties.length > 0) {
          varietyName = varieties[0].variety_name;
          plantTypeId = varieties[0].plant_type_id;
          if (plantTypeId) {
            const plantTypes = await base44.entities.PlantType.filter({ id: plantTypeId });
            if (plantTypes.length > 0) {
              plantTypeName = plantTypes[0].common_name;
            }
          }
        }
      } else if (selectedLot.plant_profile_id) {
        const profiles = await base44.entities.PlantProfile.filter({ id: selectedLot.plant_profile_id });
        if (profiles.length > 0) {
          varietyName = profiles[0].custom_label;
          plantTypeId = profiles[0].plant_type_id;
          if (plantTypeId) {
            const plantTypes = await base44.entities.PlantType.filter({ id: plantTypeId });
            if (plantTypes.length > 0) {
              plantTypeName = plantTypes[0].common_name;
            }
          }
        }
      }
      
      // Update selected cells with cached names
      for (const cellNum of selectedCells) {
        const cell = allCells.find(c => c.cell_number === cellNum);
        if (cell) {
          await base44.entities.TrayCell.update(cell.id, {
            user_seed_id: selectedLot.id,
            variety_id: selectedLot.variety_id,
            plant_profile_id: selectedLot.plant_profile_id,
            plant_type_id: plantTypeId,
            variety_name: varietyName,
            plant_type_name: plantTypeName,
            status: 'seeded',
            seeded_date: new Date().toISOString().split('T')[0]
          });
        }
      }

      // Update tray status
      await base44.entities.SeedTray.update(trayId, {
        status: 'seeded',
        start_date: new Date().toISOString().split('T')[0]
      });

      toast.success(`Planted ${selectedCells.length} cells!`);
      onSeedPlanted?.();
      onClose();
      setSelectedCells([]);
      setSelectedLot(null);
    } catch (error) {
      console.error('Error planting seeds:', error);
      toast.error('Failed to plant seeds');
    } finally {
      setLoading(false);
    }
  };

  const filteredLots = seedLots.filter(lot => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return lot.custom_label?.toLowerCase().includes(searchLower) ||
      lot.lot_number?.toLowerCase().includes(searchLower) ||
      displayNames[lot.id]?.toLowerCase().includes(searchLower);
  });

  const filteredGrowList = growListItems.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return item.variety_name?.toLowerCase().includes(searchLower) ||
      item.plant_type?.toLowerCase().includes(searchLower) ||
      displayNames[item.id]?.toLowerCase().includes(searchLower);
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Plant Seeds in {trayName}</DialogTitle>
        </DialogHeader>

        {loadingSeeds ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tabs for Seed Source */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stash">Seed Stash</TabsTrigger>
                <TabsTrigger value="grow-list">Grow Lists</TabsTrigger>
                <TabsTrigger value="seedlings">Seedlings</TabsTrigger>
              </TabsList>

              {/* Seed Stash Tab */}
              <TabsContent value="stash" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Search Seeds</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by name or lot number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {filteredLots.length === 0 ? (
                      <p className="text-sm text-gray-500 p-4 text-center">No seeds in your stash</p>
                    ) : (
                      filteredLots.map(lot => (
                        <button
                          key={lot.id}
                          onClick={() => setSelectedLot({ ...lot, source: 'stash' })}
                          className={`w-full p-3 border rounded-lg text-left transition ${
                            selectedLot?.id === lot.id && selectedLot?.source === 'stash'
                              ? 'border-emerald-600 bg-emerald-50'
                              : 'border-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          <p className="font-medium text-sm">
                            {displayNames[lot.id] || lot.custom_label || 'Unlabeled'}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Lot: {lot.lot_number} • {lot.quantity} {lot.unit}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Grow Lists Tab */}
              <TabsContent value="grow-list" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Search Grow List Items</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by variety or plant type..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {filteredGrowList.length === 0 ? (
                      <p className="text-sm text-gray-500 p-4 text-center">No items in grow lists</p>
                    ) : (
                      filteredGrowList.map((item, idx) => (
                        <button
                         key={`growlist-${item.variety_id || item.plant_profile_id}-${idx}`}
                         onClick={() => setSelectedLot({ ...item, source: 'grow-list' })}
                         className={`w-full p-3 border rounded-lg text-left transition ${
                           selectedLot?.source === 'grow-list' && 
                           (selectedLot?.variety_id === item.variety_id || selectedLot?.plant_profile_id === item.plant_profile_id)
                             ? 'border-emerald-600 bg-emerald-50'
                             : 'border-gray-300 hover:border-emerald-400'
                         }`}
                        >
                         <p className="font-medium text-sm">
                           {item.variety_name || 'Unnamed Variety'}
                         </p>
                         <p className="text-xs text-gray-600 mt-1">
                           from "{item.source_list}"
                         </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Seedlings Tab - Ready to transplant from indoor grow */}
              <TabsContent value="seedlings" className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search seedlings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                  {seedlings.filter(s => 
                    !searchTerm || 
                    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    displayNames[s.id]?.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((seedling, idx) => (
                    <button
                      key={seedling.id || idx}
                      onClick={() => setSelectedLot({ ...seedling, source: 'seedling' })}
                      className={cn(
                        "w-full p-3 border rounded-lg text-left transition",
                        selectedLot?.id === seedling.id && selectedLot?.source === 'seedling'
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-gray-300 hover:border-emerald-400"
                      )}
                    >
                      <p className="font-medium text-sm">
                        {displayNames[seedling.id] || seedling.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {seedling.source === 'container' ? `Container: ${seedling.container_type}` : 'From tray cell'}
                      </p>
                      <Badge variant="outline" className="text-[10px] mt-1">Ready to Transplant</Badge>
                    </button>
                  ))}

                  {seedlings.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-6">
                      No seedlings ready to transplant yet
                    </p>
                  )}
                </div>
              </TabsContent>
              </Tabs>

            {/* Select Cells */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Cells to Plant ({selectedCells.length} selected)
              </label>
              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-3">
                  Click cells to select. Red = selected, Green = already planted.
                </div>
                <TrayCellGrid
                  trayId={trayId}
                  selectedCells={selectedCells}
                  onCellToggle={(cellNum) => {
                    setSelectedCells(prev =>
                      prev.includes(cellNum)
                        ? prev.filter(c => c !== cellNum)
                        : [...prev, cellNum]
                    );
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handlePlantSeeds}
                disabled={loading || !selectedLot || selectedCells.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? 'Planting...' : `Plant ${selectedCells.length} Seeds`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TrayCellGrid({ trayId, selectedCells, onCellToggle }) {
  const [cells, setCells] = useState([]);
  const [tray, setTray] = useState(null);

  useEffect(() => {
    loadData();
  }, [trayId]);

  const loadData = async () => {
    try {
      const [trayData, cellData] = await Promise.all([
        base44.entities.SeedTray.filter({ id: trayId }),
        base44.entities.TrayCell.filter({ tray_id: trayId })
      ]);
      
      if (trayData.length > 0) {
        setTray(trayData[0]);
      }
      setCells(cellData.sort((a, b) => a.cell_number - b.cell_number));
    } catch (error) {
      console.error('Error loading cells:', error);
    }
  };

  if (!tray || cells.length === 0) return <p className="text-gray-500">Loading tray...</p>;

  const cols = tray.cells_cols;
  const rows = tray.cells_rows;

  return (
    <div className="inline-block border border-gray-300 rounded bg-white overflow-auto max-h-80">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex">
          {Array.from({ length: cols }).map((_, col) => {
            const cell = cells.find(c => c.row === row && c.col === col);
            const isSelected = cell && selectedCells.includes(cell.cell_number);

            return (
              <button
                key={`${row}-${col}`}
                onClick={() => cell && onCellToggle(cell.cell_number)}
                disabled={!cell}
                className={`w-8 h-8 border border-gray-200 flex items-center justify-center text-[10px] font-bold transition ${
                  isSelected
                    ? 'bg-red-500 text-white'
                    : cell?.status === 'seeded'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-white hover:bg-gray-100'
                }`}
                title={cell ? `Cell ${cell.cell_number}` : ''}
              >
                {cell?.cell_number}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}