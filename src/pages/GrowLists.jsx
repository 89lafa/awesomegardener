import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Plus, Trash2, Calendar, Settings, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function GrowLists() {
  const [user, setUser] = useState(null);
  const [growLists, setGrowLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);

  const [newList, setNewList] = useState({
    name: '',
    description: '',
    year: new Date().getFullYear(),
    status: 'active'
  });

  const [newItem, setNewItem] = useState({
    seed_lot_id: '',
    plant_type_id: '',
    plant_type_name: '',
    variety_id: '',
    variety_name: '',
    quantity: 1,
    notes: '',
    available_quantity: undefined
  });

  const [plantTypes, setPlantTypes] = useState([]);
  const [seedStash, setSeedStash] = useState([]);
  const [plantProfiles, setPlantProfiles] = useState([]);

  const [loadingPlantTypes, setLoadingPlantTypes] = useState(false);
  const [loadingSeedStash, setLoadingSeedStash] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [seedSearch, setSeedSearch] = useState('');
  const [plantTypeSearch, setPlantTypeSearch] = useState('');

  // ══════════════════════════════════════════════════════════════
  // Plant Catalog variety picker (cached per plant type)
  // - One API call per plant_type_id while modal is open
  // - Client-side filtering to avoid rate limits
  // ══════════════════════════════════════════════════════════════
  const catalogVarietyCacheRef = useRef(new Map()); // plant_type_id -> Variety[]
  const [catalogVarieties, setCatalogVarieties] = useState([]);
  const [catalogVarietiesLoading, setCatalogVarietiesLoading] = useState(false);
  const [catalogVarietiesError, setCatalogVarietiesError] = useState(null);

  useEffect(() => {
    let unsubscribe = null;

    const init = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        await loadData(userData);

        // Subscribe to changes
        unsubscribe = base44.entities.GrowList.subscribe(
          { created_by: userData.email },
          () => loadData(userData)
        );
      } catch (error) {
        console.error('Error initializing:', error);
        toast.error('Failed to load grow lists');
      }
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Load Plant Catalog varieties for selected plant type (cached)
  const loadCatalogVarietiesForPlantType = async (plantTypeId) => {
    if (!plantTypeId) {
      setCatalogVarieties([]);
      setCatalogVarietiesError(null);
      return;
    }

    // Cache hit
    if (catalogVarietyCacheRef.current.has(plantTypeId)) {
      setCatalogVarieties(catalogVarietyCacheRef.current.get(plantTypeId) || []);
      setCatalogVarietiesError(null);
      return;
    }

    setCatalogVarietiesLoading(true);
    setCatalogVarietiesError(null);

    try {
      // Keep the limit reasonable to avoid payload/rate issues.
      // One call per plant_type_id while the modal is open, then client-side filtering.
      const vars = await base44.entities.Variety.filter(
        { plant_type_id: plantTypeId, status: 'active' },
        'variety_name',
        2000
      );
      catalogVarietyCacheRef.current.set(plantTypeId, vars || []);
      setCatalogVarieties(vars || []);
    } catch (e) {
      console.error('Error loading catalog varieties:', e);
      setCatalogVarieties([]);
      setCatalogVarietiesError('Could not load varieties for this plant type.');
    } finally {
      setCatalogVarietiesLoading(false);
    }
  };

  // When the Add Item modal is open and the user is selecting from Plant Catalog (no seed lot),
  // fetch the varieties for that plant type once and then filter client-side.
  useEffect(() => {
    if (!showAddItemDialog) return;
    if (!newItem?.plant_type_id) return;
    if (newItem.seed_lot_id) return;

    loadCatalogVarietiesForPlantType(newItem.plant_type_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddItemDialog, newItem.plant_type_id, newItem.seed_lot_id]);

  const loadData = async (userData) => {
    try {
      setLoading(true);

      // Load grow lists
      const lists = await base44.entities.GrowList.filter(
        { created_by: userData.email },
        'created_date',
        100
      );

      setGrowLists(lists);

      // Auto-select first list if none selected
      if (!selectedList && lists.length > 0) {
        setSelectedList(lists[0]);
      } else if (selectedList) {
        // Update selected list with fresh data
        const updated = lists.find((l) => l.id === selectedList.id);
        if (updated) setSelectedList(updated);
      }

      // Load cached plant types (avoid repeated calls)
      await loadPlantTypes(userData);

      // Load seed stash
      await loadSeedStash(userData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cached plant types (session-level)
  let plantTypesCache = null;
  const getPlantTypesCached = async () => {
    if (plantTypesCache) return plantTypesCache;
    const data = await base44.entities.PlantType.filter({}, 'name', 2000);
    plantTypesCache = data || [];
    return plantTypesCache;
  };

  const loadPlantTypes = async () => {
    try {
      setLoadingPlantTypes(true);
      const types = await getPlantTypesCached();
      setPlantTypes(types);
    } catch (error) {
      console.error('Error loading plant types:', error);
    } finally {
      setLoadingPlantTypes(false);
    }
  };

  const loadSeedStash = async (userData) => {
    try {
      setLoadingSeedStash(true);

      const seeds = await base44.entities.SeedLot.filter(
        { created_by: userData.email, is_wishlist: false },
        'created_date',
        2000
      );

      setSeedStash(seeds || []);

      // Load plant profiles for mapping seed lots to variety / plant type
      const profileIds = Array.from(
        new Set((seeds || []).map((s) => s.plant_profile_id).filter(Boolean))
      );

      if (profileIds.length > 0) {
        const profiles = await base44.entities.PlantProfile.filter(
          { id: { $in: profileIds } },
          'created_date',
          2000
        );
        setPlantProfiles(profiles || []);
      } else {
        setPlantProfiles([]);
      }
    } catch (error) {
      console.error('Error loading seed stash:', error);
    } finally {
      setLoadingSeedStash(false);
    }
  };

  const handleCreateList = async () => {
    if (!newList.name.trim()) {
      toast.error('Please enter a name for your grow list');
      return;
    }

    try {
      const created = await base44.entities.GrowList.create({
        ...newList,
        created_by: user.email,
        items: []
      });

      toast.success('Grow list created!');
      setShowCreateDialog(false);
      setNewList({
        name: '',
        description: '',
        year: new Date().getFullYear(),
        status: 'active'
      });

      // Select the new list
      setSelectedList(created);
      await loadData(user);
    } catch (error) {
      console.error('Error creating grow list:', error);
      toast.error('Failed to create grow list');
    }
  };

  const handleDeleteList = async (listId) => {
    if (!confirm('Are you sure you want to delete this grow list?')) return;

    try {
      await base44.entities.GrowList.delete(listId);
      toast.success('Grow list deleted');

      // Reset selection if deleted list was selected
      if (selectedList?.id === listId) {
        setSelectedList(null);
      }

      await loadData(user);
    } catch (error) {
      console.error('Error deleting grow list:', error);
      toast.error('Failed to delete grow list');
    }
  };

  const handleOpenAddItem = () => {
    setNewItem({
      seed_lot_id: '',
      plant_type_id: '',
      plant_type_name: '',
      variety_id: '',
      variety_name: '',
      quantity: 1,
      notes: '',
      available_quantity: undefined
    });
    setSeedSearch('');
    setPlantTypeSearch('');
    setShowAddItemDialog(true);
  };

  const handleSeedSelection = async (seedLotId) => {
    // Clear if none selected
    if (!seedLotId) {
      setNewItem({
        ...newItem,
        seed_lot_id: '',
        plant_type_id: '',
        plant_type_name: '',
        variety_id: '',
        variety_name: '',
        available_quantity: undefined
      });
      return;
    }

    // Find seed lot
    const seed = seedStash.find((s) => s.id === seedLotId);
    if (!seed) return;

    // Find corresponding plant profile
    const profile = plantProfiles.find((p) => p.id === seed.plant_profile_id);

    if (profile) {
      // Strategy 1: Use PlantProfile data if available
      if (profile.plant_type_id && profile.variety_name) {
        const plantType = plantTypes.find((pt) => pt.id === profile.plant_type_id);

        setNewItem({
          ...newItem,
          seed_lot_id: seedLotId,
          plant_type_id: profile.plant_type_id,
          plant_type_name: plantType?.name || profile.plant_type_name || '',
          variety_id: profile.variety_id || '',
          variety_name: profile.variety_name || '',
          available_quantity: seed.seed_count || seed.quantity || 0
        });
        return;
      }

      // Strategy 2: Use PlantProfile plant_type_name and variety_name
      if (profile.plant_type_name && profile.variety_name) {
        const plantType = plantTypes.find(
          (pt) => pt.name.toLowerCase() === profile.plant_type_name.toLowerCase()
        );

        setNewItem({
          ...newItem,
          seed_lot_id: seedLotId,
          plant_type_id: plantType?.id || '',
          plant_type_name: profile.plant_type_name,
          variety_id: profile.variety_id || '',
          variety_name: profile.variety_name,
          available_quantity: seed.seed_count || seed.quantity || 0
        });
        return;
      }
    }

    // Strategy 3: Fallback: Try to use variety_id to find plant type
    if (profile?.variety_id) {
      try {
        const variety = await base44.entities.Variety.get(profile.variety_id);
        const plantType = plantTypes.find((pt) => pt.id === variety?.plant_type_id);

        setNewItem({
          ...newItem,
          seed_lot_id: seedLotId,
          plant_type_id: variety?.plant_type_id || '',
          plant_type_name: plantType?.name || '',
          variety_id: profile.variety_id || '',
          variety_name: variety?.variety_name || profile.variety_name || '',
          available_quantity: seed.seed_count || seed.quantity || 0
        });
        return;
      } catch (e) {
        console.error('Error fetching variety for seed selection:', e);
      }
    }

    // Strategy 4: Ultimate fallback - allow manual
    setNewItem({
      ...newItem,
      seed_lot_id: seedLotId,
      plant_type_id: '',
      plant_type_name: '',
      variety_id: '',
      variety_name: profile?.variety_name || seed.variety_name || '',
      available_quantity: seed.seed_count || seed.quantity || 0
    });
  };

  const handleAddItem = async () => {
    if (!selectedList) return;

    // Require at least plant type and variety name
    if ((!newItem.plant_type_id && !newItem.plant_type_name) || !newItem.variety_name?.trim()) {
      toast.error('Please select a plant type and enter a variety');
      return;
    }

    try {
      const updatedItems = [...(selectedList.items || [])];

      updatedItems.push({
        seed_lot_id: newItem.seed_lot_id || undefined,
        plant_type_id: newItem.plant_type_id || undefined,
        plant_type_name: newItem.plant_type_name || undefined,
        variety_id: newItem.variety_id || undefined, // IMPORTANT: this enables NeedToBuy to work correctly
        variety_name: newItem.variety_name,
        quantity: Number(newItem.quantity || 1),
        notes: newItem.notes || undefined,
        added_date: new Date().toISOString()
      });

      await base44.entities.GrowList.update(selectedList.id, {
        items: updatedItems
      });

      toast.success('Item added!');
      setShowAddItemDialog(false);
      await loadData(user);
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    }
  };

  const handleRemoveItem = async (index) => {
    if (!selectedList) return;

    try {
      const updatedItems = [...(selectedList.items || [])];
      updatedItems.splice(index, 1);

      await base44.entities.GrowList.update(selectedList.id, {
        items: updatedItems
      });

      toast.success('Item removed');
      await loadData(user);
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };

  const filteredLists = growLists.filter((list) => {
    const q = searchQuery.toLowerCase();
    return (
      list.name?.toLowerCase().includes(q) ||
      (list.description || '').toLowerCase().includes(q)
    );
  });

  const filteredSeeds = seedStash.filter((seed) => {
    const q = seedSearch.toLowerCase();
    const profile = plantProfiles.find((p) => p.id === seed.plant_profile_id);

    const displayName =
      profile?.variety_name ||
      seed.variety_name ||
      seed.seed_name ||
      '';

    return displayName.toLowerCase().includes(q);
  });

  const filteredPlantTypes = plantTypes.filter((pt) => {
    const q = plantTypeSearch.toLowerCase();
    return pt.name.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full mr-2" />
        <span>Loading Grow Lists…</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Grow Lists</h1>
          <p className="text-sm text-gray-600">
            Plan what you want to plant this season — from your Seed Stash or from the Plant Catalog.
          </p>
        </div>

        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Grow List
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-2 w-full md:w-2/3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search grow lists…"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lists */}
        <Card className="p-4 md:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Your Lists</div>
            <Badge variant="outline">{filteredLists.length}</Badge>
          </div>

          <div className="space-y-2">
            {filteredLists.map((list) => (
              <div
                key={list.id}
                className={`p-3 rounded-md border cursor-pointer hover:bg-gray-50 ${
                  selectedList?.id === list.id ? 'border-emerald-500 bg-emerald-50' : ''
                }`}
                onClick={() => setSelectedList(list)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{list.name}</div>
                    <div className="text-xs text-gray-600">
                      {list.year || ''} • {list.status || ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(list.items || []).length} items
                    </div>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteList(list.id);
                    }}
                    title="Delete list"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredLists.length === 0 && (
              <div className="text-sm text-gray-500 py-6 text-center">
                No grow lists found.
              </div>
            )}
          </div>
        </Card>

        {/* Selected list */}
        <Card className="p-4 md:col-span-2">
          {!selectedList ? (
            <div className="text-center py-16 text-gray-500">
              Select a grow list to view items.
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <div className="text-xl font-semibold">{selectedList.name}</div>
                  {selectedList.description && (
                    <div className="text-sm text-gray-600">{selectedList.description}</div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleOpenAddItem}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>

                  <Button variant="outline" title="Sync to Calendar (coming next)">
                    <Calendar className="w-4 h-4 mr-2" />
                    Sync to Calendar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {(selectedList.items || []).map((item, idx) => (
                  <div
                    key={`${item.variety_id || item.variety_name}-${idx}`}
                    className="p-3 rounded-md border hover:bg-gray-50 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.variety_name}</div>
                      <div className="text-xs text-gray-600">
                        {item.plant_type_name || 'Unknown type'} • Qty: {item.quantity || 1}
                        {item.seed_lot_id ? (
                          <Badge className="ml-2 bg-blue-100 text-blue-800">From Stash</Badge>
                        ) : (
                          <Badge className="ml-2 bg-emerald-100 text-emerald-800">From Catalog</Badge>
                        )}
                      </div>
                      {item.notes && (
                        <div className="text-xs text-gray-500 mt-1">{item.notes}</div>
                      )}
                      {!item.variety_id && (
                        <div className="text-xs text-amber-700 mt-1">
                          Tip: pick a catalog variety (in the Add Item modal) so Need-to-Buy can link affiliate URLs reliably.
                        </div>
                      )}
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveItem(idx)}
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                ))}

                {(selectedList.items || []).length === 0 && (
                  <div className="text-center py-16 text-gray-500">
                    No items yet. Click “Add Item” to start.
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Create list dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Grow List</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newList.name}
                onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                placeholder="e.g., 2026 Spring Grow List"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newList.description}
                onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                placeholder="Optional…"
              />
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={newList.year}
                onChange={(e) =>
                  setNewList({ ...newList, year: Number(e.target.value || new Date().getFullYear()) })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateList}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Item to Grow List</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>From Seed Stash (optional)</Label>
              <Input
                value={seedSearch}
                onChange={(e) => setSeedSearch(e.target.value)}
                placeholder="Search seeds…"
              />

              <Select value={newItem.seed_lot_id || ''} onValueChange={handleSeedSelection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select from your seeds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {loadingSeedStash ? (
                    <div className="px-2 py-1.5 text-sm text-gray-500">Loading…</div>
                  ) : (
                    filteredSeeds.slice(0, 100).map((seed) => {
                      const prof = plantProfiles.find((p) => p.id === seed.plant_profile_id);
                      const name =
                        prof?.variety_name || seed.variety_name || seed.seed_name || 'Unknown';
                      const qty = seed.seed_count ?? seed.quantity ?? 0;
                      return (
                        <SelectItem key={seed.id} value={seed.id}>
                          {name} - {qty} seeds
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>

              {newItem.seed_lot_id && (
                <div className="text-xs text-gray-600">
                  Available: <span className="font-medium">{newItem.available_quantity ?? 0}</span> seeds
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Plant Type</Label>
                <Input
                  value={plantTypeSearch}
                  onChange={(e) => setPlantTypeSearch(e.target.value)}
                  placeholder="Search types…"
                  disabled={!!newItem.seed_lot_id}
                />

                <Select
                  value={newItem.plant_type_id || ''}
                  onValueChange={(value) => {
                    const pt = plantTypes.find((t) => t.id === value);
                    setNewItem({
                      ...newItem,
                      plant_type_id: value,
                      plant_type_name: pt?.name || '',
                      // reset variety selection when plant type changes (unless it was from stash)
                      variety_id: newItem.seed_lot_id ? newItem.variety_id : '',
                      variety_name: newItem.seed_lot_id ? newItem.variety_name : ''
                    });
                  }}
                  disabled={!!newItem.seed_lot_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingPlantTypes ? (
                      <div className="px-2 py-1.5 text-sm text-gray-500">Loading…</div>
                    ) : (
                      filteredPlantTypes.slice(0, 150).map((pt) => (
                        <SelectItem key={pt.id} value={pt.id}>
                          {pt.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div>
                  <Label htmlFor="varietyName">Variety</Label>
                  <Input
                    id="varietyName"
                    value={newItem.variety_name}
                    onChange={(e) => {
                      // Manual typing clears any previously selected catalog variety_id
                      setNewItem({ ...newItem, variety_name: e.target.value, variety_id: '' });
                    }}
                    placeholder={newItem.plant_type_id ? "Start typing to search varieties..." : "Select a plant type first"}
                    disabled={!newItem.plant_type_id}
                    className="mt-2"
                  />

                  {/* Plant Catalog picker (optional, but recommended for proper Need-to-Buy) */}
                  {newItem.plant_type_id && !newItem.seed_lot_id && (
                    <div className="mt-2 space-y-2">
                      <Select
                        value={newItem.variety_id ? newItem.variety_id : 'manual'}
                        onValueChange={(value) => {
                          if (value === 'manual') {
                            setNewItem({ ...newItem, variety_id: '' });
                            return;
                          }
                          const picked = (catalogVarieties || []).find(v => v.id === value);
                          setNewItem({
                            ...newItem,
                            variety_id: value,
                            variety_name: picked?.variety_name || newItem.variety_name
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick from Plant Catalog (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Use typed name (no catalog link)</SelectItem>

                          {catalogVarietiesLoading && (
                            <div className="px-2 py-1.5 text-sm text-gray-500">Loading varieties…</div>
                          )}

                          {!catalogVarietiesLoading && catalogVarietiesError && (
                            <div className="px-2 py-1.5 text-sm text-red-600">{catalogVarietiesError}</div>
                          )}

                          {!catalogVarietiesLoading && !catalogVarietiesError && (
                            (() => {
                              const q = (newItem.variety_name || '').toLowerCase().trim();
                              const options = (catalogVarieties || [])
                                .filter(v => {
                                  if (!q) return true;
                                  const name = (v.variety_name || '').toLowerCase();
                                  return name.includes(q);
                                })
                                .slice(0, 100);

                              if (options.length === 0) {
                                return <div className="px-2 py-1.5 text-sm text-gray-500">No matches (try a different search)</div>;
                              }

                              return options.map(v => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.variety_name}
                                </SelectItem>
                              ));
                            })()
                          )}
                        </SelectContent>
                      </Select>

                      <p className="text-xs text-gray-500">
                        Tip: selecting from the catalog links the item to a real Variety record, so Need-to-Buy and affiliate links work reliably.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={newItem.quantity}
                onChange={(e) =>
                  setNewItem({ ...newItem, quantity: Number(e.target.value || 1) })
                }
              />

              {/* IMPORTANT: warn but DO NOT block */}
              {newItem.seed_lot_id &&
                newItem.available_quantity !== undefined &&
                newItem.quantity > newItem.available_quantity && (
                  <div className="text-xs text-red-600">
                    Not enough seeds! You only have {newItem.available_quantity} seeds available.
                    <br />
                    You can still add it — this will show up in Need-to-Buy.
                  </div>
                )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={newItem.notes}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                placeholder="Optional notes…"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
                Cancel
              </Button>

              <Button
                onClick={handleAddItem}
                disabled={
                  (!newItem.plant_type_id && !newItem.plant_type_name) ||
                  !newItem.variety_name?.trim() ||
                  !newItem.quantity
                }
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}