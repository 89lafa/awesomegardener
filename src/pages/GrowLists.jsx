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
  Target
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

  const [newList, setNewList] = useState({
    name: `${new Date().getFullYear()} Grow List`,
    year: new Date().getFullYear(),
    linked_garden_id: ''
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
      const [listsData, gardensData, seedsData, typesData, profilesData] = await Promise.all([
        base44.entities.GrowList.filter({ created_by: user.email }, '-created_date'),
        base44.entities.Garden.filter({ archived: false, created_by: user.email }),
        base44.entities.SeedLot.filter({ is_wishlist: false, created_by: user.email }),
        base44.entities.PlantType.list('common_name', 100),
        base44.entities.PlantProfile.list('variety_name', 500)
      ]);
      setGrowLists(listsData);
      setGardens(gardensData);
      setSeeds(seedsData);
      setPlantTypes(typesData);
      
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

  const handleCreateList = async () => {
    if (!newList.name.trim()) return;

    try {
      const list = await base44.entities.GrowList.create({
        ...newList,
        status: 'draft',
        items: []
      });
      setGrowLists([list, ...growLists]);
      setShowNewDialog(false);
      setNewList({
        name: `${new Date().getFullYear()} Grow List`,
        year: new Date().getFullYear(),
        linked_garden_id: ''
      });
      toast.success('Grow list created!');
    } catch (error) {
      console.error('Error creating grow list:', error);
      toast.error('Failed to create grow list');
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

  const handleAddItem = async () => {
    if (!selectedList || !newItem.plant_type_name) return;

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
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{selectedList.name}</h1>
              <Badge className={getStatusColor(selectedList.status)}>
                {selectedList.status}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">
              {selectedList.items?.length || 0} items • {selectedList.year}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={createPageUrl('Calendar') + `?syncGrowList=${selectedList.id}`}>
              <Button 
                variant="outline"
                className="gap-2"
              >
                <Calendar className="w-4 h-4" />
                Push to Calendar
              </Button>
            </Link>
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

        {/* Items */}
        {!selectedList.items?.length ? (
          <Card className="py-12">
            <CardContent className="text-center">
              <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No items in this grow list yet</p>
              <Button 
                onClick={() => setShowAddItemDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Add First Item
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {selectedList.items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                          <Target className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {item.variety_name || item.plant_type_name}
                          </h3>
                          {item.variety_name && (
                            <p className="text-sm text-gray-500">{item.plant_type_name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              Quantity: {item.quantity || item.target_count || 1}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link to={createPageUrl('GardenBuilder') + `?gardenId=${selectedList.linked_garden_id || gardens[0]?.id}`}>
                          <Button variant="outline" size="sm">
                            Place in Garden
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </Button>
                      </div>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-gray-600 mt-2 pl-16">{item.notes}</p>
                    )}
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
                        variety_name: profile?.variety_name || ''
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
                            {profile.variety_name} ({profile.common_name})
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
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
                disabled={!newItem.plant_type_id}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Add Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Grow Lists</h1>
          <p className="text-gray-600 mt-1">Plan what you want to grow each season</p>
        </div>
        <Button 
          onClick={() => setShowNewDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Grow List
        </Button>
      </div>

      <AdBanner placement="top_banner" pageType="grow_list" />

      {growLists.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <ListChecks className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No grow lists yet</h3>
            <p className="text-gray-600 mb-6">Create a grow list to plan your garden</p>
            <Button 
              onClick={() => setShowNewDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Create Grow List
            </Button>
          </CardContent>
        </Card>
      ) : (
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
                      <CardTitle className="text-lg">{list.name}</CardTitle>
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
                  <p className="text-sm text-gray-600">
                    {list.items?.length || 0} items
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-emerald-600 text-sm">
                    <span>View details</span>
                    <ChevronRight className="w-4 h-4" />
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
                value={newList.linked_garden_id} 
                onValueChange={(v) => setNewList({ ...newList, linked_garden_id: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a garden" />
                </SelectTrigger>
                <SelectContent>
                  {gardens.map((garden) => (
                    <SelectItem key={garden.id} value={garden.id}>{garden.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateList}
              disabled={!newList.name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}