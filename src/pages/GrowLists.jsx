import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Plus, Trash2, Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const safeLower = (v) => (typeof v === 'string' ? v.toLowerCase() : '');
const safeStr = (v) => (typeof v === 'string' ? v : '');

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

  // Plant Catalog variety picker cache (per plant type)
  const catalogVarietyCacheRef = useRef(new Map()); // plant_type_id -> Variety[]
  const [catalogVarieties, setCatalogVarieties] = useState([]);
  const [catalogVarietiesLoading, setCatalogVarietiesLoading] = useState(false);
  const [catalogVarietiesError, setCatalogVarietiesError] = useState(null);

  // ✅ REAL caching for plant types (previous version reset every render)
  const plantTypesCacheRef = useRef(null);

  const profileById = useMemo(() => {
    const m = new Map();
    (plantProfiles || []).forEach((p) => {
      if (p?.id) m.set(p.id, p);
    });
    return m;
  }, [plantProfiles]);

  const plantTypeById = useMemo(() => {
    const m = new Map();
    (plantTypes || []).forEach((pt) => {
      if (pt?.id) m.set(pt.id, pt);
    });
    return m;
  }, [plantTypes]);

  useEffect(() => {
    let unsubscribe = null;

    const init = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);

        await loadData(userData);

        // Subscribe to changes for this user
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPlantTypesCached = async () => {
    if (plantTypesCacheRef.current) return plantTypesCacheRef.current;
    const data = await base44.entities.PlantType.filter({}, 'name', 2000);
    plantTypesCacheRef.current = data || [];
    return plantTypesCacheRef.current;
  };

  const loadPlantTypes = async () => {
    try {
      setLoadingPlantTypes(true);
      const types = await getPlantTypesCached();
      setPlantTypes(types || []);
    } catch (error) {
      console.error('Error loading plant types:', error);
      setPlantTypes([]);
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

      const seedsSafe = seeds || [];
      setSeedStash(seedsSafe);

      // Load plant profiles for mapping seed lots -> variety/plant type
      const profileIds = Array.from(
        new Set(seedsSafe.map((s) => s.plant_profile_id).filter(Boolean))
      );

      if (profileIds.length > 0) {
        const profiles = await base44.entities.PlantProfile.filter(
          { id: { $in: profileIds } },
          'updated_date',
          2000
        );
        setPlantProfiles(profiles || []);
      } else {
        setPlantProfiles([]);
      }
    } catch (error) {
      console.error('Error loading seed stash:', error);
      setSeedStash([]);
      setPlantProfiles([]);
    } finally {
      setLoadingSeedStash(false);
    }
  };

  const loadData = async (userData) => {
    try {
      setLoading(true);

      const lists = await base44.entities.GrowList.filter(
        { created_by: userData.email },
        'created_date',
        100
      );

      const listsSafe = lists || [];
      setGrowLists(listsSafe);

      // Auto-select first list if none selected
      if (!selectedList && listsSafe.length > 0) {
        setSelectedList(listsSafe[0]);
      } else if (selectedList) {
        const updated = listsSafe.find((l) => l.id === selectedList.id);
        if (updated) setSelectedList(updated);
      }

      await loadPlantTypes();
      await loadSeedStash(userData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // When Add Item modal is open AND user is selecting from Plant Catalog (no seed lot),
  // fetch the varieties for that plant type once, then filter client-side.
  useEffect(() => {
    if (!showAddItemDialog) return;
    if (!newItem?.plant_type_id) return;
    if (newItem.seed_lot_id) return;

    loadCatalogVarietiesForPlantType(newItem.plant_type_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddItemDialog, newItem.plant_type_id, newItem.seed_lot_id]);

  const handleCreateList = async () => {
    if (!newList.name.trim()) {
      toast.error('Please enter a list name');
      return;
    }

    try {
      const created = await base44.entities.GrowList.create({
        ...newList,
        created_by: user.email,
        items: []
      });

      toast.success('Grow list created');
      setShowCreateDialog(false);
      setNewList({
        name: '',
        description: '',
        year: new Date().getFullYear(),
        status: 'active'
      });

      // Refresh data
      await loadData(user);
      setSelectedList(created);
    } catch (error) {
      console.error('Error creating list:', error);
      toast.error('Failed to create grow list');
    }
  };

  const handleDeleteList = async (listId) => {
    try {
      await base44.entities.GrowList.delete(listId);
      toast.success('Grow list deleted');

      // Update UI
      const remaining = growLists.filter((l) => l.id !== listId);
      setGrowLists(remaining);

      if (selectedList?.id === listId) {
        setSelectedList(remaining[0] || null);
      }
    } catch (error) {
      console.error('Error deleting list:', error);
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
    setCatalogVarieties([]);
    setCatalogVarietiesError(null);
    setShowAddItemDialog(true);
  };

  const handleSeedSelection = (seedLotId) => {
    const selectedSeed = (seedStash || []).find((s) => s.id === seedLotId);
    if (!selectedSeed) return;

    const profile = selectedSeed.plant_profile_id
      ? profileById.get(selectedSeed.plant_profile_id)
      : null;

    const varietyName = safeStr(profile?.variety_name) || safeStr(selectedSeed.variety_name) || 'Unknown Variety';
    const plantTypeName = safeStr(profile?.plant_type_name) || safeStr(selectedSeed.plant_type_name) || 'Unknown Type';

    setNewItem((prev) => ({
      ...prev,
      seed_lot_id: seedLotId,
      variety_id: safeStr(profile?.variety_id) || '',
      variety_name: varietyName,
      plant_type_id: safeStr(profile?.plant_type_id) || '',
      plant_type_name: plantTypeName,
      available_quantity: selectedSeed.quantity
    }));
  };

  const handlePlantTypeSelection = async (plantTypeId) => {
    const pt = plantTypeById.get(plantTypeId);
    setNewItem((prev) => ({
      ...prev,
      plant_type_id: plantTypeId,
      plant_type_name: safeStr(pt?.name) || '',
      variety_id: '',
      variety_name: ''
    }));

    // If using Plant Catalog mode (no seed lot), load varieties for that type
    if (!newItem.seed_lot_id) {
      await loadCatalogVarietiesForPlantType(plantTypeId);
    }
  };

  const handleCatalogVarietySelection = (varietyId) => {
    const v = (catalogVarieties || []).find((x) => x.id === varietyId);
    if (!v) return;

    setNewItem((prev) => ({
      ...prev,
      variety_id: varietyId,
      variety_name: safeStr(v.variety_name) || ''
    }));
  };

  const handleAddItem = async () => {
    if (!selectedList?.id) return;

    // Require plant type + variety name (either from seed stash OR plant catalog)
    if (!newItem.plant_type_id || !newItem.variety_name?.trim()) {
      toast.error('Please select a plant type and variety');
      return;
    }

    try {
      const item = {
        seed_lot_id: newItem.seed_lot_id || undefined, // optional
        plant_type_id: newItem.plant_type_id,
        plant_type_name: newItem.plant_type_name,
        variety_id: newItem.variety_id || undefined,
        variety_name: newItem.variety_name,
        quantity: Number(newItem.quantity) || 1,
        notes: newItem.notes || '',
        available_quantity: newItem.available_quantity,
        added_date: new Date().toISOString()
      };

      const updatedItems = [...(selectedList.items || []), item];

      await base44.entities.GrowList.update(selectedList.id, {
        items: updatedItems
      });

      toast.success('Item added');
      setShowAddItemDialog(false);
      await loadData(user);
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    }
  };

  const handleDeleteItem = async (index) => {
    try {
      const updatedItems = (selectedList.items || []).filter((_, i) => i !== index);

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

  const filteredLists = useMemo(() => {
    const q = safeLower(searchQuery);
    if (!q) return growLists || [];
    return (growLists || []).filter((list) => safeLower(list?.name).includes(q));
  }, [growLists, searchQuery]);

  const filteredSeeds = useMemo(() => {
    const q = safeLower(seedSearch);
    if (!q) return seedStash || [];
    return (seedStash || []).filter((seed) => {
      const profile = seed?.plant_profile_id ? profileById.get(seed.plant_profile_id) : null;
      const displayName =
        safeStr(profile?.variety_name) ||
        safeStr(seed?.variety_name) ||
        safeStr(seed?.name) ||
        '';
      return safeLower(displayName).includes(q);
    });
  }, [seedStash, seedSearch, profileById]);

  // ✅ This is where your crash happened before: pt.name could be undefined
  const filteredPlantTypes = useMemo(() => {
    const q = safeLower(plantTypeSearch);
    if (!q) return plantTypes || [];
    return (plantTypes || []).filter((pt) => safeLower(pt?.name).includes(q));
  }, [plantTypes, plantTypeSearch]);

  const filteredCatalogVarieties = useMemo(() => {
    const q = safeLower(newItem?.variety_name);
    if (!q) return catalogVarieties || [];
    // Don’t filter by id; filter by name for type-ahead
    return (catalogVarieties || []).filter((v) => safeLower(v?.variety_name).includes(q));
  }, [catalogVarieties, newItem?.variety_name]);

  const syncToCalendar = async () => {
    toast.message('Sync to Calendar is not wired in this page yet.');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Loading grow lists…</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Grow Lists</h1>
          <Badge variant="outline" className="capitalize">
            {selectedList?.status || '—'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-4 h-4" />
            New List
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            onClick={syncToCalendar}
          >
            <Calendar className="w-4 h-4" />
            Sync to Calendar
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Left: lists */}
        <Card className="p-4 md:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Your Lists</div>
          </div>

          <Input
            placeholder="Search lists…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3"
          />

          <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
            {filteredLists.map((list) => (
              <div
                key={list.id}
                className={`p-3 rounded-lg border cursor-pointer ${
                  selectedList?.id === list.id ? 'border-emerald-400 bg-emerald-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedList(list)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{list.name}</div>
                    <div className="text-xs text-gray-500">
                      {list.year || '—'} • {(list.items || []).length} items
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteList(list.id);
                    }}
                    title="Delete list"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredLists.length === 0 && (
              <div className="text-sm text-gray-500 py-6 text-center">
                No lists found.
              </div>
            )}
          </div>
        </Card>

        {/* Right: selected list items */}
        <Card className="p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold">
                {selectedList?.name || 'Select a list'}
              </div>
              {selectedList?.description && (
                <div className="text-sm text-gray-500">{selectedList.description}</div>
              )}
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              onClick={handleOpenAddItem}
              disabled={!selectedList}
            >
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </div>

          {!selectedList ? (
            <div className="text-sm text-gray-500 py-10 text-center">
              Select a grow list to view items.
            </div>
          ) : (
            <div className="space-y-2">
              {(selectedList.items || []).length === 0 ? (
                <div className="text-sm text-gray-500 py-10 text-center">
                  No items yet. Click “Add Item”.
                </div>
              ) : (
                (selectedList.items || []).map((item, idx) => {
                  const needToBuy =
                    typeof item.available_quantity === 'number' &&
                    Number(item.quantity || 0) > Number(item.available_quantity || 0);

                  const missingQty = needToBuy
                    ? Number(item.quantity || 0) - Number(item.available_quantity || 0)
                    : 0;

                  return (
                    <div key={idx} className="p-3 rounded-lg border hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {item.variety_name || 'Unknown Variety'}{' '}
                            <span className="text-gray-400">—</span>{' '}
                            <span className="text-gray-700">{item.plant_type_name || 'Unknown Type'}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Qty: <span className="font-medium">{item.quantity || 1}</span>
                            {typeof item.available_quantity === 'number' && (
                              <>
                                {' '}
                                • Available: <span className="font-medium">{item.available_quantity}</span>
                              </>
                            )}
                          </div>

                          {needToBuy && (
                            <div className="text-xs text-red-600 mt-1">
                              Not enough seeds! You’re short by {missingQty}.
                            </div>
                          )}

                          {item.notes && (
                            <div className="text-xs text-gray-500 mt-1">{item.notes}</div>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteItem(idx)}
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Create List Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Grow List</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={newList.name}
                onChange={(e) => setNewList((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., 2026 Spring Grow List"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={newList.description}
                onChange={(e) => setNewList((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={newList.year}
                  onChange={(e) =>
                    setNewList((p) => ({ ...p, year: Number(e.target.value) || new Date().getFullYear() }))
                  }
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={newList.status}
                  onValueChange={(v) => setNewList((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">draft</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="archived">archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
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

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to Grow List</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Seed stash optional */}
            <div>
              <Label>From Seed Stash (optional)</Label>
              <Input
                placeholder="Search seeds…"
                value={seedSearch}
                onChange={(e) => setSeedSearch(e.target.value)}
                className="mb-2"
              />
              <Select
                value={newItem.seed_lot_id || '__none'}
                onValueChange={(v) => {
                  if (v === '__none') {
                    setNewItem((p) => ({
                      ...p,
                      seed_lot_id: '',
                      available_quantity: undefined
                    }));
                    return;
                  }
                  handleSeedSelection(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select from your seeds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None (use Plant Catalog)</SelectItem>
                  {loadingSeedStash ? (
                    <SelectItem value="__loading" disabled>
                      Loading…
                    </SelectItem>
                  ) : (
                    filteredSeeds.map((seed) => {
                      const profile = seed?.plant_profile_id ? profileById.get(seed.plant_profile_id) : null;
                      const displayName =
                        safeStr(profile?.variety_name) ||
                        safeStr(seed?.variety_name) ||
                        safeStr(seed?.name) ||
                        'Unknown Seed';

                      const qty = typeof seed?.quantity === 'number' ? seed.quantity : null;

                      return (
                        <SelectItem key={seed.id} value={seed.id}>
                          {displayName}{qty !== null ? ` — ${qty} seeds` : ''}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>

              {typeof newItem.available_quantity === 'number' && (
                <div className="text-xs text-gray-500 mt-1">
                  Available: {newItem.available_quantity} seeds
                </div>
              )}
            </div>

            {/* Plant type + variety */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plant Type</Label>
                <Input
                  placeholder="Search types…"
                  value={plantTypeSearch}
                  onChange={(e) => setPlantTypeSearch(e.target.value)}
                  className="mb-2"
                />
                <Select
                  value={newItem.plant_type_id || ''}
                  onValueChange={(v) => handlePlantTypeSelection(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingPlantTypes ? (
                      <SelectItem value="__loading" disabled>
                        Loading…
                      </SelectItem>
                    ) : (
                      filteredPlantTypes.map((pt) => (
                        <SelectItem key={pt.id} value={pt.id}>
                          {pt.name || 'Unnamed Type'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Variety</Label>
                {/* If user picked a seed lot, allow typing/editing variety name manually (still supported) */}
                {newItem.seed_lot_id ? (
                  <Input
                    value={newItem.variety_name}
                    onChange={(e) => setNewItem((p) => ({ ...p, variety_name: e.target.value }))}
                    placeholder="Variety"
                  />
                ) : (
                  <>
                    <Input
                      value={newItem.variety_name}
                      onChange={(e) => setNewItem((p) => ({ ...p, variety_name: e.target.value }))}
                      placeholder={
                        newItem.plant_type_id ? 'Search catalog varieties…' : 'Select plant type first…'
                      }
                      className="mb-2"
                      disabled={!newItem.plant_type_id}
                    />

                    <Select
                      value={newItem.variety_id || '__none'}
                      onValueChange={(v) => {
                        if (v === '__none') return;
                        handleCatalogVarietySelection(v);
                      }}
                      disabled={!newItem.plant_type_id}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !newItem.plant_type_id
                              ? 'Select plant type first'
                              : catalogVarietiesLoading
                                ? 'Loading varieties…'
                                : 'Select from Plant Catalog'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {!newItem.plant_type_id ? (
                          <SelectItem value="__disabled" disabled>
                            Select plant type first
                          </SelectItem>
                        ) : catalogVarietiesLoading ? (
                          <SelectItem value="__loading" disabled>
                            Loading…
                          </SelectItem>
                        ) : catalogVarietiesError ? (
                          <SelectItem value="__error" disabled>
                            {catalogVarietiesError}
                          </SelectItem>
                        ) : (
                          <>
                            <SelectItem value="__none" disabled>
                              Choose a variety…
                            </SelectItem>
                            {filteredCatalogVarieties.slice(0, 200).map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.variety_name || 'Unnamed Variety'}
                              </SelectItem>
                            ))}
                            {filteredCatalogVarieties.length > 200 && (
                              <SelectItem value="__more" disabled>
                                Showing first 200 matches — keep typing to narrow…
                              </SelectItem>
                            )}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                value={newItem.quantity}
                onChange={(e) => setNewItem((p) => ({ ...p, quantity: Number(e.target.value) || 1 }))}
                min={1}
              />
              {typeof newItem.available_quantity === 'number' &&
                Number(newItem.quantity || 0) > Number(newItem.available_quantity || 0) && (
                  <div className="text-xs text-red-600 mt-1">
                    Not enough seeds! You only have {newItem.available_quantity} available.
                  </div>
                )}
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={newItem.notes}
                onChange={(e) => setNewItem((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
                Cancel
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddItem}>
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}