import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Search, 
  Sprout, 
  Filter,
  Plus,
  ChevronRight,
  Sun,
  Droplets,
  Ruler,
  Clock,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Package,
  ListChecks,
  BookOpen,
  Grid3x3,
  List,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AdBanner from '@/components/monetization/AdBanner';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PlantRecommendations from '@/components/ai/PlantRecommendations';
import { Sparkles } from 'lucide-react';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import { useDebouncedValue } from '../components/utils/useDebouncedValue';

const CATEGORIES = ['vegetable', 'fruit', 'herb', 'flower', 'other'];

export default function PlantCatalog() {
  const [searchParams] = useSearchParams();
  const [plantTypes, setPlantTypes] = useState([]);
  const [allVarieties, setAllVarieties] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [newVariety, setNewVariety] = useState({
    variety_name: '',
    days_to_maturity: '',
    spacing_recommended: '',
    plant_height_typical: '',
    sun_requirement: 'full_sun',
    water_requirement: 'moderate'
  });

  useEffect(() => {
    loadPlantTypes();
    loadAllVarieties();
    
    // Handle search param from TopBar
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedType) {
      loadVarieties(selectedType.id);
      loadSubCategories(selectedType.id);
    }
  }, [selectedType]);

  const loadPlantTypes = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    
    // Clear old cache format that's missing plantGroups
    try {
      const existingCache = sessionStorage.getItem('plant_catalog_cache');
      if (existingCache) {
        const parsed = JSON.parse(existingCache);
        if (!parsed.plantGroups) {
          console.debug('[PlantCatalog] Clearing old cache format');
          sessionStorage.removeItem('plant_catalog_cache');
        }
      }
    } catch (e) { /* ignore */ }
    
    const cached = sessionStorage.getItem('plant_catalog_cache');
    if (cached && !isRetry) {
      try {
        const { types, browseCats, plantGroups: cachedGroups, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 30 * 60 * 1000) {
          console.debug('[PlantCatalog] Using cached data, age:', Math.round(age/1000), 's');
          const validTypes = types.filter(type => 
            type.id && type.common_name && type.is_active !== false && !type.notes?.includes('DEPRECATED')
          ).map(type => {
            const group = (cachedGroups || []).find(g => g.id === type.plant_group_id);
            return {
              ...type,
              plant_group_sort_order: group?.sort_order ?? 99
            };
          });
          const browseTypes = browseCats.map(cat => ({
            id: `browse_${cat.category_code}`,
            common_name: cat.name,
            icon: cat.icon,
            category: 'browse',
            color: '',
            _is_browse_only: true,
            _browse_category: cat,
            _sort_priority: -1000 + cat.sort_order
          }));
          setPlantTypes([...browseTypes, ...validTypes]);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Cache parse error:', e);
      }
    }
    
    try {
      console.debug('[PlantCatalog] fetch_start PlantType');
      
      // Load sequentially with delays to prevent rate limiting
      const types = await smartQuery(base44, 'PlantType', {}, 'common_name', 5000);
      await new Promise(r => setTimeout(r, 300));
      
      const browseCats = await smartQuery(base44, 'BrowseCategory', { is_active: true }, 'sort_order');
      await new Promise(r => setTimeout(r, 300));
      
      const plantGroups = await smartQuery(base44, 'PlantGroup', {}, 'sort_order');
      
      console.debug('[PlantCatalog] fetch_success PlantType count=', types.length);
      
      // CRITICAL: Store plantGroups in cache
      sessionStorage.setItem('plant_catalog_cache', JSON.stringify({
        types, browseCats, plantGroups, timestamp: Date.now()
      }));
      
      const validTypes = types.filter(type => 
        type.id && 
        type.common_name && 
        type.is_active !== false &&
        !type.notes?.includes('DEPRECATED')
      ).map(type => {
        const group = plantGroups.find(g => g.id === type.plant_group_id);
        return {
          ...type,
          plant_group_sort_order: group?.sort_order ?? 99
        };
      });
      
      const browseTypes = browseCats.map(cat => ({
        id: `browse_${cat.category_code}`,
        common_name: cat.name,
        icon: cat.icon,
        category: 'browse',
        color: '',
        _is_browse_only: true,
        _browse_category: cat,
        _sort_priority: -1000 + cat.sort_order
      }));
      
      setPlantTypes([...browseTypes, ...validTypes]);
      setRateLimitError(null);
    } catch (error) {
      console.error('[PlantCatalog] Error loading plant types:', error);
      if (error.code === 'RATE_LIMIT') {
        setRateLimitError(error);
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  const loadAllVarieties = async () => {
    try {
      // Load first 500 varieties for search - don't load all 4000
      const vars = await smartQuery(base44, 'Variety', { 
        status: 'active'
      }, 'variety_name', 500);
      setAllVarieties(vars);
    } catch (error) {
      console.error('[PlantCatalog] Error loading varieties:', error);
    }
  };

  const loadVarieties = async (typeId) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const vars = await base44.entities.Variety.filter({ 
        plant_type_id: typeId,
        status: 'active'
      }, 'variety_name', 50);
      setVarieties(vars);
    } catch (error) {
      console.error('[PlantCatalog] Error loading varieties:', error);
      setVarieties([]);
    }
  };

  const loadSubCategories = async (typeId) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const subcats = await base44.entities.PlantSubCategory.filter({ 
        plant_type_id: typeId,
        is_active: true
      }, 'sort_order');
      setSubCategories(subcats);
    } catch (error) {
      console.error('[PlantCatalog] Error loading subcategories:', error);
      setSubCategories([]);
    }
  };

  const handleAddVariety = async () => {
    if (!selectedType || !newVariety.variety_name.trim()) return;

    try {
      const variety = await base44.entities.Variety.create({
        plant_type_id: selectedType.id,
        plant_type_name: selectedType.name,
        variety_name: newVariety.variety_name,
        days_to_maturity: newVariety.days_to_maturity ? parseInt(newVariety.days_to_maturity) : null,
        spacing_recommended: newVariety.spacing_recommended ? parseInt(newVariety.spacing_recommended) : null,
        plant_height_typical: newVariety.plant_height_typical,
        sun_requirement: newVariety.sun_requirement,
        water_requirement: newVariety.water_requirement,
        status: 'pending_review',
        is_custom: true
      });

      setVarieties([...varieties, variety]);
      setShowAddVariety(false);
      setNewVariety({
        variety_name: '',
        days_to_maturity: '',
        spacing_recommended: '',
        plant_height_typical: '',
        sun_requirement: 'full_sun',
        water_requirement: 'moderate'
      });
      toast.success('Variety added! It will be reviewed by moderators.');
    } catch (error) {
      console.error('Error adding variety:', error);
      toast.error('Failed to add variety');
    }
  };

  const handleAddToSeedStash = async (variety) => {
    try {
      await base44.entities.SeedLot.create({
        plant_type_id: selectedType.id,
        plant_type_name: selectedType.name,
        variety_id: variety.id,
        variety_name: variety.variety_name,
        is_wishlist: false
      });
      toast.success('Added to your seed stash!');
    } catch (error) {
      console.error('Error adding to stash:', error);
      toast.error('Failed to add to stash');
    }
  };

  const handleAddToWishlist = async (variety) => {
    try {
      await base44.entities.SeedLot.create({
        plant_type_id: selectedType.id,
        plant_type_name: selectedType.name,
        variety_id: variety.id,
        variety_name: variety.variety_name,
        is_wishlist: true
      });
      toast.success('Added to your wishlist!');
    } catch (error) {
      console.error('Error adding to wishlist:', error);
    }
  };

  // Define popular plant types for top categories sorting
  const popularTypes = ['Tomato', 'Pepper', 'Cucumber', 'Lettuce', 'Bean', 'Pea', 'Squash', 'Zucchini', 
                        'Carrot', 'Radish', 'Onion', 'Garlic', 'Basil', 'Cilantro', 'Parsley'];

  const filteredTypes = plantTypes.filter(type => {
    const name = type.common_name || '';
    
    // If search query exists, check both PlantType names AND Variety names
    const matchesSearch = debouncedSearchQuery === '' || 
                         name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                         type.scientific_name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                         allVarieties.some(v => 
                           v.plant_type_id === type.id && 
                           v.variety_name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
                         );
    
    const matchesCategory = selectedCategory === 'all' || type.category === selectedCategory || type.category === 'browse';
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    // Browse categories always first
    if (a._sort_priority !== undefined && b._sort_priority !== undefined) {
      return a._sort_priority - b._sort_priority;
    }
    if (a._sort_priority !== undefined) return -1;
    if (b._sort_priority !== undefined) return 1;
    
    // Get plant group sort order for both
    const groupOrderA = a.plant_group_sort_order ?? 99;
    const groupOrderB = b.plant_group_sort_order ?? 99;
    
    // Sort by group first (garden groups 1-6, indoor group 50)
    if (groupOrderA !== groupOrderB) {
      return groupOrderA - groupOrderB;
    }
    
    // Within same group, apply user's selected sort
    if (sortBy === 'name') {
      return (a.common_name || '').localeCompare(b.common_name || '');
    } else if (sortBy === 'category') {
      return (a.category || '').localeCompare(b.category || '');
    } else if (sortBy === 'popularity') {
      const aIndex = popularTypes.indexOf(a.common_name);
      const bIndex = popularTypes.indexOf(b.common_name);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return (a.common_name || '').localeCompare(b.common_name || '');
    }
    return 0;
  });

  const getSunIcon = (sun) => {
    switch (sun) {
      case 'full_sun': return '☀️';
      case 'partial_sun': return '🌤️';
      case 'partial_shade': return '⛅';
      case 'full_shade': return '🌥️';
      default: return '☀️';
    }
  };

  const getWaterIcon = (water) => {
    switch (water) {
      case 'low': return '💧';
      case 'moderate': return '💧💧';
      case 'high': return '💧💧💧';
      default: return '💧💧';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Empty state when no plant types
  if (plantTypes.length === 0 && !selectedType) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Plant Catalog</h1>
        <Card className="py-16">
          <CardContent className="text-center">
            <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Plant catalog is empty</h3>
            <p className="text-gray-600">Admin must import taxonomy or add plant types first.</p>
            <p className="text-sm text-gray-500 mt-2">Admin → Data Imports → Import Plant Taxonomy</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Variety Detail View
  if (selectedVariety) {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedVariety(null)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {selectedType?.name}
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedVariety.variety_name}
                </h1>
                <p className="text-gray-600">{selectedType?.name}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  {selectedVariety.days_to_maturity && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <Clock className="w-5 h-5 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Days to Maturity</p>
                      <p className="font-semibold">{selectedVariety.days_to_maturity} days</p>
                    </div>
                  )}
                  {selectedVariety.spacing_recommended && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <Ruler className="w-5 h-5 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Spacing</p>
                      <p className="font-semibold">{selectedVariety.spacing_recommended}"</p>
                    </div>
                  )}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <Sun className="w-5 h-5 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Sun</p>
                    <p className="font-semibold capitalize">
                      {selectedVariety.sun_requirement?.replace(/_/g, ' ') || 'Full sun'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <Droplets className="w-5 h-5 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Water</p>
                    <p className="font-semibold capitalize">
                      {selectedVariety.water_requirement || 'Moderate'}
                    </p>
                  </div>
                </div>

                {selectedVariety.plant_height_typical && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500">Typical Height</p>
                    <p className="font-semibold">{selectedVariety.plant_height_typical}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => handleAddToSeedStash(selectedVariety)}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <Package className="w-4 h-4" />
                Add to Seed Stash
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleAddToWishlist(selectedVariety)}
                className="gap-2"
              >
                <ListChecks className="w-4 h-4" />
                Add to Wishlist
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <AdBanner 
              placement="side_banner" 
              pageType="catalog" 
              plantTypeId={selectedType?.id}
              varietyId={selectedVariety.id}
            />
          </div>
        </div>
      </div>
    );
  }

  // Plant Type Detail View
  if (selectedType) {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => { setSelectedType(null); setVarieties([]); }}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {selectedType.common_name || selectedType.name}
            </h1>
            {selectedType.scientific_name && (
              <p className="text-gray-600 mt-1 italic">{selectedType.scientific_name}</p>
            )}
            <p className="text-gray-500 mt-1 capitalize">{selectedType.category}</p>
          </div>
          <div className="flex gap-2">
            <Link to={createPageUrl('PlantCatalogV2')}>
              <Button variant="outline" className="gap-2">
                <BookOpen className="w-4 h-4" />
                Advanced Catalog
              </Button>
            </Link>
            <Button 
              onClick={() => setShowAddVariety(true)}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Variety
            </Button>
          </div>
        </div>

        <AdBanner placement="top_banner" pageType="catalog" plantTypeId={selectedType.id} />

        {/* Subcategories Filter */}
        {subCategories.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter by Type</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedSubCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSubCategory('all')}
                  className={selectedSubCategory === 'all' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  All
                </Button>
                {subCategories.map((subcat) => (
                  <Button
                    key={subcat.id}
                    variant={selectedSubCategory === subcat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSubCategory(subcat.id)}
                    className={selectedSubCategory === subcat.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    <span className="mr-1">{subcat.icon}</span>
                    {subcat.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Default Info */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Growing Info</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getSunIcon(selectedType.typical_sun)}</span>
                <div>
                  <p className="text-sm text-gray-500">Sun</p>
                  <p className="font-medium capitalize">
                    {selectedType.typical_sun?.replace(/_/g, ' ') || 'Full sun'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{getWaterIcon(selectedType.typical_water)}</span>
                <div>
                  <p className="text-sm text-gray-500">Water</p>
                  <p className="font-medium capitalize">{selectedType.typical_water || 'Moderate'}</p>
                </div>
              </div>
              {selectedType.typical_spacing_min && (
                <div className="flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Spacing</p>
                    <p className="font-medium">
                      {selectedType.typical_spacing_min}-{selectedType.typical_spacing_max}"
                    </p>
                  </div>
                </div>
              )}
              {selectedType.default_days_to_maturity && (
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Days to Maturity</p>
                    <p className="font-medium">{selectedType.default_days_to_maturity}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Varieties List */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">
            Varieties ({selectedSubCategory === 'all' ? varieties.length : varieties.filter(v => {
              const maps = v.subcategory_maps || [];
              return maps.some(m => m === selectedSubCategory);
            }).length})
          </h3>
          {(selectedSubCategory === 'all' ? varieties : varieties.filter(v => {
            const maps = v.subcategory_maps || [];
            return maps.some(m => m === selectedSubCategory);
          })).length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Sprout className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No varieties yet</p>
                <Button 
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setShowAddVariety(true)}
                >
                  Add First Variety
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(selectedSubCategory === 'all' ? varieties : varieties.filter(v => {
                const maps = v.subcategory_maps || [];
                return maps.some(m => m === selectedSubCategory);
              })).map((variety) => (
                <Card 
                  key={variety.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedVariety(variety)}
                >
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-gray-900">{variety.variety_name}</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {variety.days_to_maturity && (
                        <Badge variant="outline">{variety.days_to_maturity} days</Badge>
                      )}
                      {variety.spacing_recommended && (
                        <Badge variant="outline">{variety.spacing_recommended}" spacing</Badge>
                      )}
                      {variety.is_custom && (
                        <Badge variant="secondary">Custom</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-gray-400">
                      <span>View details</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Add Variety Dialog */}
        <Dialog open={showAddVariety} onOpenChange={setShowAddVariety}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New {selectedType?.name} Variety</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="varietyName">Variety Name *</Label>
                <Input
                  id="varietyName"
                  placeholder="e.g., Cherokee Purple, Sugar Snap"
                  value={newVariety.variety_name}
                  onChange={(e) => setNewVariety({ ...newVariety, variety_name: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dtm">Days to Maturity</Label>
                  <Input
                    id="dtm"
                    type="number"
                    placeholder="e.g., 75"
                    value={newVariety.days_to_maturity}
                    onChange={(e) => setNewVariety({ ...newVariety, days_to_maturity: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="spacing">Spacing (inches)</Label>
                  <Input
                    id="spacing"
                    type="number"
                    placeholder="e.g., 24"
                    value={newVariety.spacing_recommended}
                    onChange={(e) => setNewVariety({ ...newVariety, spacing_recommended: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="height">Typical Height</Label>
                <Input
                  id="height"
                  placeholder="e.g., 4-6 feet"
                  value={newVariety.plant_height_typical}
                  onChange={(e) => setNewVariety({ ...newVariety, plant_height_typical: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sun Requirement</Label>
                  <Select 
                    value={newVariety.sun_requirement} 
                    onValueChange={(v) => setNewVariety({ ...newVariety, sun_requirement: v })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_sun">Full Sun</SelectItem>
                      <SelectItem value="partial_sun">Partial Sun</SelectItem>
                      <SelectItem value="partial_shade">Partial Shade</SelectItem>
                      <SelectItem value="full_shade">Full Shade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Water Requirement</Label>
                  <Select 
                    value={newVariety.water_requirement} 
                    onValueChange={(v) => setNewVariety({ ...newVariety, water_requirement: v })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddVariety(false)}>Cancel</Button>
              <Button 
                onClick={handleAddVariety}
                disabled={!newVariety.variety_name.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Add Variety
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main Catalog View
  return (
    <ErrorBoundary fallbackTitle="Plant Catalog Error" fallbackMessage="Unable to load plant catalog. Please refresh the page.">
      <div className="space-y-6">
      {rateLimitError && (
        <RateLimitBanner 
          retryInMs={rateLimitError.retryInMs || 5000} 
          onRetry={() => loadPlantTypes(true)}
          retrying={retrying}
        />
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Plant Catalog</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Browse plants and varieties for your garden</p>
        </div>
        <Button
          onClick={() => setShowAIRecommendations(true)}
          className="gap-2 bg-purple-600 hover:bg-purple-700"
        >
          <Sparkles className="w-4 h-4" />
          AI Recommendations
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search plants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popularity">Top Categories</SelectItem>
            <SelectItem value="name">Sort: A-Z</SelectItem>
            <SelectItem value="category">Sort: Category</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <AdBanner placement="top_banner" pageType="catalog" />

      {/* Plant Types Grid or List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <AnimatePresence>
            {filteredTypes.map((type, index) => {
              // Check if this is the first indoor plant (transition from garden to indoor)
              const prevType = filteredTypes[index - 1];
              const isFirstIndoorPlant = prevType && 
                (prevType.plant_group_sort_order ?? 0) < 50 && 
                (type.plant_group_sort_order ?? 0) >= 50;

              return (
                  <React.Fragment key={type.id}>
                  {isFirstIndoorPlant && (
                    <div className="col-span-full my-4">
                      <div className="border-t-2 border-emerald-200 dark:border-emerald-700 relative">
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 px-6 py-2">
                          <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                            🏠 Indoor & Houseplants
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">Tropical foliage, succulents, ferns, and more</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <Link to={createPageUrl('PlantCatalogDetail') + `?id=${type.id}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                      <Card 
                        className="cursor-pointer hover:shadow-lg transition-all duration-300 group"
                        style={{ 
                          background: 'var(--glass-bg)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          border: '1px solid var(--glass-border)'
                        }}
                      >
                       <CardContent className="p-4 text-center">
                         <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl bg-white group-hover:scale-110 transition-transform">
                           {type.icon || '🌱'}
                         </div>
                          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{type.common_name || type.name}</h3>
                          {type.scientific_name && (
                            <p className="text-xs italic truncate" style={{ color: 'var(--text-muted)' }}>{type.scientific_name}</p>
                          )}
                          <div className="flex items-center justify-center gap-1 flex-wrap mt-1">
                            <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{type.category}</p>
                            {type.is_perennial && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0.5">Perennial</Badge>
                            )}
                          </div>
                          {!type._is_browse_only && (
                            <div className="flex items-center justify-center gap-1 mt-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--primary)' }}>
                              <span>Browse</span>
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Link>
                  </React.Fragment>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredTypes.map((type, index) => (
              <Link key={type.id} to={createPageUrl('PlantCatalogDetail') + `?id=${type.id}`}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-all duration-300 group"
                    style={{ 
                      background: 'var(--glass-bg)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid var(--glass-border)'
                    }}
                  >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 bg-white group-hover:scale-110 transition-transform">
                      {type.icon || '🌱'}
                    </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{type.common_name || type.name}</h3>
                        {type.scientific_name && (
                          <p className="text-sm italic truncate" style={{ color: 'var(--text-muted)' }}>{type.scientific_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{type.category}</Badge>
                        {type.is_perennial && (
                          <Badge variant="outline">Perennial</Badge>
                        )}
                        <ChevronRight className="w-5 h-5 transition-colors" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </Link>
            ))}
          </AnimatePresence>
        </div>
      )}

      {filteredTypes.length === 0 && (
        <div className="text-center py-12">
          <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No plants found</h3>
          <p className="text-gray-600">Try adjusting your search or filters</p>
        </div>
      )}
      
      <PlantRecommendations
        open={showAIRecommendations}
        onOpenChange={setShowAIRecommendations}
        context="catalog"
      />
      </div>
    </ErrorBoundary>
  );
}