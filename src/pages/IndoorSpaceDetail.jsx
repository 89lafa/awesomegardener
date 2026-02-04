import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { 
  ArrowLeft,
  Plus,
  Loader2,
  Mic,
  MoveHorizontal,
  Edit,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import AIGrowAssistant from '@/components/indoor/AIGrowAssistant';
import GrowLogComponent from '@/components/indoor/GrowLogComponent';
import { AddRackDialog } from '@/components/indoor/AddRackDialog';
import { AddTrayDialog } from '@/components/indoor/AddTrayDialog';
import { AddContainerDialog } from '@/components/indoor/AddContainerDialog';
import { PlantSeedsDialog } from '@/components/indoor/PlantSeedsDialog';
import MoveTrayDialog from '@/components/indoor/MoveTrayDialog';
import { createPageUrl } from '@/utils';

export default function IndoorSpaceDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const spaceId = searchParams.get('id');

  const [space, setSpace] = useState(null);
  const [racks, setRacks] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [trays, setTrays] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [showAddRack, setShowAddRack] = useState(false);
  const [showAddTray, setShowAddTray] = useState(false);
  const [showPlantSeeds, setShowPlantSeeds] = useState(false);
  const [showAddContainer, setShowAddContainer] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [selectedTray, setSelectedTray] = useState(null);
  const [showMoveTray, setShowMoveTray] = useState(false);
  const [trayToMove, setTrayToMove] = useState(null);

  useEffect(() => {
    if (spaceId) {
      loadSpaceData();
    }
  }, [spaceId]);

  const loadSpaceData = async () => {
    try {
      setLoading(true);
      
      const spaceData = await base44.entities.IndoorGrowSpace.filter({ id: spaceId });
      if (spaceData.length === 0) {
        toast.error('Space not found');
        navigate('/IndoorGrowSpaces');
        return;
      }
      
      const space = spaceData[0];
      setSpace(space);

      // Load racks, shelves, trays and containers
      const [racksData, shelvesData, traysData, containersData] = await Promise.all([
        base44.entities.GrowRack.filter({ indoor_space_id: spaceId }, 'name'),
        base44.entities.GrowShelf.filter({}, 'shelf_number'),
        base44.entities.SeedTray.filter({}, 'name'),
        base44.entities.IndoorContainer.filter({ indoor_space_id: spaceId }, 'name')
      ]);

      setRacks(racksData);
      setShelves(shelvesData);
      setTrays(traysData);
      setContainers(containersData);
    } catch (error) {
      console.error('Error loading space:', error);
      toast.error('Failed to load space');
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/IndoorGrowSpaces')}
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
        <Button 
          onClick={() => setShowAI(true)}
          className="bg-purple-600 hover:bg-purple-700 gap-2"
        >
          <Mic className="w-4 h-4" />
          AI Assistant
        </Button>
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
          <p className="text-2xl font-bold text-green-600">🌱 0</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ready to Transplant</p>
          <p className="text-2xl font-bold text-orange-600">0</p>
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
          <Button 
            onClick={() => setShowAddRack(true)}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Rack
          </Button>

          {racks.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600">No racks yet. Click "Add Rack" to create one.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {racks.map(rack => {
                const rackShelves = shelves.filter(s => s.rack_id === rack.id);
                return (
                  <Card key={rack.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{rack.name}</h3>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {rack.width_ft}ft × {rack.depth_ft}ft • {rack.num_shelves} shelves
                        </p>
                        {rack.notes && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {rack.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Shelves */}
                    <div className="space-y-3">
                      {rackShelves.map(shelf => {
                        const shelfTrays = trays.filter(t => t.shelf_id === shelf.id);
                        return (
                          <div key={shelf.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{shelf.name}</h4>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {shelf.width_ft}ft wide • {shelf.max_trays} max trays
                                </p>
                              </div>
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

                            {/* Trays on this shelf */}
                            {shelfTrays.length === 0 ? (
                              <p className="text-xs text-gray-500">No trays yet</p>
                            ) : (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                {shelfTrays.map(tray => (
                                 <div key={tray.id} className="relative group">
                                   <button
                                     onClick={() => {
                                       window.location.href = createPageUrl('TrayDetail') + `?id=${tray.id}`;
                                     }}
                                     className="w-full p-2 bg-white border border-emerald-200 rounded hover:border-emerald-600 transition text-left"
                                   >
                                     <p className="text-xs font-medium text-gray-900">{tray.name}</p>
                                     <p className="text-[10px] text-gray-600">{tray.total_cells} cells</p>
                                     <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                                       {tray.status === 'seeded' ? '🌱 Seeded' : '📋 Empty'}
                                     </p>
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
                  
                return (
                  <Card key={container.id} className="p-4 text-center cursor-pointer hover:shadow-md transition">
                    <p className="text-3xl mb-2">🪴</p>
                    <p className="font-semibold text-sm text-gray-900">{displayName}</p>
                    <p className="text-xs text-gray-600">{container.container_type?.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-emerald-600 mt-2 font-medium">
                      {container.status === 'planted' ? '🌱 Planted' : '📋 Empty'}
                    </p>
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

      {/* Dialogs */}
      {showAI && (
        <AIGrowAssistant 
          onClose={() => setShowAI(false)}
          context={{ space, racks, containers }}
        />
      )}

      <AddRackDialog
        isOpen={showAddRack}
        onClose={() => setShowAddRack(false)}
        spaceId={spaceId}
        onRackAdded={loadSpaceData}
      />

      {selectedShelf && (
        <AddTrayDialog
          isOpen={showAddTray}
          onClose={() => {
            setShowAddTray(false);
            setSelectedShelf(null);
          }}
          shelfId={selectedShelf.id}
          onTrayAdded={loadSpaceData}
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
        isOpen={showAddContainer}
        onClose={() => setShowAddContainer(false)}
        spaceId={spaceId}
        onContainerAdded={loadSpaceData}
      />

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
    </div>
  );
}