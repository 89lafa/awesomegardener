import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft,
  Plus,
  Loader2,
  Edit,
  Trash2,
  Package,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function IndoorSpaceDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const spaceId = urlParams.get('id');

  const [space, setSpace] = useState(null);
  const [racks, setRacks] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRackDialog, setShowAddRackDialog] = useState(false);
  const [showAddContainerDialog, setShowAddContainerDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [newRack, setNewRack] = useState({
    name: 'Rack 1',
    width_ft: 6,
    depth_ft: 3,
    height_ft: 6,
    num_shelves: 5
  });

  const [newContainer, setNewContainer] = useState({
    name: '',
    container_type: 'cup_3.5in'
  });

  useEffect(() => {
    if (spaceId) {
      loadData();
    }
  }, [spaceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [spaceData, racksData, containersData] = await Promise.all([
        base44.entities.IndoorGrowSpace.filter({ id: spaceId }),
        base44.entities.GrowRack.filter({ indoor_space_id: spaceId }, '-created_date'),
        base44.entities.IndoorContainer.filter({ 
          indoor_space_id: spaceId,
          status: { $ne: 'transplanted' }
        }, '-created_date')
      ]);

      if (!spaceData || spaceData.length === 0) {
        toast.error('Space not found');
        navigate(createPageUrl('IndoorGrowSpaces'));
        return;
      }

      setSpace(spaceData[0]);
      
      // Load shelves and trays for each rack
      const racksWithDetails = await Promise.all(
        racksData.map(async (rack) => {
          const [shelves, trays] = await Promise.all([
            base44.entities.GrowShelf.filter({ rack_id: rack.id }, 'shelf_number'),
            base44.entities.SeedTray.filter({ indoor_space_id: spaceId })
          ]);

          // Load cells for trays on this rack's shelves
          const shelvesWithTrays = await Promise.all(
            shelves.map(async (shelf) => {
              const shelfTrays = trays.filter(t => t.shelf_id === shelf.id);
              
              const traysWithStats = await Promise.all(
                shelfTrays.map(async (tray) => {
                  const cells = await base44.entities.TrayCell.filter({ tray_id: tray.id });
                  const active = cells.filter(c => ['seeded', 'germinated', 'growing'].includes(c.status));
                  const failed = cells.filter(c => c.status === 'failed');
                  
                  return {
                    ...tray,
                    stats: {
                      total: tray.total_cells,
                      filled: cells.filter(c => c.variety_id).length,
                      active: active.length,
                      failed: failed.length
                    }
                  };
                })
              );

              return {
                ...shelf,
                trays: traysWithStats
              };
            })
          );

          return {
            ...rack,
            shelves: shelvesWithTrays
          };
        })
      );

      setRacks(racksWithDetails);
      setContainers(containersData);
    } catch (error) {
      console.error('Error loading space details:', error);
      toast.error('Failed to load space details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRack = async () => {
    if (!newRack.name.trim()) {
      toast.error('Please enter a rack name');
      return;
    }

    setCreating(true);
    try {
      const rack = await base44.entities.GrowRack.create({
        ...newRack,
        indoor_space_id: spaceId
      });

      // Auto-create shelves
      const shelves = [];
      for (let i = 1; i <= newRack.num_shelves; i++) {
        const shelf = await base44.entities.GrowShelf.create({
          rack_id: rack.id,
          shelf_number: i,
          width_ft: newRack.width_ft,
          depth_ft: newRack.depth_ft,
          max_trays: Math.floor(newRack.width_ft * 2) // 2 trays per foot
        });
        shelves.push({ ...shelf, trays: [] });
      }

      setRacks([{ ...rack, shelves }, ...racks]);
      setNewRack({
        name: `Rack ${racks.length + 2}`,
        width_ft: 6,
        depth_ft: 3,
        height_ft: 6,
        num_shelves: 5
      });
      setShowAddRackDialog(false);
      toast.success('Rack created with shelves');
    } catch (error) {
      console.error('Error creating rack:', error);
      toast.error('Failed to create rack');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateContainer = async () => {
    setCreating(true);
    try {
      const container = await base44.entities.IndoorContainer.create({
        ...newContainer,
        indoor_space_id: spaceId,
        status: 'empty'
      });

      setContainers([container, ...containers]);
      setNewContainer({ name: '', container_type: 'cup_3.5in' });
      setShowAddContainerDialog(false);
      toast.success('Container added');
    } catch (error) {
      console.error('Error creating container:', error);
      toast.error('Failed to create container');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRack = async (rackId) => {
    if (!confirm('Delete this rack and all its shelves/trays?')) return;

    try {
      await base44.entities.GrowRack.delete(rackId);
      setRacks(racks.filter(r => r.id !== rackId));
      toast.success('Rack deleted');
    } catch (error) {
      console.error('Error deleting rack:', error);
      toast.error('Failed to delete rack');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!space) return null;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(createPageUrl('IndoorGrowSpaces'))}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{space.name}</h1>
          <p className="text-gray-600 mt-1">
            {space.width_ft}ft × {space.length_ft}ft • {space.space_type === 'room' ? '🏠 Room' : '⛺ Grow Tent'}
          </p>
        </div>
        <Button
          onClick={() => setShowAddRackDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Rack
        </Button>
      </div>

      {/* Racks */}
      <div className="space-y-6">
        {racks.length === 0 ? (
          <Card className="p-12 text-center">
            <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No racks yet</h3>
            <p className="text-gray-600 mb-6">Add your first shelving rack to start organizing trays</p>
            <Button 
              onClick={() => setShowAddRackDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Add First Rack
            </Button>
          </Card>
        ) : (
          racks.map((rack) => (
            <Card key={rack.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{rack.name}</h3>
                  <p className="text-sm text-gray-600">
                    {rack.width_ft}ft × {rack.depth_ft}ft × {rack.height_ft}ft • {rack.num_shelves} shelves
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRack(rack.id)}
                >
                  <Trash2 className="w-4 h-4 text-gray-500" />
                </Button>
              </div>

              {/* Shelves */}
              <div className="space-y-4">
                {rack.shelves?.map((shelf) => (
                  <div key={shelf.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        Shelf {shelf.shelf_number} {shelf.shelf_number === rack.num_shelves && '(Top)'}
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(createPageUrl('TrayDetail') + `?spaceId=${spaceId}&shelfId=${shelf.id}`);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Tray
                      </Button>
                    </div>

                    {/* Trays on this shelf */}
                    {shelf.trays?.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {shelf.trays.map((tray) => {
                          const fillPercent = tray.stats.filled / tray.stats.total * 100;
                          const statusColor = 
                            fillPercent >= 90 ? 'bg-green-500' :
                            fillPercent >= 50 ? 'bg-yellow-500' :
                            fillPercent > 0 ? 'bg-orange-500' : 'bg-gray-300';

                          return (
                            <div
                              key={tray.id}
                              onClick={() => navigate(createPageUrl('TrayDetail') + `?id=${tray.id}`)}
                              className="bg-white rounded-lg p-3 border border-gray-200 hover:border-emerald-400 cursor-pointer transition-all hover:shadow-md"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-900 truncate">{tray.name}</p>
                                  <p className="text-xs text-gray-500">{tray.insert_type}</p>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${statusColor} flex-shrink-0`} />
                              </div>
                              <div className="text-xs text-gray-600">
                                <span className="font-semibold">{tray.stats.active}/{tray.stats.total}</span> active
                              </div>
                              {tray.stats.failed > 0 && (
                                <div className="text-xs text-red-600 mt-1">
                                  {tray.stats.failed} failed
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No trays on this shelf - click "Add Tray" to get started
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Floor Containers */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Floor Containers</h3>
          <Button
            onClick={() => setShowAddContainerDialog(true)}
            variant="outline"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Container
          </Button>
        </div>
        
        {containers.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {containers.map((container) => (
              <div
                key={container.id}
                className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-emerald-400 cursor-pointer transition-all"
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">🪴</div>
                  <p className="text-xs font-medium text-gray-900 truncate">{container.name || 'Container'}</p>
                  <p className="text-xs text-gray-500 mt-1">{container.container_type.replace('_', ' ')}</p>
                  {container.status && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {container.status}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">
            No floor containers yet
          </p>
        )}
      </Card>

      {/* Add Rack Dialog */}
      <Dialog open={showAddRackDialog} onOpenChange={setShowAddRackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Rack</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rack Name</label>
              <Input
                value={newRack.name}
                onChange={(e) => setNewRack({...newRack, name: e.target.value})}
                placeholder="e.g., Rack 1"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Width (ft)</label>
                <Input
                  type="number"
                  value={newRack.width_ft}
                  onChange={(e) => setNewRack({...newRack, width_ft: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Depth (ft)</label>
                <Input
                  type="number"
                  value={newRack.depth_ft}
                  onChange={(e) => setNewRack({...newRack, depth_ft: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Height (ft)</label>
                <Input
                  type="number"
                  value={newRack.height_ft}
                  onChange={(e) => setNewRack({...newRack, height_ft: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Number of Shelves</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={newRack.num_shelves}
                onChange={(e) => setNewRack({...newRack, num_shelves: parseInt(e.target.value) || 1})}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRackDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateRack}
              disabled={creating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Rack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Container Dialog */}
      <Dialog open={showAddContainerDialog} onOpenChange={setShowAddContainerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Floor Container</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Container Name</label>
              <Input
                value={newContainer.name}
                onChange={(e) => setNewContainer({...newContainer, name: e.target.value})}
                placeholder="e.g., Tomato Cup 1"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select 
                value={newContainer.container_type}
                onValueChange={(v) => setNewContainer({...newContainer, container_type: v})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cup_3.5in">3.5" Cup</SelectItem>
                  <SelectItem value="cup_4in">4" Cup</SelectItem>
                  <SelectItem value="pot_1gal">1 Gallon Pot</SelectItem>
                  <SelectItem value="pot_3gal">3 Gallon Pot</SelectItem>
                  <SelectItem value="grow_bag_5gal">5 Gallon Grow Bag</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContainerDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateContainer}
              disabled={creating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Container
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}