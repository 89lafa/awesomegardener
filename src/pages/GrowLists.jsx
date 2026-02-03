import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  ListChecks, 
  Plus, 
  MoreVertical,
  Trash2,
  Edit,
  Archive,
  ChevronRight,
  TreeDeciduous,
  Package,
  Calendar,
  Loader2,
  ArrowLeft,
  Target,
  AlertTriangle,
  Grid3x3,
  List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import AdBanner from '@/components/monetization/AdBanner';
import PlantRecommendations from '@/components/ai/PlantRecommendations';
import { Sparkles } from 'lucide-react';
import { getPlantTypesCached } from '@/components/utils/dataCache';

export default function GrowLists() {
  const [searchParams] = useSearchParams();
  const [growLists, setGrowLists] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [seeds, setSeeds] = useState([]);
  const [plantTypes, setPlantTypes] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedList, setSelectedList] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(searchParams.get('action') === 'new');
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'
  const [itemViewMode, setItemViewMode] = useState('card'); // 'card' or 'list' for detail view items

  const [seasons, setSeasons] = useState([]);
  const [newList, setNewList] = useState({
    name: `${new Date().getFullYear()} Grow List`,
    year: new Date().getFullYear(),
    garden_id: '',
    garden_season_id: ''
  });

  const [newItem, setNewItem] = useState({
    plant_type_id: '',
    plant_type_name: '',
    variety_id: '',
    variety_name: '',
    quantity: 1,
    seed_lot_id: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
    
    // Real-time subscription to prevent empty states
    const unsubscribe = base44.entities.GrowList.subscribe((event) => {
      console.log('[GrowList Subscription]', event.type, event.id);
      loadData();
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Check for addSeed param
    const addSeedId = searchParams.get('addSeed');
    if (addSeedId && seeds.length > 0) {
      const seed = seeds.find(s => s.id === addSeedId);
      if (seed) {
        setNewItem({
          plant_type_name: seed.plant_type_name || '',
          variety_name: seed.variety_name || seed.custom_name || '',
          target_count: 1,
          seed_lot_id: seed.id,
          notes: ''
        });
        setShowAddItemDialog(true);
      }
    }
  }, [searchParams, seeds]);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      
      // V1B-2: Batch query optimization - load lists and seeds first
      const [listsData, gardensData, seedsData, seasonsData] = await Promise.all([
        base44.entities.GrowList.filter({ created_by: user.email }, '-created_date'),
        base44.entities.Garden.filter({ archived: false, created_by: user.email }),
        base44.entities.SeedLot.filter({ is_wishlist: false, created_by: user.email }),
        base44.entities.GardenSeason.filter({ created_by: user.email }, '-year')
      ]);
      
      // Extract unique profile IDs from seeds
      const uniqueProfileIds = [...new Set(seedsData.map(s => s.plant_profile_id).filter(Boolean))];
      
      // Batch fetch only needed profiles
      const profilesData = uniqueProfileIds.length > 0 
        ? await base44.entities.PlantProfile.filter({ id: { $in: uniqueProfileIds } })
        : [];
      
      // Use cached plant types
      const typesData = await getPlantTypesCached(() => 
        base44.entities.PlantType.list('common_name', 100)
      );
      
      setGrowLists(listsData);
      setGardens(gardensData);
      setSeeds(seedsData);
      setPlantTypes(typesData);
      setSeasons(seasonsData);
      
      // Build profiles map
      const pMap = {};
      profilesData.forEach(p => pMap[p.id] = p);
      setProfilesMap(pMap);
    } catch (error) {
      console.error('Error loading grow lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const [creatingList, setCreatingList] = useState(false);

  const handleCreateList = async () => {
    if (!newList.name.trim()) return;
    if (creatingList) return; // Prevent double-submit
    setCreatingList(true);

    try {
      const list = await base44.entities.GrowList.create({
        name: newList.name,
        year: newList.year,
        garden_id: newList.garden_id || null,
        garden_season_id: newList.garden_season_id || null,
        status: 'draft',
        items: []
      });
      setGrowLists([list, ...growLists]);
      setShowNewDialog(false);
      setNewList({
        name: `${new Date().getFullYear()} Grow List`,
        year: new Date().getFullYear(),
        garden_id: '',
        garden_season_id: ''
      });
      toast.success('Grow list created!');
    } catch (error) {
      console.error('Error creating grow list:', error);
      toast.error('Failed to create grow list');
    } finally {
      setCreatingList(false);
    }
  };

  const handleDeleteList = async (list) => {
    if (!confirm(`Delete "${list.name}"?`)) return;
    try {
      await base44.entities.GrowList.delete(list.id);
      setGrowLists(growLists.filter(l => l.id !== list.id));
      if (selectedList?.id === list.id) setSelectedList(null);
      toast.success('Grow list deleted');
    } catch (error) {
      console.error('Error deleting grow list:', error);
    }
  };

  const [addingItem, setAddingItem] = useState(false);

  const handleAddItem = async () => {
    if (!selectedList || !newItem.plant_type_name) return;
    if (addingItem) return; // Prevent double-submit
    setAddingItem(true);

    const item = {
      id: Date.now().toString(),
      plant_type_id: newItem.plant_type_id,
      plant_type_name: newItem.plant_type_name,
      variety_id: newItem.variety_id || null,
      variety_name: newItem.variety_name,
      quantity: newItem.quantity || 1,
      seed_lot_id: newItem.seed_lot_id || null,
      notes: newItem.notes || '',
      added_date: new Date().toISOString()
    };

    try {
      const updatedItems = [...(selectedList.items || []), item];
      await base44.entities.GrowList.update(selectedList.id, { items: updatedItems });
      setSelectedList({ ...selectedList, items: updatedItems });
      setGrowLists(growLists.map(l => 
        l.id === selectedList.id ? { ...l, items: updatedItems } : l
      ));
      setShowAddItemDialog(false);
      setNewItem({
        plant_type_id: '',
        plant_type_name: '',
        variety_id: '',
        variety_name: '',
        quantity: 1,
        seed_lot_id: '',
        notes: ''
      });
      toast.success('Item added!');
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    } finally {
      setAddingItem(false);
    }
  };

  const removeFromList = async (listId, itemIndex) => {
    if (!selectedList) return;

    try {
      const updatedItems = selectedList.items.filter((_, idx) => idx !== itemIndex);
      await base44.entities.GrowList.update(listId, { items: updatedItems });
      setSelectedList({ ...selectedList, items: updatedItems });
      setGrowLists(growLists.map(l => 
        l.id === listId ? { ...l, items: updatedItems } : l
      ));
      toast.success('Item removed');
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!selectedList) return;

    try {
      const updatedItems = selectedList.items.filter(i => i.id !== itemId);
      await base44.entities.GrowList.update(selectedList.id, { items: updatedItems });
      setSelectedList({ ...selectedList, items: updatedItems });
      setGrowLists(growLists.map(l => 
        l.id === selectedList.id ? { ...l, items: updatedItems } : l
      ));
      toast.success('Item removed');
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const handleUpdateStatus = async (list, status) => {
    try {
      await base44.entities.GrowList.update(list.id, { status });
      setGrowLists(growLists.map(l => l.id === list.id ? { ...l, status } : l));
      if (selectedList?.id === list.id) {
        setSelectedList({ ...selectedList, status });
      }
      toast.success('Status updated');
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'archived': return 'bg-gray-100 text-gray-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Detail view
  if (selectedList) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setSelectedList(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Input
                value={selectedList.name}
                onChange={async (e) => {
                  const newName = e.target.value;
                  await base44.entities.GrowList.update(selectedList.id, { name: newName });
                  setSelectedList({ ...selectedList, name: newName });
                  setGrowLists(growLists.map(l => l.id === selectedList.id ? { ...l, name: newName } : l));
                }}
                className="text-2xl font-bold max-w-md"
              />
              <Badge className={getStatusColor(selectedList.status)}>
                {selectedList.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-gray-600">
                {selectedList.items?.length || 0} items
              </p>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Garden:</Label>
                <Select 
                  value={selectedList.garden_id || ''} 
                  onValueChange={async (v) => {
                    await base44.entities.GrowList.update(selectedList.id, { garden_id: v || null, garden_season_id: null });
                    setSelectedList({ ...selectedList, garden_id: v || null, garden_season_id: null });
                    setGrowLists(growLists.map(l => l.id === selectedList.id ? { ...l, garden_id: v || null, garden_season_id: null } : l));
                    if (v) {
                      const gardenSeasons = await base44.entities.GardenSeason.filter({ garden_id: v }, '-year');
                      setSeasons(gardenSeasons);
                    }
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select garden" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {gardens.map((garden) => (
                      <SelectItem key={garden.id} value={garden.id}>{garden.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedList.garden_id && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Season:</Label>
                  <Select 
                    value={selectedList.garden_season_id || ''} 
                    onValueChange={async (v) => {
                      await base44.entities.GrowList.update(selectedList.id, { garden_season_id: v || null });
                      setSelectedList({ ...selectedList, garden_season_id: v || null });
                      setGrowLists(growLists.map(l => l.id === selectedList.id ? { ...l, garden_season_id: v || null } : l));
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select season" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      {seasons.filter(s => s.garden_id === selectedList.garden_id).map((season) => (
                        <SelectItem key={season.id} value={season.id}>
                          {season.year} {season.season}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {selectedList.garden_season_id && (
              <Link to={createPageUrl('Calendar') + `?syncGrowList=${selectedList.id}&season=${selectedList.garden_season_id}`}>
                <Button 
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Calendar className="w-4 h-4" />
                  Sync to Calendar
                </Button>
              </Link>
            )}
            <Button 
              variant="outline"
              onClick={() => handleUpdateStatus(selectedList, selectedList.status === 'active' ? 'archived' : 'active')}
            >
              {selectedList.status === 'active' ? 'Archive' : 'Activate'}
            </Button>
            <Button 
              onClick={() => setShowAddItemDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </div>
        </div>

        <AdBanner placement="top_banner" pageType="grow_list" />

        {/* View Mode Toggle */}
        {selectedList.items?.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant={itemViewMode === 'card' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setItemViewMode('card')}
              className={itemViewMode === 'card' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={itemViewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setItemViewMode('list')}
              className={itemViewMode === 'list' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Items */}
        {!selectedList.items?.length ? (
          <Card 
            className="py-12"
            style={{ 
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--glass-border)'
            }}
          >
            <CardContent className="text-center">
              <ListChecks className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>No items in this grow list yet</p>
              <Button 
                onClick={() => setShowAddItemDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Add First Item
              </Button>
            </CardContent>
          </Card>
        ) : itemViewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedList.items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  style={{ 
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--glass-border)'
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                              {item.variety_name || item.plant_type_name}
                            </h3>
                            {item.variety_name && (
                              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{item.plant_type_name}</p>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Qty: {item.quantity || item.target_count || 1}
                        </Badge>
                      </div>
                      {item.notes && (
                       <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.notes}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {selectedList.items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card
                  style={{ 
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--glass-border)'
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                            {item.variety_name || item.plant_type_name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.variety_name && (
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.plant_type_name}</span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              Qty: {item.quantity || item.target_count || 1}
                            </Badge>
                          </div>
                          {item.notes && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{item.notes}</p>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="flex-shrink-0"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Add Item Dialog */}
        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Item to Grow List</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>From Seed Stash (optional)</Label>
                <Select 
                  value={newItem.seed_lot_id} 
                  onValueChange={(v) => {
                    const seed = seeds.find(s => s.id === v);
                    if (seed) {
                      const profile = profilesMap[seed.plant_profile_id];
                      setNewItem({
                        ...newItem,
                        seed_lot_id: v,
                        plant_type_id: profile?.plant_type_id || '',
                        plant_type_name: profile?.common_name || '',
                        variety_id: profile?.variety_id || '',
                        variety_name: profile?.variety_name || '',
                        available_quantity: seed.quantity || 0
                      });
                    }
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select from your seeds" />
                  </SelectTrigger>
                  <SelectContent>
                    {seeds.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">No seeds in your stash</div>
                    ) : (
                      seeds.map((seed) => {
                        const profile = profilesMap[seed.plant_profile_id];
                        if (!profile) return null;
                        return (
                          <SelectItem key={seed.id} value={seed.id}>
                            {profile.variety_name} ({profile.common_name}) - {seed.quantity || 0} {seed.unit || 'seeds'}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                {newItem.seed_lot_id && newItem.available_quantity !== undefined && (
                  <p className="text-xs text-gray-600 mt-1">
                    Available: {newItem.available_quantity} seeds
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Plant Type</Label>
                  <Select 
                    value={newItem.plant_type_id} 
                    onValueChange={(v) => {
                      const type = plantTypes.find(t => t.id === v);
                      setNewItem({ 
                        ...newItem, 
                        plant_type_id: v,
                        plant_type_name: type?.common_name || ''
                      });
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {plantTypes.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">No plant types available</div>
                      ) : (
                        plantTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.icon && <span className="mr-2">{type.icon}</span>}
                            {type.common_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="varietyName">Variety</Label>
                  <Input
                    id="varietyName"
                    value={newItem.variety_name}
                    onChange={(e) => setNewItem({ ...newItem, variety_name: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  className="mt-2"
                />
                {newItem.seed_lot_id && newItem.available_quantity !== undefined && newItem.quantity > newItem.available_quantity && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Not enough seeds! You only have {newItem.available_quantity} available.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Optional notes..."
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleAddItem}
                disabled={
                  !newItem.plant_type_id || 
                  addingItem ||
                  (newItem.seed_lot_id && newItem.available_quantity !== undefined && newItem.quantity > newItem.available_quantity)
                }
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {addingItem ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  'Add Item'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <PlantRecommendations
          open={showAIRecommendations}
          onOpenChange={setShowAIRecommendations}
          context="growlist"
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
         <div>
           <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Grow Lists</h1>
           <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Plan what you want to grow each season</p>
         </div>
         <div className="flex gap-2 flex-wrap">
           <Link to={createPageUrl('NeedToBuy')}>
             <Button 
               variant="outline"
               className="gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
             >
               🛒 Need to Buy
             </Button>
           </Link>
           <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className={viewMode === 'cards' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              Cards
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              List
            </Button>
          </div>
          <Button 
            onClick={() => setShowAIRecommendations(true)}
            variant="outline"
            className="gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
          >
            <Sparkles className="w-4 h-4" />
            AI Suggest
          </Button>
          <Button 
            onClick={() => setShowNewDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            New Grow List
          </Button>
        </div>
      </div>

      <AdBanner placement="top_banner" pageType="grow_list" />

      {growLists.length === 0 ? (
        <Card 
          className="py-16"
          style={{ 
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)'
          }}
        >
          <CardContent className="text-center">
            <ListChecks className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No grow lists yet</h3>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>Create a grow list to plan your garden</p>
            <Button 
              onClick={() => setShowNewDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Create Grow List
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {growLists.map((list, index) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedList(list)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg" style={{ color: 'var(--text-primary)' }}>{list.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getStatusColor(list.status)}>
                          {list.status}
                        </Badge>
                        {list.year && (
                          <Badge variant="outline">{list.year}</Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteList(list); }}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {list.items?.length || 0} items
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-sm" style={{ color: 'var(--primary)' }}>
                    <span>View details</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {growLists.map((list, index) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-300"
                onClick={() => setSelectedList(list)}
                style={{ 
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--glass-border)'
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <ListChecks className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{list.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`${getStatusColor(list.status)} text-xs`}>
                              {list.status}
                            </Badge>
                            {list.year && (
                              <Badge variant="outline" className="text-xs">{list.year}</Badge>
                            )}
                            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>• {list.items?.length || 0} items</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteList(list); }}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* New List Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Grow List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="listName">List Name</Label>
              <Input
                id="listName"
                placeholder="e.g., 2025 Summer Garden"
                value={newList.name}
                onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={newList.year}
                onChange={(e) => setNewList({ ...newList, year: parseInt(e.target.value) || '' })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Link to Garden (optional)</Label>
              <Select 
                value={newList.garden_id} 
                onValueChange={async (v) => {
                  setNewList({ ...newList, garden_id: v, garden_season_id: '' });
                  // Load seasons for selected garden
                  if (v) {
                    const currentUser = await base44.auth.me();
                    const gardenSeasons = await base44.entities.GardenSeason.filter({ 
                      garden_id: v,
                      created_by: currentUser.email
                    }, '-year');
                    setSeasons(gardenSeasons);
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a garden" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {gardens.map((garden) => (
                    <SelectItem key={garden.id} value={garden.id}>{garden.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newList.garden_id && (
              <div>
                <Label>Season (optional)</Label>
                <Select 
                  value={newList.garden_season_id} 
                  onValueChange={(v) => setNewList({ ...newList, garden_season_id: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a season" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No specific season</SelectItem>
                    {seasons.filter(s => s.garden_id === newList.garden_id).map((season) => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.year} {season.season}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateList}
              disabled={!newList.name.trim() || creatingList}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creatingList ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create List'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <PlantRecommendations
        open={showAIRecommendations}
        onOpenChange={setShowAIRecommendations}
        context="growlist"
      />
    </div>
  );
}