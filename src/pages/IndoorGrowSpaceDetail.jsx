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
  List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import AddRackDialog from '@/components/indoor/AddRackDialog';
import AddTrayDialog from '@/components/indoor/AddTrayDialog';
import AddContainerDialog from '@/components/indoor/AddContainerDialog';

export default function IndoorGrowSpaceDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const spaceId = searchParams.get('id');
  
  const [space, setSpace] = useState(null);
  const [racks, setRacks] = useState([]);
  const [trays, setTrays] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRack, setShowAddRack] = useState(false);
  const [showAddTray, setShowAddTray] = useState(false);
  const [showAddContainer, setShowAddContainer] = useState(false);
  const [activeTab, setActiveTab] = useState('racks');

  useEffect(() => {
    if (spaceId) {
      loadSpaceData();
    }
  }, [spaceId]);

  const loadSpaceData = async () => {
    try {
      setLoading(true);
      const [spaceData, racksData, traysData, containersData] = await Promise.all([
        base44.entities.IndoorGrowSpace.filter({ id: spaceId }),
        base44.entities.GrowRack.filter({ indoor_space_id: spaceId }),
        base44.entities.SeedTray.filter({ indoor_space_id: spaceId }),
        base44.entities.IndoorContainer.filter({ indoor_space_id: spaceId })
      ]);

      if (spaceData.length === 0) {
        toast.error('Space not found');
        navigate(createPageUrl('IndoorGrowSpaces'));
        return;
      }

      setSpace(spaceData[0]);
      setRacks(racksData);
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
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Space Not Found</h2>
        <Button onClick={() => navigate(createPageUrl('IndoorGrowSpaces'))}>
          Back to Spaces
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
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
      <div className="grid grid-cols-3 gap-4">
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
            <p className="text-2xl font-bold text-orange-600">{containers.length}</p>
            <p className="text-sm text-gray-600">Containers</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="racks" className="flex-1">Racks ({racks.length})</TabsTrigger>
          <TabsTrigger value="trays" className="flex-1">Trays ({trays.length})</TabsTrigger>
          <TabsTrigger value="containers" className="flex-1">Containers ({containers.length})</TabsTrigger>
        </TabsList>

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
              {racks.map(rack => (
                <Card key={rack.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <h4 className="font-semibold">{rack.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {rack.shelves_count || 0} shelves • {rack.width_inches}" wide
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => toast.info('Rack detail view coming soon')}
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

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
              {trays.map(tray => (
                <Card 
                  key={tray.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(createPageUrl('TrayDetail') + `?id=${tray.id}`)}
                >
                  <CardContent className="p-4">
                    <h4 className="font-semibold">{tray.label || 'Seed Tray'}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {tray.tray_size_cells || 0} cells
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {tray.location_shelf || 'No shelf'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="containers" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Individual Containers</h3>
            <Button 
              onClick={() => setShowAddContainer(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Container
            </Button>
          </div>

          {containers.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">No containers yet</p>
                <Button onClick={() => setShowAddContainer(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  Add First Container
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {containers.map(container => (
                <Card key={container.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <h4 className="font-semibold">{container.label || 'Container'}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {container.container_size_gallons || 0} gal • {container.status}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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