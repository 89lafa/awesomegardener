import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Plus, 
  Loader2,
  Home,
  Edit,
  Trash2,
  ChevronRight,
  Sprout
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { smartQuery } from '@/components/utils/smartQuery';
import AdBanner from '@/components/monetization/AdBanner';

export default function IndoorGrowSpaces() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  
  const [newSpace, setNewSpace] = useState({
    name: '',
    space_type: 'room',
    width_ft: 15,
    length_ft: 30,
    height_ft: 8
  });

  useEffect(() => {
    loadSpaces();
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     WAVE-BASED LOADING — prevents 429 rate limit errors
     
     OLD CODE: 6 simultaneous queries in Promise.all
       → Works in isolation but when you browse other pages first
         (Dashboard, Calendar, Tasks), the rate budget is already
         eaten → this page's 6 parallel calls hit 429
     
     NEW CODE: 2 waves of 3 queries each with 800ms gap
       Wave 1: spaces + racks + shelves  → show page immediately
       Wave 2: trays + containers + cells → complete the stats
     ═══════════════════════════════════════════════════════════════ */
  const loadSpaces = async (retryCount = 0) => {
    try {
      setLoading(true);
      const user = await base44.auth.me();
      
      // WAVE 1: Core structure (3 calls with smartQuery caching)
      const [spacesData, allRacks, allShelves] = await Promise.all([
        smartQuery(base44, 'IndoorGrowSpace', { created_by: user.email }, '-created_date'),
        smartQuery(base44, 'GrowRack', { created_by: user.email }),
        smartQuery(base44, 'GrowShelf', { created_by: user.email })
      ]);

      // Build lookup maps immediately
      const racksBySpaceId = {};
      allRacks.forEach(rack => {
        if (!racksBySpaceId[rack.indoor_space_id]) racksBySpaceId[rack.indoor_space_id] = [];
        racksBySpaceId[rack.indoor_space_id].push(rack);
      });

      const shelfsByRackId = {};
      allShelves.forEach(shelf => {
        if (!shelfsByRackId[shelf.rack_id]) shelfsByRackId[shelf.rack_id] = [];
        shelfsByRackId[shelf.rack_id].push(shelf.id);
      });

      // Show spaces immediately with partial stats (racks only)
      const spacesWithPartialStats = spacesData.map(space => ({
        ...space,
        stats: {
          racks: (racksBySpaceId[space.id] || []).length,
          trays: '…',
          containers: '…',
          activeSeedlings: '…',
          activePlants: '…'
        }
      }));
      setSpaces(spacesWithPartialStats);
      setLoading(false); // ← Page visible NOW with partial data

      // WAVE 2: Detail data (800ms delay to avoid rate limit)
      setTimeout(async () => {
        try {
          const [allTrays, allContainers, allCells] = await Promise.all([
            smartQuery(base44, 'SeedTray', { created_by: user.email }),
            smartQuery(base44, 'IndoorContainer', { created_by: user.email }),
            smartQuery(base44, 'TrayCell', { created_by: user.email })
          ]);

          // Calculate complete stats in memory (zero additional API calls)
          setSpaces(spacesData.map(space => {
            const spaceRacks = racksBySpaceId[space.id] || [];
            
            // Get all shelf IDs belonging to racks in this space
            const shelfIdsInSpace = new Set();
            spaceRacks.forEach(rack => {
              const shelves = shelfsByRackId[rack.id] || [];
              shelves.forEach(shelfId => shelfIdsInSpace.add(shelfId));
            });

            // Trays: directly in space OR on shelves in this space
            const spaceTrays = allTrays.filter(t => 
              t.indoor_space_id === space.id || 
              (t.shelf_id && shelfIdsInSpace.has(t.shelf_id))
            );

            const spaceContainers = allContainers.filter(c => c.indoor_space_id === space.id);
            
            // Count active seedlings from tray cells
            const trayIds = new Set(spaceTrays.map(t => t.id));
            const activeSeedlings = allCells.filter(cell => 
              trayIds.has(cell.tray_id) && 
              ['seeded', 'germinated', 'growing'].includes(cell.status)
            ).length;
            
            const activePlants = spaceContainers.filter(c => 
              c.status === 'growing' || c.status === 'planted'
            ).length;
            
            return {
              ...space,
              stats: {
                racks: spaceRacks.length,
                trays: spaceTrays.length,
                containers: spaceContainers.length,
                activeSeedlings,
                activePlants
              }
            };
          }));
        } catch (wave2Error) {
          console.warn('Wave 2 stats failed (non-critical):', wave2Error.message);
          // Replace "…" with 0 so UI isn't stuck showing dots
          setSpaces(prev => prev.map(s => ({
            ...s,
            stats: {
              ...s.stats,
              trays: typeof s.stats.trays === 'string' ? 0 : s.stats.trays,
              containers: typeof s.stats.containers === 'string' ? 0 : s.stats.containers,
              activeSeedlings: typeof s.stats.activeSeedlings === 'string' ? 0 : s.stats.activeSeedlings,
              activePlants: typeof s.stats.activePlants === 'string' ? 0 : s.stats.activePlants,
            }
          })));
        }
      }, 800);

    } catch (error) {
      console.error('Error loading spaces:', error);
      
      // Auto-retry on rate limit (up to 2 retries with exponential backoff)
      if (error.message?.includes('Rate limit') && retryCount < 2) {
        const delay = (retryCount + 1) * 3000; // 3s, 6s
        console.log(`[IndoorGrowSpaces] Rate limited, retrying in ${delay/1000}s (attempt ${retryCount + 1}/2)`);
        setTimeout(() => loadSpaces(retryCount + 1), delay);
        return; // Don't set loading=false yet
      }
      
      toast.error('Failed to load indoor spaces');
      setLoading(false);
    }
  };

  const handleCreateSpace = async () => {
    if (!newSpace.name.trim()) {
      toast.error('Please enter a space name');
      return;
    }
    
    setCreating(true);
    try {
      const space = await base44.entities.IndoorGrowSpace.create(newSpace);
      const spaceWithStats = {
        ...space,
        stats: { racks: 0, trays: 0, containers: 0, activeSeedlings: 0, activePlants: 0 }
      };
      setSpaces([spaceWithStats, ...spaces]);
      setNewSpace({ name: '', space_type: 'room', width_ft: 15, length_ft: 30, height_ft: 8 });
      setShowNewDialog(false);
      toast.success('Indoor grow space created!');
    } catch (error) {
      console.error('Error creating space:', error);
      toast.error('Failed to create space');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSpace = async (spaceId) => {
    if (!confirm('Delete this space and all its contents?')) return;
    
    setDeleting(spaceId);
    try {
      await base44.entities.IndoorGrowSpace.delete(spaceId);
      setSpaces(spaces.filter(s => s.id !== spaceId));
      toast.success('Space deleted');
    } catch (error) {
      console.error('Error deleting space:', error);
      toast.error('Failed to delete space');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>🏠 Indoor Grow Spaces</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Start seeds indoors before transplanting</p>
        </div>
        <Button 
          onClick={() => setShowNewDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Space
        </Button>
      </div>

      <AdBanner placement="top_banner" pageType="indoor_grow" />

      {/* Spaces Grid */}
      {spaces.length === 0 ? (
        <Card className="p-12 text-center">
          <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No indoor spaces yet</h3>
          <p className="text-gray-600 mb-6">Create your first grow room or tent to start tracking seeds</p>
          <Button 
            onClick={() => setShowNewDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Create Indoor Space
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map(space => (
            <Card 
              key={space.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(createPageUrl('IndoorGrowDetail') + `?id=${space.id}`)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{space.name}</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {space.width_ft}ft × {space.length_ft}ft • {space.space_type === 'room' ? '🏠 Room' : '⛺ Tent'}
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-xs text-gray-600">Racks</p>
                    <p className="text-lg font-semibold text-blue-700">{space.stats.racks}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-xs text-gray-600">Trays</p>
                    <p className="text-lg font-semibold text-green-700">{space.stats.trays}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2">
                    <p className="text-xs text-gray-600">Active Seedlings</p>
                    <p className="text-lg font-semibold text-purple-700">🌱 {space.stats.activeSeedlings}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2">
                    <p className="text-xs text-gray-600">Containers</p>
                    <p className="text-lg font-semibold text-orange-700">🪴 {space.stats.containers}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(createPageUrl('IndoorGrowDetail') + `?id=${space.id}`);
                    }}
                  >
                    Open
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSpace(space.id);
                    }}
                    disabled={deleting === space.id}
                  >
                    {deleting === space.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New Space Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Indoor Grow Space</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Space Name</label>
              <Input
                placeholder="e.g., Basement Grow Room"
                value={newSpace.name}
                onChange={(e) => setNewSpace({...newSpace, name: e.target.value})}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Type</label>
              <Select 
                value={newSpace.space_type}
                onValueChange={(v) => setNewSpace({...newSpace, space_type: v})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">🏠 Room</SelectItem>
                  <SelectItem value="grow_tent">⛺ Grow Tent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Width (ft)</label>
                <Input
                  type="number"
                  value={newSpace.width_ft}
                  onChange={(e) => setNewSpace({...newSpace, width_ft: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Length (ft)</label>
                <Input
                  type="number"
                  value={newSpace.length_ft}
                  onChange={(e) => setNewSpace({...newSpace, length_ft: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Height (ft)</label>
                <Input
                  type="number"
                  value={newSpace.height_ft}
                  onChange={(e) => setNewSpace({...newSpace, height_ft: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateSpace}
              disabled={creating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Space
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
