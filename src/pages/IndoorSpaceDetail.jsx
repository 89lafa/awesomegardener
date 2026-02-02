import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { 
  ArrowLeft,
  Plus,
  Loader2,
  Mic
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import AIGrowAssistant from '@/components/indoor/AIGrowAssistant';
import GrowLogComponent from '@/components/indoor/GrowLogComponent';

export default function IndoorSpaceDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const spaceId = searchParams.get('id');

  const [space, setSpace] = useState(null);
  const [racks, setRacks] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);

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

      // Load racks and containers
      const [racksData, containersData] = await Promise.all([
        base44.entities.GrowRack.filter({ indoor_space_id: spaceId }, 'name'),
        base44.entities.IndoorContainer.filter({ indoor_space_id: spaceId }, 'name')
      ]);

      setRacks(racksData);
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
            <h1 className="text-3xl font-bold text-gray-900">{space.name}</h1>
            <p className="text-gray-600 mt-1">
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
          <p className="text-sm text-gray-600">Racks</p>
          <p className="text-2xl font-bold text-emerald-600">{racks.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Containers</p>
          <p className="text-2xl font-bold text-blue-600">🪴 {containers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Active Seedlings</p>
          <p className="text-2xl font-bold text-green-600">🌱 0</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Ready to Transplant</p>
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
            onClick={async () => {
              const rackName = prompt('Rack name (e.g., Rack 1):');
              if (!rackName) return;
              
              try {
                const newRack = await base44.entities.GrowRack.create({
                  indoor_space_id: spaceId,
                  name: rackName,
                  width_ft: 6,
                  depth_ft: 3,
                  height_ft: 6,
                  num_shelves: 4
                });
                setRacks([...racks, newRack]);
                toast.success('Rack added!');
              } catch (error) {
                toast.error('Failed to add rack');
              }
            }}
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
            racks.map(rack => (
              <Card key={rack.id} className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{rack.name}</h3>
                <p className="text-sm text-gray-600">
                  {rack.width_ft}ft × {rack.depth_ft}ft • {rack.num_shelves} shelves
                </p>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="containers" className="space-y-4">
          {containers.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600 mb-4">No containers yet</p>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="w-4 h-4" />
                Add Container
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {containers.map(container => (
                <Card key={container.id} className="p-4 text-center">
                  <p className="text-2xl mb-2">🪴</p>
                  <p className="font-semibold text-sm text-gray-900">{container.name}</p>
                  <p className="text-xs text-gray-600">{container.container_type}</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="log">
          <Card className="p-6">
            <GrowLogComponent targetId={spaceId} targetType="indoor_space_id" />
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Assistant */}
      {showAI && (
        <AIGrowAssistant 
          onClose={() => setShowAI(false)}
          context={{ space, racks, containers }}
        />
      )}
    </div>
  );
}