import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { 
  TreeDeciduous, 
  Plus, 
  Settings,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
  Copy,
  Eye,
  Grid3x3,
  Layers,
  X
} from 'lucide-react';
import Garden3DView from '@/components/garden/Garden3DView';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import PlotCanvas from '@/components/garden/PlotCanvas';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import ShareButton from '@/components/common/ShareButton';

export default function MyGarden() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [plot, setPlot] = useState(null);
  const [activeSeason, setActiveSeason] = useState(null);
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemPlantings, setSelectedItemPlantings] = useState([]);
  const [showCreateGarden, setShowCreateGarden] = useState(false);
  const [newGardenName, setNewGardenName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [newSeasonData, setNewSeasonData] = useState({
    year: new Date().getFullYear() + 1,
    season: 'Spring'
  });
  const [viewMode, setViewMode] = useState('standard');
  const [plotItems, setPlotItems] = useState([]);
  const [plantingCounts, setPlantingCounts] = useState({});
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [plantingRules, setPlantingRules] = useState([]);
 const getPlantsPerSlot = (planting, containerType) => {
  if (!planting?.plant_type_id) return 1;
  const rule = plantingRules.find(r => 
    r.plant_type_id === planting.plant_type_id && 
    r.container_type === containerType
  ) || plantingRules.find(r => r.plant_type_id === planting.plant_type_id);
  return rule?.plants_per_grid_slot || 1;
};
 
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGarden) {
      loadPlot();
      loadSeasons();
      load3DData();
    }
  }, [activeGarden]);

  const load3DData = async () => {
    if (!activeGarden) return;
    try {
      const items = await base44.entities.PlotItem.filter({ garden_id: activeGarden.id });
      const plantings = await base44.entities.PlantInstance.filter({ garden_id: activeGarden.id });
      
      const counts = {};
      items.forEach(item => {
        const itemPlantings = plantings.filter(p => p.bed_id === item.id);
        const capacity = (item.metadata?.grid_rows * item.metadata?.grid_cols) || item.metadata?.capacity || 0;
        counts[item.id] = {
  filled: itemPlantings.reduce((sum, p) => sum + ((p.cell_span_cols || 1) * (p.cell_span_rows || 1) * getPlantsPerSlot(p, item.item_type)), 0),
  capacity
};
      });

      setPlotItems(items);
      setPlantingCounts(counts);
    } catch (error) {
      console.error('Error loading 3D data:', error);
    }
  };

  useEffect(() => {
    if (selectedItem && activeSeason) {
      loadSelectedItemPlantings();
    }
  }, [selectedItem, activeSeason]);

  const loadSelectedItemPlantings = async () => {
    if (!selectedItem || !activeSeason) return;
    
    try {
      const allPlantings = await base44.entities.PlantInstance.filter({ 
        bed_id: selectedItem.id,
        garden_id: activeGarden.id
      });
      
      const currentYear = new Date().getFullYear();
      const isCurrentYearSeason = activeSeason && activeSeason.startsWith(currentYear.toString());
      
      const filteredPlantings = allPlantings.filter(p => {
        if (!p.season_year) {
          return isCurrentYearSeason;
        }
        return p.season_year === activeSeason;
      });
      
      setSelectedItemPlantings(filteredPlantings);
    } catch (error) {
      console.error('Error loading plantings:', error);
    }
  };

