import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Package, 
  Plus, 
  Search, 
  Filter,
  Heart,
  AlertTriangle,
  RefreshCw,
  Star,
  MoreVertical,
  Trash2,
  Edit,
  ListChecks,
  Loader2,
  Grid3X3,
  List,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AdBanner from '@/components/monetization/AdBanner';

const TAGS = [
  { value: 'favorite', label: 'Favorite', icon: Star, color: 'text-yellow-500' },
  { value: 'low_stock', label: 'Low Stock', icon: AlertTriangle, color: 'text-orange-500' },
  { value: 'trade', label: 'Trade', icon: RefreshCw, color: 'text-blue-500' },
  { value: 'must_grow', label: 'Must Grow', icon: Heart, color: 'text-red-500' },
];

export default function SeedStash() {
  const [searchParams] = useSearchParams();
  const [seeds, setSeeds] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [plantTypes, setPlantTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(searchParams.get('action') === 'new');
  const [editingSeed, setEditingSeed] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [filterTab, setFilterTab] = useState('stash');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [varieties, setVarieties] = useState([]);
  const [selectedPlantType, setSelectedPlantType] = useState(null);

  const [formData, setFormData] = useState({
    plant_profile_id: '',
    quantity: '',
    unit: 'seeds',
    year_acquired: new Date().getFullYear(),
    packed_for_year: '',
    source_vendor_name: '',
    source_vendor_url: '',
    storage_location: '',
    lot_notes: '',
    tags: [],
    is_wishlist: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[SeedStash] Loading data...');
      const user = await base44.auth.me();
      const [seedsData, profilesData, typesData] = await Promise.all([
        base44.entities.SeedLot.filter({ created_by: user.email }, '-created_date'),
        base44.entities.PlantProfile.list('variety_name', 500),
        base44.entities.PlantType.list('common_name')
      ]);
      
      console.log('[SeedStash] Loaded:', seedsData.length, 'lots,', profilesData.length, 'profiles');
      setSeeds(seedsData);
      setPlantTypes(typesData.filter(t => t.common_name && t.common_name.trim()));
      
      const profilesMap = {};
      profilesData.forEach(p => {
        profilesMap[p.id] = p;
      });
      setProfiles(profilesMap);
      
      // Log any lots without profiles
      seedsData.forEach(lot => {
        if (lot.plant_profile_id && !profilesMap[lot.plant_profile_id]) {
          console.warn('[SeedStash] SeedLot missing profile:', lot.id, 'profile_id:', lot.plant_profile_id);
        }
      });
    } catch (error) {
      console.error('Error loading seed stash:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlantTypeChange = async (plantTypeId) => {
    const type = plantTypes.find(t => t.id === plantTypeId);
    setSelectedPlantType(type);
    setFormData({ 
      ...formData, 
      plant_type_id: plantTypeId,
      plant_profile_id: ''
    });

    if (plantTypeId) {
      try {
        const vars = await base44.entities.Variety.filter({ 
          plant_type_id: plantTypeId,
          status: 'active'
        }, 'variety_name');
        setVarieties(vars);
      } catch (error) {
        console.error('Error loading varieties:', error);
        setVarieties([]);
      }
    } else {
      setVarieties([]);
    }
  };

  const handleVarietyChange = async (varietyId) => {
    const variety = varieties.find(v => v.id === varietyId);
    
    // Find or create PlantProfile for this variety
    const existingProfiles = await base44.entities.PlantProfile.filter({
      variety_name: variety.variety_name,
      plant_type_id: variety.plant_type_id
    });
    
    let profileId;
    if (existingProfiles.length > 0) {
      profileId = existingProfiles[0].id;
    } else {
      const plantType = plantTypes.find(t => t.id === variety.plant_type_id);
      const newProfile = await base44.entities.PlantProfile.create({
        plant_type_id: variety.plant_type_id,
        common_name: plantType?.common_name,
        variety_name: variety.variety_name,
        days_to_maturity_seed: variety.days_to_maturity,
        spacing_in_min: variety.spacing_recommended,
        spacing_in_max: variety.spacing_recommended,
        source_type: 'user_private'
      });
      profileId = newProfile.id;
      setProfiles({ ...profiles, [profileId]: newProfile });
    }
    
    setFormData({ 
      ...formData, 
      plant_profile_id: profileId
    });
  };

  const handleSubmit = async () => {
    if (!formData.plant_profile_id) {
      toast.error('Please select a variety');
      return;
    }

    try {
      if (editingSeed) {
        await base44.entities.SeedLot.update(editingSeed.id, formData);
        await loadData(); // Reload to get updated profiles
        toast.success('Seed updated!');
      } else {
        const seed = await base44.entities.SeedLot.create(formData);
        await loadData(); // Reload to get updated profiles
        toast.success(formData.is_wishlist ? 'Added to wishlist!' : 'Seed added to stash!');
      }
      closeDialog();
    } catch (error) {
      console.error('Error saving seed:', error);
      toast.error('Failed to save seed');
    }
  };

  const handleDelete = async (seed) => {
    if (!confirm(`Delete "${seed.variety_name || seed.custom_name}"?`)) return;
    try {
      await base44.entities.SeedLot.delete(seed.id);
      setSeeds(seeds.filter(s => s.id !== seed.id));
      toast.success('Seed deleted');
    } catch (error) {
      console.error('Error deleting seed:', error);
    }
  };

  const handleToggleWishlist = async (seed) => {
    try {
      await base44.entities.SeedLot.update(seed.id, { is_wishlist: !seed.is_wishlist });
      setSeeds(seeds.map(s => s.id === seed.id ? { ...s, is_wishlist: !s.is_wishlist } : s));
      toast.success(seed.is_wishlist ? 'Moved to stash' : 'Moved to wishlist');
    } catch (error) {
      console.error('Error updating seed:', error);
    }
  };

  const handleToggleTag = async (seed, tag) => {
    const newTags = seed.tags?.includes(tag) 
      ? seed.tags.filter(t => t !== tag)
      : [...(seed.tags || []), tag];
    
    try {
      await base44.entities.SeedLot.update(seed.id, { tags: newTags });
      setSeeds(seeds.map(s => s.id === seed.id ? { ...s, tags: newTags } : s));
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const openEditDialog = async (seed) => {
    setEditingSeed(seed);
    const profile = profiles[seed.plant_profile_id];
    
    setFormData({
      plant_profile_id: seed.plant_profile_id || '',
      plant_type_id: profile?.plant_type_id || '',
      quantity: seed.quantity || '',
      unit: seed.unit || 'seeds',
      year_acquired: seed.year_acquired || new Date().getFullYear(),
      packed_for_year: seed.packed_for_year || '',
      source_vendor_name: seed.source_vendor_name || '',
      source_vendor_url: seed.source_vendor_url || '',
      storage_location: seed.storage_location || '',
      lot_notes: seed.lot_notes || '',
      tags: seed.tags || [],
      is_wishlist: seed.is_wishlist || false
    });

    if (profile?.plant_type_id) {
      try {
        const type = plantTypes.find(t => t.id === profile.plant_type_id);
        setSelectedPlantType(type);
        const vars = await base44.entities.Variety.filter({ 
          plant_type_id: profile.plant_type_id,
          status: 'active'
        }, 'variety_name');
        setVarieties(vars);
      } catch (error) {
        console.error('Error loading varieties:', error);
      }
    }

    setShowAddDialog(true);
  };

  const closeDialog = () => {
    setShowAddDialog(false);
    setEditingSeed(null);
    setVarieties([]);
    setSelectedPlantType(null);
    setFormData({
      plant_profile_id: '',
      plant_type_id: '',
      quantity: '',
      unit: 'seeds',
      year_acquired: new Date().getFullYear(),
      packed_for_year: '',
      source_vendor_name: '',
      source_vendor_url: '',
      storage_location: '',
      lot_notes: '',
      tags: [],
      is_wishlist: false
    });
  };

  const filteredSeeds = seeds.filter(seed => {
    // Tab filter
    if (filterTab === 'stash' && seed.is_wishlist) return false;
    if (filterTab === 'wishlist' && !seed.is_wishlist) return false;

    const profile = profiles[seed.plant_profile_id];
    if (!profile && seed.plant_profile_id) {
      console.warn('[SeedStash] Filtering out seed without profile:', seed.id);
      return false;
    }

    // Search filter
    const name = (profile?.variety_name || profile?.common_name || seed.custom_label || '').toLowerCase();
    if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;

    // Type filter
    if (filterType !== 'all' && profile?.common_name !== filterType) return false;

    // Tag filter
    if (filterTag !== 'all' && !seed.tags?.includes(filterTag)) return false;

    return true;
  });

  const stashCount = seeds.filter(s => !s.is_wishlist).length;
  const wishlistCount = seeds.filter(s => s.is_wishlist).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Seed Stash</h1>
          <p className="text-gray-600 mt-1">Track your seeds and wishlist</p>
        </div>
        <Button 
          onClick={() => setShowAddDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Seeds
        </Button>
      </div>

      <AdBanner placement="top_banner" pageType="seed_stash" />

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs value={filterTab} onValueChange={setFilterTab}>
          <TabsList>
            <TabsTrigger value="stash" className="gap-2">
              <Package className="w-4 h-4" />
              Stash ({stashCount})
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="gap-2">
              <Heart className="w-4 h-4" />
              Wishlist ({wishlistCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('table')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search seeds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Plant Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {[...new Set(seeds.map(s => {
              const profile = profiles[s.plant_profile_id];
              return profile?.common_name;
            }).filter(Boolean))].map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {TAGS.map((tag) => (
              <SelectItem key={tag.value} value={tag.value}>{tag.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Seeds Display */}
      {filteredSeeds.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filterTab === 'wishlist' ? 'No wishlist items' : 'No seeds yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {filterTab === 'wishlist' 
                ? 'Add seeds you want to buy' 
                : 'Add your first seeds to track your collection'}
            </p>
            <Button 
              onClick={() => {
                setFormData({ ...formData, is_wishlist: filterTab === 'wishlist' });
                setShowAddDialog(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {filterTab === 'wishlist' ? 'Add to Wishlist' : 'Add Seeds'}
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredSeeds.map((seed, index) => (
              <motion.div
                key={seed.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                     <div className="flex-1 min-w-0">
                       {(() => {
                         const profile = profiles[seed.plant_profile_id];
                         return (
                           <>
                             <h3 className="font-semibold text-gray-900 truncate">
                               {profile?.variety_name || seed.custom_label || 'Unknown'}
                             </h3>
                             {profile?.common_name && (
                               <p className="text-sm text-gray-500">{profile.common_name}</p>
                             )}
                           </>
                         );
                       })()}
                     </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(seed)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleWishlist(seed)}>
                            <Heart className="w-4 h-4 mr-2" />
                            {seed.is_wishlist ? 'Move to Stash' : 'Move to Wishlist'}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl('GrowLists') + '?addSeed=' + seed.id}>
                              <ListChecks className="w-4 h-4 mr-2" />
                              Add to Grow List
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(seed)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-2 text-sm">
                      {seed.source_vendor_name && (
                        <p className="text-gray-600">{seed.source_vendor_name}</p>
                      )}
                      <div className="flex items-center gap-2 text-gray-500">
                        {seed.year_acquired && (
                          <Badge variant="outline">{seed.year_acquired}</Badge>
                        )}
                        {seed.quantity && (
                          <Badge variant="outline">
                            {seed.quantity} {seed.unit}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {TAGS.map((tag) => (
                        <button
                          key={tag.value}
                          onClick={() => handleToggleTag(seed, tag.value)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            seed.tags?.includes(tag.value)
                              ? 'bg-gray-100 ' + tag.color
                              : 'text-gray-300 hover:text-gray-400'
                          }`}
                        >
                          <tag.icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSeeds.map((seed) => {
                const profile = profiles[seed.plant_profile_id];
                return (
                <TableRow key={seed.id}>
                  <TableCell className="font-medium">
                    {profile?.variety_name || seed.custom_label || 'Unknown'}
                  </TableCell>
                  <TableCell>{profile?.common_name || '-'}</TableCell>
                  <TableCell>{seed.source_vendor_name || '-'}</TableCell>
                  <TableCell>{seed.year_acquired || '-'}</TableCell>
                  <TableCell>
                    {seed.quantity ? `${seed.quantity} ${seed.unit}` : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {seed.tags?.map((tag) => {
                        const tagInfo = TAGS.find(t => t.value === tag);
                        return tagInfo ? (
                          <tagInfo.icon key={tag} className={`w-4 h-4 ${tagInfo.color}`} />
                        ) : null;
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(seed)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(seed)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSeed ? 'Edit Seed' : (formData.is_wishlist ? 'Add to Wishlist' : 'Add Seeds')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label>Plant Type (from catalog)</Label>
              <Select 
                value={formData.plant_type_id} 
                onValueChange={handlePlantTypeChange}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select from catalog" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None (manual entry)</SelectItem>
                  {plantTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.common_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.plant_type_id && (
              <div>
                <Label>Variety Name *</Label>
                {varieties.length > 0 ? (
                  <Select 
                    value={formData.plant_profile_id} 
                    onValueChange={handleVarietyChange}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select variety" />
                    </SelectTrigger>
                    <SelectContent>
                      {varieties.map((variety) => (
                        <SelectItem key={variety.id} value={variety.id}>
                          {variety.variety_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-gray-500 mt-2">No varieties available for {selectedPlantType?.common_name}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="e.g., 25"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(v) => setFormData({ ...formData, unit: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seeds">Seeds</SelectItem>
                    <SelectItem value="packets">Packets</SelectItem>
                    <SelectItem value="grams">Grams</SelectItem>
                    <SelectItem value="ounces">Ounces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year_acquired">Year Acquired</Label>
                <Input
                  id="year_acquired"
                  type="number"
                  value={formData.year_acquired}
                  onChange={(e) => setFormData({ ...formData, year_acquired: parseInt(e.target.value) || '' })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="packed_for">Packed For Year</Label>
                <Input
                  id="packed_for"
                  type="number"
                  placeholder="2025"
                  value={formData.packed_for_year}
                  onChange={(e) => setFormData({ ...formData, packed_for_year: parseInt(e.target.value) || '' })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="source">Vendor/Source</Label>
              <Input
                id="source"
                placeholder="e.g., Baker Creek"
                value={formData.source_vendor_name}
                onChange={(e) => setFormData({ ...formData, source_vendor_name: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="source_url">Vendor URL</Label>
              <Input
                id="source_url"
                type="url"
                placeholder="https://..."
                value={formData.source_vendor_url}
                onChange={(e) => setFormData({ ...formData, source_vendor_url: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="storage">Storage Location</Label>
              <Input
                id="storage"
                placeholder="e.g., Refrigerator, Box A"
                value={formData.storage_location}
                onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about these seeds..."
                value={formData.lot_notes}
                onChange={(e) => setFormData({ ...formData, lot_notes: e.target.value })}
                className="mt-2"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="wishlist"
                checked={formData.is_wishlist}
                onCheckedChange={(checked) => setFormData({ ...formData, is_wishlist: checked })}
              />
              <Label htmlFor="wishlist" className="text-sm font-normal">
                Add to wishlist (seeds I want to buy)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button 
              onClick={handleSubmit}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {editingSeed ? 'Save Changes' : 'Add Seed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}