import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { 
  ArrowLeft,
  Plus,
  Loader2,
  MoveHorizontal,
  Edit,
  FileText,
  Lightbulb,
  List,
  Box,
  Eye,
  Search,
  Sprout
} from 'lucide-react';

// Helper component to show tray status - uses pre-loaded cell data
function TrayStatusBadge({ trayId, trayCells }) {
  const activeCount = trayCells.filter(c => 
    c.tray_id === trayId && ['seeded', 'germinated', 'growing'].includes(c.status)
  ).length;
  
  return (
    <p className={`text-[10px] mt-1 font-bold uppercase ${activeCount === 0 ? 'text-gray-500' : 'text-emerald-600'}`}>
      {activeCount === 0 ? '📭 EMPTY' : '🌱 SEEDED'}
    </p>
  );
}

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import GrowLogComponent from '@/components/indoor/GrowLogComponent';
import AddRackDialog from '@/components/indoor/AddRackDialog';
import EditRackDialog from '@/components/indoor/EditRackDialog';
import EditShelfDialog from '@/components/indoor/EditShelfDialog';
import AddTrayDialog from '@/components/indoor/AddTrayDialog';
import AddContainerDialog from '@/components/indoor/AddContainerDialog';
import { PlantSeedsDialog } from '@/components/indoor/PlantSeedsDialog';
import MoveTrayDialog from '@/components/indoor/MoveTrayDialog';
import { createPageUrl } from '@/utils';
import Rack3DView from '@/components/indoor/Rack3DView';
import PlantDetailModal from '@/components/myplants/PlantDetailModal';

