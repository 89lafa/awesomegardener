import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { 
  TreeDeciduous, 
  Plus, 
  Settings,
  Loader2,
  ChevronDown,
  Layout,
  Sprout
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
  
  // SAFE MODE: Disable planting layer if ?safe=1
  const safeMode = searchParams.get('safe') === '1';
  
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [plot, setPlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateGarden, setShowCreateGarden] = useState(false);
  const [newGardenName, setNewGardenName] = useState('');
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState('layout'); // 'layout' or 'planting'

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGarden) {
      loadPlot();
    }
  }, [activeGarden]);

  const loadData = async () => {
    try {
      const [userData, gardensData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Garden.filter({ archived: false }, '-updated_date')
      ]);
      
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
          width: 240, // 20 feet
          height: 360, // 30 feet
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

  const handleCreateGarden = async () => {
    if (!newGardenName.trim() || creating) return;

    setCreating(true);
    try {
      const garden = await base44.entities.Garden.create({
        name: newGardenName,
        privacy: 'private'
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
        <span className="ml-3 text-gray-600">Loading gardens...</span>
      </div>
    );
  }

  // Debug info (dev mode)
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev && activeGarden) {
    console.log('MyGarden Debug:', {
      activeGardenId: activeGarden?.id,
      plotId: plot?.id,
      mode,
      hasPlot: !!plot
    });
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

  // Keyboard shortcuts - unconditional hook
  useEffect(() => {
    // Skip if safe mode
    if (safeMode) return;
    
    const handleKeyPress = (e) => {
      if (e.key === 'l' || e.key === 'L') {
        setMode('layout');
      } else if (e.key === 'p' || e.key === 'P') {
        setMode('planting');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [safeMode]);

  return (
    <ErrorBoundary fallbackTitle="My Garden Error" fallbackMessage="Failed to load My Garden. This might be due to missing data or a component error.">
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Safe Mode Banner */}
        {safeMode && (
          <div className="bg-orange-50 border border-orange-200 px-4 py-2 text-sm mb-2 rounded">
            <strong>SAFE MODE:</strong> Planting features disabled. Remove ?safe=1 from URL to enable.
          </div>
        )}
        
        {/* Debug Banner - Dev Only */}
        {isDev && activeGarden && (
          <div className="bg-yellow-50 border border-yellow-200 px-4 py-2 text-xs mb-2 rounded">
            <strong>Debug:</strong> Garden: {activeGarden.id.slice(0,8)} | Plot: {plot?.id?.slice(0,8) || 'loading'} | Mode: {mode} | Safe: {safeMode ? 'ON' : 'OFF'}
          </div>
        )}
        {/* Header with Garden Selector and Mode Toggle */}
        <div className="flex items-center justify-between pb-4 border-b">
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
          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            {!safeMode && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <Button
                  size="sm"
                  variant={mode === 'layout' ? 'default' : 'ghost'}
                  onClick={() => setMode('layout')}
                  className="gap-2"
                >
                  <Layout className="w-4 h-4" />
                  Layout <span className="text-xs opacity-60">(L)</span>
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'planting' ? 'default' : 'ghost'}
                  onClick={() => setMode('planting')}
                  className="gap-2"
                >
                  <Sprout className="w-4 h-4" />
                  Planting <span className="text-xs opacity-60">(P)</span>
                </Button>
              </div>
            )}
            <Button 
              onClick={() => setShowCreateGarden(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Garden
            </Button>
          </div>
        </div>

        {/* Plot Canvas */}
        {activeGarden && plot ? (
          <ErrorBoundary fallbackTitle="Canvas Error" fallbackMessage="The garden canvas failed to render. Try refreshing the page.">
            <PlotCanvas 
              garden={activeGarden}
              plot={plot}
              mode={safeMode ? 'layout' : mode}
              safeMode={safeMode}
              onPlotUpdate={loadPlot}
            />
          </ErrorBoundary>
        ) : activeGarden && !plot ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="ml-3 text-gray-600">Loading plot...</span>
          </div>
        ) : null}
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