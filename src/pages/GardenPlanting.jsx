import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  TreeDeciduous, 
  Plus, 
  Loader2,
  Grid3X3,
  Rows,
  Package,
  Home,
  Sprout,
  Hammer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const SPACE_TYPE_ICONS = {
  RAISED_BED: Grid3X3,
  IN_GROUND_BED: Rows,
  GREENHOUSE: Home,
  OPEN_PLOT: Sprout,
  GROW_BAG: Package,
  CONTAINER: Package
};

const SPACE_TYPE_LABELS = {
  RAISED_BED: 'Raised Bed',
  IN_GROUND_BED: 'In-Ground Bed',
  GREENHOUSE: 'Greenhouse',
  OPEN_PLOT: 'Open Plot',
  GROW_BAG: 'Grow Bag',
  CONTAINER: 'Container'
};

export default function GardenPlanting() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGarden) {
      loadSpaces();
    }
  }, [activeGarden]);

  const loadData = async () => {
    try {
      const [userData, gardensData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Garden.filter({ archived: false }, '-updated_date')
      ]);
      
      setGardens(gardensData);

      if (gardensData.length === 0) {
        setLoading(false);
        return;
      }

      // Garden selection logic
      const urlGardenId = searchParams.get('gardenId');
      let selectedGarden = null;

      if (urlGardenId) {
        selectedGarden = gardensData.find(g => g.id === urlGardenId);
      } else if (userData.active_garden_id) {
        selectedGarden = gardensData.find(g => g.id === userData.active_garden_id);
      } else {
        selectedGarden = gardensData[0];
      }

      if (selectedGarden) {
        setActiveGarden(selectedGarden);
        setSearchParams({ gardenId: selectedGarden.id });
        if (userData.active_garden_id !== selectedGarden.id) {
          await base44.auth.updateMe({ active_garden_id: selectedGarden.id });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load gardens');
    } finally {
      setLoading(false);
    }
  };

  const syncPlotItemsToSpaces = async () => {
    try {
      // Get all plot items for this garden
      const plotItems = await base44.entities.PlotItem.filter({ garden_id: activeGarden.id });
      
      console.log(`[SYNC] Found ${plotItems.length} plot items for garden ${activeGarden.id}`);
      
      const plantableTypes = ['RAISED_BED', 'IN_GROUND_BED', 'GREENHOUSE', 'OPEN_PLOT', 'GROW_BAG', 'CONTAINER'];
      
      for (const item of plotItems) {
        // Skip non-plantable items
        if (!plantableTypes.includes(item.item_type)) {
          console.log(`[SYNC] Skipping non-plantable item: ${item.label} (${item.item_type})`);
          continue;
        }

        // Check if PlantingSpace exists
        const existingSpaces = await base44.entities.PlantingSpace.filter({ plot_item_id: item.id });
        
        if (existingSpaces.length > 0) {
          console.log(`[SYNC] Space already exists for: ${item.label}`);
          continue;
        }

        // Calculate layout schema
        let layoutSchema = { type: 'slots', slots: 1 };
        let capacity = 1;

        if (item.item_type === 'RAISED_BED' && item.metadata?.gridEnabled) {
          const gridSize = item.metadata.gridSize || 12;
          const cols = Math.floor(item.width / gridSize);
          const rows = Math.floor(item.height / gridSize);
          layoutSchema = { type: 'grid', grid_size: gridSize, columns: cols, rows: rows };
          capacity = cols * rows;
        } else if (item.item_type === 'IN_GROUND_BED' || item.item_type === 'OPEN_PLOT') {
          const rowSpacing = item.metadata?.rowSpacing || 18;
          const rowCount = item.metadata?.rowCount || Math.floor(item.width / rowSpacing);
          layoutSchema = { type: 'rows', rows: rowCount, row_spacing: rowSpacing };
          capacity = rowCount;
        } else if (item.item_type === 'GREENHOUSE') {
          const slots = item.metadata?.capacity || 20;
          layoutSchema = { type: 'slots', slots };
          capacity = slots;
        }

        console.log(`[SYNC] Creating space for: ${item.label} (capacity: ${capacity})`);

        await base44.entities.PlantingSpace.create({
          garden_id: activeGarden.id,
          plot_item_id: item.id,
          space_type: item.item_type,
          name: item.label,
          capacity,
          layout_schema,
          is_active: true
        });
      }
    } catch (error) {
      console.error('[SYNC] Error syncing plot items to spaces:', error);
    }
  };

  const loadSpaces = async () => {
    try {
      // First sync plot items to spaces
      await syncPlotItemsToSpaces();
      
      // Then load spaces
      const [spacesData, plantingsData, plotItemsData] = await Promise.all([
        base44.entities.PlantingSpace.filter({ 
          garden_id: activeGarden.id,
          is_active: true 
        }),
        base44.entities.PlantInstance.filter({ garden_id: activeGarden.id }),
        base44.entities.PlotItem.filter({ garden_id: activeGarden.id })
      ]);
      
      console.log(`[DEBUG] Garden: ${activeGarden.name} (${activeGarden.id})`);
      console.log(`[DEBUG] PlotItems: ${plotItemsData.length}`, plotItemsData.map(i => ({ id: i.id, type: i.item_type, label: i.label })));
      console.log(`[DEBUG] PlantingSpaces: ${spacesData.length}`, spacesData.map(s => ({ id: s.id, plot_item_id: s.plot_item_id, name: s.name, type: s.space_type })));
      
      setSpaces(spacesData);
      setPlantings(plantingsData);
    } catch (error) {
      console.error('Error loading spaces:', error);
    }
  };

  const handleGardenChange = async (gardenId) => {
    const garden = gardens.find(g => g.id === gardenId);
    if (!garden) return;

    setActiveGarden(garden);
    setSearchParams({ gardenId: garden.id });
    
    try {
      await base44.auth.updateMe({ active_garden_id: garden.id });
    } catch (error) {
      console.error('Error saving preference:', error);
    }
  };

  const getSpaceCapacity = (space) => {
    const spacePlantings = plantings.filter(p => p.space_id === space.id);
    return {
      used: spacePlantings.length,
      total: space.capacity || 0
    };
  };

  const groupedSpaces = spaces.reduce((acc, space) => {
    if (!acc[space.space_type]) {
      acc[space.space_type] = [];
    }
    acc[space.space_type].push(space);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // No gardens state
  if (gardens.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <TreeDeciduous className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Gardens Yet</h2>
            <p className="text-gray-600 mb-6">
              Create your first garden and start planning your layout
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

  // No spaces (empty plot)
  if (spaces.length === 0) {
    return (
      <ErrorBoundary fallbackTitle="Garden Error">
        <div className="space-y-6">
          {/* Header with Garden Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TreeDeciduous className="w-6 h-6 text-emerald-600" />
              {gardens.length > 1 ? (
                <Select value={activeGarden?.id} onValueChange={handleGardenChange}>
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
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{activeGarden?.name}</h1>
              )}
            </div>
          </div>

          {/* Empty State */}
          <Card className="py-16">
            <CardContent className="text-center">
              <Hammer className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Beds or Spaces Yet</h3>
              <p className="text-gray-600 mb-6">
                First, design your garden layout in Plot Builder by adding beds, greenhouses, and containers
              </p>
              <Link to={createPageUrl('MyGarden') + `?gardenId=${activeGarden.id}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <Hammer className="w-4 h-4" />
                  Open Plot Builder
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Garden Error">
      <div className="space-y-6">
        {/* Header with Garden Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TreeDeciduous className="w-6 h-6 text-emerald-600" />
            {gardens.length > 1 ? (
              <Select value={activeGarden?.id} onValueChange={handleGardenChange}>
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
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{activeGarden?.name}</h1>
            )}
          </div>
          <Link to={createPageUrl('MyGarden') + `?gardenId=${activeGarden.id}`}>
            <Button variant="outline" className="gap-2">
              <Hammer className="w-4 h-4" />
              Edit Layout
            </Button>
          </Link>
        </div>

        {/* Spaces Grouped by Type */}
        <div className="space-y-6">
          {Object.entries(groupedSpaces).map(([type, typeSpaces]) => {
            const Icon = SPACE_TYPE_ICONS[type] || Grid3X3;
            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-emerald-600" />
                    {SPACE_TYPE_LABELS[type] || type}
                    <Badge variant="secondary" className="ml-2">{typeSpaces.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {typeSpaces.map((space) => {
                      const capacity = getSpaceCapacity(space);
                      const percentFull = capacity.total > 0 ? (capacity.used / capacity.total) * 100 : 0;
                      return (
                        <Card 
                          key={space.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            // TODO: Navigate to space detail/planting view
                            toast.info('Space planting UI coming soon!');
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-900">{space.name}</h4>
                              <Badge variant={capacity.used > 0 ? 'default' : 'outline'}>
                                {capacity.used}/{capacity.total}
                              </Badge>
                            </div>
                            
                            {/* Capacity Bar */}
                            {capacity.total > 0 && (
                              <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-emerald-600 h-2 rounded-full transition-all"
                                    style={{ width: `${Math.min(percentFull, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {space.layout_schema?.type && (
                              <p className="text-xs text-gray-500 mt-2 capitalize">
                                {space.layout_schema.type} layout
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </ErrorBoundary>
  );
}