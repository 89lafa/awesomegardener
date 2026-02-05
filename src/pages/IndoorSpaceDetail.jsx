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
import { cn } from '@/lib/utils';
import AIGrowAssistant from '@/components/indoor/AIGrowAssistant';
import GrowLogComponent from '@/components/indoor/GrowLogComponent';
import { AddRackDialog } from '@/components/indoor/AddRackDialog';
import { AddTrayDialog } from '@/components/indoor/AddTrayDialog';
import { AddContainerDialog } from '@/components/indoor/AddContainerDialog';
import { PlantSeedsDialog } from '@/components/indoor/PlantSeedsDialog';
import MoveTrayDialog from '@/components/indoor/MoveTrayDialog';
import { createPageUrl } from '@/utils';

// Tray card - stats passed from parent to avoid N+1 queries
function TrayCard({ tray, stats, onMove }) {
  const navigate = useNavigate();

  const getStatusColor = () => {
    if (stats.loading) return 'bg-gray-100 border-gray-300';
    const fillPercent = (stats.filled / stats.total) * 100;
    if (fillPercent === 0) return 'bg-gray-50 border-gray-300';
    if (fillPercent < 50) return 'bg-red-50 border-red-300';
    if (fillPercent < 90) return 'bg-yellow-50 border-yellow-300';
    return 'bg-green-50 border-green-300';
  };

  const getStatusIndicator = () => {
    if (stats.loading) return '⏳';
    const fillPercent = (stats.filled / stats.total) * 100;
    if (fillPercent === 0) return '⬜';
    if (fillPercent < 50) return '🔴';
    if (fillPercent < 90) return '🟡';
    if (fillPercent === 100) return '🟢';
    return '🟢';
  };

  const handleTrayClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('[TRAY CLICK] Navigating to tray:', tray.id, tray.name);
    const url = `${createPageUrl('TrayDetail')}?id=${tray.id}`;
    console.log('[TRAY CLICK] URL:', url);
    navigate(url);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleTrayClick}
        className={cn(
          "w-full p-3 border-2 rounded-lg transition-all text-left hover:shadow-md",
          getStatusColor()
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-bold text-gray-900">{tray.name}</p>
          <span className="text-base">{getStatusIndicator()}</span>
        </div>
        <p className="text-[10px] text-gray-600">{tray.insert_type}</p>
        <div className="mt-2 flex items-center gap-1">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${stats.loading ? 0 : (stats.filled / stats.total * 100)}%` }}
            />
          </div>
          <span className="text-[9px] font-medium text-gray-700">
            {stats.loading ? '...' : `${stats.filled}/${stats.total}`}
          </span>
        </div>
      </button>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition"
        onClick={(e) => {
          e.stopPropagation();
          onMove();
        }}
      >
        <MoveHorizontal className="w-3 h-3" />
      </Button>
    </div>
  );
}

// Stats component with real-time counts
function StatsCards({ racks, trays, containers }) {
  const [stats, setStats] = useState({
    activeSeedlings: 0,
    readyToTransplant: 0,
    totalCells: 0,
    loading: true
  });

  useEffect(() => {
    calculateStats();
  }, [trays, containers]);

  const calculateStats = async () => {
    try {
      let activeSeedlings = 0;
      let readyToTransplant = 0;
      let totalCells = 0;

      if (trays.length > 0) {
        // Fetch ALL cells for ALL trays in ONE query to avoid rate limits
        const trayIds = trays.map(t => t.id);
        const allCells = await base44.entities.TrayCell.filter({ 
          tray_id: { $in: trayIds }
        });

        totalCells = allCells.length;
        activeSeedlings = allCells.filter(c => 
          c.status === 'seeded' || c.status === 'germinated' || c.status === 'growing'
        ).length;
        readyToTransplant = allCells.filter(c => c.status === 'growing').length;
      }

      // Count containers ready to transplant
      readyToTransplant += containers.filter(c => c.status === 'ready_to_transplant').length;

      setStats({ activeSeedlings, readyToTransplant, totalCells, loading: false });
    } catch (error) {
      console.error('Error calculating stats:', error);
      setStats({ activeSeedlings: 0, readyToTransplant: 0, totalCells: 0, loading: false });
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <p className="text-sm text-gray-600">Racks</p>
        <p className="text-2xl font-bold text-purple-600">{racks.length}</p>
      </Card>
      <Card className="p-4">
        <p className="text-sm text-gray-600">Trays</p>
        <p className="text-2xl font-bold text-blue-600">📋 {trays.length}</p>
      </Card>
      <Card className="p-4">
        <p className="text-sm text-gray-600">Active Seedlings</p>
        <p className="text-2xl font-bold text-green-600">
          {stats.loading ? '...' : `🌱 ${stats.activeSeedlings}`}
        </p>
      </Card>
      <Card className="p-4">
        <p className="text-sm text-gray-600">Ready to Move</p>
        <p className="text-2xl font-bold text-orange-600">
          {stats.loading ? '...' : `🔄 ${stats.readyToTransplant}`}
        </p>
      </Card>
    </div>
  );
}

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
  const [trayStats, setTrayStats] = useState({});

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

      // Load racks for this space
      const racksData = await base44.entities.GrowRack.filter({ indoor_space_id: spaceId }, 'name');
      
      // Load all shelves for these racks
      const rackIds = racksData.map(r => r.id);
      const shelvesData = rackIds.length > 0 
        ? await base44.entities.GrowShelf.filter({ rack_id: { $in: rackIds } }, 'shelf_number')
        : [];
      
      // Load all trays for these shelves OR directly in this space
      const shelfIds = shelvesData.map(s => s.id);
      const traysData = await base44.entities.SeedTray.filter({
        $or: [
          { shelf_id: { $in: shelfIds } },
          { indoor_space_id: spaceId }
        ]
      }, 'name');
      
      // Load containers in this space
      const containersData = await base44.entities.IndoorContainer.filter({ indoor_space_id: spaceId }, 'name');

      setRacks(racksData);
      setShelves(shelvesData);
      setTrays(traysData);
      setContainers(containersData);

      // Load ALL tray stats in one batch to avoid rate limits
      if (traysData.length > 0) {
        loadAllTrayStats(traysData);
      }
    } catch (error) {
      console.error('Error loading space:', error);
      toast.error('Failed to load space');
    } finally {
      setLoading(false);
    }
  };

  const loadAllTrayStats = async (traysData) => {
    try {
      const trayIds = traysData.map(t => t.id);
      
      // Fetch ALL cells for ALL trays in ONE query
      const allCells = await base44.entities.TrayCell.filter({ 
        tray_id: { $in: trayIds }
      });

      // Group cells by tray_id
      const statsByTray = {};
      traysData.forEach(tray => {
        const trayCells = allCells.filter(c => c.tray_id === tray.id);
        const filled = trayCells.filter(c => 
          c.status !== 'empty' && c.status !== 'failed' && c.status !== 'transplanted'
        ).length;
        statsByTray[tray.id] = {
          filled,
          total: trayCells.length || tray.total_cells,
          loading: false
        };
      });

      setTrayStats(statsByTray);
    } catch (error) {
      console.error('Error loading tray stats:', error);
      // Set default stats on error
      const defaultStats = {};
      traysData.forEach(tray => {
        defaultStats[tray.id] = { filled: 0, total: tray.total_cells, loading: false };
      });
      setTrayStats(defaultStats);
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
      <StatsCards racks={racks} trays={trays} containers={containers} />

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
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-2">
                                {shelfTrays.map(tray => (
                                 <TrayCard 
                                   key={tray.id} 
                                   tray={tray}
                                   stats={trayStats[tray.id] || { filled: 0, total: tray.total_cells, loading: true }}
                                   onMove={() => {
                                     setTrayToMove(tray);
                                     setShowMoveTray(true);
                                   }}
                                 />
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