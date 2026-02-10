import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Plus,
  Loader2,
  Settings,
  Trash2,
  Grid3x3,
  List,
  Sprout,
  Eye,
  Edit,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import AddRackDialog from '@/components/indoor/AddRackDialog';
import AddTrayDialog from '@/components/indoor/AddTrayDialog';
import AddContainerDialog from '@/components/indoor/AddContainerDialog';
import Rack3DView from '@/components/indoor/Rack3DView';

export default function IndoorGrowSpaceDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const spaceId = searchParams.get('id');
  
  const [space, setSpace] = useState(null);
  const [racks, setRacks] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [trays, setTrays] = useState([]);
  const [trayCells, setTrayCells] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRack, setShowAddRack] = useState(false);
  const [showAddTray, setShowAddTray] = useState(false);
  const [showAddContainer, setShowAddContainer] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRackId, setSelectedRackId] = useState(null);

  useEffect(() => {
    if (spaceId) {
      loadSpaceData();
    }
  }, [spaceId]);

  const loadSpaceData = async () => {
    try {
      setLoading(true);
      const [spaceData, racksData, shelvesData, traysData, cellsData, containersData] = await Promise.all([
        base44.entities.IndoorGrowSpace.filter({ id: spaceId }),
        base44.entities.GrowRack.filter({ indoor_space_id: spaceId }),
        base44.entities.GrowShelf.filter({ indoor_space_id: spaceId }),
        base44.entities.SeedTray.filter({ indoor_space_id: spaceId }),
        base44.entities.TrayCell.filter({ indoor_space_id: spaceId }),
        base44.entities.IndoorContainer.filter({ indoor_space_id: spaceId })
      ]);

      if (spaceData.length === 0) {
        toast.error('Space not found');
        navigate(createPageUrl('IndoorGrowSpaces'));
        return;
      }

      setSpace(spaceData[0]);
      setRacks(racksData);
      setShelves(shelvesData);
      setTrays(traysData);
      setTrayCells(cellsData);
      setContainers(containersData);

      // Auto-select first rack if available
      if (racksData.length > 0 && !selectedRackId) {
        setSelectedRackId(racksData[0].id);
      }
    } catch (error) {
      console.error('Error loading space:', error);
      toast.error('Failed to load space');
    } finally {
      setLoading(false);
    }
  };

  // Calculate active seedlings
  const activeSeedlings = trayCells.filter(cell => 
    cell.status === 'seeded' || cell.status === 'germinated' || cell.status === 'growing'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Space Not Found</h2>
        <Button onClick={() => navigate(createPageUrl('IndoorGrowSpaces'))}>
          Back to Spaces
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(createPageUrl('IndoorGrowSpaces'))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {space.name}
          </h1>
          <p className="text-gray-600 mt-1">
            {space.width_ft}ft × {space.length_ft}ft • {space.space_type === 'room' ? '🏠 Room' : '⛺ Grow Tent'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{racks.length}</p>
            <p className="text-sm text-gray-600">Racks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{trays.length}</p>
            <p className="text-sm text-gray-600">Trays</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{activeSeedlings.length}</p>
            <p className="text-sm text-gray-600">Active Seedlings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{containers.length}</p>
            <p className="text-sm text-gray-600">Containers</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="3d-view">3D View</TabsTrigger>
          <TabsTrigger value="racks">Racks ({racks.length})</TabsTrigger>
          <TabsTrigger value="trays">Trays ({trays.length})</TabsTrigger>
          <TabsTrigger value="seedlings">Seedlings ({activeSeedlings.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Space Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Space Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Dimensions:</span>
                      <span className="font-medium">{space.width_ft}ft × {space.length_ft}ft</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{space.space_type === 'room' ? 'Room' : 'Grow Tent'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Racks:</span>
                      <span className="font-medium">{racks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Trays:</span>
                      <span className="font-medium">{trays.length}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Seedling Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Active Seedlings:</span>
                      <span className="font-medium text-emerald-600">{activeSeedlings.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Seeded:</span>
                      <span className="font-medium">{trayCells.filter(c => c.status === 'seeded').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Germinated:</span>
                      <span className="font-medium">{trayCells.filter(c => c.status === 'germinated').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Growing:</span>
                      <span className="font-medium">{trayCells.filter(c => c.status === 'growing').length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-3">Quick Actions</h4>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setShowAddRack(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rack
                  </Button>
                  <Button onClick={() => setShowAddTray(true)} className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tray
                  </Button>
                  <Button onClick={() => setShowAddContainer(true)} className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Container
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3D View Tab */}
        <TabsContent value="3d-view" className="space-y-4 mt-4">
          {racks.length === 0 ? (
            <Card className="py-16">
              <CardContent className="text-center">
                <Grid3x3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400 mb-2">No Racks Yet</h3>
                <p className="text-gray-600 mb-6">Add your first rack to see the 3D visualization</p>
                <Button onClick={() => setShowAddRack(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Rack
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Rack3DView
              racks={racks}
              shelves={shelves}
              trays={trays}
              selectedRackId={selectedRackId || racks[0].id}
              onSelectRack={setSelectedRackId}
            />
          )}
        </TabsContent>

        {/* Racks Tab */}
        <TabsContent value="racks" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Grow Racks</h3>
            <Button 
              onClick={() => setShowAddRack(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Rack
            </Button>
          </div>

          {racks.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Grid3x3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">No racks yet</p>
                <Button onClick={() => setShowAddRack(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  Add First Rack
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {racks.map(rack => {
                const rackShelves = shelves.filter(s => s.rack_id === rack.id);
                const rackTrays = trays.filter(t => 
                  rackShelves.some(shelf => shelf.id === t.shelf_id)
                );
                return (
                  <Card key={rack.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{rack.name}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRackId(rack.id);
                            setActiveTab('3d-view');
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {rackShelves.length} shelves • {rackTrays.length} trays
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedRackId(rack.id);
                            setActiveTab('3d-view');
                          }}
                        >
                          <Maximize2 className="w-3 h-3 mr-1" />
                          View 3D
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Trays Tab */}
        <TabsContent value="trays" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Seed Trays</h3>
            <Button 
              onClick={() => setShowAddTray(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tray
            </Button>
          </div>

          {trays.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Grid3x3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">No trays yet</p>
                <Button onClick={() => setShowAddTray(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  Add First Tray
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trays.map(tray => {
                const cells = trayCells.filter(c => c.tray_id === tray.id);
                const activeCells = cells.filter(c => 
                  c.status === 'seeded' || c.status === 'germinated' || c.status === 'growing'
                );
                const shelf = shelves.find(s => s.id === tray.shelf_id);
                const rack = shelf ? racks.find(r => r.id === shelf.rack_id) : null;

                return (
                  <Card 
                    key={tray.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(createPageUrl('TrayDetail') + `?id=${tray.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{tray.name || 'Seed Tray'}</h4>
                        {activeCells.length > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-800">
                            <Sprout className="w-3 h-3 mr-1" />
                            {activeCells.length}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {tray.total_cells || 72} cells
                      </p>
                      {rack && (
                        <p className="text-xs text-gray-500 mt-1">
                          📦 {rack.name} • {shelf?.name || 'Shelf'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Seedlings Tab */}
        <TabsContent value="seedlings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Seedlings</CardTitle>
            </CardHeader>
            <CardContent>
              {activeSeedlings.length === 0 ? (
                <div className="text-center py-8">
                  <Sprout className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">No active seedlings</p>
                  <Button onClick={() => setActiveTab('trays')} className="bg-emerald-600 hover:bg-emerald-700">
                    View Trays
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSeedlings.map(cell => {
                    const tray = trays.find(t => t.id === cell.tray_id);
                    const shelf = tray ? shelves.find(s => s.id === tray.shelf_id) : null;
                    const rack = shelf ? racks.find(r => r.id === shelf.rack_id) : null;

                    return (
                      <div 
                        key={cell.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(createPageUrl('TrayDetail') + `?id=${cell.tray_id}`)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Sprout className="w-4 h-4 text-emerald-600" />
                            <span className="font-medium">{cell.variety_name || 'Unknown'}</span>
                            <Badge variant="outline" className="text-xs">
                              {cell.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {rack?.name} • {shelf?.name} • {tray?.name} • Cell {cell.cell_position}
                          </p>
                          {cell.seeded_date && (
                            <p className="text-xs text-gray-500">
                              Seeded: {new Date(cell.seeded_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddRackDialog 
        open={showAddRack}
        onOpenChange={setShowAddRack}
        spaceId={spaceId}
        onSuccess={loadSpaceData}
      />

      <AddTrayDialog 
        open={showAddTray}
        onOpenChange={setShowAddTray}
        spaceId={spaceId}
        onSuccess={loadSpaceData}
      />

      <AddContainerDialog 
        open={showAddContainer}
        onOpenChange={setShowAddContainer}
        spaceId={spaceId}
        onSuccess={loadSpaceData}
      />
    </div>
  );
}