export default function IndoorGrowDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const spaceId = searchParams.get('id');

  const [space, setSpace] = useState(null);
  const [racks, setRacks] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [trays, setTrays] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trayCells, setTrayCells] = useState([]);
  const [showAddRack, setShowAddRack] = useState(false);
  const [showAddTray, setShowAddTray] = useState(false);
  const [showPlantSeeds, setShowPlantSeeds] = useState(false);
  const [showAddContainer, setShowAddContainer] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [selectedTray, setSelectedTray] = useState(null);
  const [showMoveTray, setShowMoveTray] = useState(false);
  const [trayToMove, setTrayToMove] = useState(null);
  const [showEditRack, setShowEditRack] = useState(false);
  const [rackToEdit, setRackToEdit] = useState(null);
  const [showEditShelf, setShowEditShelf] = useState(false);
  const [shelfToEdit, setShelfToEdit] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [selected3DRack, setSelected3DRack] = useState(null);

  // Plant detail modal state for container lifecycle tracking
  const [containerMyPlantMap, setContainerMyPlantMap] = useState({});
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [creatingTracking, setCreatingTracking] = useState(null);

  // Assign seedling to empty container
  const [showAssignSeedling, setShowAssignSeedling] = useState(false);
  const [containerToAssign, setContainerToAssign] = useState(null);
  const [availableSeedlings, setAvailableSeedlings] = useState([]);
  const [loadingSeedlings, setLoadingSeedlings] = useState(false);
  const [customSeedling, setCustomSeedling] = useState({ variety_name: '', plant_type_name: '', notes: '' });

  useEffect(() => {
    if (spaceId) {
      loadSpaceData();
    }
  }, [spaceId]);

  const loadSpaceData = async () => {
    try {
      setLoading(true);
      
      // Load space and racks only first
      const [spaceData, racksData] = await Promise.all([
        base44.entities.IndoorGrowSpace.filter({ id: spaceId }),
        base44.entities.GrowRack.filter({ indoor_space_id: spaceId }, 'name')
      ]);
      
      if (spaceData.length === 0) {
        toast.error('Space not found');
        navigate(createPageUrl('IndoorGrowSpaces'));
        return;
      }
      
      const space = spaceData[0];
      setSpace(space);
      setRacks(racksData);

      // Load shelves and containers in parallel
      const [shelvesData, containersData] = await Promise.all([
        racksData.length > 0 
          ? base44.entities.GrowShelf.filter({ rack_id: { $in: racksData.map(r => r.id) } }, 'shelf_number')
          : Promise.resolve([]),
        base44.entities.IndoorContainer.filter({ indoor_space_id: spaceId }, 'name')
      ]);
      
      setShelves(shelvesData);
      setContainers(containersData);

      // Load MyPlant records linked to these containers via source_tray_cell_id
      await loadContainerPlantLinks(containersData);

      // Load trays only if we have shelves
      if (shelvesData.length > 0) {
        const traysData = await base44.entities.SeedTray.filter(
          { shelf_id: { $in: shelvesData.map(s => s.id) } },
          'name'
        );
        setTrays(traysData);
        
        // Load all tray cells once for status badges
        if (traysData.length > 0) {
          const cellsData = await base44.entities.TrayCell.filter(
            { tray_id: { $in: traysData.map(t => t.id) } }
          );
          setTrayCells(cellsData);
        }
      } else {
        setTrays([]);
        setTrayCells([]);
      }
    } catch (error) {
      console.error('Error loading space:', error);
      toast.error('Failed to load space');
    } finally {
      setLoading(false);
    }
  };

  // Load the MyPlant ↔ IndoorContainer linkage via source_tray_cell_id
  const loadContainerPlantLinks = async (containersData) => {
    try {
      const plantedContainers = containersData.filter(c => c.source_tray_cell_id);
      if (plantedContainers.length === 0) {
        setContainerMyPlantMap({});
        return;
      }

      // Load MyPlant records that share the same source_tray_cell_ids
      const cellIds = plantedContainers.map(c => c.source_tray_cell_id);
      const myPlants = await base44.entities.MyPlant.filter({
        source_tray_cell_id: { $in: cellIds }
      });

      // Build map: container.id -> myPlant.id
      const linkMap = {};
      for (const container of plantedContainers) {
        const linkedPlant = myPlants.find(p => p.source_tray_cell_id === container.source_tray_cell_id);
        if (linkedPlant) {
          linkMap[container.id] = linkedPlant.id;
        }
      }
      setContainerMyPlantMap(linkMap);
    } catch (error) {
      console.error('Error loading plant links:', error);
    }
  };

  // Create a MyPlant record for a legacy container that doesn't have one
  const handleStartTracking = async (container) => {
    setCreatingTracking(container.id);
    try {
      const displayName = container.variety_name && container.plant_type_name
        ? `${container.variety_name} - ${container.plant_type_name}`
        : container.variety_name || container.name;

      const containerTypeLabel = {
        'cup_3.5in': '3.5" Cup',
        'cup_4in': '4" Cup',
        'pot_1gal': '1 Gal Pot',
        'pot_3gal': '3 Gal Pot',
        'grow_bag_5gal': '5 Gal Grow Bag',
        'grow_bag_10gal': '10 Gal Grow Bag'
      }[container.container_type] || container.container_type || 'Container';

      const newPlant = await base44.entities.MyPlant.create({
        plant_profile_id: container.plant_profile_id,
        seed_lot_id: container.user_seed_id,
        variety_id: container.variety_id,
        variety_name: container.variety_name,
        plant_type_id: container.plant_type_id,
        plant_type_name: container.plant_type_name,
        status: 'transplanted',
        location_name: `🏠 ${space?.name || 'Indoor'} - ${containerTypeLabel}`,
        name: displayName,
        source_tray_cell_id: container.source_tray_cell_id,
        transplant_date: container.planted_date || new Date().toISOString().split('T')[0],
        notes: `Indoor container: ${containerTypeLabel} in ${space?.name || 'Indoor Space'}`
      });

      // Fix legacy container status: ready_to_transplant → planted (it's already in a container!)
      if (container.status === 'ready_to_transplant') {
        try {
          await base44.entities.IndoorContainer.update(container.id, { status: 'planted' });
        } catch (err) {
          console.log('Could not update legacy container status:', err);
        }
      }

      // Update local map and open the detail modal
      setContainerMyPlantMap(prev => ({ ...prev, [container.id]: newPlant.id }));
      setSelectedPlantId(newPlant.id);
      // Reload containers so the card reflects updated status
      loadSpaceData();
      toast.success('Tracking started! You can now monitor this plant.');
    } catch (error) {
      console.error('Error creating plant tracking:', error);
      toast.error('Failed to start tracking');
    } finally {
      setCreatingTracking(null);
    }
  };

  // Load available seedlings from ALL trays in this space
  const loadAvailableSeedlings = async () => {
    setLoadingSeedlings(true);
    try {
      const user = await base44.auth.me();
      // Get all tray cells in this space that have seedlings
      const allCells = await base44.entities.TrayCell.filter({ created_by: user.email });
      const trayIds = trays.map(t => t.id);
      const seedlingCells = allCells.filter(c => 
        trayIds.includes(c.tray_id) && 
        ['seeded', 'germinated', 'growing'].includes(c.status) &&
        (c.variety_name || c.plant_type_name)
      );
      setAvailableSeedlings(seedlingCells);
    } catch (error) {
      console.error('Error loading seedlings:', error);
    } finally {
      setLoadingSeedlings(false);
    }
  };

  // Assign a seedling (from tray or custom) to an empty container
  const handleAssignSeedling = async (seedlingCell) => {
    if (!containerToAssign) return;
    try {
      const now = new Date();
      now.setHours(now.getHours() - 5);
      const adjustedDate = now.toISOString().split('T')[0];

      const containerTypeLabel = {
        'cup_3.5in': '3.5" Cup', 'cup_4in': '4" Cup',
        'pot_1gal': '1 Gal Pot', 'pot_3gal': '3 Gal Pot',
        'grow_bag_5gal': '5 Gal Grow Bag', 'grow_bag_10gal': '10 Gal Grow Bag'
      }[containerToAssign.container_type] || containerToAssign.container_type || 'Container';

      // Update the container with plant info
      await base44.entities.IndoorContainer.update(containerToAssign.id, {
        variety_id: seedlingCell.variety_id || null,
        variety_name: seedlingCell.variety_name,
        plant_type_id: seedlingCell.plant_type_id || null,
        plant_type_name: seedlingCell.plant_type_name,
        plant_profile_id: seedlingCell.plant_profile_id || null,
        user_seed_id: seedlingCell.user_seed_id || null,
        source_tray_cell_id: seedlingCell.id || null,
        status: 'planted',
        planted_date: adjustedDate
      });

      // Create MyPlant for tracking
      const displayName = seedlingCell.variety_name && seedlingCell.plant_type_name
        ? `${seedlingCell.variety_name} - ${seedlingCell.plant_type_name}`
        : seedlingCell.variety_name || seedlingCell.plant_type_name || 'Unknown';

      const newPlant = await base44.entities.MyPlant.create({
        plant_profile_id: seedlingCell.plant_profile_id || null,
        seed_lot_id: seedlingCell.user_seed_id || null,
        variety_id: seedlingCell.variety_id || null,
        variety_name: seedlingCell.variety_name,
        plant_type_id: seedlingCell.plant_type_id || null,
        plant_type_name: seedlingCell.plant_type_name,
        status: 'transplanted',
        location_name: `🏠 ${space?.name || 'Indoor'} - ${containerTypeLabel}`,
        name: displayName,
        source_tray_cell_id: seedlingCell.id || null,
        transplant_date: adjustedDate,
        notes: `Indoor container: ${containerTypeLabel} in ${space?.name || 'Indoor Space'}`
      });

      // If from a tray cell, mark it as transplanted
      if (seedlingCell.tray_id) {
        await base44.entities.TrayCell.update(seedlingCell.id, {
          status: 'transplanted',
          transplanted_date: adjustedDate
        });
      }

      setContainerMyPlantMap(prev => ({ ...prev, [containerToAssign.id]: newPlant.id }));
      setShowAssignSeedling(false);
      setContainerToAssign(null);
      setCustomSeedling({ variety_name: '', plant_type_name: '', notes: '' });
      loadSpaceData();
      toast.success(`${displayName} planted in ${containerTypeLabel}!`);
    } catch (error) {
      console.error('Error assigning seedling:', error);
      toast.error('Failed to assign seedling');
    }
  };

  // Assign custom seedling (manual entry, e.g., bought at Home Depot)
  const handleAssignCustomSeedling = async () => {
    if (!customSeedling.variety_name && !customSeedling.plant_type_name) {
      toast.error('Please enter at least a variety name or plant type');
      return;
    }
    // Create a "fake" cell object with the custom data
    await handleAssignSeedling({
      variety_name: customSeedling.variety_name || null,
      plant_type_name: customSeedling.plant_type_name || null,
      variety_id: null,
      plant_type_id: null,
      plant_profile_id: null,
      user_seed_id: null,
      id: null,
      tray_id: null // not from tray
    });
  };

  // Handle container card click
  const handleContainerClick = (container) => {
    const myPlantId = containerMyPlantMap[container.id];
    if (myPlantId) {
      // Has a linked MyPlant — open the detail modal
      setSelectedPlantId(myPlantId);
    } else if (container.status === 'empty' || !container.variety_name) {
      // Empty container — open assign seedling dialog
      setContainerToAssign(container);
      setShowAssignSeedling(true);
      loadAvailableSeedlings();
    } else {
      // Planted but no MyPlant yet (legacy) — offer to start tracking
      handleStartTracking(container);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="text-center py-12">
        <p>Space not found</p>
      </div>
    );
  }

  // Count active seedlings across all containers
  const activeSeedlingCount = containers.filter(c => 
    ['planted', 'growing'].includes(c.status)
  ).length;
  const readyToTransplantCount = containers.filter(c => c.status === 'ready_to_transplant').length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(createPageUrl('IndoorGrowSpaces'))}
            className="h-auto p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{space.name}</h1>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              {space.width_ft}ft × {space.length_ft}ft • {space.space_type === 'room' ? '🏠 Room' : '⛺ Tent'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Racks</p>
          <p className="text-2xl font-bold text-emerald-600">{racks.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Containers</p>
          <p className="text-2xl font-bold text-blue-600">🪴 {containers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Active Seedlings</p>
          <p className="text-2xl font-bold text-green-600">🌱 {activeSeedlingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ready to Transplant</p>
          <p className="text-2xl font-bold text-orange-600">{readyToTransplantCount}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="racks">
        <TabsList>
          <TabsTrigger value="racks">Racks & Shelves</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="log">Grow Log</TabsTrigger>
        </TabsList>

        <TabsContent value="racks" className="space-y-4">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Button 
              onClick={() => setShowAddRack(true)}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Rack
            </Button>
            
            {racks.length > 0 && (
              <div className="hidden md:flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
                <button
                  onClick={() => {
                    setViewMode('list');
                    setSelected3DRack(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <List size={18} />
                  List View
                </button>
                
                <button
                  onClick={() => {
                    setViewMode('3d');
                    if (!selected3DRack) {
                      setSelected3DRack(racks[0].id);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === '3d'
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Box size={18} />
                  3D View
                </button>
              </div>
            )}
          </div>

          {racks.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600">No racks yet. Click "Add Rack" to create one.</p>
            </Card>
          ) : viewMode === 'list' || window.innerWidth < 768 ? (
            <div className="space-y-4">
              {racks.map(rack => {
                const rackShelves = shelves.filter(s => s.rack_id === rack.id);
                return (
                  <Card key={rack.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{rack.name}</h3>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {rack.width_ft}ft × {rack.depth_ft}ft • {rack.num_shelves} shelves
                        </p>
                        {(rack.temperature || rack.humidity) && (
                          <p className="text-sm mt-1 font-medium text-blue-700">
                            {rack.temperature && `${rack.temperature}°F`}
                            {rack.temperature && rack.humidity && ' • '}
                            {rack.humidity && `${rack.humidity}% humidity`}
                          </p>
                        )}
                        {rack.notes && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {rack.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRackToEdit(rack);
                          setShowEditRack(true);
                        }}
                        className="gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </Button>
                    </div>

                    {/* Shelves */}
                    <div className="space-y-3">
                      {rackShelves.map(shelf => {
                        const shelfTrays = trays.filter(t => t.shelf_id === shelf.id);
                        return (
                          <div key={shelf.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                           <div className="flex items-start justify-between mb-2">
                             <div className="flex-1">
                               <div className="flex items-center gap-2">
                                 <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{shelf.name}</h4>
                                 {shelf.light_wattage && (
                                   <span className="text-xs font-medium text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                                     <Lightbulb className="w-3 h-3" />
                                     {shelf.light_wattage}W
                                   </span>
                                 )}
                               </div>
                               <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                 {shelf.width_ft}ft wide • {shelf.max_trays} max trays{shelf.light_hours_per_day ? ` • ${shelf.light_hours_per_day}hrs/day light` : ''}
                               </p>
                             </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setShelfToEdit(shelf);
                                    setShowEditShelf(true);
                                  }}
                                  className="gap-1"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedShelf(shelf);
                                    setShowAddTray(true);
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700 gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add Tray
                                </Button>
                              </div>
                            </div>

                            {/* Trays on this shelf */}
                            {shelfTrays.length === 0 ? (
                              <p className="text-xs text-gray-500">No trays yet</p>
                            ) : (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                {shelfTrays.map(tray => (
                                 <div key={tray.id} className="relative group">
                                  <button
                                   onClick={async () => {
                                     window.location.href = createPageUrl('TrayDetail') + `?id=${tray.id}`;
                                   }}
                                   className="w-full p-2 bg-white border border-emerald-200 rounded hover:border-emerald-600 transition text-left"
                                  >
                                   <p className="text-xs font-medium text-gray-900">{tray.name}</p>
                                   <p className="text-[10px] text-gray-600">{tray.total_cells} cells</p>
                                   <TrayStatusBadge trayId={tray.id} trayCells={trayCells} />
                                   {tray.notes && (
                                     <p className="text-[9px] text-gray-500 mt-1 truncate">📝 {tray.notes}</p>
                                   )}
                                  </button>
                                   <Button
                                     size="sm"
                                     variant="ghost"
                                     className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setTrayToMove(tray);
                                       setShowMoveTray(true);
                                     }}
                                   >
                                     <MoveHorizontal className="w-3 h-3" />
                                   </Button>
                                 </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Rack3DView
              racks={racks}
              shelves={shelves}
              trays={trays}
              selectedRackId={selected3DRack}
              onSelectRack={setSelected3DRack}
            />
          )}
        </TabsContent>

        <TabsContent value="containers" className="space-y-4">
          <Button 
            onClick={() => setShowAddContainer(true)}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Container
          </Button>

          {containers.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600">No containers yet</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {containers.map(container => {
                const displayName = container.variety_name && container.plant_type_name 
                  ? `${container.variety_name} - ${container.plant_type_name}`
                  : container.variety_name || container.name;
                
                const hasTracking = !!containerMyPlantMap[container.id];
                const isPlanted = container.status !== 'empty';
                const isCreatingThis = creatingTracking === container.id;

                const containerTypeLabel = {
                  'cup_3.5in': '3.5" Cup',
                  'cup_4in': '4" Cup',
                  'pot_1gal': '1 Gal Pot',
                  'pot_3gal': '3 Gal Pot',
                  'grow_bag_5gal': '5 Gal Grow Bag',
                  'grow_bag_10gal': '10 Gal Grow Bag'
                }[container.container_type] || container.container_type?.replace(/_/g, ' ');
                  
                return (
                  <Card 
                    key={container.id} 
                    className={`p-4 text-center transition group cursor-pointer ${
                      isPlanted 
                        ? 'hover:shadow-lg hover:border-emerald-400' 
                        : 'hover:shadow-lg hover:border-blue-400'
                    }`}
                    onClick={() => handleContainerClick(container)}
                  >
                    {/* Status indicator */}
                    {isPlanted && (
                      <div className="flex justify-end mb-1">
                        {hasTracking ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0">
                            📊 Tracked
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0">
                            Tap to track
                          </Badge>
                        )}
                      </div>
                    )}

                    {!isPlanted && (
                      <div className="flex justify-end mb-1">
                        <Badge className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0">
                          <Sprout className="w-2.5 h-2.5 mr-1 inline" />
                          Tap to plant
                        </Badge>
                      </div>
                    )}

                    <p className="text-3xl mb-2">🪴</p>
                    <p className="font-semibold text-sm text-gray-900">{displayName}</p>
                    <p className="text-xs text-gray-600">{containerTypeLabel}</p>
                    
                    {container.status === 'planted' && (
                      <p className="text-[10px] text-emerald-600 mt-2 font-medium">
                        🌱 Planted
                      </p>
                    )}
                    {container.status === 'growing' && (
                      <p className="text-[10px] text-green-600 mt-2 font-medium">
                        🌿 Growing
                      </p>
                    )}
                    {container.status === 'ready_to_transplant' && (
                      <p className="text-[10px] text-orange-600 mt-2 font-medium">
                        📦 Ready to Transplant
                      </p>
                    )}

                    {container.planted_date && (
                      <p className="text-[9px] text-gray-400 mt-1">
                        Since {container.planted_date}
                      </p>
                    )}

                    {/* Loading indicator for "Start Tracking" */}
                    {isCreatingThis && (
                      <div className="mt-2 flex items-center justify-center gap-1 text-xs text-emerald-600">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Starting tracking...
                      </div>
                    )}

                    {/* Hover hint */}
                    {!isCreatingThis && (
                      <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-emerald-600 flex items-center justify-center gap-1">
                          <Eye className="w-3 h-3" />
                          {!isPlanted ? 'Plant Seedling' : hasTracking ? 'View Details' : 'Start Tracking'}
                        </span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="log">
          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">Space Activity</h3>
                <GrowLogComponent targetId={spaceId} targetType="indoor_space_id" />
              </div>
              
              <div className="border-t pt-6">
                <h3 className="font-semibold text-lg mb-3">Tray Activity</h3>
                <div className="space-y-4">
                  {trays.map(tray => (
                    <div key={tray.id}>
                      <p className="text-sm font-medium text-emerald-700 mb-2">📋 {tray.name}</p>
                      <div className="ml-4 border-l-2 border-emerald-200 pl-4">
                        <GrowLogComponent targetId={tray.id} targetType="tray_id" compact />
                      </div>
                    </div>
                  ))}
                  {trays.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No trays in this space yet</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plant Detail Modal — shared with MyPlants page */}
      <PlantDetailModal
        plantId={selectedPlantId}
        open={!!selectedPlantId}
        onOpenChange={(open) => {
          if (!open) setSelectedPlantId(null);
        }}
        onUpdate={() => {
          // Refresh container data when plant is updated
          loadSpaceData();
        }}
      />

      {/* Dialogs */}
      <AddRackDialog
        open={showAddRack}
        onOpenChange={setShowAddRack}
        spaceId={spaceId}
        onSuccess={loadSpaceData}
      />

      {selectedShelf && (
        <AddTrayDialog
          open={showAddTray}
          onOpenChange={(open) => {
            setShowAddTray(open);
            if (!open) setSelectedShelf(null);
          }}
          spaceId={spaceId}
          shelfId={selectedShelf.id}
          onSuccess={loadSpaceData}
        />
      )}

      {selectedTray && (
        <PlantSeedsDialog
          isOpen={showPlantSeeds}
          onClose={() => {
            setShowPlantSeeds(false);
            setSelectedTray(null);
          }}
          trayId={selectedTray.id}
          trayName={selectedTray.name}
          onSeedPlanted={loadSpaceData}
        />
      )}

      <AddContainerDialog
        open={showAddContainer}
        onOpenChange={setShowAddContainer}
        spaceId={spaceId}
        onSuccess={loadSpaceData}
      />

      {/* Assign Seedling to Container Dialog */}
      <Dialog open={showAssignSeedling} onOpenChange={(open) => {
        setShowAssignSeedling(open);
        if (!open) {
          setContainerToAssign(null);
          setCustomSeedling({ variety_name: '', plant_type_name: '', notes: '' });
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Plant Seedling in {containerToAssign ? ({
                'cup_3.5in': '3.5" Cup', 'cup_4in': '4" Cup',
                'pot_1gal': '1 Gal Pot', 'pot_3gal': '3 Gal Pot',
                'grow_bag_5gal': '5 Gal Grow Bag', 'grow_bag_10gal': '10 Gal Grow Bag'
              }[containerToAssign.container_type] || containerToAssign.container_type) : 'Container'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="from-tray">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="from-tray">From Seed Tray</TabsTrigger>
              <TabsTrigger value="custom">Custom / Store-Bought</TabsTrigger>
            </TabsList>

            {/* From Tray Tab */}
            <TabsContent value="from-tray" className="space-y-3">
              {loadingSeedlings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                </div>
              ) : availableSeedlings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">No seedlings in your trays right now</p>
                  <p className="text-gray-400 text-xs mt-1">Plant seeds in trays first, or use Custom tab</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2">
                  <p className="text-xs text-gray-500 mb-2">
                    {availableSeedlings.length} seedling{availableSeedlings.length !== 1 ? 's' : ''} available from trays in this space
                  </p>
                  {availableSeedlings.map((cell, idx) => {
                    const name = cell.variety_name && cell.plant_type_name 
                      ? `${cell.variety_name} - ${cell.plant_type_name}`
                      : cell.variety_name || cell.plant_type_name || 'Unknown';
                    
                    const tray = trays.find(t => t.id === cell.tray_id);
                    
                    return (
                      <button
                        key={cell.id || idx}
                        onClick={() => handleAssignSeedling(cell)}
                        className="w-full p-3 border rounded-lg text-left transition hover:border-emerald-500 hover:bg-emerald-50"
                      >
                        <p className="font-medium text-sm">{name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px]">{cell.status}</Badge>
                          {tray && <span className="text-[10px] text-gray-500">from {tray.name}</span>}
                          <span className="text-[10px] text-gray-400">Cell #{cell.cell_number}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Custom / Store-Bought Tab */}
            <TabsContent value="custom" className="space-y-4">
              <p className="text-sm text-gray-600">
                Add a plant you bought at a store, received from a friend, or want to track without a seed record.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Variety Name *</label>
                  <Input
                    placeholder="e.g., Early Girl, Carolina Reaper..."
                    value={customSeedling.variety_name}
                    onChange={(e) => setCustomSeedling(prev => ({ ...prev, variety_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Plant Type</label>
                  <Input
                    placeholder="e.g., Tomato, Pepper, Basil..."
                    value={customSeedling.plant_type_name}
                    onChange={(e) => setCustomSeedling(prev => ({ ...prev, plant_type_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                  <Input
                    placeholder="e.g., Bought at Home Depot, 6-inch pot..."
                    value={customSeedling.notes}
                    onChange={(e) => setCustomSeedling(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <Button
                onClick={handleAssignCustomSeedling}
                disabled={!customSeedling.variety_name && !customSeedling.plant_type_name}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <Sprout className="w-4 h-4 mr-2" />
                Plant in Container
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {trayToMove && (
        <MoveTrayDialog
          isOpen={showMoveTray}
          onClose={() => {
            setShowMoveTray(false);
            setTrayToMove(null);
          }}
          tray={trayToMove}
          onMoved={() => {
            loadSpaceData();
            setShowMoveTray(false);
            setTrayToMove(null);
          }}
        />
      )}

      {rackToEdit && (
        <EditRackDialog
          isOpen={showEditRack}
          onClose={() => {
            setShowEditRack(false);
            setRackToEdit(null);
          }}
          rack={rackToEdit}
          onRackUpdated={() => {
            loadSpaceData();
            setShowEditRack(false);
            setRackToEdit(null);
          }}
          onRackDeleted={() => {
            loadSpaceData();
            setShowEditRack(false);
            setRackToEdit(null);
          }}
        />
      )}

      {shelfToEdit && (
        <EditShelfDialog
          isOpen={showEditShelf}
          onClose={() => {
            setShowEditShelf(false);
            setShelfToEdit(null);
          }}
          shelf={shelfToEdit}
          onShelfUpdated={() => {
            loadSpaceData();
            setShowEditShelf(false);
            setShelfToEdit(null);
          }}
        />
      )}
    </div>
  );
}
