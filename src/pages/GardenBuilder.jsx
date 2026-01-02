import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import SpaceCanvas from '@/components/builder/SpaceCanvas';
import { 
  TreeDeciduous, 
  Plus, 
  Settings, 
  ChevronRight,
  Layers,
  Loader2,
  Save,
  ArrowLeft,
  MoreVertical,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AdBanner from '@/components/monetization/AdBanner';

const SPACE_TYPES = [
  { value: 'raised_bed_area', label: 'Raised Bed Area' },
  { value: 'inground_plot', label: 'In-Ground Plot' },
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'container_zone', label: 'Container Zone' },
  { value: 'custom', label: 'Custom' },
];

export default function GardenBuilder() {
  const [searchParams] = useSearchParams();
  const gardenId = searchParams.get('gardenId');

  const [garden, setGarden] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [beds, setBeds] = useState([]);
  const [plants, setPlants] = useState([]);
  const [companionRules, setCompanionRules] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const [newSpace, setNewSpace] = useState({
    name: '',
    type: 'raised_bed_area'
  });

  useEffect(() => {
    if (gardenId) {
      loadGardenData();
    }
  }, [gardenId]);

  const loadGardenData = async () => {
    try {
      const [gardenData, spacesData, bedsData, plantsData, rulesData] = await Promise.all([
        base44.entities.Garden.filter({ id: gardenId }),
        base44.entities.GardenSpace.filter({ garden_id: gardenId }, 'sort_order'),
        base44.entities.Bed.filter({ garden_id: gardenId }),
        base44.entities.PlantInstance.filter({ garden_id: gardenId }),
        base44.entities.CompanionRule.list()
      ]);

      if (gardenData.length > 0) {
        setGarden(gardenData[0]);
      }
      setSpaces(spacesData);
      setBeds(bedsData);
      setPlants(plantsData);
      setCompanionRules(rulesData);

      if (spacesData.length > 0) {
        setSelectedSpace(spacesData[0]);
      }
    } catch (error) {
      console.error('Error loading garden data:', error);
      toast.error('Failed to load garden');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSpace = async () => {
    if (!newSpace.name.trim()) return;

    try {
      const space = await base44.entities.GardenSpace.create({
        garden_id: gardenId,
        name: newSpace.name,
        type: newSpace.type,
        canvas_width: 800,
        canvas_height: 600,
        sort_order: spaces.length
      });

      setSpaces([...spaces, space]);
      setSelectedSpace(space);
      setShowAddSpace(false);
      setNewSpace({ name: '', type: 'raised_bed_area' });
      toast.success('Space added!');
    } catch (error) {
      console.error('Error adding space:', error);
      toast.error('Failed to add space');
    }
  };

  const handleDeleteSpace = async (space) => {
    if (!confirm(`Delete "${space.name}" and all its beds?`)) return;

    try {
      // Delete all beds and plants in this space
      const spaceBeds = beds.filter(b => b.space_id === space.id);
      const spacePlants = plants.filter(p => p.space_id === space.id);

      for (const plant of spacePlants) {
        await base44.entities.PlantInstance.delete(plant.id);
      }
      for (const bed of spaceBeds) {
        await base44.entities.Bed.delete(bed.id);
      }
      await base44.entities.GardenSpace.delete(space.id);

      const newSpaces = spaces.filter(s => s.id !== space.id);
      setSpaces(newSpaces);
      setBeds(beds.filter(b => b.space_id !== space.id));
      setPlants(plants.filter(p => p.space_id !== space.id));

      if (selectedSpace?.id === space.id) {
        setSelectedSpace(newSpaces[0] || null);
      }

      toast.success('Space deleted');
    } catch (error) {
      console.error('Error deleting space:', error);
      toast.error('Failed to delete space');
    }
  };

  const handleDataUpdate = () => {
    loadGardenData();
    setLastSaved(new Date());
  };

  if (!gardenId) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <TreeDeciduous className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No garden selected</h2>
          <p className="text-gray-600 mb-4">Choose a garden to start building</p>
          <Link to={createPageUrl('Gardens')}>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              View My Gardens
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('Gardens')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{garden?.name}</h1>
            {lastSaved && (
              <p className="text-xs text-gray-500">
                Last saved: {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdBanner placement="inline_card" pageType="garden_builder" className="hidden xl:block w-64" />
        </div>
      </div>

      <div className="flex-1 flex min-h-0 mt-4">
        {/* Space Tabs - Left Side */}
        <div className="w-48 lg:w-56 flex-shrink-0 border-r pr-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Spaces
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAddSpace(true)}
              className="h-7 w-7"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto space-y-1">
            {spaces.map((space) => (
              <div
                key={space.id}
                className={cn(
                  "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                  selectedSpace?.id === space.id 
                    ? "bg-emerald-100 text-emerald-900" 
                    : "hover:bg-gray-100"
                )}
                onClick={() => setSelectedSpace(space)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{space.name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {space.type.replace(/_/g, ' ')}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDeleteSpace(space)} className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Space
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {spaces.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-2">No spaces yet</p>
                <Button 
                  size="sm" 
                  onClick={() => setShowAddSpace(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Add Space
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 min-w-0">
          {selectedSpace ? (
            <SpaceCanvas
              space={selectedSpace}
              gardenId={gardenId}
              beds={beds.filter(b => b.space_id === selectedSpace.id)}
              plantInstances={plants.filter(p => p.space_id === selectedSpace.id)}
              companionRules={companionRules}
              onUpdate={handleDataUpdate}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl">
              <div className="text-center">
                <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">Select or create a space to start</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Space Dialog */}
      <Dialog open={showAddSpace} onOpenChange={setShowAddSpace}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Space</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="spaceName">Space Name</Label>
              <Input
                id="spaceName"
                placeholder="e.g., Main Garden, Greenhouse"
                value={newSpace.name}
                onChange={(e) => setNewSpace({ ...newSpace, name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Space Type</Label>
              <Select 
                value={newSpace.type} 
                onValueChange={(v) => setNewSpace({ ...newSpace, type: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPACE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSpace(false)}>Cancel</Button>
            <Button 
              onClick={handleAddSpace}
              disabled={!newSpace.name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Add Space
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}