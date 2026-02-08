import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Plus, 
  Thermometer, 
  Droplets, 
  Sun,
  Edit,
  Trash2,
  Loader2,
  Sprout
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function IndoorSpaceDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const spaceId = searchParams.get('id');
  
  const [space, setSpace] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (spaceId) {
      loadData();
    }
  }, [spaceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const spaceData = await base44.entities.IndoorSpace.filter({ id: spaceId });
      if (spaceData.length === 0) {
        toast.error('Space not found');
        navigate(createPageUrl('IndoorPlants'));
        return;
      }
      
      setSpace(spaceData[0]);

      // Load tiers
      const tiersData = await base44.entities.IndoorSpaceTier.filter(
        { indoor_space_id: spaceId },
        'tier_number'
      );
      setTiers(tiersData);

      // Load plants
      const plantsData = await base44.entities.IndoorPlant.filter({
        indoor_space_id: spaceId,
        is_active: true
      }, '-created_date');
      setPlants(plantsData);
    } catch (error) {
      console.error('Error loading space:', error);
      toast.error('Failed to load space');
    } finally {
      setLoading(false);
    }
  };

  const formatLocationType = (type) => {
    const labels = {
      'tiered_rack': 'Multi-Tier Rack',
      'bookshelf': 'Bookshelf',
      'floating_shelf': 'Floating Shelf',
      'window_sill': 'Window Sill',
      'table': 'Table',
      'floor_standing': 'Floor',
      'hanging': 'Hanging',
      'greenhouse_mini': 'Mini Greenhouse',
      'custom': 'Custom'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!space) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('IndoorPlants'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{space.name}</h1>
            <p className="text-sm text-gray-500">
              {formatLocationType(space.location_type)} • {space.room_name || 'No room'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Sprout className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{plants.length}</p>
                <p className="text-xs text-gray-500">Plants</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {space.avg_temperature_f && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Thermometer className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{space.avg_temperature_f}°F</p>
                  <p className="text-xs text-gray-500">Temperature</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {space.avg_humidity_percent && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Droplets className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{space.avg_humidity_percent}%</p>
                  <p className="text-xs text-gray-500">Humidity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {space.light_hours_per_day && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Sun className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{space.light_hours_per_day}hr</p>
                  <p className="text-xs text-gray-500">Light per day</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="plants">
        <TabsList>
          <TabsTrigger value="plants">Plants ({plants.length})</TabsTrigger>
          {tiers.length > 0 && <TabsTrigger value="layout">Layout</TabsTrigger>}
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="plants" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Plants in this space</h2>
            <Button className="bg-emerald-600 hover:bg-emerald-700" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Plant
            </Button>
          </div>

          {plants.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <div className="text-5xl mb-4">🪴</div>
                <h3 className="text-lg font-semibold mb-2">No plants yet</h3>
                <p className="text-gray-600 mb-4">Add your first houseplant to this space</p>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Plant
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plants.map((plant) => (
                <Card key={plant.id}>
                  <CardContent className="p-4">
                    <div className="text-4xl mb-2 text-center">🪴</div>
                    <h3 className="font-semibold text-center">
                      {plant.nickname || 'Unnamed Plant'}
                    </h3>
                    <p className="text-xs text-gray-500 text-center">
                      {plant.health_status || 'healthy'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="layout">
          <Card>
            <CardHeader>
              <CardTitle>Visual Layout</CardTitle>
            </CardHeader>
            <CardContent>
              {tiers.length > 0 ? (
                <div className="space-y-4">
                  {tiers.map((tier) => (
                    <div key={tier.id} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">
                        {tier.label} (Tier {tier.tier_number})
                      </h4>
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: tier.grid_columns * tier.grid_rows }).map((_, idx) => (
                          <div
                            key={idx}
                            className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-xs text-gray-400"
                          >
                            Empty
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No tiers configured for this space</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="environment">
          <Card>
            <CardHeader>
              <CardTitle>Environmental Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Thermometer className="w-8 h-8 text-orange-500" />
                  <div>
                    <p className="text-xs text-gray-500">Temperature</p>
                    <p className="font-semibold">{space.avg_temperature_f || '--'}°F</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Droplets className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500">Humidity</p>
                    <p className="font-semibold">{space.avg_humidity_percent || '--'}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Sun className="w-8 h-8 text-yellow-500" />
                  <div>
                    <p className="text-xs text-gray-500">Light Hours</p>
                    <p className="font-semibold">{space.light_hours_per_day || '--'}hr/day</p>
                  </div>
                </div>
              </div>

              {space.has_grow_lights && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-900">
                    💡 Grow Lights: {space.light_type?.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Space Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Dimensions</Label>
                <p className="text-sm text-gray-600 mt-1">
                  {space.width_inches}" W × {space.depth_inches}" D
                  {space.height_inches && ` × ${space.height_inches}" H`}
                </p>
              </div>

              {tiers.length > 0 && (
                <div>
                  <Label>Tiers</Label>
                  <p className="text-sm text-gray-600 mt-1">{tiers.length} tiers configured</p>
                </div>
              )}

              {space.description && (
                <div>
                  <Label>Description</Label>
                  <p className="text-sm text-gray-600 mt-1">{space.description}</p>
                </div>
              )}

              <div className="pt-4 space-y-2">
                <Button variant="outline" className="w-full">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Space
                </Button>
                <Button variant="outline" className="w-full text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Space
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}