import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  ArrowLeft, 
  Plus,
  Leaf,
  Droplets,
  Sun,
  TrendingUp,
  Loader2,
  Package,
  ListChecks,
  SlidersHorizontal,
  X,
  Grid3x3,
  List,
  Search
} from 'lucide-react';
import AddVarietyDialog from '@/components/variety/AddVarietyDialog';
import AddToStashModal from '@/components/catalog/AddToStashModal';
import AddToGrowListModal from '@/components/catalog/AddToGrowListModal';
import AdvancedFiltersPanel from '@/components/catalog/AdvancedFiltersPanel';
import VarietyListView from '@/components/catalog/VarietyListView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import ErrorBoundary from '@/components/common/ErrorBoundary';

export default function PlantCatalogDetail() {
  const [searchParams] = useSearchParams();
  const plantTypeId = searchParams.get('id');
  
  const SQUASH_UMBRELLA_ID = '69594ee83e086041528f2b15';
  const SQUASH_CANONICAL_IDS = ['69594a9f1243f13d1245edfd', '69594a9f1243f13d1245edfe', '69594a9f1243f13d1245edff', '69575e5ecdbb16ee56fa7508'];
  const isSquashUmbrella = plantTypeId === SQUASH_UMBRELLA_ID;
  
  const [browseCategory, setBrowseCategory] = useState(null);
  const isBrowseCategory = plantTypeId?.startsWith('browse_');
  const [canonicalIds, setCanonicalIds] = useState(isSquashUmbrella ? SQUASH_CANONICAL_IDS : []);
  
  const [plantType, setPlantType] = useState(null);
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [showAddToStash, setShowAddToStash] = useState(false);
  const [showAddToGrowList, setShowAddToGrowList] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [selectedSubCategories, setSelectedSubCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    if (plantTypeId) {
      return localStorage.getItem(`pc_detail_view_${plantTypeId}`) || 'cards';
    }
    return 'cards';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [filters, setFilters] = useState({
    daysToMaturity: { min: null, max: null },
    spacing: { min: null, max: null },
    heatLevel: { min: null, max: null },
    growthHabits: [],
    colors: [],
    species: [],
    containerFriendly: null,
    trellisRequired: null,
    hasImage: null,
    seedTypes: [],
    organicOnly: false,
    speciesFilter: [],
    ornamentalOnly: false,
    seedLineTypes: [],
    organicSeedsOnly: false,
    seasonTimings: []
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 50;
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('variety_columns');
    return saved ? JSON.parse(saved) : ['name', 'subcategory', 'days', 'spacing', 'species', 'seed_line', 'traits', 'actions'];
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  useEffect(() => {
    loadUser();
    if (plantTypeId) {
      loadPlantType();
    } else {
      setNotFound(true);
      setLoading(false);
    }
  }, [plantTypeId]);

  useEffect(() => {
    if (plantTypeId) {
      localStorage.setItem(`pc_detail_view_${plantTypeId}`, viewMode);
    }
  }, [viewMode, plantTypeId]);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const reloadVarieties = async (resetPagination = true) => {
    if (!plantTypeId) return;
    
    if (resetPagination) {
      setCurrentPage(1);
    }
    
    try {
      // For Squash umbrella, load from canonical types
      let vars;
      if (isSquashUmbrella) {
        vars = await base44.entities.Variety.filter({ status: 'active' }, 'variety_name', 1000);
        vars = vars.filter(v => SQUASH_CANONICAL_IDS.includes(v.plant_type_id));
      } else {
        vars = await base44.entities.Variety.filter({ 
          plant_type_id: plantTypeId,
          status: 'active'
        }, 'variety_name', 1000);
      }
      
      // Load subcategory mappings
      const varietyIds = vars.map(v => v.id);
      if (varietyIds.length > 0) {
        const allMaps = await base44.entities.VarietySubCategoryMap.list();
        const mapsForThese = allMaps.filter(m => varietyIds.includes(m.variety_id));
        
        vars = vars.map(v => {
          if (!v.plant_subcategory_id) {
            const mapping = mapsForThese.find(m => m.variety_id === v.id);
            if (mapping) {
              return { ...v, plant_subcategory_id: mapping.plant_subcategory_id };
            }
          }
          return v;
        });
      }
      
      setVarieties(vars);
    } catch (error) {
      console.error('Error reloading varieties:', error);
    }
  };

  const loadPlantType = async () => {
    try {
      // Validate plantTypeId
      if (!plantTypeId) {
        console.error('No plantTypeId provided');
        setNotFound(true);
        setLoading(false);
        return;
      }

      console.log('Loading plant type:', plantTypeId);
      const types = await base44.entities.PlantType.filter({ id: plantTypeId });
      
      if (types.length === 0) {
        console.error('Plant type not found:', plantTypeId);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const type = types[0];
      console.log('Loaded plant type:', type);
      setPlantType(type);

      // Load active subcategories (filter inactive for dropdown)
      let subcats;
      if (isSquashUmbrella) {
        const allSubcats = await base44.entities.PlantSubCategory.filter({ is_active: true });
        subcats = allSubcats.filter(sc => SQUASH_CANONICAL_IDS.includes(sc.plant_type_id));
      } else {
        subcats = await base44.entities.PlantSubCategory.filter({ 
          plant_type_id: plantTypeId,
          is_active: true
        }, 'sort_order');
      }
      console.log('[SUBCATEGORY] Loaded active subcategories:', subcats.length);
      
      // Deduplicate subcategories by name (in case of duplicates)
      const uniqueSubcats = [];
      const seenNames = new Set();
      for (const subcat of subcats) {
        if (!seenNames.has(subcat.name)) {
          seenNames.add(subcat.name);
          uniqueSubcats.push(subcat);
        }
      }
      setSubCategories(uniqueSubcats);

      // Load varieties
      console.log('[VARIETY DEBUG] Attempting to load varieties for plant_type_id:', plantTypeId);

      let vars;
      if (isSquashUmbrella || canonicalIds.length > 0) {
        // Load all varieties, then filter client-side
        const allVars = await base44.entities.Variety.filter({ status: 'active' }, 'variety_name', 1000);
        vars = allVars.filter(v => canonicalIds.includes(v.plant_type_id));
      } else {
        vars = await base44.entities.Variety.filter({ 
          plant_type_id: plantTypeId,
          status: 'active'
        }, 'variety_name');
      }
      
      console.log('[VARIETY DEBUG] Found Variety records:', vars.length);
      
      // If no Variety records found, try PlantProfile table
      if (vars.length === 0) {
        vars = await base44.entities.PlantProfile.filter({ 
          plant_type_id: plantTypeId
        }, 'variety_name');
        console.log('[VARIETY DEBUG] Found PlantProfile records:', vars.length);
      }
      
      // Load subcategory mappings for varieties that don't have direct subcategory_id
      const varietyIds = vars.map(v => v.id);
      if (varietyIds.length > 0) {
        const allMaps = await base44.entities.VarietySubCategoryMap.list();
        const mapsForThese = allMaps.filter(m => varietyIds.includes(m.variety_id));
        
        // Merge subcategory IDs from mappings into varieties
        vars = vars.map(v => {
          if (!v.plant_subcategory_id) {
            const mapping = mapsForThese.find(m => m.variety_id === v.id);
            if (mapping) {
              return { ...v, plant_subcategory_id: mapping.plant_subcategory_id };
            }
          }
          return v;
        });
      }
      
      console.log('[VARIETY DEBUG] Final varieties:', vars.slice(0, 3));
      setVarieties(vars);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading plant type:', error);
      toast.error('Failed to load plant details');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableFilters = () => {
    const seedTypeSet = new Set();
    varieties.forEach(v => {
      const seedType = v.traits?.seed_type || (v.popularity_tier === 'heirloom' ? 'heirloom' : null);
      if (seedType) seedTypeSet.add(seedType);
    });
    
    const available = {
      daysToMaturity: varieties.some(v => v.days_to_maturity || v.days_to_maturity_seed),
      spacing: varieties.some(v => v.spacing_recommended || v.spacing_in_min),
      heatLevel: varieties.some(v => v.heat_scoville_min || v.heat_scoville_max),
      growthHabits: [...new Set(varieties.filter(v => v.growth_habit).map(v => v.growth_habit))],
      colors: [...new Set(varieties.filter(v => v.fruit_color || v.pod_color).map(v => v.fruit_color || v.pod_color))],
      species: [...new Set(varieties.filter(v => v.species).map(v => v.species))],
      seedTypes: Array.from(seedTypeSet),
      speciesOptions: [...new Set(varieties.filter(v => v.species).map(v => v.species))],
      seedLineTypes: [...new Set(varieties.filter(v => v.seed_line_type).map(v => v.seed_line_type))],
      seasonTimings: [...new Set(varieties.filter(v => v.season_timing).map(v => v.season_timing))],
      booleans: {
        containerFriendly: varieties.some(v => v.container_friendly),
        trellisRequired: varieties.some(v => v.trellis_required),
        hasImage: varieties.some(v => v.images?.length > 0 || v.image_url),
        organic: varieties.some(v => v.traits?.organic_seed === true),
        ornamental: varieties.some(v => v.is_ornamental === true),
        organicSeeds: varieties.some(v => v.is_organic === true)
      }
    };
    return available;
  };

  // UTILITY: Get effective subcategory IDs (single source of truth)
  const getEffectiveSubcategoryIds = (variety) => {
    let ids = [];
    
    // Priority 1: plant_subcategory_ids (array or string)
    if (variety.plant_subcategory_ids) {
      if (Array.isArray(variety.plant_subcategory_ids)) {
        ids = variety.plant_subcategory_ids;
      } else if (typeof variety.plant_subcategory_ids === 'string') {
        // Might be JSON string
        try {
          const parsed = JSON.parse(variety.plant_subcategory_ids);
          if (Array.isArray(parsed)) {
            ids = parsed;
          }
        } catch (e) {
          // Not JSON, might be comma-separated
          if (variety.plant_subcategory_ids.includes(',')) {
            ids = variety.plant_subcategory_ids.split(',').map(id => id.trim());
          }
        }
      }
    }
    
    // Priority 2: Fallback to plant_subcategory_id if array is empty
    if (ids.length === 0 && variety.plant_subcategory_id && variety.plant_subcategory_id.trim() !== '') {
      ids = [variety.plant_subcategory_id.trim()];
    }
    
    // Dedupe and filter empty/invalid
    ids = [...new Set(ids.filter(id => id && typeof id === 'string' && id.trim() !== ''))];
    
    // CRITICAL: Only filter out IDs that don't exist in subCategories at all
    // Do NOT filter by is_active here - admin can see inactive subcats
    const allSubcatIds = new Set(subCategories.map(s => s.id));
    const validIds = ids.filter(id => allSubcatIds.has(id));
    
    // For non-admin users, also filter by is_active
    const user_role = window.localStorage.getItem('user_role');
    if (user_role !== 'admin') {
      const activeSubcatIds = new Set(subCategories.filter(s => s.is_active).map(s => s.id));
      return validIds.filter(id => activeSubcatIds.has(id));
    }
    
    return validIds;
  };

  const applyFiltersAndSort = () => {
    let filtered = [...varieties];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.variety_name?.toLowerCase().includes(query) ||
        v.synonyms?.some(s => s.toLowerCase().includes(query)) ||
        v.grower_notes?.toLowerCase().includes(query) ||
        v.notes_public?.toLowerCase().includes(query)
      );
    }

    // Sub-category filter - using effective IDs
    if (selectedSubCategories.length > 0) {
      filtered = filtered.filter(v => {
        const effectiveIds = getEffectiveSubcategoryIds(v);
        
        // Handle Uncategorized - only if effective list is empty
        if (selectedSubCategories.includes('uncategorized')) {
          return effectiveIds.length === 0;
        }

        // Match if variety has ANY of the selected subcategories in effective list
        return selectedSubCategories.some(selectedId => effectiveIds.includes(selectedId));
      });
    }

    // Days to maturity range
    if (filters.daysToMaturity.min !== null || filters.daysToMaturity.max !== null) {
      filtered = filtered.filter(v => {
        const days = v.days_to_maturity || v.days_to_maturity_seed;
        if (!days) return false;
        if (filters.daysToMaturity.min !== null && days < filters.daysToMaturity.min) return false;
        if (filters.daysToMaturity.max !== null && days > filters.daysToMaturity.max) return false;
        return true;
      });
    }

    // Spacing range
    if (filters.spacing.min !== null || filters.spacing.max !== null) {
      filtered = filtered.filter(v => {
        const spacing = v.spacing_recommended || v.spacing_in_min;
        if (!spacing) return false;
        if (filters.spacing.min !== null && spacing < filters.spacing.min) return false;
        if (filters.spacing.max !== null && spacing > filters.spacing.max) return false;
        return true;
      });
    }

    // Heat level range
    if (filters.heatLevel.min !== null || filters.heatLevel.max !== null) {
      filtered = filtered.filter(v => {
        const heat = v.heat_scoville_min || v.heat_scoville_max;
        if (!heat) return false;
        if (filters.heatLevel.min !== null && heat < filters.heatLevel.min) return false;
        if (filters.heatLevel.max !== null && heat > filters.heatLevel.max) return false;
        return true;
      });
    }

    // Growth habit multi-select
    if (filters.growthHabits.length > 0) {
      filtered = filtered.filter(v => 
        v.growth_habit && filters.growthHabits.includes(v.growth_habit)
      );
    }

    // Color multi-select
    if (filters.colors.length > 0) {
      filtered = filtered.filter(v => 
        (v.fruit_color && filters.colors.includes(v.fruit_color)) ||
        (v.pod_color && filters.colors.includes(v.pod_color))
      );
    }

    // Species multi-select
    if (filters.species.length > 0) {
      filtered = filtered.filter(v => 
        v.species && filters.species.includes(v.species)
      );
    }

    // Seed type filter
    if (filters.seedTypes.length > 0) {
      filtered = filtered.filter(v => {
        const seedType = v.traits?.seed_type || (v.popularity_tier === 'heirloom' ? 'heirloom' : null);
        return seedType && filters.seedTypes.includes(seedType);
      });
    }

    // Organic filter
    if (filters.organicOnly) {
      filtered = filtered.filter(v => v.traits?.organic_seed === true);
    }

    // Species filter
    if (filters.speciesFilter.length > 0) {
      filtered = filtered.filter(v => v.species && filters.speciesFilter.includes(v.species));
    }

    // Ornamental filter
    if (filters.ornamentalOnly) {
      filtered = filtered.filter(v => v.is_ornamental === true);
    }

    // Seed line type filter
    if (filters.seedLineTypes.length > 0) {
      filtered = filtered.filter(v => v.seed_line_type && filters.seedLineTypes.includes(v.seed_line_type));
    }

    // Organic seeds filter
    if (filters.organicSeedsOnly) {
      filtered = filtered.filter(v => v.is_organic === true);
    }

    // Season timing filter
    if (filters.seasonTimings.length > 0) {
      filtered = filtered.filter(v => v.season_timing && filters.seasonTimings.includes(v.season_timing));
    }

    // Boolean filters
    if (filters.containerFriendly === true) {
      filtered = filtered.filter(v => v.container_friendly === true);
    }
    if (filters.trellisRequired === true) {
      filtered = filtered.filter(v => v.trellis_required === true);
    }
    if (filters.hasImage === true) {
      filtered = filtered.filter(v => v.images?.length > 0 || v.image_url);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return (a.variety_name || '').localeCompare(b.variety_name || '');
        case 'name_desc':
          return (b.variety_name || '').localeCompare(a.variety_name || '');
        case 'days_asc':
          return (a.days_to_maturity || a.days_to_maturity_seed || 999) - 
                 (b.days_to_maturity || b.days_to_maturity_seed || 999);
        case 'days_desc':
          return (b.days_to_maturity || b.days_to_maturity_seed || 0) - 
                 (a.days_to_maturity || a.days_to_maturity_seed || 0);
        case 'spacing_asc':
          return (a.spacing_recommended || a.spacing_in_min || 999) - 
                 (b.spacing_recommended || b.spacing_in_min || 999);
        case 'spacing_desc':
          return (b.spacing_recommended || b.spacing_in_min || 0) - 
                 (a.spacing_recommended || a.spacing_in_min || 0);
        case 'heat_asc':
          return (a.heat_scoville_min || a.heat_scoville_max || 0) - 
                 (b.heat_scoville_min || b.heat_scoville_max || 0);
        case 'heat_desc':
          return (b.heat_scoville_min || b.heat_scoville_max || 0) - 
                 (a.heat_scoville_min || a.heat_scoville_max || 0);
        case 'species_asc':
          return (a.species || 'zzz').localeCompare(b.species || 'zzz');
        case 'species_desc':
          return (b.species || '').localeCompare(a.species || '');
        case 'seed_line_asc':
          return (a.seed_line_type || 'zzz').localeCompare(b.seed_line_type || 'zzz');
        case 'seed_line_desc':
          return (b.seed_line_type || '').localeCompare(a.seed_line_type || '');
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredVarieties = applyFiltersAndSort();
  const paginatedVarieties = filteredVarieties.slice(0, currentPage * itemsPerPage);
  const hasMoreItems = filteredVarieties.length > paginatedVarieties.length;

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSubCategories([]);
    setFilters({
      daysToMaturity: { min: null, max: null },
      spacing: { min: null, max: null },
      heatLevel: { min: null, max: null },
      growthHabits: [],
      colors: [],
      species: [],
      containerFriendly: null,
      trellisRequired: null,
      hasImage: null,
      seedTypes: [],
      organicOnly: false,
      speciesFilter: [],
      ornamentalOnly: false,
      seedLineTypes: [],
      organicSeedsOnly: false,
      seasonTimings: []
    });
    setSortBy('name_asc');
    setCurrentPage(1);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedSubCategories.length > 0) count++;
    if (filters.daysToMaturity.min !== null || filters.daysToMaturity.max !== null) count++;
    if (filters.spacing.min !== null || filters.spacing.max !== null) count++;
    if (filters.heatLevel.min !== null || filters.heatLevel.max !== null) count++;
    if (filters.growthHabits.length > 0) count++;
    if (filters.colors.length > 0) count++;
    if (filters.species.length > 0) count++;
    if (filters.containerFriendly) count++;
    if (filters.trellisRequired) count++;
    if (filters.hasImage) count++;
    if (filters.seedTypes.length > 0) count++;
    if (filters.organicOnly) count++;
    if (filters.speciesFilter.length > 0) count++;
    if (filters.ornamentalOnly) count++;
    if (filters.seedLineTypes.length > 0) count++;
    if (filters.organicSeedsOnly) count++;
    if (filters.seasonTimings.length > 0) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  const handleSubCategoryToggle = (subcatId) => {
    setSelectedSubCategories(prev => 
      prev.includes(subcatId) 
        ? prev.filter(id => id !== subcatId)
        : [...prev, subcatId]
    );
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Leaf className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Plant Type Not Found</h2>
        <p className="text-gray-600 mb-6">This plant type doesn't exist or has been removed.</p>
        <Link to={createPageUrl('PlantCatalog')}>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plant Catalog
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Plant Detail Error">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('PlantCatalog')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                plantType.color || 'bg-emerald-100'
              }`}>
                {plantType.icon || '🌱'}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  {plantType.common_name || plantType.name}
                </h1>
                {plantType.scientific_name && (
                  <p className="text-gray-500 italic">{plantType.scientific_name}</p>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                    className={viewMode === 'cards' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={viewMode === 'list' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
                {!isSquashUmbrella ? (
                 <Button 
                   onClick={() => setShowAddVariety(true)}
                   className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                 >
                   <Plus className="w-4 h-4" />
                   {user?.role === 'admin' || user?.role === 'editor' ? 'Add Variety' : 'Suggest Variety'}
                 </Button>
                ) : (
                 <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 max-w-xs">
                   ℹ️ Browse-only: Add to Summer/Winter Squash, Zucchini, or Pumpkin
                 </div>
                )}
                </div>
                </div>
                </div>
                </div>

                {/* Browse Category Notice */}
                {(isSquashUmbrella || browseCategory) && (
                  <div className="px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900">
                    {browseCategory?.info_banner || 'ℹ️ Squash Browse View: This shows varieties from Summer Squash, Winter Squash, Zucchini, and Pumpkin. To add new varieties, navigate to the specific plant type.'}
                  </div>
                )}

                {/* Overview - Compact */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 mb-0.5">Water Needs</span>
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium capitalize">{plantType.typical_water || 'Moderate'}</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 mb-0.5">Sun Exposure</span>
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium capitalize">{plantType.typical_sun?.replace(/_/g, ' ') || 'Full Sun'}</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 mb-0.5">Days to Maturity</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">{plantType.default_days_to_maturity || 'Varies'}</span>
                </div>
              </div>
              {(plantType.typical_spacing_min && plantType.typical_spacing_max) && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-0.5">Spacing</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {plantType.typical_spacing_min}" - {plantType.typical_spacing_max}"
                    </span>
                  </div>
                </div>
              )}
              {plantType.is_perennial !== undefined && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-0.5">Growth Habit</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {plantType.is_perennial ? 'Perennial' : 'Annual'}
                    </span>
                  </div>
                </div>
              )}
              {plantType.default_start_indoors_weeks && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-0.5">Start Indoors</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{plantType.default_start_indoors_weeks} wks before frost</span>
                  </div>
                </div>
              )}
              {plantType.default_transplant_weeks !== undefined && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-0.5">Transplant</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {plantType.default_transplant_weeks} wks {plantType.default_transplant_weeks >= 0 ? 'after' : 'before'} frost
                    </span>
                  </div>
                </div>
              )}
              {user?.role === 'admin' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="ml-auto"
                  onClick={() => window.location.href = `/EditPlantType?id=${plantType.id}`}
                >
                  Edit PlantType
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Search, Sort, Filters */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Top Controls */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search varieties..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
              
              {/* Sub-Category Dropdown */}
              <Select 
                value={selectedSubCategories[0] || ''} 
                onValueChange={(v) => {
                  setSelectedSubCategories(v ? [v] : []);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Sub-Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All ({varieties.length})</SelectItem>
                  {subCategories.filter(s => s.is_active).map((subcat) => {
                    // Count varieties with this subcategory using effective IDs
                    const count = varieties.filter(v => {
                      const effectiveIds = getEffectiveSubcategoryIds(v);
                      return effectiveIds.includes(subcat.id);
                    }).length;

                    // CRITICAL: Only show if count > 0
                    if (count === 0) return null;

                    return (
                      <SelectItem key={subcat.id} value={subcat.id}>
                        {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                        {subcat.name} ({count})
                      </SelectItem>
                    );
                  })}
                  {(() => {
                    // Uncategorized = effective list empty
                    const uncategorizedCount = varieties.filter(v => {
                      const effectiveIds = getEffectiveSubcategoryIds(v);
                      return effectiveIds.length === 0;
                    }).length;

                    return uncategorizedCount > 0 && (
                      <SelectItem value="uncategorized">
                        Uncategorized ({uncategorizedCount})
                      </SelectItem>
                    );
                  })()}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => {
                setSortBy(v);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_asc">Name A → Z</SelectItem>
                  <SelectItem value="name_desc">Name Z → A</SelectItem>
                  <SelectItem value="days_asc">Days: Low → High</SelectItem>
                  <SelectItem value="days_desc">Days: High → Low</SelectItem>
                  <SelectItem value="spacing_asc">Spacing: Low → High</SelectItem>
                  <SelectItem value="spacing_desc">Spacing: High → Low</SelectItem>
                  {getAvailableFilters().heatLevel && (
                    <>
                      <SelectItem value="heat_asc">Heat: Low → High</SelectItem>
                      <SelectItem value="heat_desc">Heat: High → Low</SelectItem>
                    </>
                  )}
                  <SelectItem value="species_asc">Species: A → Z</SelectItem>
                  <SelectItem value="species_desc">Species: Z → A</SelectItem>
                  <SelectItem value="seed_line_asc">Seed Line: A → Z</SelectItem>
                  <SelectItem value="seed_line_desc">Seed Line: Z → A</SelectItem>
                  </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setShowFilters(true)}
                className="gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 bg-emerald-600">{activeFilterCount}</Badge>
                )}
              </Button>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear
                </Button>
              )}
              {viewMode === 'list' && (
                <Button
                  variant="outline"
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="gap-2"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Columns
                </Button>
              )}
            </div>
            
            {/* Column Selector */}
            {showColumnSelector && viewMode === 'list' && (
              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-sm font-semibold mb-2">Select Columns</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'name', label: 'Name' },
                    { id: 'subcategory', label: 'Sub-Category' },
                    { id: 'days', label: 'Days' },
                    { id: 'spacing', label: 'Spacing' },
                    { id: 'height', label: 'Height' },
                    { id: 'sun', label: 'Sun' },
                    { id: 'water', label: 'Water' },
                    { id: 'color', label: 'Color' },
                    { id: 'species', label: 'Species' },
                    { id: 'seed_line', label: 'Seed Line' },
                    { id: 'season', label: 'Season' },
                    { id: 'traits', label: 'Flags' },
                    { id: 'actions', label: 'Actions' }
                  ].map(col => (
                    <Button
                      key={col.id}
                      size="sm"
                      variant={visibleColumns.includes(col.id) ? 'default' : 'outline'}
                      onClick={() => {
                        const newCols = visibleColumns.includes(col.id)
                          ? visibleColumns.filter(c => c !== col.id)
                          : [...visibleColumns, col.id];
                        setVisibleColumns(newCols);
                        localStorage.setItem('variety_columns', JSON.stringify(newCols));
                      }}
                      className={visibleColumns.includes(col.id) ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    >
                      {col.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Filter Chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500">Active filters:</span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: "{searchQuery}"
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                  </Badge>
                )}
                {filters.daysToMaturity.min !== null && (
                  <Badge variant="secondary" className="gap-1">
                    Days ≥ {filters.daysToMaturity.min}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({
                      ...filters, daysToMaturity: { ...filters.daysToMaturity, min: null }
                    })} />
                  </Badge>
                )}
                {filters.daysToMaturity.max !== null && (
                  <Badge variant="secondary" className="gap-1">
                    Days ≤ {filters.daysToMaturity.max}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({
                      ...filters, daysToMaturity: { ...filters.daysToMaturity, max: null }
                    })} />
                  </Badge>
                )}
                {filters.spacing.min !== null && (
                  <Badge variant="secondary" className="gap-1">
                    Spacing ≥ {filters.spacing.min}"
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({
                      ...filters, spacing: { ...filters.spacing, min: null }
                    })} />
                  </Badge>
                )}
                {filters.spacing.max !== null && (
                  <Badge variant="secondary" className="gap-1">
                    Spacing ≤ {filters.spacing.max}"
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({
                      ...filters, spacing: { ...filters.spacing, max: null }
                    })} />
                  </Badge>
                )}
                {filters.containerFriendly && (
                  <Badge variant="secondary" className="gap-1">
                    Container Friendly
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({
                      ...filters, containerFriendly: null
                    })} />
                  </Badge>
                )}
                {filters.trellisRequired && (
                  <Badge variant="secondary" className="gap-1">
                    Needs Trellis
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({
                      ...filters, trellisRequired: null
                    })} />
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Varieties */}
        <Card>
          <CardHeader>
            <CardTitle>
              Varieties ({filteredVarieties.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredVarieties.length === 0 ? (
              <div className="text-center py-8">
                <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">
                  {activeFilterCount > 0 ? 'No varieties match your filters' : 'No varieties cataloged yet'}
                  </p>
                  {activeFilterCount > 0 ? (
                  <Button 
                    onClick={handleClearFilters}
                    variant="outline"
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </Button>
                  ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-4">
                      {(isSquashUmbrella || browseCategory)
                        ? 'Navigate to specific plant types to add varieties'
                        : user?.role === 'admin' 
                          ? 'Import varieties or add them manually' 
                          : 'Be the first to suggest a variety!'}
                    </p>
                    {!(isSquashUmbrella || browseCategory) && (
                      <Button 
                        onClick={() => setShowAddVariety(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {user?.role === 'admin' || user?.role === 'editor' ? 'Add First Variety' : 'Suggest Variety'}
                      </Button>
                    )}
                  </>
                  )}
              </div>
            ) : viewMode === 'list' ? (
              <>
                <VarietyListView
                  varieties={paginatedVarieties}
                  subCategories={subCategories}
                  visibleColumns={visibleColumns}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  onAddToStash={(variety) => {
                    setSelectedVariety(variety);
                    setShowAddToStash(true);
                  }}
                  onAddToGrowList={(variety) => {
                    setSelectedVariety(variety);
                    setShowAddToGrowList(true);
                  }}
                />
                {hasMoreItems && (
                  <div className="text-center mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Load More ({filteredVarieties.length - paginatedVarieties.length} remaining)
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  {paginatedVarieties.map((variety) => (
                    <Card 
                      key={variety.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        const targetPage = user?.role === 'admin' ? 'EditVariety' : 'ViewVariety';
                        window.location.href = createPageUrl(targetPage) + `?id=${variety.id}`;
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{variety.variety_name}</h4>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {user?.role === 'admin' && (
                              <>
                                <Link to={createPageUrl('ViewVariety') + `?id=${variety.id}`}>
                                  <Button 
                                    size="sm"
                                    variant="ghost"
                                    title="View as User"
                                  >
                                    <span className="text-xs">View</span>
                                  </Button>
                                </Link>
                                <Link to={createPageUrl('EditVariety') + `?id=${variety.id}`}>
                                  <Button 
                                    size="sm"
                                    variant="ghost"
                                    title="Edit"
                                  >
                                    <span className="text-xs">Edit</span>
                                  </Button>
                                </Link>
                              </>
                            )}
                            <Button 
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedVariety(variety);
                                setShowAddToStash(true);
                              }}
                              title="Add to Seed Stash"
                            >
                              <Package className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedVariety(variety);
                                setShowAddToGrowList(true);
                              }}
                              title="Add to Grow List"
                            >
                              <ListChecks className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                         {(() => {
                           const effectiveIds = getEffectiveSubcategoryIds(variety);
                           if (effectiveIds.length === 0) {
                             return (
                               <Badge variant="outline" className="text-xs text-gray-500">
                                 Uncategorized
                               </Badge>
                             );
                           }
                           return effectiveIds.map(subcatId => {
                             const subcat = subCategories.find(s => s.id === subcatId);
                             return subcat ? (
                               <Badge key={subcatId} variant="secondary" className="text-xs">
                                 {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                                 {subcat.name}
                               </Badge>
                             ) : (
                               <Badge key={subcatId} variant="outline" className="text-xs text-gray-500">
                                 Unknown
                               </Badge>
                             );
                           });
                         })()}
                         {(variety.days_to_maturity || variety.days_to_maturity_seed) && (
                           <Badge variant="outline" className="text-xs">
                             {variety.days_to_maturity || variety.days_to_maturity_seed} days
                           </Badge>
                         )}
                         {(variety.spacing_recommended || variety.spacing_in_min) && (
                           <Badge variant="outline" className="text-xs">
                             {variety.spacing_recommended || variety.spacing_in_min}" spacing
                           </Badge>
                         )}
                         {variety.trellis_required && (
                           <Badge className="bg-green-100 text-green-800 text-xs">Needs Trellis</Badge>
                         )}
                         {variety.container_friendly && (
                           <Badge className="bg-blue-100 text-blue-800 text-xs">Container</Badge>
                         )}
                         {(() => {
                           const seedType = variety.traits?.seed_type || (variety.popularity_tier === 'heirloom' ? 'heirloom' : null);
                           if (!seedType) return null;
                           const label = seedType === 'open_pollinated' ? 'OP' : 
                                        seedType === 'hybrid_f1' ? 'Hybrid' : 
                                        seedType === 'heirloom' ? 'Heirloom' : seedType;
                           return <Badge variant="outline" className="text-xs">{label}</Badge>;
                         })()}
                         {variety.traits?.organic_seed && (
                           <Badge className="bg-purple-100 text-purple-800 text-xs">Organic</Badge>
                         )}
                        </div>
                        {(variety.grower_notes || variety.notes_public) && (
                          <p className="text-sm text-gray-600 mt-3 line-clamp-2">{variety.grower_notes || variety.notes_public}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {hasMoreItems && (
                  <div className="text-center mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Load More ({filteredVarieties.length - paginatedVarieties.length} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>



        {/* Add Variety Dialog */}
        <AddVarietyDialog 
          plantType={plantType}
          open={showAddVariety}
          onOpenChange={setShowAddVariety}
          onSuccess={reloadVarieties}
          userRole={user?.role}
        />

        {/* Add to Stash Modal */}
        <AddToStashModal
          open={showAddToStash}
          onOpenChange={setShowAddToStash}
          variety={selectedVariety}
          plantType={plantType}
        />

        {/* Add to Grow List Modal */}
        <AddToGrowListModal
          open={showAddToGrowList}
          onOpenChange={setShowAddToGrowList}
          variety={selectedVariety}
          plantType={plantType}
        />

        {/* Advanced Filters Panel */}
        <AdvancedFiltersPanel
          open={showFilters}
          onOpenChange={setShowFilters}
          filters={filters}
          onFilterChange={(newFilters) => {
            setFilters(newFilters);
            setCurrentPage(1);
          }}
          onClearAll={() => {
            setFilters({
              daysToMaturity: { min: null, max: null },
              spacing: { min: null, max: null },
              heatLevel: { min: null, max: null },
              growthHabits: [],
              colors: [],
              species: [],
              containerFriendly: null,
              trellisRequired: null,
              hasImage: null
            });
            setCurrentPage(1);
          }}
          availableFilters={getAvailableFilters()}
        />
      </div>
    </ErrorBoundary>
  );
}