const loadData = async () => {
  try {
    const userData = await base44.auth.me();
    const [gardensData, rulesData] = await Promise.all([
      base44.entities.Garden.filter({ 
        archived: false, 
        created_by: userData.email 
      }, '-updated_date'),
      base44.entities.PlantingRule.list()
    ]);
    
    setPlantingRules(rulesData || []);
      
      setUser(userData);
      setGardens(gardensData);

      if (gardensData.length === 0) {
        setLoading(false);
        return;
      }

      const urlGardenId = searchParams.get('gardenId');
      let selectedGarden = null;

      if (urlGardenId) {
        selectedGarden = gardensData.find(g => g.id === urlGardenId);
      } else if (userData.active_garden_id) {
        selectedGarden = gardensData.find(g => g.id === userData.active_garden_id);
      } else if (gardensData.length === 1) {
        selectedGarden = gardensData[0];
      } else {
        selectedGarden = gardensData[0];
      }

      if (selectedGarden) {
        setActiveGarden(selectedGarden);
        if (userData.active_garden_id !== selectedGarden.id) {
          await base44.auth.updateMe({ active_garden_id: selectedGarden.id });
        }
        setSearchParams({ gardenId: selectedGarden.id });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load gardens');
    } finally {
      setLoading(false);
    }
  };

  const loadPlot = async () => {
    try {
      const plots = await base44.entities.GardenPlot.filter({ garden_id: activeGarden.id });
      
      if (plots.length === 0) {
        const newPlot = await base44.entities.GardenPlot.create({
          garden_id: activeGarden.id,
          width: 480,
          height: 720,
          units: 'ft',
          shape_type: 'RECTANGLE',
          grid_enabled: true,
          grid_size: 12
        });
        setPlot(newPlot);
      } else {
        setPlot(plots[0]);
      }
    } catch (error) {
      console.error('Error loading plot:', error);
    }
  };

  const loadSeasons = async () => {
    if (!activeGarden) return;
    
    try {
      const seasons = await base44.entities.GardenSeason.filter({ 
        garden_id: activeGarden.id 
      }, '-year');
      
      if (seasons.length === 0) {
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
        const currentYear = new Date().getFullYear();
        const currentSeason = seasons.find(s => s.year === currentYear);
        setActiveSeason(currentSeason?.season_key || seasons[0].season_key);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
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

  const handleDeleteGarden = async () => {
    if (!activeGarden) return;
    
    const confirmed = confirm(
      `⚠️ DELETE ENTIRE GARDEN?\n\n` +
      `You are about to permanently delete "${activeGarden.name}".\n\n` +
      `This will delete:\n` +
      `• The entire garden\n` +
      `• All raised beds, greenhouses, and other items\n` +
      `• All plantings and plant data\n\n` +
      `THIS CANNOT BE UNDONE.\n\n` +
      `Type the garden name to confirm deletion.`
    );
    
    if (!confirmed) return;
    
    const typedName = prompt(`To confirm deletion, type the garden name exactly:\n"${activeGarden.name}"`);
    
    if (typedName !== activeGarden.name) {
      if (typedName !== null) {
        toast.error('Garden name did not match. Deletion cancelled.');
      }
      return;
    }
    
    try {
      const plotItems = await base44.entities.PlotItem.filter({ garden_id: activeGarden.id });
      for (const item of plotItems) {
        const plantings = await base44.entities.PlantInstance.filter({ bed_id: item.id });
        for (const planting of plantings) {
          await base44.entities.PlantInstance.delete(planting.id);
        }
        await base44.entities.PlotItem.delete(item.id);
      }
      
      const spaces = await base44.entities.PlantingSpace.filter({ garden_id: activeGarden.id });
      for (const space of spaces) {
        await base44.entities.PlantingSpace.delete(space.id);
      }
      
      const plots = await base44.entities.GardenPlot.filter({ garden_id: activeGarden.id });
      for (const p of plots) {
        await base44.entities.GardenPlot.delete(p.id);
      }
      
      await base44.entities.Garden.delete(activeGarden.id);
      
      const updatedGardens = gardens.filter(g => g.id !== activeGarden.id);
      setGardens(updatedGardens);
      
      if (updatedGardens.length > 0) {
        setActiveGarden(updatedGardens[0]);
        setSearchParams({ gardenId: updatedGardens[0].id });
      } else {
        setActiveGarden(null);
        setPlot(null);
        setSearchParams({});
      }
      
      toast.success('Garden deleted');
    } catch (error) {
      console.error('Error deleting garden:', error);
      toast.error('Failed to delete garden');
    }
  };

  const handleCreateGarden = async () => {
    if (!newGardenName.trim()) return;
    if (creating) return;
    setCreating(true);
    try {
      const garden = await base44.entities.Garden.create({
        name: newGardenName,
        privacy: 'private',
        planting_method: 'STANDARD'
      });

      const newPlot = await base44.entities.GardenPlot.create({
        garden_id: garden.id,
        width: 240,
        height: 360,
        units: 'ft',
        shape_type: 'RECTANGLE',
        grid_enabled: true,
        grid_size: 12
      });

      setGardens([garden, ...gardens]);
      setActiveGarden(garden);
      setPlot(newPlot);
      setShowCreateGarden(false);
      setNewGardenName('');
      setSearchParams({ gardenId: garden.id });
      
      await base44.auth.updateMe({ active_garden_id: garden.id });
      toast.success('Garden created!');
    } catch (error) {
      console.error('Error creating garden:', error);
      toast.error('Failed to create garden');
    } finally {
      setCreating(false);
    }
  };

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
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <TreeDeciduous className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Create Your First Garden</h2>
            <p className="text-gray-600 mb-6">
              Start planning your garden layout with beds, greenhouses, and more
            </p>
            <Button 
              onClick={() => setShowCreateGarden(true)}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Garden
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Deduplicate plantings for summary display
  const plantingSummary = (() => {
    if (!selectedItemPlantings.length) return [];
    const grouped = {};
    selectedItemPlantings.forEach(p => {
      const name = p.display_name || 'Unknown';
      const icon = p.plant_type_icon || '🌱';
      const key = `${icon}-${name}`;
      if (!grouped[key]) {
        grouped[key] = { name, icon, count: 0 };
      }
      grouped[key].count += (p.cell_span_cols || 1) * (p.cell_span_rows || 1) * getPlantsPerSlot(p, selectedItem?.item_type);
    });
    return Object.values(grouped).sort((a, b) => b.count - a.count);
  })();

const totalPlants = selectedItemPlantings.reduce(
  (sum, p) => sum + ((p.cell_span_cols || 1) * (p.cell_span_rows || 1) * getPlantsPerSlot(p, selectedItem?.item_type)), 0
);

  return (
    <ErrorBoundary fallbackTitle="Garden Error">
      <div className="h-[calc(100vh-8rem)] flex flex-col pb-20 lg:pb-0">
        {/* Header with Garden Selector */}
        <div className="flex flex-col gap-2 lg:gap-3 pb-3 lg:pb-4 border-b">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-4">
            <div className="flex items-center gap-2 lg:gap-3 flex-1 w-full lg:w-auto">
              <TreeDeciduous className="w-5 h-5 lg:w-6 lg:h-6 text-emerald-600 flex-shrink-0" />
              {gardens.length > 1 ? (
                <Select value={activeGarden?.id} onValueChange={handleGardenChange}>
                  <SelectTrigger className="w-full lg:w-64 text-sm lg:text-base">
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
                <h1 className="text-lg lg:text-2xl font-bold text-gray-900">{activeGarden?.name}</h1>
              )}
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
              <button
                onClick={() => setViewMode('standard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  viewMode === 'standard' ? 'bg-emerald-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Grid3x3 size={16} />
                <span className="hidden sm:inline">Standard</span>
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  viewMode === '3d' ? 'bg-emerald-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Layers size={16} />
                <span className="hidden sm:inline">3D View</span>
              </button>
            </div>

            {/* Desktop Only - Public Toggle + Share Buttons */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white">
                <Label className="text-sm cursor-pointer flex items-center gap-2">
                  <Switch
                    checked={activeGarden?.is_public || false}
                    onCheckedChange={async (checked) => {
                      try {
                        await base44.entities.Garden.update(activeGarden.id, { 
                          is_public: checked,
                          privacy: checked ? 'public' : 'private'
                        });
                        setActiveGarden({ ...activeGarden, is_public: checked, privacy: checked ? 'public' : 'private' });
                        toast.success(checked ? 'Garden is now public' : 'Garden is now private');
                        loadData();
                      } catch (error) {
                        console.error('Error updating privacy:', error);
                        toast.error('Failed to update privacy');
                      }
                    }}
                  />
                  {activeGarden?.is_public ? '🌐 Public' : '🔒 Private'}
                </Label>
              </div>
              
              {activeGarden?.is_public && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const publicUrl = `${window.location.origin}${createPageUrl('PublicGarden')}?id=${activeGarden.id}`;
                      navigator.clipboard.writeText(publicUrl);
                      toast.success('Public link copied!');
                    }}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(`${createPageUrl('PublicGarden')}?id=${activeGarden.id}`, '_blank');
                    }}
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </Button>
                  <ShareButton
                    title={`${activeGarden.name} - AwesomeGardener`}
                    text={`Check out my garden on AwesomeGardener!`}
                    url={`${window.location.origin}${createPageUrl('PublicGarden')}?id=${activeGarden.id}`}
                    imageUrl={activeGarden.cover_image}
                  />
                </>
              )}
            </div>

            <Button 
              onClick={() => setShowCreateGarden(true)}
              variant="outline"
              size="sm"
              className="gap-1 lg:gap-2 hidden lg:flex"
            >
              <Plus className="w-3 h-3 lg:w-4 lg:h-4" />
              New Garden
            </Button>
          </div>

          {/* Season Selector + Mode Selector */}
          <div className="flex items-center gap-2 lg:gap-4 flex-wrap text-sm lg:text-base">
            {availableSeasons.length > 0 && (
              <div className="flex items-center gap-1 lg:gap-2 flex-1 lg:flex-none">
                <Calendar className="w-3 h-3 lg:w-4 lg:h-4 text-gray-500 flex-shrink-0" />
                <Label className="text-xs lg:text-sm font-medium hidden lg:inline">Season:</Label>
                <Select value={activeSeason} onValueChange={setActiveSeason}>
                  <SelectTrigger className="w-28 lg:w-36 text-xs lg:text-sm h-8 lg:h-9">
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
                  className="gap-1 hidden lg:flex h-8"
                >
                  <Plus className="w-3 h-3" />
                  Add Season
                </Button>
              </div>
            )}
            
            <div className="flex items-center gap-1 lg:gap-2 flex-1 lg:flex-none">
              <Label className="text-xs lg:text-sm font-medium hidden lg:inline">Mode:</Label>
              <Select 
                value={activeGarden?.chaos_mode ? 'chaos' : 'standard'}
                onValueChange={async (value) => {
                  const chaosMode = value === 'chaos';
                  await base44.entities.Garden.update(activeGarden.id, { chaos_mode: chaosMode });
                  setGardens(gardens.map(g => g.id === activeGarden.id ? { ...g, chaos_mode: chaosMode } : g));
                  setActiveGarden({ ...activeGarden, chaos_mode: chaosMode });
                  toast.success(chaosMode ? 'Chaos Mode enabled! Freeform planting.' : 'Standard mode restored');
                }}
              >
                <SelectTrigger className="w-32 lg:w-40 text-xs lg:text-sm h-8 lg:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">📐 Standard</SelectItem>
                  <SelectItem value="chaos">🎨 Chaos Garden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Plot Canvas or 3D View */}
        {activeGarden && plot && activeSeason && (
          <>
            {activeGarden?.chaos_mode && (
              <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-900">
                  🎨 <strong>Chaos Garden Mode:</strong> Freeform planting without strict grid constraints. Place items anywhere!
                </p>
              </div>
            )}
            
            {viewMode === 'standard' ? (
              <PlotCanvas 
                garden={activeGarden}
                plot={plot}
                activeSeason={activeSeason}
                seasonId={availableSeasons.find(s => s.season_key === activeSeason)?.id}
                onPlotUpdate={() => {
                  loadPlot();
                  load3DData();
                }}
                onDeleteGarden={handleDeleteGarden}
                onItemSelect={(item) => {
                  setSelectedItem(item);
                  setDetailExpanded(true); // Auto-expand when selecting new item
                }}
              />
            ) : (
              <Garden3DView
                structures={plotItems}
                plotLayout={plot}
                plantingCounts={plantingCounts}
              />
            )}

            {/* ═══════════════════════════════════════════
                Selected Item Detail — COMPACT & COLLAPSIBLE
                Max height capped, scrollable, with dismiss
                ═══════════════════════════════════════════ */}
            {selectedItem && (
              <Card className="mt-4 lg:mb-0 mb-32 relative z-0 hidden lg:block border-emerald-200">
                <CardContent className="p-4">
                  {/* Header row — always visible */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {selectedItem.label}
                        </h3>
                        <p className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
                          {selectedItem.item_type.replace(/_/g, ' ')} • {selectedItem.width}" × {selectedItem.height}"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-xl font-bold text-emerald-600">{totalPlants}</div>
                        <p className="text-[10px] text-gray-500">plants</p>
                      </div>

                      {/* Expand/Collapse toggle — DOWN arrow = collapse, UP arrow = expand */}
                      <button
                        onClick={() => setDetailExpanded(!detailExpanded)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                        title={detailExpanded ? 'Collapse' : 'Expand'}
                      >
                        {detailExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        )}
                      </button>

                      {/* Dismiss button */}
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                        title="Close"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable content */}
                  {detailExpanded && (
                    <div className="mt-3">
                      {plantingSummary.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                            Currently Growing ({plantingSummary.length} {plantingSummary.length === 1 ? 'variety' : 'varieties'}):
                          </h4>
                          {/* Capped height with scroll — never takes over the screen */}
                          <div className="max-h-48 overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                              {plantingSummary.map((item, idx) => (
                                <div 
                                  key={idx}
                                  className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200"
                                >
                                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
                                      {item.name}
                                    </span>
                                    {item.count > 1 && (
                                      <span className="text-[10px] text-emerald-600 font-bold">×{item.count}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-gray-50 rounded-lg">
                          <p className="text-gray-500 text-sm">No plants in this {selectedItem.item_type.replace(/_/g, ' ').toLowerCase()} yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Create Garden Dialog */}
      <Dialog open={showCreateGarden} onOpenChange={setShowCreateGarden}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Garden</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="gardenName">Garden Name</Label>
            <Input
              id="gardenName"
              placeholder="e.g., Backyard Garden"
              value={newGardenName}
              onChange={(e) => setNewGardenName(e.target.value)}
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) {
                  handleCreateGarden();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGarden(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateGarden}
              disabled={!newGardenName.trim() || creating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Garden'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </ErrorBoundary>
  );
}
