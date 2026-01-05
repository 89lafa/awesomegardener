import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { 
  TreeDeciduous, 
  Plus, 
  Settings,
  Loader2,
  ChevronDown,
  Trash2,
  Calendar
} from 'lucide-react';
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
import { toast } from 'sonner';
import PlotCanvas from '@/components/garden/PlotCanvas';
import ErrorBoundary from '@/components/common/ErrorBoundary';

export default function MyGarden() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [plot, setPlot] = useState(null);
  const [activeSeason, setActiveSeason] = useState(null);
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGarden, setShowCreateGarden] = useState(false);
  const [newGardenName, setNewGardenName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGarden) {
      loadPlot();
      loadSeasons();
    }
  }, [activeGarden]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      const gardensData = await base44.entities.Garden.filter({ 
        archived: false, 
        created_by: userData.email 
      }, '-updated_date');
      
      setUser(userData);
      setGardens(gardensData);

      // Garden selection logic
      if (gardensData.length === 0) {
        // No gardens - show create CTA
        setLoading(false);
        return;
      }

      // Try to get garden from URL or user preference
      const urlGardenId = searchParams.get('gardenId');
      let selectedGarden = null;

      if (urlGardenId) {
        selectedGarden = gardensData.find(g => g.id === urlGardenId);
      } else if (userData.active_garden_id) {
        selectedGarden = gardensData.find(g => g.id === userData.active_garden_id);
      } else if (gardensData.length === 1) {
        selectedGarden = gardensData[0];
      } else {
        // Multiple gardens, no preference - use first
        selectedGarden = gardensData[0];
      }

      if (selectedGarden) {
        setActiveGarden(selectedGarden);
        // Save preference
        if (userData.active_garden_id !== selectedGarden.id) {
          await base44.auth.updateMe({ active_garden_id: selectedGarden.id });
        }
        // Update URL
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
        // Auto-create default plot
        const newPlot = await base44.entities.GardenPlot.create({
          garden_id: activeGarden.id,
          width: 480, // 40 feet
          height: 720, // 60 feet
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

  const handleAddSeason = async () => {
    const yearInput = prompt('Enter year for new season:', (new Date().getFullYear() + 1).toString());
    if (!yearInput) return;
    
    const year = parseInt(yearInput);
    if (isNaN(year) || year < 2000 || year > 2100) {
      toast.error('Invalid year');
      return;
    }
    
    try {
      const newSeason = await base44.entities.GardenSeason.create({
        garden_id: activeGarden.id,
        year,
        season: 'Spring',
        season_key: `${year}-Spring`,
        status: 'planning'
      });
      
      setAvailableSeasons([...availableSeasons, newSeason].sort((a, b) => b.year - a.year));
      setActiveSeason(newSeason.season_key);
      toast.success(`${year} season created`);
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
    
    // Save preference
    try {
      await base44.auth.updateMe({ active_garden_id: garden.id });
    } catch (error) {
      console.error('Error saving preference:', error);
    }
  };

  const handleDeleteGarden = async () => {
    if (!activeGarden) return;
    
    // Show warning dialog with red styling
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
    
    // Second confirmation - require typing garden name
    const typedName = prompt(`To confirm deletion, type the garden name exactly:\n"${activeGarden.name}"`);
    
    if (typedName !== activeGarden.name) {
      if (typedName !== null) { // Only show error if they didn't cancel
        toast.error('Garden name did not match. Deletion cancelled.');
      }
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
    if (!newGardenName.trim() || creating) return;

    setCreating(true);
    try {
      const garden = await base44.entities.Garden.create({
        name: newGardenName,
        privacy: 'private',
        planting_method: 'STANDARD'
      });

      // Create default plot
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

  return (
    <ErrorBoundary fallbackTitle="Garden Error">
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header with Garden Selector */}
        <div className="flex flex-col gap-3 pb-4 border-b">
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
            <Button 
              onClick={() => setShowCreateGarden(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Garden
            </Button>
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
                onClick={handleAddSeason}
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
                New Year
              </Button>
            </div>
          )}
        </div>

        {/* Plot Canvas */}
        {activeGarden && plot && (
          <PlotCanvas 
            garden={activeGarden}
            plot={plot}
            activeSeason={activeSeason}
            onPlotUpdate={loadPlot}
            onDeleteGarden={handleDeleteGarden}
          />
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
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Garden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}