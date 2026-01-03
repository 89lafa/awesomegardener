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
  AlertCircle
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import ErrorBoundary from '@/components/common/ErrorBoundary';

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
      loadPlantingSpaces();
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

  const syncFromPlotBuilder = async () => {
    if (!activeGarden) return;
    
    setSyncing(true);
    setSyncResult(null);
    
    try {
      console.log('[SYNC] Starting sync for garden:', activeGarden.id);
      
      // Load all plot items for this garden
      const plotItems = await base44.entities.PlotItem.filter({ garden_id: activeGarden.id });
      console.log('[SYNC] Found plot items:', plotItems.length);
      
      // Load existing planting spaces
      const existingSpaces = await base44.entities.PlantingSpace.filter({ garden_id: activeGarden.id });
      const existingByPlotItem = {};
      existingSpaces.forEach(s => {
        if (s.plot_item_id) existingByPlotItem[s.plot_item_id] = s;
      });
      
      const plantableTypes = ['RAISED_BED', 'IN_GROUND_BED', 'GREENHOUSE', 'OPEN_PLOT', 'GROW_BAG', 'CONTAINER'];
      const plantableItems = plotItems.filter(item => plantableTypes.includes(item.item_type));
      
      console.log('[SYNC] Plantable items:', plantableItems.length);
      
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
          layout_schema,
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
      
      setSyncResult({ created, updated, skipped });
      await loadPlantingSpaces();
      toast.success(`Sync complete! Created ${created}, updated ${updated}`);
    } catch (error) {
      console.error('[SYNC] Error:', error);
      toast.error('Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
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
            <Link to={createPageUrl('PlotBuilder') + `?gardenId=${activeGarden?.id}`}>
              <Button variant="outline" className="gap-2">
                <Settings className="w-4 h-4" />
                Plot Builder
              </Button>
            </Link>
            <Button 
              onClick={syncFromPlotBuilder}
              disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync from Plot Builder
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
              <strong>No planting spaces yet.</strong> Use Plot Builder to design your garden layout, 
              then click "Sync from Plot Builder" to create planting spaces.
            </AlertDescription>
          </Alert>
        )}

        {/* Planting Spaces List */}
        {plantingSpaces.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plantingSpaces.map((space) => (
              <Card key={space.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{space.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium capitalize">{space.space_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Capacity:</span>
                      <span className="font-medium">{space.capacity} {space.layout_schema?.type === 'grid' ? 'cells' : space.layout_schema?.type === 'rows' ? 'rows' : 'slots'}</span>
                    </div>
                    {space.layout_schema?.type === 'grid' && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Layout:</span>
                        <span className="font-medium">{space.layout_schema.columns} × {space.layout_schema.rows} grid</span>
                      </div>
                    )}
                  </div>
                  <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Plants
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}