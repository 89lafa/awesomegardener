import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Plus, Thermometer, Droplets, Sun, Edit, Trash2, Loader2, Sprout,
  List, Box, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RotateCcw,
  ZoomIn, Maximize2, AlertTriangle, AlertCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [viewMode, setViewMode] = useState('list');
  const [showPlaceExistingModal, setShowPlaceExistingModal] = useState(false);

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

      const tiersData = await base44.entities.IndoorSpaceTier.filter(
        { indoor_space_id: spaceId },
        'tier_number'
      );
      setTiers(tiersData);

      const plantsData = await base44.entities.IndoorPlant.filter({
        indoor_space_id: spaceId,
        is_active: true
      }, '-created_date');
      
      // Enrich with variety data in batches
      const enrichedPlants = await Promise.all(
        plantsData.map(async (plant) => {
          if (plant.variety_id) {
            try {
              const varietyData = await base44.entities.Variety.filter({ id: plant.variety_id });
              return { ...plant, variety_name: varietyData[0]?.variety_name };
            } catch (error) {
              console.error('Error loading variety:', error);
              return plant;
            }
          }
          return plant;
        })
      );
      
      setPlants(enrichedPlants);
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('IndoorPlants'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{space.name}</h1>
            <p className="text-sm text-gray-500">
              {formatLocationType(space.location_type)} • {space.room_name || 'No room'}
            </p>
          </div>
        </div>

        {tiers.length > 0 && (
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'list' ? 'bg-emerald-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <List size={18} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === '3d' ? 'bg-emerald-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Box size={18} />
              <span className="hidden sm:inline">3D View</span>
            </button>
          </div>
        )}
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

      {viewMode === '3d' && tiers.length > 0 ? (
        <Space3DView space={space} tiers={tiers} plants={plants} spaceId={spaceId} navigate={navigate} />
      ) : (
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
                <div className="flex gap-2">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                  onClick={() => navigate(createPageUrl('AddIndoorPlant') + `?spaceId=${spaceId}`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Plant
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  size="sm"
                  onClick={() => setShowPlaceExistingModal(true)}
                >
                  <Sprout className="w-4 h-4 mr-2" />
                  Place Existing
                </Button>
              </div>
            </div>

            {plants.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center">
                  <div className="text-5xl mb-4">🪴</div>
                  <h3 className="text-lg font-semibold mb-2">No plants yet</h3>
                  <p className="text-gray-600 mb-4">Add your first houseplant to this space</p>
                  <div className="flex gap-2">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => navigate(createPageUrl('AddIndoorPlant') + `?spaceId=${spaceId}`)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Plant
                    </Button>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700"
                      onClick={() => setShowPlaceExistingModal(true)}
                    >
                      <Sprout className="w-4 h-4 mr-2" />
                      Place Existing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plants.map((plant) => (
                  <Card 
                    key={plant.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer h-full"
                  >
                    <CardContent 
                      className="p-4"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(createPageUrl('IndoorPlantDetail') + `?id=${plant.id}`);
                      }}
                    >
                      <div className="text-4xl mb-2 text-center">🪴</div>
                      <h3 className="font-semibold text-center">{plant.nickname || plant.variety_name || 'Unnamed Plant'}</h3>
                      {plant.nickname && plant.variety_name && (
                        <p className="text-xs text-gray-600 text-center italic">{plant.variety_name}</p>
                      )}
                      <p className="text-xs text-gray-500 text-center capitalize mt-1">{plant.health_status || 'healthy'}</p>
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
                    {tiers.map((tier) => {
                      const tierPlants = plants.filter(p => p.tier_id === tier.id || (!p.tier_id && tier.tier_number === 1));
                      const gridCols = tier.grid_columns || 4;
                      const gridRows = tier.grid_rows || 2;
                      
                      return (
                        <div key={tier.id} className="border rounded-lg p-3 bg-gradient-to-br from-emerald-50 to-green-50">
                          <h4 className="font-semibold mb-2 text-sm text-gray-800">
                            {tier.label} (Tier {tier.tier_number})
                          </h4>
                          <div 
                            className="grid gap-1.5"
                            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                          >
                            {Array.from({ length: gridCols * gridRows }).map((_, idx) => {
                              const x = idx % gridCols;
                              const y = Math.floor(idx / gridCols);
                              const plantInCell = tierPlants.find(p => 
                                p.grid_position_x === x && p.grid_position_y === y
                              );
                              
                              return (
                                <div
                                  key={idx}
                                  className={`aspect-square rounded-md flex flex-col items-center justify-center text-[10px] transition-all ${
                                    plantInCell 
                                      ? 'bg-emerald-100 border-2 border-emerald-500 cursor-pointer hover:shadow-md hover:scale-105' 
                                      : 'border border-dashed border-gray-300 text-gray-400'
                                  }`}
                                  onClick={(e) => {
                                    if (plantInCell) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      navigate(createPageUrl('IndoorPlantDetail') + `?id=${plantInCell.id}`);
                                    }
                                  }}
                                >
                                  {plantInCell ? (
                                    <>
                                      <div className="text-xl">🌿</div>
                                      <div className="font-medium truncate w-full px-0.5 text-center text-[9px] leading-tight">
                                        {plantInCell.nickname || plantInCell.variety_name}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-[9px]">Empty</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Show plants without grid positions */}
                          {tierPlants.filter(p => p.grid_position_x === null || p.grid_position_x === undefined).length > 0 && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <p className="text-[10px] font-medium text-yellow-800 mb-1.5">Plants in this tier (not placed on grid):</p>
                              <div className="flex flex-wrap gap-1.5">
                                {tierPlants.filter(p => p.grid_position_x === null || p.grid_position_x === undefined).map(p => (
                                  <div
                                    key={p.id}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      navigate(createPageUrl('IndoorPlantDetail') + `?id=${p.id}`);
                                    }}
                                    className="cursor-pointer hover:bg-yellow-100 transition-colors px-2 py-1 bg-white rounded border border-yellow-300 text-[10px] font-medium"
                                  >
                                    🌿 {p.nickname || p.variety_name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
          )}

          <PlaceExistingPlantModal
          open={showPlaceExistingModal}
          onClose={() => setShowPlaceExistingModal(false)}
          spaceId={spaceId}
          tiers={tiers}
          onSuccess={() => {
            setShowPlaceExistingModal(false);
            loadData();
            toast.success('Plant placed in space!');
          }}
          />
          </div>
          );
          }

          function PlaceExistingPlantModal({ open, onClose, spaceId, tiers, onSuccess }) {
          const [plants, setPlants] = useState([]);
          const [selectedPlant, setSelectedPlant] = useState('');
          const [selectedTier, setSelectedTier] = useState('');
          const [loading, setLoading] = useState(true);
          const [saving, setSaving] = useState(false);

          useEffect(() => {
          if (open) {
          loadPlants();
          }
          }, [open]);

          const loadPlants = async () => {
            try {
              const data = await base44.entities.IndoorPlant.filter({ is_active: true });
              const enriched = await Promise.all(
                data.map(async p => {
                  if (p.variety_id) {
                    try {
                      const variety = await base44.entities.Variety.filter({ id: p.variety_id }).then(r => r[0]);
                      return { ...p, variety_name: variety?.variety_name };
                    } catch (error) {
                      console.error('Error loading variety:', error);
                      return p;
                    }
                  }
                  return p;
                })
              );
              setPlants(enriched);
            } catch (error) {
              console.error('Error loading plants:', error);
            } finally {
              setLoading(false);
            }
          };

          const handlePlace = async () => {
          if (!selectedPlant) return;

          setSaving(true);
          try {
          await base44.entities.IndoorPlant.update(selectedPlant, {
          indoor_space_id: spaceId,
          tier_id: selectedTier || null
          });
          onSuccess();
          } catch (error) {
          console.error('Error placing plant:', error);
          toast.error('Failed to place plant');
          } finally {
          setSaving(false);
          }
          };

          return (
          <Dialog open={open} onOpenChange={onClose}>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Existing Plant in Space</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Select Plant</Label>
                <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose a plant" />
                  </SelectTrigger>
                  <SelectContent>
                    {plants.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nickname || p.variety_name || 'Unnamed'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {tiers.length > 0 && (
                <div>
                  <Label>Select Tier (optional)</Label>
                  <Select value={selectedTier} onValueChange={setSelectedTier}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose tier" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiers.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label || `Tier ${t.tier_number}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                <Button 
                  onClick={handlePlace} 
                  disabled={!selectedPlant || saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Place Plant
                </Button>
              </div>
            </div>
          )}
          </DialogContent>
          </Dialog>
          );
          }

function Space3DView({ space, tiers, plants, spaceId, navigate }) {
  const [viewAngle, setViewAngle] = useState(25);
  const [viewPitch, setViewPitch] = useState(10);
  const [zoom, setZoom] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedPlant, setSelectedPlant] = useState(null);

  const setPresetAngle = (angle) => {
    setViewAngle(angle);
    setViewPitch(10);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-md p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {space.width_inches}"W × {space.depth_inches}"D × {tiers.length} tiers
          </div>
          {space.has_grow_lights && (
            <div className="flex items-center gap-1 text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
              <Sun size={14} />
              <span>Grow Lights</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setZoom(Math.min(zoom + 0.1, 1.5))}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={20} />
            </button>
            <button
              onClick={() => setZoom(Math.max(zoom - 0.1, 0.7))}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <Maximize2 size={20} />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setPresetAngle(-25)}
              className={`p-2 rounded transition-colors ${
                viewAngle === -25 ? 'bg-emerald-600 text-white' : 'hover:bg-gray-200 text-gray-600'
              }`}
              title="View from Left"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setPresetAngle(25)}
              className={`p-2 rounded transition-colors ${
                viewAngle === 25 ? 'bg-emerald-600 text-white' : 'hover:bg-gray-200 text-gray-600'
              }`}
              title="Front-Right View"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => setPresetAngle(45)}
              className={`p-2 rounded transition-colors ${
                viewAngle === 45 ? 'bg-emerald-600 text-white' : 'hover:bg-gray-200 text-gray-600'
              }`}
              title="Side View"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewPitch(Math.min(viewPitch + 5, 40))}
              className="p-1 rounded transition-colors hover:bg-gray-200 text-gray-600"
              title="Tilt Up"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={() => setViewPitch(Math.max(viewPitch - 5, -30))}
              className="p-1 rounded transition-colors hover:bg-gray-200 text-gray-600"
              title="Tilt Down"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-4 py-2 rounded-lg transition-colors font-medium ${
              showLabels ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Labels {showLabels ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-12 relative overflow-hidden border-2 border-slate-700 min-h-[700px]">
        <div className="absolute inset-0 bg-gradient-radial from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        
        <svg className="absolute bottom-0 left-0 right-0 h-32 opacity-10 pointer-events-none">
          <defs>
            <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#floor-grid)" />
        </svg>

        <Rack3DVisualization
          space={space}
          tiers={tiers}
          plants={plants}
          viewAngle={viewAngle}
          viewPitch={viewPitch}
          zoom={zoom}
          showLabels={showLabels}
          selectedPlant={selectedPlant}
          onSelectPlant={setSelectedPlant}
          spaceId={spaceId}
          navigate={navigate}
        />

        <div className="absolute bottom-6 left-6 bg-slate-800/90 backdrop-blur rounded-xl p-4 border border-slate-700 shadow-2xl">
          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            Legend
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/50"></div>
              <span className="text-slate-300">Thriving</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/50"></div>
              <span className="text-slate-300">Healthy</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/50"></div>
              <span className="text-slate-300">Struggling</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/50"></div>
              <span className="text-slate-300">Sick</span>
            </div>
          </div>
        </div>

        <div className="absolute top-6 right-6 bg-slate-800/90 backdrop-blur rounded-xl p-4 border border-slate-700 shadow-2xl">
          <h4 className="text-sm font-bold text-white mb-3">Environment</h4>
          <div className="space-y-2 text-sm">
            {space.avg_temperature_f && (
              <div className="flex items-center gap-2 text-orange-300">
                <Thermometer size={16} />
                <span>{Math.round(space.avg_temperature_f)}°F</span>
              </div>
            )}
            {space.avg_humidity_percent && (
              <div className="flex items-center gap-2 text-blue-300">
                <Droplets size={16} />
                <span>{Math.round(space.avg_humidity_percent)}%</span>
              </div>
            )}
            {space.light_hours_per_day && (
              <div className="flex items-center gap-2 text-yellow-300">
                <Sun size={16} />
                <span>{space.light_hours_per_day}hr/day</span>
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-6 left-6 bg-slate-800/90 backdrop-blur rounded-xl p-4 border border-slate-700 shadow-2xl">
          <h4 className="text-sm font-bold text-white mb-3">💡 Controls</h4>
          <div className="space-y-1 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ChevronLeft size={14} />
              <ChevronRight size={14} />
              <span>Rotate left/right</span>
            </div>
            <div className="flex items-center gap-2">
              <ChevronUp size={14} />
              <ChevronDown size={14} />
              <span>Tilt up/down</span>
            </div>
            <div className="flex items-center gap-2">
              <ZoomIn size={14} />
              <Maximize2 size={14} />
              <span>Zoom in/out</span>
            </div>
            <div>🖱️ Click plant for details</div>
          </div>
        </div>
      </div>

      <CameraAnglePanel viewAngle={viewAngle} viewPitch={viewPitch} zoom={zoom} onReset={() => {
        setViewAngle(25);
        setViewPitch(10);
        setZoom(1);
      }} />
    </div>
  );
}

function Rack3DVisualization({ space, tiers, plants, viewAngle, viewPitch, zoom, showLabels, selectedPlant, onSelectPlant, spaceId, navigate }) {
  const getTransform = () => {
    return `scale(${zoom}) perspective(1200px) rotateX(${viewPitch}deg) rotateY(${viewAngle}deg)`;
  };

  const tierCount = tiers.length;

  return (
    <div
      className="relative mx-auto transition-all duration-500 ease-out"
      style={{
        width: '900px',
        height: '700px',
        transformStyle: 'preserve-3d',
        transform: getTransform(),
      }}
    >
      <RackStructure3D
        tiers={tiers}
        plants={plants}
        tierCount={tierCount}
        showLabels={showLabels}
        selectedPlant={selectedPlant}
        onSelectPlant={onSelectPlant}
        spaceId={spaceId}
        navigate={navigate}
      />
    </div>
  );
}

function RackStructure3D({ tiers, plants, tierCount, showLabels, selectedPlant, onSelectPlant, spaceId, navigate }) {
  const tierHeight = 100;
  const tierWidth = 500;
  const tierDepth = 200;

  return (
    <div className="relative" style={{ transformStyle: 'preserve-3d', marginTop: '200px' }}>
      <div className="absolute bg-gradient-to-r from-slate-700 to-slate-600 rounded-lg shadow-2xl"
        style={{ left: '50px', top: '0', width: '16px', height: `${tierCount * tierHeight}px`, transform: 'translateZ(-100px)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} />
      <div className="absolute bg-gradient-to-r from-slate-700 to-slate-600 rounded-lg shadow-2xl"
        style={{ right: '50px', top: '0', width: '16px', height: `${tierCount * tierHeight}px`, transform: 'translateZ(-100px)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} />
      <div className="absolute bg-gradient-to-r from-slate-600 to-slate-500 rounded-lg shadow-2xl"
        style={{ left: '50px', top: '0', width: '16px', height: `${tierCount * tierHeight}px`, transform: 'translateZ(100px)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} />
      <div className="absolute bg-gradient-to-r from-slate-600 to-slate-500 rounded-lg shadow-2xl"
        style={{ right: '50px', top: '0', width: '16px', height: `${tierCount * tierHeight}px`, transform: 'translateZ(100px)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} />

      {tiers.map((tier, i) => {
        const tierNum = i + 1;
        const yPos = (tierCount - 1 - i) * tierHeight;
        // FIX: Show plants with matching tier_id OR plants without tier_id assigned
        const tierPlants = plants.filter(p => p.tier_id === tier.id || (!p.tier_id && i === 0));

        return (
          <Tier3D
            key={tier.id}
            tier={tier}
            tierNumber={tierNum}
            yPosition={yPos}
            width={tierWidth}
            depth={tierDepth}
            plants={tierPlants}
            showLabels={showLabels}
            selectedPlant={selectedPlant}
            onSelectPlant={onSelectPlant}
            spaceId={spaceId}
            navigate={navigate}
          />
        );
      })}
    </div>
  );
}

function Tier3D({ tier, tierNumber, yPosition, width, depth, plants, showLabels, selectedPlant, onSelectPlant, spaceId, navigate }) {
  return (
    <div className="absolute" style={{ top: `${yPosition}px`, left: '50%', transform: 'translateX(-50%)', transformStyle: 'preserve-3d' }}>
      <div className="absolute -left-24 top-1/2" style={{ transform: 'translateY(-50%) translateZ(150px)' }}>
        <div className="bg-slate-700/90 backdrop-blur text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg border border-slate-600">
          {tier.label}
        </div>
      </div>

      <div className="relative" style={{ width: `${width}px`, height: `${depth}px`, transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-0 rounded-lg shadow-2xl" style={{
          background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)',
          transform: 'rotateX(-89deg) translateZ(0px)',
          transformOrigin: 'top',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)',
        }}>
          <div className="absolute inset-0 opacity-20">
            <svg width="100%" height="100%">
              <defs>
                <pattern id={`wood-${tierNumber}`} width="100" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
                  <rect width="100" height="4" fill="#000" opacity="0.1"/>
                  <rect width="100" height="1" y="4" fill="#000" opacity="0.15"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#wood-${tierNumber})`} />
            </svg>
          </div>
          <div className="absolute inset-0 opacity-10">
            {Array.from({ length: tier.grid_columns || 4 }).map((_, i) => (
              <div key={i} className="absolute h-full border-l border-white" style={{ left: `${((i + 1) / (tier.grid_columns + 1)) * 100}%` }} />
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 rounded-b-lg" style={{
          height: '20px',
          background: 'linear-gradient(180deg, #78350f 0%, #451a03 100%)',
          transform: 'translateZ(0px)',
          boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
        }} />

        {plants.map((plant, i) => {
          const x = plant.grid_position_x 
            ? (plant.grid_position_x / tier.grid_columns) * (width - 100) + 50
            : 100 + i * 150;
          const z = plant.grid_position_y 
            ? (plant.grid_position_y / tier.grid_rows) * (depth - 80) + 40
            : 60;

          return (
            <Plant3D
              key={plant.id}
              plant={plant}
              position={{ x, z }}
              isSelected={selectedPlant === plant.id}
              onClick={() => onSelectPlant(plant.id)}
              showLabel={showLabels}
            />
          );
        })}

        {plants.length < (tier.grid_columns || 4) && (
          <div 
            className="absolute cursor-pointer hover:bg-emerald-500/30 transition-colors rounded-lg border-2 border-dashed border-white/30"
            style={{ right: '20px', top: '40px', width: '80px', height: '60px', transform: 'translateZ(5px)' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(createPageUrl('AddIndoorPlant') + `?spaceId=${spaceId}&tierId=${tier.id}`);
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-white/60">
              <Plus size={24} />
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 rounded-lg" style={{
        background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)',
        transform: 'translateY(10px) translateZ(-5px) scaleX(1.1)',
        filter: 'blur(15px)',
      }} />
    </div>
  );
}

function Plant3D({ plant, position, isSelected, onClick, showLabel }) {
  const getHealthColor = () => {
    switch (plant.health_status) {
      case 'thriving': 
        return { from: '#10b981', to: '#059669', shadow: 'rgba(16, 185, 129, 0.6)' };
      case 'healthy': 
        return { from: '#22c55e', to: '#16a34a', shadow: 'rgba(34, 197, 94, 0.6)' };
      case 'struggling': 
        return { from: '#f59e0b', to: '#d97706', shadow: 'rgba(245, 158, 11, 0.6)' };
      case 'sick':
        return { from: '#ef4444', to: '#dc2626', shadow: 'rgba(239, 68, 68, 0.6)' };
      default: 
        return { from: '#22c55e', to: '#16a34a', shadow: 'rgba(34, 197, 94, 0.6)' };
    }
  };

  const colors = getHealthColor();
  const heightScale = plant.current_height_inches ? Math.min(plant.current_height_inches / 20, 2.5) : 1.2;

  return (
    <div
      onClick={onClick}
      className={`absolute cursor-pointer transition-all duration-300 group ${
        isSelected ? 'z-50 scale-110' : 'z-10 hover:z-40 hover:scale-105'
      }`}
      style={{ left: `${position.x}px`, top: '30px', transform: `translateZ(${position.z}px)`, transformStyle: 'preserve-3d' }}
    >
      <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
        <div className="relative rounded-lg border-2" style={{
          width: '80px',
          height: '60px',
          background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
          borderColor: colors.to,
          boxShadow: `0 10px 30px ${colors.shadow}, inset 0 -5px 10px rgba(0,0,0,0.3)`,
          transform: 'translateZ(20px)',
        }}>
          <div className="absolute top-0 left-0 right-0 h-3 rounded-t-lg" style={{ background: 'linear-gradient(180deg, #78350f 0%, #451a03 100%)' }} />
        </div>

        <div className="absolute top-0 right-0 rounded-r-lg" style={{
          width: '30px',
          height: '60px',
          background: `linear-gradient(90deg, ${colors.to} 0%, ${colors.from} 100%)`,
          transform: 'rotateY(90deg) translateX(15px)',
          transformOrigin: 'left',
          opacity: 0.7,
        }} />

        <div className="absolute -top-16 left-1/2" style={{ transform: `translateX(-50%) translateZ(30px) scale(${heightScale})`, transformStyle: 'preserve-3d' }}>
          <div className="relative">
            <div className="absolute inset-0 opacity-40 blur-sm" style={{ transform: 'translateZ(-10px)' }}>
              <div className="text-5xl">🌿</div>
            </div>
            <div className="relative" style={{ transform: 'translateZ(10px)' }}>
              <div className="text-5xl drop-shadow-lg">🌿</div>
            </div>
            <div className="absolute inset-0 rounded-full blur-xl opacity-50" style={{ background: colors.from, transform: 'translateZ(0px)' }} />
          </div>
        </div>

        <div className="absolute -top-2 -right-2" style={{ transform: 'translateZ(50px)' }}>
          {plant.needs_water && (
            <div className="w-8 h-8 bg-blue-500 rounded-full border-3 border-white shadow-lg animate-bounce mb-1" style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' }} title="Needs Water">
              <Droplets size={16} className="text-white absolute inset-0 m-auto" />
            </div>
          )}
          {plant.health_status === 'struggling' && (
            <div className="w-8 h-8 bg-amber-500 rounded-full border-3 border-white shadow-lg animate-pulse mb-1" style={{ boxShadow: '0 0 20px rgba(245, 158, 11, 0.8)' }} title="Needs Care">
              <AlertTriangle size={16} className="text-white absolute inset-0 m-auto" />
            </div>
          )}
          {plant.health_status === 'sick' && (
            <div className="w-8 h-8 bg-red-500 rounded-full border-3 border-white shadow-lg animate-bounce" style={{ boxShadow: '0 0 20px rgba(239, 68, 68, 0.8)' }} title="Sick">
              <AlertCircle size={16} className="text-white absolute inset-0 m-auto" />
            </div>
          )}
        </div>

        {isSelected && (
          <div className="absolute -inset-4 rounded-xl border-4 border-emerald-400 animate-pulse" style={{
            transform: 'translateZ(0px)',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.6)',
          }} />
        )}

        {showLabel && (
          <div className="absolute -bottom-8 left-1/2 bg-slate-800/95 backdrop-blur px-2 py-1 rounded text-white text-xs font-medium shadow-lg border border-slate-700"
            style={{ transform: 'translateX(-50%) translateZ(40px)', whiteSpace: 'nowrap' }}>
            {plant.nickname || plant.variety_name || 'Plant'}
          </div>
        )}

        <div className="absolute -bottom-20 left-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ transform: 'translateX(-50%) translateZ(60px) rotateX(15deg)', minWidth: '160px' }}>
          <div className="bg-slate-900/95 backdrop-blur text-white px-3 py-2 rounded-lg shadow-2xl text-sm border border-slate-700">
            <div className="font-bold truncate">{plant.nickname || plant.variety_name || 'Plant'}</div>
            {plant.nickname && plant.variety_name && (
              <div className="text-slate-400 text-xs truncate italic">{plant.variety_name}</div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full" style={{ background: colors.from }} />
              <span className="text-xs capitalize">{plant.health_status || 'healthy'}</span>
            </div>
            {plant.current_height_inches && (
              <div className="text-xs text-slate-400 mt-1">📏 {plant.current_height_inches}" tall</div>
            )}
          </div>
        </div>

        <div className="absolute top-full left-1/2" style={{
          width: '100px',
          height: '40px',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)',
          transform: 'translateX(-50%) translateY(10px) translateZ(-10px)',
          filter: 'blur(8px)',
        }} />
      </div>
    </div>
  );
}

function CameraAnglePanel({ viewAngle, viewPitch, zoom, onReset }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <RotateCcw size={16} className="text-emerald-600" />
          Camera Controls
        </h4>
        <button onClick={onReset} className="text-xs text-gray-500 hover:text-emerald-600 transition-colors">
          🔄 Reset
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>↔️ Rotation</span>
            <span className="font-mono text-gray-800">{viewAngle}°</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${((viewAngle + 45) / 90) * 100}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>↕️ Pitch</span>
            <span className="font-mono text-gray-800">{viewPitch}°</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${((viewPitch + 30) / 70) * 100}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>🔍 Zoom</span>
            <span className="font-mono text-gray-800">{(zoom * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${((zoom - 0.7) / 0.8) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}