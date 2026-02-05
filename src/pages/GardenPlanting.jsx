import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle,
  Trash2,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PlantingModal from '@/components/garden/PlantingModal';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';

// PAGE-LEVEL DATA CACHE: Shared across all SpaceCards on this page
const PAGE_DATA_CACHE = {
  varieties: null,
  plantTypes: null,
  plantingRules: null,
  cropPlans: null,
  stashPlants: null,
  profiles: null,
  lastFetch: 0
};

function SpaceCard({ space, garden, activeSeason, seasonId, sharedData }) {
   const [plantings, setPlantings] = useState([]);
   const [loading, setLoading] = useState(true);
   const [showPlantingModal, setShowPlantingModal] = useState(false);

  useEffect(() => {
    loadPlantings();
  }, [space.id, activeSeason]);

  const loadPlantings = async () => {
    if (!activeSeason || !space.plot_item_id) return;

    try {
      // CRITICAL FIX: Use smartQuery to prevent rate limits
      const allPlants = await smartQuery(base44, 'PlantInstance', { 
        bed_id: space.plot_item_id,
        garden_id: space.garden_id
      });

      // Filter by season - show plantings for selected season OR old plantings without season_year (show in current year only)
      const currentYear = new Date().getFullYear();
      const isCurrentYearSeason = activeSeason && activeSeason.startsWith(currentYear.toString());

      const plants = allPlants.filter(p => {
        // If planting has no season_year (old data), only show in current year's season
        if (!p.season_year) {
          return isCurrentYearSeason;
        }
        // Otherwise, match the selected season exactly
        return p.season_year === activeSeason;
      });

      console.log('[GardenPlanting] Loaded plantings for plot_item_id:', space.plot_item_id, 'season:', activeSeason, 'count:', plants.length);
      setPlantings(plants);
    } catch (error) {
      console.error('Error loading plantings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlantingUpdate = (updatedPlantings) => {
    if (updatedPlantings) {
      setPlantings(updatedPlantings);
    } else {
      loadPlantings();
    }
  };

  const isGridSpace = space.layout_schema?.type === 'grid';
  const isSlotsSpace = space.layout_schema?.type === 'slots';
  const columns = space.layout_schema?.columns || 1;
  const rows = space.layout_schema?.rows || 1;
  const slots = space.layout_schema?.slots || 1;
  
  // Count OCCUPIED CELLS/SLOTS
  const filledCount = isSlotsSpace 
    ? plantings.length  // For slots, just count number of plants
    : plantings.reduce((sum, p) => {  // For grid, count occupied cells
        const spanCols = p.cell_span_cols || 1;
        const spanRows = p.cell_span_rows || 1;
        return sum + (spanCols * spanRows);
      }, 0);
  
  const capacity = space.capacity;
  
  // Calculate responsive cell size for grid spaces
  const getCellSize = () => {
    if (!isGridSpace) return 28;
    
    // For wide grids, scale down cell size to fit
    if (columns > 8) return 20;
    if (columns > 6) return 24;
    return 28;
  };
  
  const cellSize = getCellSize();

  // Create a pseudo-item for PlantingModal that looks like a PlotItem
  const pseudoItem = {
    id: space.plot_item_id,
    item_type: space.space_type,
    label: space.name,
    width: isGridSpace ? columns * 12 : 120,
    height: isGridSpace ? rows * 12 : 120,
    metadata: {
      ...space.layout_schema,
      gridEnabled: isGridSpace,
      gridSize: 12,
      capacity: isSlotsSpace ? slots : undefined,
      planting_pattern: space.layout_schema?.planting_pattern || 'square_foot'
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{space.name}</CardTitle>
          <Badge variant={filledCount > 0 ? 'default' : 'outline'}>
            {filledCount}/{capacity}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 capitalize">
          {space.space_type.replace(/_/g, ' ')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Visual grid for all space types */}
          {isGridSpace ? (
            <div 
              className="grid gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg overflow-x-auto"
              style={{
                gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
                width: 'fit-content',
                maxWidth: '100%'
              }}
            >
              {Array.from({ length: rows }).map((_, rowIdx) => 
                Array.from({ length: columns }).map((_, colIdx) => {
                  const plant = plantings.find(p => 
                    colIdx >= (p.cell_col ?? p.cell_x ?? 0) && 
                    colIdx < (p.cell_col ?? p.cell_x ?? 0) + (p.cell_span_cols || 1) &&
                    rowIdx >= (p.cell_row ?? p.cell_y ?? 0) && 
                    rowIdx < (p.cell_row ?? p.cell_y ?? 0) + (p.cell_span_rows || 1)
                  );
                  
                  if (plant && (colIdx === (plant.cell_col ?? plant.cell_x ?? 0) && rowIdx === (plant.cell_row ?? plant.cell_y ?? 0))) {
                    return (
                      <div
                        key={`${colIdx}-${rowIdx}`}
                        className="bg-emerald-500 border-2 border-emerald-600 rounded flex items-center justify-center"
                        style={{
                          gridColumn: `span ${plant.cell_span_cols || 1}`,
                          gridRow: `span ${plant.cell_span_rows || 1}`,
                          width: cellSize * (plant.cell_span_cols || 1),
                          height: cellSize * (plant.cell_span_rows || 1)
                        }}
                        title={plant?.display_name || 'Plant'}
                      >
                        <span className="text-lg">{plant.plant_type_icon || '🌱'}</span>
                      </div>
                    );
                  } else if (plant) {
                    return null;
                  } else {
                    return (
                      <div
                        key={`${colIdx}-${rowIdx}`}
                        className="rounded border-2 bg-white border-amber-300"
                        style={{ width: cellSize, height: cellSize }}
                      />
                    );
                  }
                })
              )}
            </div>
          ) : isSlotsSpace ? (
            <div className="grid gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg"
              style={{ 
                gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
                maxWidth: '100%'
              }}
            >
              {Array.from({ length: slots }).map((_, idx) => {
                const plant = plantings.find(p => p.cell_col === idx);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "w-9 h-9 rounded border-2 flex items-center justify-center",
                      plant 
                        ? "bg-emerald-500 border-emerald-600" 
                        : "bg-white border-amber-300"
                    )}
                    title={plant ? (plant.display_name || 'Plant') : 'Empty slot'}
                  >
                    {plant && <span className="text-lg">{plant.plant_type_icon || '🌱'}</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Capacity:</span>
                <span className="font-medium">{capacity} rows</span>
              </div>
              {filledCount > 0 && (
                <p className="text-sm text-emerald-700 font-medium">
                  {filledCount} plant{filledCount !== 1 ? 's' : ''} growing
                </p>
              )}
            </div>
          )}
          
          <Button 
            onClick={() => setShowPlantingModal(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700" 
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Plants
          </Button>
        </div>
      </CardContent>
      
      <PlantingModal
         open={showPlantingModal}
         onOpenChange={setShowPlantingModal}
         item={pseudoItem}
         itemType={space.space_type}
         garden={garden}
         activeSeason={activeSeason}
         seasonId={seasonId}
         onPlantingUpdate={handlePlantingUpdate}
         sharedData={sharedData}
         autoOpenSeedling={autoOpenSeedling}
       />
    </Card>
  );
}

export default function GardenPlanting() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [plantingSpaces, setPlantingSpaces] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [spaceTypeFilter, setSpaceTypeFilter] = useState('all');
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [newSeasonData, setNewSeasonData] = useState({
     year: new Date().getFullYear() + 1,
     season: 'Spring'
   });

  // CRITICAL: Page-level data cache loaded ONCE and passed to all modals
  const [sharedData, setSharedData] = useState({
    varieties: [],
    plantTypes: [],
    plantingRules: [],
    cropPlans: [],
    stashPlants: [],
    profiles: {}
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGarden) {
      console.log('[GardenPlanting] Active garden changed, loading spaces...');
      loadSeasons();
      loadPlantingSpaces();
      syncFromPlotBuilder(true);
      loadSharedData(); // Load once for all modals
    }
  }, [activeGarden]);
  
  useEffect(() => {
    if (activeSeason) {
      loadPlantingSpaces();
      loadSharedData(); // Refresh when season changes
    }
  }, [activeSeason]);

  // Load shared data ONCE for the entire page
  const loadSharedData = async () => {
    try {
      const user = await base44.auth.me();
      
      console.log('[GardenPlanting] Loading shared data for all modals...');
      const [varietiesData, typesData, rulesData, stashData] = await Promise.all([
        smartQuery(base44, 'Variety', {}, 'variety_name', 500),
        smartQuery(base44, 'PlantType', {}, 'common_name', 100),
        smartQuery(base44, 'PlantingRule', {}),
        base44.entities.SeedLot.filter({ is_wishlist: false, created_by: user.email })
      ]);
      
      let cropPlansData = [];
      if (seasonId) {
        cropPlansData = await smartQuery(base44, 'CropPlan', { 
          garden_season_id: seasonId,
          user_owner_email: user.email
        });
      }
      
      // Load profiles for stash
      const uniqueProfileIds = [...new Set(stashData.map(s => s.plant_profile_id).filter(Boolean))];
      const profilesData = uniqueProfileIds.length > 0
        ? await base44.entities.PlantProfile.filter({ id: { $in: uniqueProfileIds } })
        : [];
      
      const profilesMap = {};
      profilesData.forEach(p => {
        profilesMap[p.id] = p;
      });
      
      setSharedData({
        varieties: varietiesData,
        plantTypes: typesData,
        plantingRules: rulesData,
        cropPlans: cropPlansData.filter(p => (p.quantity_planted || 0) < (p.quantity_planned || 0)),
        stashPlants: stashData,
        profiles: profilesMap
      });
      
      console.log('[GardenPlanting] Shared data loaded:', {
        varieties: varietiesData.length,
        types: typesData.length,
        rules: rulesData.length,
        stash: stashData.length,
        profiles: Object.keys(profilesMap).length
      });
    } catch (error) {
      console.error('Error loading shared data:', error);
    }
  };

  const loadData = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    
    try {
      console.log('[GardenPlanting] Loading data...');
      const userData = await base44.auth.me();
      const gardensData = await smartQuery(base44, 'Garden', { 
        archived: false, 
        created_by: userData.email 
      }, '-updated_date');
      
      setUser(userData);
      setGardens(gardensData);
      setRateLimitError(null);

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
      if (error.code === 'RATE_LIMIT') {
        setRateLimitError(error);
        setTimeout(() => loadData(true), error.retryInMs || 5000);
      } else {
        toast.error('Failed to load gardens');
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };
  
  const loadSeasons = async () => {
    if (!activeGarden) return;
    
    try {
      const seasons = await base44.entities.GardenSeason.filter({ 
        garden_id: activeGarden.id 
      }, '-year');
      
      if (seasons.length === 0) {
        // Create default season for current year
        const currentYear = new Date().getFullYear();
        const newSeason = await base44.entities.GardenSeason.create({
          garden_id: activeGarden.id,
          year: currentYear,
          season: 'Spring',
          season_key: `${currentYear}-Spring`,
          status: 'active'
        });
        setAvailableSeasons([newSeason]);
        setActiveSeason(newSeason.season_key);
      } else {
        setAvailableSeasons(seasons);
        // Set active season to most recent or user's current year
        const currentYear = new Date().getFullYear();
        const currentSeason = seasons.find(s => s.year === currentYear);
        setActiveSeason(currentSeason?.season_key || seasons[0].season_key);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
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

  const syncFromPlotBuilder = async (silent = false) => {
    if (!activeGarden) return;
    
    if (!silent) setSyncing(true);
    setSyncResult(null);
    
    try {
      console.log('[SYNC] gardenId=', activeGarden.id);
      
      // Load all plot items for this garden with their full metadata
      const plotItems = await base44.entities.PlotItem.filter({ garden_id: activeGarden.id });
      console.log('[SYNC] found PlotItems:', plotItems.length, plotItems);
      
      // Load existing planting spaces
      const existingSpaces = await base44.entities.PlantingSpace.filter({ garden_id: activeGarden.id });
      const existingByPlotItem = {};
      existingSpaces.forEach(s => {
        if (s.plot_item_id) existingByPlotItem[s.plot_item_id] = s;
      });
      
      const plantableTypes = ['RAISED_BED', 'IN_GROUND_BED', 'GREENHOUSE', 'OPEN_PLOT', 'GROW_BAG', 'CONTAINER'];
      const plantableItems = plotItems.filter(item => plantableTypes.includes(item.item_type));
      
      console.log('[SYNC] plantable items:', plantableItems.length);
      
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
          layout_schema: layoutSchema,
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
      
      console.log('[SYNC] upserted PlantingSpaces:', created + updated, '(created:', created, ', updated:', updated, ')');
      console.log('[SYNC] done');
      
      setSyncResult({ created, updated, skipped });
      await loadPlantingSpaces();
      if (!silent) {
        toast.success(`Synced ${created + updated} spaces from layout`);
      }
    } catch (error) {
      console.error('[SYNC] Error:', error);
      if (!silent) {
        toast.error('Sync failed: ' + error.message);
      }
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  const calculateLayoutSchema = (item) => {
    const metadata = item.metadata || {};

    // GROW_BAG / CONTAINER: Always 1 plant
    if (item.item_type === 'GROW_BAG' || item.item_type === 'CONTAINER') {
      return { type: 'slots', slots: 1 };
    }

    // RAISED_BED / GREENHOUSE with grid enabled
    if (metadata.gridEnabled || item.item_type === 'GREENHOUSE' || item.item_type === 'RAISED_BED') {
      const gridSize = metadata.gridSize || 12;
      return {
        type: 'grid',
        grid_size: gridSize,
        columns: Math.floor(item.width / gridSize),
        rows: Math.floor(item.height / gridSize),
        planting_pattern: metadata.planting_pattern || 'square_foot'
      };
    }

    // IN_GROUND_BED / OPEN_PLOT: row-based
    if (item.item_type === 'IN_GROUND_BED' || item.item_type === 'OPEN_PLOT') {
      return {
        type: 'rows',
        rows: metadata.rowCount || Math.floor(item.width / (metadata.rowSpacing || 18)),
        row_spacing: metadata.rowSpacing || 18,
        planting_pattern: metadata.planting_pattern || 'square_foot'
      };
    }

    // Default fallback
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

  const handleDeleteGarden = async () => {
    if (!activeGarden) return;
    
    if (!confirm(`Delete "${activeGarden.name}"? This will permanently delete this garden, its items, and all plantings. This cannot be undone.`)) {
      return;
    }
    
    try {
      // Delete all plot items and their plantings
      const plotItems = await base44.entities.PlotItem.filter({ garden_id: activeGarden.id });
      for (const item of plotItems) {
        const plantings = await base44.entities.PlantInstance.filter({ bed_id: item.id });
        for (const planting of plantings) {
          await base44.entities.PlantInstance.delete(planting.id);
        }
        await base44.entities.PlotItem.delete(item.id);
      }
      
      // Delete planting spaces
      const spaces = await base44.entities.PlantingSpace.filter({ garden_id: activeGarden.id });
      for (const space of spaces) {
        await base44.entities.PlantingSpace.delete(space.id);
      }
      
      // Delete plots
      const plots = await base44.entities.GardenPlot.filter({ garden_id: activeGarden.id });
      for (const p of plots) {
        await base44.entities.GardenPlot.delete(p.id);
      }
      
      // Delete garden
      await base44.entities.Garden.delete(activeGarden.id);
      
      // Update UI
      const updatedGardens = gardens.filter(g => g.id !== activeGarden.id);
      setGardens(updatedGardens);
      
      if (updatedGardens.length > 0) {
        setActiveGarden(updatedGardens[0]);
      } else {
        setActiveGarden(null);
      }
      
      toast.success('Garden deleted');
    } catch (error) {
      console.error('Error deleting garden:', error);
      toast.error('Failed to delete garden');
    }
  };
  
  const handleAddSeason = async () => {
    try {
      const newSeason = await base44.entities.GardenSeason.create({
        garden_id: activeGarden.id,
        year: newSeasonData.year,
        season: newSeasonData.season,
        season_key: `${newSeasonData.year}-${newSeasonData.season}`,
        status: 'planning'
      });
      
      setAvailableSeasons([...availableSeasons, newSeason].sort((a, b) => b.year - a.year));
      setActiveSeason(newSeason.season_key);
      setShowAddSeason(false);
      setNewSeasonData({ year: new Date().getFullYear() + 1, season: 'Spring' });
      toast.success(`${newSeasonData.year} ${newSeasonData.season} created`);
    } catch (error) {
      console.error('Error creating season:', error);
      toast.error('Failed to create season');
    }
  };

  const seasonId = useMemo(() => {
    return availableSeasons.find(s => s.season_key === activeSeason)?.id;
  }, [availableSeasons, activeSeason]);

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
      <div className="space-y-6 max-w-7xl">
        {rateLimitError && (
          <RateLimitBanner 
            retryInMs={rateLimitError.retryInMs || 5000} 
            onRetry={() => loadData(true)}
            retrying={retrying}
          />
        )}
        
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sprout className="w-6 h-6" style={{ color: 'var(--primary)' }} />
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
                <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{activeGarden?.name}</h1>
              )}
            </div>
            <div className="flex gap-2">
              <Link to={createPageUrl('MyGarden') + `?gardenId=${activeGarden?.id}`}>
                <Button variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Edit Layout
                </Button>
              </Link>
              <Button 
                onClick={() => syncFromPlotBuilder(false)}
                disabled={syncing}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh from Layout
              </Button>
            </div>
          </div>

          {/* Season Selector */}
          {availableSeasons.length > 0 && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <Label className="text-sm font-medium">Season:</Label>
              <Select value={activeSeason} onValueChange={setActiveSeason}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableSeasons.map((season) => (
                    <SelectItem key={season.id} value={season.season_key}>
                      {season.year} {season.season}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                size="sm"
                variant="outline"
                onClick={() => setShowAddSeason(true)}
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Season
              </Button>
            </div>
          )}
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

        {/* Space Type Filters */}
        {plantingSpaces.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={spaceTypeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSpaceTypeFilter('all')}
              className={spaceTypeFilter === 'all' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              All ({plantingSpaces.length})
            </Button>
            {['RAISED_BED', 'GROW_BAG', 'CONTAINER', 'GREENHOUSE', 'IN_GROUND_BED', 'OPEN_PLOT'].map(type => {
              const count = plantingSpaces.filter(s => s.space_type === type).length;
              if (count === 0) return null;
              return (
                <Button
                  key={type}
                  variant={spaceTypeFilter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSpaceTypeFilter(type)}
                  className={spaceTypeFilter === type ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  {type.replace(/_/g, ' ').split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')} ({count})
                </Button>
              );
            })}
          </div>
        )}

        {/* No Spaces State */}
        {plantingSpaces.length === 0 && (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <strong>No planting spaces yet.</strong> Go to Plot Layout to design your garden with beds, 
              greenhouses, and containers. Spaces will appear here automatically.
            </AlertDescription>
          </Alert>
        )}

        {/* Planting Spaces List */}
         {plantingSpaces.length > 0 && (
           <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
             {plantingSpaces
               .filter(space => spaceTypeFilter === 'all' || space.space_type === spaceTypeFilter)
               .map((space) => (
                 <SpaceCard 
                   key={space.id} 
                   space={space} 
                   garden={activeGarden} 
                   activeSeason={activeSeason}
                   seasonId={seasonId}
                   sharedData={sharedData}
                 />
               ))}
               </div>
               )}

        {/* Add Season Dialog */}
        <Dialog open={showAddSeason} onOpenChange={setShowAddSeason}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Growing Season</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="seasonYear">Year</Label>
                <Input
                  id="seasonYear"
                  type="number"
                  min="2000"
                  max="2100"
                  value={newSeasonData.year}
                  onChange={(e) => setNewSeasonData({ ...newSeasonData, year: parseInt(e.target.value) })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="seasonName">Season</Label>
                <Select 
                  value={newSeasonData.season} 
                  onValueChange={(v) => setNewSeasonData({ ...newSeasonData, season: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                    <SelectItem value="Fall">Fall</SelectItem>
                    <SelectItem value="Winter">Winter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSeason(false)}>Cancel</Button>
              <Button 
                onClick={handleAddSeason}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Add Season
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}