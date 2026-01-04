import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Sprout,
  RefreshCw, 
  Plus, 
  Settings,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import AddPlantDialog from '@/components/garden/AddPlantDialog';

function SpaceCard({ space }) {
  const [plantings, setPlantings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlantPicker, setShowPlantPicker] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    loadPlantings();
  }, [space.id]);

  const loadPlantings = async () => {
    try {
      // Load plantings by plot_item_id since PlantingModal writes to bed_id=plot_item_id
      const plants = await base44.entities.PlantInstance.filter({ 
        bed_id: space.plot_item_id,
        garden_id: space.garden_id
      });
      console.log('[GardenPlanting] Loaded plantings for plot_item_id:', space.plot_item_id, 'count:', plants.length, plants);
      setPlantings(plants);
    } catch (error) {
      console.error('Error loading plantings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (colIdx, rowIdx) => {
    console.log('[PLANTING] clicked spaceId=', space.id, 'cell=', colIdx, rowIdx);
    setSelectedCell({ x: colIdx, y: rowIdx });
    setShowPlantPicker(true);
  };

  const handleAddPlant = () => {
    console.log('[PLANTING] Add plant clicked for space:', space.id);
    setSelectedCell(null);
    setShowPlantPicker(true);
  };

  const handlePlantAdded = () => {
    loadPlantings();
  };

  const isGridSpace = space.layout_schema?.type === 'grid';
  const columns = space.layout_schema?.columns || 1;
  const rows = space.layout_schema?.rows || 1;
  
  // Count OCCUPIED CELLS (not number of plants)
  const filledCount = plantings.reduce((sum, p) => {
    const spanCols = p.cell_span_cols || 1;
    const spanRows = p.cell_span_rows || 1;
    return sum + (spanCols * spanRows);
  }, 0);
  
  const capacity = space.capacity;

  // Create grid cells map - mark ALL cells occupied by each plant
  const cellsMap = {};
  plantings.forEach(p => {
    const col = p.cell_col ?? p.cell_x ?? 0;
    const row = p.cell_row ?? p.cell_y ?? 0;
    const spanCols = p.cell_span_cols || 1;
    const spanRows = p.cell_span_rows || 1;
    
    // Mark all cells this plant occupies
    for (let r = 0; r < spanRows; r++) {
      for (let c = 0; c < spanCols; c++) {
        cellsMap[`${col + c}-${row + r}`] = p;
      }
    }
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{space.name}</CardTitle>
          <Badge variant={filledCount > 0 ? 'default' : 'outline'}>
            {filledCount}/{capacity}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 capitalize">
          {space.space_type.replace(/_/g, ' ')}
        </p>
      </CardHeader>
      <CardContent>
        {isGridSpace ? (
          <div className="space-y-3">
            {/* Grid visualization */}
            <div 
              className="grid gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg"
              style={{
                gridTemplateColumns: `repeat(${columns}, 28px)`,
                gridTemplateRows: `repeat(${rows}, 28px)`,
                width: 'fit-content'
              }}
            >
              {Array.from({ length: rows }).map((_, rowIdx) => 
                Array.from({ length: columns }).map((_, colIdx) => {
                  const plant = cellsMap[`${colIdx}-${rowIdx}`];
                  return (
                    <button
                      key={`${colIdx}-${rowIdx}`}
                      onClick={() => handleCellClick(colIdx, rowIdx)}
                      className={cn(
                        "w-7 h-7 rounded border-2 transition-colors text-xs font-medium flex items-center justify-center cursor-pointer",
                        plant 
                          ? "bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600" 
                          : "bg-white border-amber-300 hover:bg-amber-100 hover:border-amber-400"
                      )}
                      title={plant ? plant.display_name || plant.plant_display_name : 'Click to plant'}
                    >
                      {plant && <span className="text-lg">{plant.plant_type_icon || '🌱'}</span>}
                    </button>
                  );
                })
              )}
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Plants
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Capacity:</span>
              <span className="font-medium">
                {capacity} {space.layout_schema?.type === 'rows' ? 'rows' : 'slots'}
              </span>
            </div>
            {filledCount > 0 && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-700 font-medium">
                  {filledCount} plant{filledCount !== 1 ? 's' : ''} growing
                </p>
              </div>
            )}
            <Button 
              onClick={handleAddPlant}
              className="w-full bg-emerald-600 hover:bg-emerald-700" 
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Plants
            </Button>
          </div>
        )}
      </CardContent>
      
      <AddPlantDialog
        open={showPlantPicker}
        onOpenChange={setShowPlantPicker}
        space={space}
        cellCoords={selectedCell}
        onPlantAdded={handlePlantAdded}
      />
    </Card>
  );
}

export default function GardenPlanting() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [plantingSpaces, setPlantingSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGarden) {
      console.log('[GardenPlanting] Active garden changed, loading spaces...');
      loadPlantingSpaces(); // Load existing spaces first
      syncFromPlotBuilder(true); // Then sync in background
    }
  }, [activeGarden]);

  const loadData = async () => {
    try {
      console.log('[GardenPlanting] Loading data...');
      const [userData, gardensData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Garden.filter({ archived: false }, '-updated_date')
      ]);
      
      setUser(userData);
      setGardens(gardensData);

      if (gardensData.length === 0) {
        setLoading(false);
        return;
      }

      // Select garden
      const urlGardenId = searchParams.get('gardenId');
      let selectedGarden = null;

      if (urlGardenId) {
        selectedGarden = gardensData.find(g => g.id === urlGardenId);
      } else if (userData.active_garden_id) {
        selectedGarden = gardensData.find(g => g.id === userData.active_garden_id);
      } else {
        selectedGarden = gardensData[0];
      }

      console.log('[GardenPlanting] Selected garden:', selectedGarden?.name, selectedGarden?.id);
      setActiveGarden(selectedGarden);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load gardens');
    } finally {
      setLoading(false);
    }
  };

  const loadPlantingSpaces = async () => {
    if (!activeGarden) return;
    
    try {
      console.log('[GardenPlanting] Loading planting spaces for garden:', activeGarden.id);
      const spaces = await base44.entities.PlantingSpace.filter({ 
        garden_id: activeGarden.id,
        is_active: true 
      }, 'name');
      console.log('[GardenPlanting] Found planting spaces:', spaces.length, spaces);
      setPlantingSpaces(spaces);
    } catch (error) {
      console.error('Error loading planting spaces:', error);
    }
  };

  const syncFromPlotBuilder = async (silent = false) => {
    if (!activeGarden) return;
    
    if (!silent) setSyncing(true);
    setSyncResult(null);
    
    try {
      console.log('[SYNC] gardenId=', activeGarden.id);
      
      // Load all plot items for this garden
      const plotItems = await base44.entities.PlotItem.filter({ garden_id: activeGarden.id });
      console.log('[SYNC] found PlotItems:', plotItems.length);
      
      // Load existing planting spaces
      const existingSpaces = await base44.entities.PlantingSpace.filter({ garden_id: activeGarden.id });
      const existingByPlotItem = {};
      existingSpaces.forEach(s => {
        if (s.plot_item_id) existingByPlotItem[s.plot_item_id] = s;
      });
      
      const plantableTypes = ['RAISED_BED', 'IN_GROUND_BED', 'GREENHOUSE', 'OPEN_PLOT', 'GROW_BAG', 'CONTAINER'];
      const plantableItems = plotItems.filter(item => plantableTypes.includes(item.item_type));
      
      console.log('[SYNC] plantable items:', plantableItems.length);
      
      let created = 0;
      let updated = 0;
      let skipped = 0;
      
      for (const item of plantableItems) {
        // Calculate layout schema
        const layoutSchema = calculateLayoutSchema(item);
        const capacity = calculateCapacity(layoutSchema);
        
        const spaceData = {
          garden_id: activeGarden.id,
          plot_item_id: item.id,
          space_type: item.item_type,
          name: item.label,
          capacity,
          layout_schema: layoutSchema,
          is_active: true
        };
        
        if (existingByPlotItem[item.id]) {
          // Update existing
          await base44.entities.PlantingSpace.update(existingByPlotItem[item.id].id, spaceData);
          updated++;
        } else {
          // Create new
          await base44.entities.PlantingSpace.create(spaceData);
          created++;
        }
      }
      
      // Mark spaces as inactive if plot item was deleted
      for (const space of existingSpaces) {
        if (space.plot_item_id && !plotItems.find(pi => pi.id === space.plot_item_id)) {
          await base44.entities.PlantingSpace.update(space.id, { is_active: false });
        }
      }
      
      console.log('[SYNC] upserted PlantingSpaces:', created + updated, '(created:', created, ', updated:', updated, ')');
      console.log('[SYNC] done');
      
      setSyncResult({ created, updated, skipped });
      await loadPlantingSpaces();
      if (!silent) {
        toast.success(`Synced ${created + updated} spaces from layout`);
      }
    } catch (error) {
      console.error('[SYNC] Error:', error);
      if (!silent) {
        toast.error('Sync failed: ' + error.message);
      }
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  const calculateLayoutSchema = (item) => {
    const metadata = item.metadata || {};
    
    if (metadata.gridEnabled) {
      const gridSize = metadata.gridSize || 12;
      return {
        type: 'grid',
        grid_size: gridSize,
        columns: Math.floor(item.width / gridSize),
        rows: Math.floor(item.height / gridSize)
      };
    }
    
    if (item.item_type === 'IN_GROUND_BED' || item.item_type === 'OPEN_PLOT') {
      return {
        type: 'rows',
        rows: metadata.rowCount || Math.floor(item.width / (metadata.rowSpacing || 18)),
        row_spacing: metadata.rowSpacing || 18
      };
    }
    
    if (item.item_type === 'GROW_BAG' || item.item_type === 'CONTAINER') {
      return { type: 'slots', slots: 1 };
    }
    
    if (item.item_type === 'GREENHOUSE') {
      return { type: 'slots', slots: metadata.capacity || 20 };
    }
    
    return { type: 'slots', slots: 10 };
  };

  const calculateCapacity = (layoutSchema) => {
    if (layoutSchema.type === 'grid') {
      return layoutSchema.columns * layoutSchema.rows;
    }
    if (layoutSchema.type === 'rows') {
      return layoutSchema.rows;
    }
    return layoutSchema.slots || 1;
  };

  const handleDeleteGarden = async () => {
    if (!activeGarden) return;
    
    if (!confirm(`Delete "${activeGarden.name}"? This will permanently delete this garden, its items, and all plantings. This cannot be undone.`)) {
      return;
    }
    
    try {
      // Delete all plot items and their plantings
      const plotItems = await base44.entities.PlotItem.filter({ garden_id: activeGarden.id });
      for (const item of plotItems) {
        const plantings = await base44.entities.PlantInstance.filter({ bed_id: item.id });
        for (const planting of plantings) {
          await base44.entities.PlantInstance.delete(planting.id);
        }
        await base44.entities.PlotItem.delete(item.id);
      }
      
      // Delete planting spaces
      const spaces = await base44.entities.PlantingSpace.filter({ garden_id: activeGarden.id });
      for (const space of spaces) {
        await base44.entities.PlantingSpace.delete(space.id);
      }
      
      // Delete plots
      const plots = await base44.entities.GardenPlot.filter({ garden_id: activeGarden.id });
      for (const p of plots) {
        await base44.entities.GardenPlot.delete(p.id);
      }
      
      // Delete garden
      await base44.entities.Garden.delete(activeGarden.id);
      
      // Update UI
      const updatedGardens = gardens.filter(g => g.id !== activeGarden.id);
      setGardens(updatedGardens);
      
      if (updatedGardens.length > 0) {
        setActiveGarden(updatedGardens[0]);
      } else {
        setActiveGarden(null);
      }
      
      toast.success('Garden deleted');
    } catch (error) {
      console.error('Error deleting garden:', error);
      toast.error('Failed to delete garden');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (gardens.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Sprout className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Gardens Yet</h2>
            <p className="text-gray-600 mb-6">
              Create a garden first to start planting
            </p>
            <Link to={createPageUrl('Gardens')}>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="w-4 h-4" />
                Create Garden
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="My Garden Error">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sprout className="w-6 h-6 text-emerald-600" />
            {gardens.length > 1 ? (
              <Select 
                value={activeGarden?.id} 
                onValueChange={(gardenId) => {
                  const garden = gardens.find(g => g.id === gardenId);
                  setActiveGarden(garden);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a garden" />
                </SelectTrigger>
                <SelectContent>
                  {gardens.map((garden) => (
                    <SelectItem key={garden.id} value={garden.id}>
                      {garden.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{activeGarden?.name}</h1>
            )}
          </div>
          <div className="flex gap-2">
            {activeGarden && (
              <Button 
                onClick={handleDeleteGarden}
                variant="outline"
                className="gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
            <Link to={createPageUrl('MyGarden') + `?gardenId=${activeGarden?.id}`}>
              <Button variant="outline" className="gap-2">
                <Settings className="w-4 h-4" />
                Edit Layout
              </Button>
            </Link>
            <Button 
              onClick={() => syncFromPlotBuilder(false)}
              disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh from Layout
            </Button>
          </div>
        </div>

        {/* Sync Result */}
        {syncResult && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription>
              Sync complete! Created {syncResult.created}, updated {syncResult.updated} planting spaces.
            </AlertDescription>
          </Alert>
        )}

        {/* No Spaces State */}
        {plantingSpaces.length === 0 && (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <strong>No planting spaces yet.</strong> Go to Plot Layout to design your garden with beds, 
              greenhouses, and containers. Spaces will appear here automatically.
            </AlertDescription>
          </Alert>
        )}

        {/* Planting Spaces List */}
        {plantingSpaces.length > 0 && (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {plantingSpaces.map((space) => (
              <SpaceCard key={space.id} space={space} />
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}