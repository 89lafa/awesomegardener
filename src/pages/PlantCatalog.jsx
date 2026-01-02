import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  ListChecks
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

const CATEGORIES = ['vegetable', 'fruit', 'herb', 'flower', 'other'];

export default function PlantCatalog() {
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [showAddVariety, setShowAddVariety] = useState(false);
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
  }, []);

  useEffect(() => {
    if (selectedType) {
      loadVarieties(selectedType.id);
    }
  }, [selectedType]);

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list('common_name');
      // Filter out invalid/bad plant types
      const validTypes = types.filter(type => {
        const hasValidName = type.common_name && type.common_name.trim().length >= 2;
        const hasValidId = type.id;
        return hasValidName && hasValidId;
      });
      setPlantTypes(validTypes);
    } catch (error) {
      console.error('Error loading plant types:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVarieties = async (typeId) => {
    try {
      const vars = await base44.entities.Variety.filter({ 
        plant_type_id: typeId,
        status: 'active'
      }, 'variety_name');
      setVarieties(vars);
    } catch (error) {
      console.error('Error loading varieties:', error);
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

  const filteredTypes = plantTypes.filter(type => {
    const name = type.common_name || '';
    if (!name || name.trim().length < 2) return false; // Extra safety check
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         type.scientific_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || type.category === selectedCategory;
    return matchesSearch && matchesCategory;
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
            Varieties ({varieties.length})
          </h3>
          {varieties.length === 0 ? (
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
              {varieties.map((variety) => (
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
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Plant Catalog</h1>
        <p className="text-gray-600 mt-1">Browse plants and varieties for your garden</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
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
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AdBanner placement="top_banner" pageType="catalog" />

      {/* Plant Types Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <AnimatePresence>
          {filteredTypes.map((type, index) => (
            <Link key={type.id} to={createPageUrl('PlantCatalogDetail') + `?id=${type.id}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 group">
                  <CardContent className="p-4 text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl ${
                      type.color || 'bg-emerald-100'
                    } group-hover:scale-110 transition-transform`}>
                      {type.icon || '🌱'}
                    </div>
                    <h3 className="font-semibold text-gray-900">{type.common_name || type.name}</h3>
                    {type.scientific_name && (
                      <p className="text-xs text-gray-500 italic truncate">{type.scientific_name}</p>
                    )}
                    <p className="text-xs text-gray-400 capitalize mt-1">{type.category}</p>
                    <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Browse</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          ))}
        </AnimatePresence>
      </div>

      {filteredTypes.length === 0 && (
        <div className="text-center py-12">
          <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No plants found</h3>
          <p className="text-gray-600">Try adjusting your search or filters</p>
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}