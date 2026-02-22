import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Plus, Leaf, Droplets, Sun, TrendingUp, Loader2,
  Package, ListChecks, SlidersHorizontal, X, Grid3x3, List,
  Search, ExternalLink, MapPin, Thermometer
} from 'lucide-react';

import AddVarietyDialog from '@/components/variety/AddVarietyDialog';
import AddToStashModal from '@/components/catalog/AddToStashModal';
import AddToGrowListModal from '@/components/catalog/AddToGrowListModal';
import AdvancedFiltersPanel from '@/components/catalog/AdvancedFiltersPanel';
import VarietyListView from '@/components/catalog/VarietyListView';
import SpecialCareWarnings from '@/components/indoor/SpecialCareWarnings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useDebouncedValue } from '../components/utils/useDebouncedValue';

// ─── Zone utilities ──────────────────────────────────────────
// Fallback temp_min_f lookup keyed by plant_type_code.
// Used when variety.temp_min_f is not yet populated.
// Priority: variety.temp_min_f (from DB upsert) → this lookup → null
const PLANT_ZONE_DATA = {
  PT_TOMATO:         { temp_min_f: 32,  is_perennial_species: true  },
  PT_PEPPER:         { temp_min_f: 32,  is_perennial_species: true  },
  PT_EGGPLANT:       { temp_min_f: 32,  is_perennial_species: true  },
  PT_CUCUMBER:       { temp_min_f: 32,  is_perennial_species: false },
  PT_ZUCCHINI:       { temp_min_f: 32,  is_perennial_species: false },
  PT_SQUASH:         { temp_min_f: 32,  is_perennial_species: false },
  PT_SUMMER_SQUASH:  { temp_min_f: 32,  is_perennial_species: false },
  PT_WINTER_SQUASH:  { temp_min_f: 32,  is_perennial_species: false },
  PT_PUMPKIN:        { temp_min_f: 32,  is_perennial_species: false },
  PT_LETTUCE:        { temp_min_f: 28,  is_perennial_species: false },
  PT_SPINACH:        { temp_min_f: 20,  is_perennial_species: false },
  PT_KALE:           { temp_min_f: 10,  is_perennial_species: false },
  PT_CABBAGE:        { temp_min_f: 20,  is_perennial_species: false },
  PT_BROCCOLI:       { temp_min_f: 25,  is_perennial_species: false },
  PT_CAULIFLOWER:    { temp_min_f: 28,  is_perennial_species: false },
  PT_BRUSSELS:       { temp_min_f: 15,  is_perennial_species: false },
  PT_CARROT:         { temp_min_f: 15,  is_perennial_species: false },
  PT_RADISH:         { temp_min_f: 28,  is_perennial_species: false },
  PT_BEET:           { temp_min_f: 25,  is_perennial_species: false },
  PT_TURNIP:         { temp_min_f: 20,  is_perennial_species: false },
  PT_PARSNIP:        { temp_min_f: 10,  is_perennial_species: false },
  PT_POTATO:         { temp_min_f: 32,  is_perennial_species: false },
  PT_SWEET_POTATO:   { temp_min_f: 32,  is_perennial_species: true  },
  PT_ONION:          { temp_min_f: 20,  is_perennial_species: false },
  PT_GARLIC:         { temp_min_f: -20, is_perennial_species: true  },
  PT_LEEK:           { temp_min_f: 10,  is_perennial_species: false },
  PT_SCALLION:       { temp_min_f: 20,  is_perennial_species: false },
  PT_CHIVES:         { temp_min_f: -40, is_perennial_species: true  },
  PT_CORN:           { temp_min_f: 32,  is_perennial_species: false },
  PT_SWEET_CORN:     { temp_min_f: 32,  is_perennial_species: false },
  PT_BEAN:           { temp_min_f: 32,  is_perennial_species: false },
  PT_PEA:            { temp_min_f: 20,  is_perennial_species: false },
  PT_BOK_CHOY:       { temp_min_f: 25,  is_perennial_species: false },
  PT_COLLARD_GREENS: { temp_min_f: 15,  is_perennial_species: false },
  PT_SWISS_CHARD:    { temp_min_f: 25,  is_perennial_species: false },
  PT_ARUGULA:        { temp_min_f: 20,  is_perennial_species: false },
  PT_MUSTARD_GREENS: { temp_min_f: 20,  is_perennial_species: false },
  PT_KOHLRABI:       { temp_min_f: 20,  is_perennial_species: false },
  PT_RUTABAGA:       { temp_min_f: 15,  is_perennial_species: false },
  PT_CELERY:         { temp_min_f: 28,  is_perennial_species: false },
  PT_ASPARAGUS:      { temp_min_f: -40, is_perennial_species: true  },
  PT_RHUBARB:        { temp_min_f: -40, is_perennial_species: true  },
  PT_ARTICHOKE:      { temp_min_f: 15,  is_perennial_species: true  },
  PT_SUNCHOKE:       { temp_min_f: -40, is_perennial_species: true  },
  PT_OKRA:           { temp_min_f: 32,  is_perennial_species: true  },
  PT_GROUNDCHERRY:   { temp_min_f: 32,  is_perennial_species: true  },
  PT_TOMATILLO:      { temp_min_f: 32,  is_perennial_species: true  },
  PT_STRAWBERRY:     { temp_min_f: -30, is_perennial_species: true  },
  PT_RASPBERRY:      { temp_min_f: -40, is_perennial_species: true  },
  PT_BLACKBERRY:     { temp_min_f: -10, is_perennial_species: true  },
  PT_BLUEBERRY:      { temp_min_f: -30, is_perennial_species: true  },
  PT_CURRANT:        { temp_min_f: -40, is_perennial_species: true  },
  PT_GOOSEBERRY:     { temp_min_f: -40, is_perennial_species: true  },
  PT_ELDERBERRY:     { temp_min_f: -30, is_perennial_species: true  },
  PT_GRAPE:          { temp_min_f: -20, is_perennial_species: true  },
  PT_APPLE:          { temp_min_f: -40, is_perennial_species: true  },
  PT_PEAR:           { temp_min_f: -30, is_perennial_species: true  },
  PT_PEACH:          { temp_min_f: -10, is_perennial_species: true  },
  PT_PLUM:           { temp_min_f: -30, is_perennial_species: true  },
  PT_CHERRY:         { temp_min_f: -30, is_perennial_species: true  },
  PT_CANTALOUPE:     { temp_min_f: 32,  is_perennial_species: false },
  PT_WATERMELON:     { temp_min_f: 32,  is_perennial_species: false },
  PT_BASIL:          { temp_min_f: 32,  is_perennial_species: false },
  PT_CILANTRO:       { temp_min_f: 20,  is_perennial_species: false },
  PT_DILL:           { temp_min_f: 25,  is_perennial_species: false },
  PT_PARSLEY:        { temp_min_f: 10,  is_perennial_species: false },
  PT_MINT:           { temp_min_f: -30, is_perennial_species: true  },
  PT_OREGANO:        { temp_min_f: -10, is_perennial_species: true  },
  PT_THYME:          { temp_min_f: -30, is_perennial_species: true  },
  PT_ROSEMARY:       { temp_min_f: 10,  is_perennial_species: true  },
  PT_SAGE:           { temp_min_f: -20, is_perennial_species: true  },
  PT_FENNEL:         { temp_min_f: 15,  is_perennial_species: false },
  PT_SUNFLOWER:      { temp_min_f: 32,  is_perennial_species: false },
  PT_MARIGOLD:       { temp_min_f: 32,  is_perennial_species: true  },
  PT_CALENDULA:      { temp_min_f: 20,  is_perennial_species: false },
  PT_NASTURTIUM:     { temp_min_f: 32,  is_perennial_species: true  },
  PT_BORAGE:         { temp_min_f: 25,  is_perennial_species: false },
  PT_SWEET_ALYSSUM:  { temp_min_f: 20,  is_perennial_species: true  },
  PT_ROSE:           { temp_min_f: -20, is_perennial_species: true  },
  PT_PEONY:          { temp_min_f: -40, is_perennial_species: true  },
  PT_HYDRANGEA:      { temp_min_f: -20, is_perennial_species: true  },
  PT_TULIP:          { temp_min_f: -40, is_perennial_species: true  },
  PT_DAFFODIL:       { temp_min_f: -40, is_perennial_species: true  },
  PT_IRIS:           { temp_min_f: -40, is_perennial_species: true  },
  PT_LILY:           { temp_min_f: -30, is_perennial_species: true  },
  PT_DAYLILY:        { temp_min_f: -40, is_perennial_species: true  },
  PT_LAVENDER:       { temp_min_f: -10, is_perennial_species: true  },
  PT_CONEFLOWER:     { temp_min_f: -40, is_perennial_species: true  },
  PT_DAHLIA:         { temp_min_f: 28,  is_perennial_species: true  },
  PT_ZINNIA:         { temp_min_f: 32,  is_perennial_species: false },
  PT_COSMOS:         { temp_min_f: 32,  is_perennial_species: false },
  PT_ASTER:          { temp_min_f: -30, is_perennial_species: true  },
  PT_LUPINE:         { temp_min_f: -30, is_perennial_species: true  },
};

// Converts any zone string format to minimum winter temp in °F.
// Handles: "7a", "Zone 7a", "Zone 7a (0°F to 5°F)", "zone 7b", etc.
function getZoneMinTemp(zoneStr) {
  if (!zoneStr) return null;
  // Extract the numeric zone + optional a/b subzone from anywhere in the string
  const match = String(zoneStr).match(/(\d+)\s*([ab])?/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const sub = (match[2] || 'a').toLowerCase();
  return (num - 1) * 10 - 60 + (sub === 'b' ? 5 : 0);
}

// Extract clean display label, e.g. "Zone 7a (0°F to 5°F)" → "7a"
function parseZoneLabel(zoneStr) {
  if (!zoneStr) return null;
  const match = String(zoneStr).match(/(\d+\s*[ab]?)/i);
  return match ? match[1].replace(/\s+/, '').toLowerCase() : zoneStr;
}

// Returns the effective temp_min_f for a variety:
// variety field (from DB upsert) → fallback lookup → null
function getEffectiveTempMin(variety, plantTypeCode) {
  if (variety?.temp_min_f != null && variety.temp_min_f !== '') {
    return parseFloat(variety.temp_min_f);
  }
  return PLANT_ZONE_DATA[plantTypeCode]?.temp_min_f ?? null;
}

// Returns 'perennial', 'annual', or null
function getZoneBehavior(tempMinF, zoneMinTemp, plantTypeCode) {
  if (tempMinF === null || zoneMinTemp === null) return null;
  const survives = tempMinF <= zoneMinTemp;
  const isPerennialSpecies = PLANT_ZONE_DATA[plantTypeCode]?.is_perennial_species ?? false;
  if (!survives) return 'annual';
  return isPerennialSpecies ? 'perennial' : 'annual';
}

// ─────────────────────────────────────────────────────────────
export default function PlantCatalogDetail() {
  const [searchParams] = useSearchParams();
  const plantTypeId = searchParams.get('id');

  // Squash umbrella special-case
  const SQUASH_UMBRELLA_ID = '69594ee83e086041528f2b15';
  const SQUASH_CANONICAL_IDS = [
    '69594a9f1243f13d1245edfd',
    '69594a9f1243f13d1245edfe',
    '69594a9f1243f13d1245edff',
    '69575e5ecdbb16ee56fa7508'
  ];
  const isSquashUmbrella = plantTypeId === SQUASH_UMBRELLA_ID;

  const [browseCategory, setBrowseCategory] = useState(null);
  const isBrowseCategory = plantTypeId?.startsWith('browse_');

  const [plantType, setPlantType] = useState(null);
  const [varieties, setVarieties] = useState([]);
  const [subCategories, setSubCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showAddVariety, setShowAddVariety] = useState(false);
  const [showAddToStash, setShowAddToStash] = useState(false);
  const [showAddToGrowList, setShowAddToGrowList] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedVariety, setSelectedVariety] = useState(null);
  const [selectedSubCategories, setSelectedSubCategories] = useState([]);

  const [user, setUser] = useState(null);

  // ── Zone state ──
  const [userZone, setUserZone] = useState(null);
  const [userZoneMinTemp, setUserZoneMinTemp] = useState(null);
  const [showPerennialOnly, setShowPerennialOnly] = useState(false);

  const [viewMode, setViewMode] = useState(() => {
    if (plantTypeId) return localStorage.getItem(`pc_detail_view_${plantTypeId}`) || 'cards';
    return 'cards';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [sortBy, setSortBy] = useState('recommended');

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
  const itemsPerPage = 50;

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('variety_columns');
    return saved
      ? JSON.parse(saved)
      : ['name', 'subcategory', 'days', 'spacing', 'species', 'seed_line', 'traits', 'actions'];
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Persist view mode per plant type
  useEffect(() => {
    if (plantTypeId) localStorage.setItem(`pc_detail_view_${plantTypeId}`, viewMode);
  }, [viewMode, plantTypeId]);

  // Load user + zone once
  useEffect(() => {
    (async () => {
      try {
        const [userData, settings] = await Promise.all([
          base44.auth.me(),
          base44.entities.UserSettings.list(),
        ]);
        setUser(userData);
        const zone = settings?.[0]?.usda_zone;
        if (zone) {
          setUserZone(parseZoneLabel(zone)); // normalize: "Zone 7a (0°F...)" → "7a"
          setUserZoneMinTemp(getZoneMinTemp(zone));
        }
      } catch (e) {
        console.error('Error loading user/zone:', e);
      }
    })();
  }, []);

  // Load page data
  useEffect(() => {
    if (!plantTypeId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    loadPlantTypeAndVarieties();
  }, [plantTypeId]);

  const reloadVarieties = async () => {
    if (!plantTypeId) return;
    try {
      setCurrentPage(1);
      let vars = [];
      if (isSquashUmbrella) {
        vars = await base44.entities.Variety.filter({ status: 'active' }, 'variety_name', 1000);
        vars = vars.filter(v => SQUASH_CANONICAL_IDS.includes(v.plant_type_id));
      } else if (isBrowseCategory) {
        await loadPlantTypeAndVarieties();
        return;
      } else {
        vars = await base44.entities.Variety.filter(
          { plant_type_id: plantTypeId, status: 'active' },
          'variety_name',
          1000
        );
      }
      vars = await mergeSubcategoryMaps(vars);
      setVarieties(vars);
    } catch (e) {
      console.error('Error reloading varieties:', e);
    }
  };

  // ─── Helper: merge subcategory map if missing ─────────────
  const mergeSubcategoryMaps = async (vars) => {
    const varietyIds = vars.map(v => v.id);
    if (varietyIds.length === 0 || !vars.some(v => !v.plant_subcategory_id)) return vars;
    try {
      const maps = await base44.entities.VarietySubCategoryMap.filter({
        variety_id: { $in: varietyIds }
      });
      const mapByVariety = new Map(maps.map(m => [m.variety_id, m.plant_subcategory_id]));
      return vars.map(v => {
        if (!v.plant_subcategory_id && mapByVariety.has(v.id)) {
          return { ...v, plant_subcategory_id: mapByVariety.get(v.id) };
        }
        return v;
      });
    } catch {
      return vars;
    }
  };

  const loadPlantTypeAndVarieties = async () => {
    setLoading(true);
    setNotFound(false);

    try {
      // Browse Category
      if (isBrowseCategory) {
        const categoryCode = plantTypeId.replace('browse_', '');
        const browseCats = await base44.entities.BrowseCategory.filter({ category_code: categoryCode });

        if (!browseCats.length) { setNotFound(true); setLoading(false); return; }

        const cat = browseCats[0];
        setBrowseCategory(cat);

        const cleanIds = (cat.plant_type_ids || [])
          .filter(id => id && typeof id === 'string' && id.length === 24 && /^[a-f0-9]{24}$/.test(id));

        setPlantType({
          id: plantTypeId,
          common_name: cat.name,
          icon: cat.icon,
          category: 'browse',
          description: cat.description,
          _is_browse_only: true
        });

        if (!cleanIds.length) {
          setSubCategories([]);
          setVarieties([]);
          setLoading(false);
          return;
        }

        const [allSubcats, varsRaw] = await Promise.all([
          base44.entities.PlantSubCategory.filter({ is_active: true }),
          base44.entities.Variety.filter(
            { plant_type_id: { $in: cleanIds }, status: 'active' },
            'variety_name',
            1000
          )
        ]);

        setSubCategories(allSubcats.filter(sc => cleanIds.includes(sc.plant_type_id)));
        setVarieties(await mergeSubcategoryMaps(varsRaw));
        setCurrentPage(1);
        setLoading(false);
        return;
      }

      // Regular Plant Type
      const types = await base44.entities.PlantType.filter({ id: plantTypeId });
      if (!types.length) { setNotFound(true); setLoading(false); return; }

      const type = types[0];
      setPlantType(type);

      const subcatsPromise = (async () => {
        if (isSquashUmbrella) {
          const all = await base44.entities.PlantSubCategory.filter({ is_active: true });
          return dedupeSubcatsByName(all.filter(sc => SQUASH_CANONICAL_IDS.includes(sc.plant_type_id)));
        }
        const subcats = await base44.entities.PlantSubCategory.filter(
          { plant_type_id: plantTypeId, is_active: true }, 'sort_order'
        );
        return dedupeSubcatsByName(subcats);
      })();

      const varietiesPromise = (async () => {
        let vars = isSquashUmbrella
          ? await base44.entities.Variety.filter(
              { plant_type_id: { $in: SQUASH_CANONICAL_IDS }, status: 'active' },
              'variety_name', 1000
            )
          : await base44.entities.Variety.filter(
              { plant_type_id: plantTypeId, status: 'active' },
              'variety_name', 1000
            );

        if (!vars.length) {
          const prof = await base44.entities.PlantProfile.filter({ plant_type_id: plantTypeId }, 'variety_name');
          vars = prof || [];
        }

        return mergeSubcategoryMaps(vars);
      })();

      const [subcats, vars] = await Promise.all([subcatsPromise, varietiesPromise]);
      setSubCategories(subcats);
      setVarieties(vars);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading plant type:', error);
      toast.error('Failed to load plant details');
    } finally {
      setLoading(false);
    }
  };

  const dedupeSubcatsByName = (subcats) => {
    const unique = [];
    const seen = new Set();
    for (const s of subcats || []) {
      const key = (s?.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(s);
    }
    return unique;
  };

  // ─── Sorting helpers ──────────────────────────────────────
  const norm = (s) => (s || '').toString().trim().toLowerCase();
  const toStringsDeep = (val) => {
    if (!val) return [];
    if (typeof val === 'string') return [val];
    if (Array.isArray(val)) return val.flatMap(toStringsDeep);
    if (typeof val === 'object') return Object.values(val).flatMap(toStringsDeep);
    return [];
  };
  const looksLikeUrl = (s) => {
    const x = norm(s);
    return x.includes('http://') || x.includes('https://') || x.includes('www.') ||
           /\b[a-z0-9-]+\.(com|net|org|io|co|us|ca|uk)\b/.test(x);
  };
  const extractBuyLinks = (v) => {
    const candidates = [
      v?.affiliate_url, ...(toStringsDeep(v?.sources)),
      v?.buy_seeds_link, v?.buy_link, v?.purchase_url, v?.product_url,
      ...(toStringsDeep(v?.traits)), ...(toStringsDeep(v?.extended_data)),
    ];
    return candidates.flatMap(toStringsDeep).map(s => (s?.toString?.() ?? '').trim())
      .filter(Boolean).filter(looksLikeUrl);
  };
  const isPepperSeeds = (v) => extractBuyLinks(v).join(' ').toLowerCase().includes('pepperseeds.net');
  const recommendedTier = (v) => {
    if (isPepperSeeds(v)) return 3;
    if (v?.affiliate_url && norm(v.affiliate_url)) return 2;
    if (extractBuyLinks(v).length > 0) return 1;
    return 0;
  };
  const popularityScore = (v) => {
    if (v?.popularity_tier === 'popular') return 3;
    if (v?.popularity_tier === 'common') return 2;
    return 1;
  };

  // ─── Available filters (derived from varieties) ───────────
  const availableFilters = useMemo(() => {
    const seedTypeSet = new Set();
    const growthHabits = new Set();
    const colors = new Set();
    const species = new Set();
    const seedLineTypes = new Set();
    const seasonTimings = new Set();
    let hasDays = false, hasSpacing = false, hasHeat = false;
    let hasContainer = false, hasTrellis = false, hasImage = false;
    let hasOrganicTrait = false, hasOrnamental = false, hasOrganicSeeds = false;

    for (const v of varieties) {
      const seedType = v?.traits?.seed_type || (v?.popularity_tier === 'heirloom' ? 'heirloom' : null);
      if (seedType) seedTypeSet.add(seedType);
      if (v?.days_to_maturity || v?.days_to_maturity_seed) hasDays = true;
      if (v?.spacing_recommended || v?.spacing_in_min || v?.spacing_min) hasSpacing = true;
      if (v?.scoville_min || v?.scoville_max || v?.heat_scoville_min || v?.heat_scoville_max) hasHeat = true;
      if (v?.growth_habit) growthHabits.add(v.growth_habit);
      if (v?.fruit_color || v?.pod_color) colors.add(v.fruit_color || v.pod_color);
      if (v?.species) species.add(v.species);
      if (v?.seed_line_type) seedLineTypes.add(v.seed_line_type);
      if (v?.season_timing) seasonTimings.add(v.season_timing);
      if (v?.container_friendly) hasContainer = true;
      if (v?.trellis_required) hasTrellis = true;
      if (v?.images?.length > 0 || v?.image_url) hasImage = true;
      if (v?.traits?.organic_seed === true) hasOrganicTrait = true;
      if (v?.is_ornamental === true) hasOrnamental = true;
      if (v?.is_organic === true) hasOrganicSeeds = true;
    }

    return {
      daysToMaturity: hasDays, spacing: hasSpacing, heatLevel: hasHeat,
      growthHabits: [...growthHabits], colors: [...colors], species: [...species],
      seedTypes: Array.from(seedTypeSet), speciesOptions: [...species],
      seedLineTypes: [...seedLineTypes], seasonTimings: [...seasonTimings],
      booleans: { containerFriendly: hasContainer, trellisRequired: hasTrellis,
        hasImage, organic: hasOrganicTrait, ornamental: hasOrnamental, organicSeeds: hasOrganicSeeds }
    };
  }, [varieties]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (debouncedSearchQuery) count++;
    if (selectedSubCategories.length > 0) count++;
    if (showPerennialOnly) count++;
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
  }, [debouncedSearchQuery, selectedSubCategories, showPerennialOnly, filters]);

  // ─── Zone info for this plant type ───────────────────────
  const plantTypeZoneInfo = useMemo(() => {
    if (!userZoneMinTemp || !plantType?.plant_type_code) return null;
    const zd = PLANT_ZONE_DATA[plantType.plant_type_code];
    if (!zd) return null;
    const behavior = getZoneBehavior(zd.temp_min_f, userZoneMinTemp, plantType.plant_type_code);
    return { behavior, zd };
  }, [userZone, userZoneMinTemp, plantType]);

  // ─── Filtered varieties ───────────────────────────────────
  const filteredVarieties = useMemo(() => {
    let filtered = [...varieties];

    // Search
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.variety_name?.toLowerCase().includes(query) ||
        v.synonyms?.some(s => s.toLowerCase().includes(query)) ||
        v.grower_notes?.toLowerCase().includes(query) ||
        v.notes_public?.toLowerCase().includes(query)
      );
    }

    // Subcategory
    if (selectedSubCategories.length > 0) {
      filtered = filtered.filter(v => {
        if (selectedSubCategories.includes('uncategorized')) return !v.plant_subcategory_id;
        return selectedSubCategories.includes(v.plant_subcategory_id);
      });
    }

    // ── Zone filter: show only varieties that survive as perennials ──
    if (showPerennialOnly && userZoneMinTemp !== null) {
      filtered = filtered.filter(v => {
        const tempMin = getEffectiveTempMin(v, plantType?.plant_type_code);
        if (tempMin === null) return true; // no data — include by default
        const isPerennialSpecies = PLANT_ZONE_DATA[plantType?.plant_type_code]?.is_perennial_species ?? false;
        if (!isPerennialSpecies) return false; // true annuals never survive as perennials
        return tempMin <= userZoneMinTemp;
      });
    }

    // Days range
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
        const spacing = v.spacing_recommended || v.spacing_in_min || v.spacing_min;
        if (!spacing) return false;
        if (filters.spacing.min !== null && spacing < filters.spacing.min) return false;
        if (filters.spacing.max !== null && spacing > filters.spacing.max) return false;
        return true;
      });
    }

    // Heat range
    if (filters.heatLevel.min !== null || filters.heatLevel.max !== null) {
      filtered = filtered.filter(v => {
        const heat = v.scoville_min || v.scoville_max || v.heat_scoville_min || v.heat_scoville_max;
        if (!heat) return false;
        if (filters.heatLevel.min !== null && heat < filters.heatLevel.min) return false;
        if (filters.heatLevel.max !== null && heat > filters.heatLevel.max) return false;
        return true;
      });
    }

    if (filters.growthHabits.length > 0)
      filtered = filtered.filter(v => v.growth_habit && filters.growthHabits.includes(v.growth_habit));
    if (filters.colors.length > 0)
      filtered = filtered.filter(v =>
        (v.fruit_color && filters.colors.includes(v.fruit_color)) ||
        (v.pod_color && filters.colors.includes(v.pod_color))
      );
    if (filters.species.length > 0)
      filtered = filtered.filter(v => v.species && filters.species.includes(v.species));
    if (filters.seedTypes.length > 0)
      filtered = filtered.filter(v => {
        const st = v.traits?.seed_type || (v.popularity_tier === 'heirloom' ? 'heirloom' : null);
        return st && filters.seedTypes.includes(st);
      });
    if (filters.organicOnly) filtered = filtered.filter(v => v.traits?.organic_seed === true);
    if (filters.speciesFilter.length > 0)
      filtered = filtered.filter(v => v.species && filters.speciesFilter.includes(v.species));
    if (filters.ornamentalOnly) filtered = filtered.filter(v => v.is_ornamental === true);
    if (filters.seedLineTypes.length > 0)
      filtered = filtered.filter(v => v.seed_line_type && filters.seedLineTypes.includes(v.seed_line_type));
    if (filters.organicSeedsOnly) filtered = filtered.filter(v => v.is_organic === true);
    if (filters.seasonTimings.length > 0)
      filtered = filtered.filter(v => v.season_timing && filters.seasonTimings.includes(v.season_timing));
    if (filters.containerFriendly === true) filtered = filtered.filter(v => v.container_friendly === true);
    if (filters.trellisRequired === true) filtered = filtered.filter(v => v.trellis_required === true);
    if (filters.hasImage === true) filtered = filtered.filter(v => v.images?.length > 0 || v.image_url);

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recommended': {
          const td = recommendedTier(b) - recommendedTier(a);
          if (td !== 0) return td;
          const pd = popularityScore(b) - popularityScore(a);
          if (pd !== 0) return pd;
          return (a.variety_name || '').localeCompare(b.variety_name || '');
        }
        case 'name_asc': return (a.variety_name || '').localeCompare(b.variety_name || '');
        case 'name_desc': return (b.variety_name || '').localeCompare(a.variety_name || '');
        case 'days_asc': return (a.days_to_maturity || a.days_to_maturity_seed || 999) -
                                (b.days_to_maturity || b.days_to_maturity_seed || 999);
        case 'days_desc': return (b.days_to_maturity || b.days_to_maturity_seed || 0) -
                                 (a.days_to_maturity || a.days_to_maturity_seed || 0);
        case 'spacing_asc': return (a.spacing_recommended || a.spacing_in_min || a.spacing_min || 999) -
                                   (b.spacing_recommended || b.spacing_in_min || b.spacing_min || 999);
        case 'spacing_desc': return (b.spacing_recommended || b.spacing_in_min || b.spacing_min || 0) -
                                    (a.spacing_recommended || a.spacing_in_min || a.spacing_min || 0);
        case 'heat_asc': {
          const ha = a.scoville_min || a.scoville_max || a.heat_scoville_min || 0;
          const hb = b.scoville_min || b.scoville_max || b.heat_scoville_min || 0;
          return ha - hb;
        }
        case 'heat_desc': {
          const ha = a.scoville_min || a.scoville_max || a.heat_scoville_min || 0;
          const hb = b.scoville_min || b.scoville_max || b.heat_scoville_min || 0;
          return hb - ha;
        }
        case 'species_asc': return (a.species || 'zzz').localeCompare(b.species || 'zzz');
        case 'species_desc': return (b.species || '').localeCompare(a.species || '');
        case 'seed_line_asc': return (a.seed_line_type || 'zzz').localeCompare(b.seed_line_type || 'zzz');
        case 'seed_line_desc': return (b.seed_line_type || '').localeCompare(a.seed_line_type || '');
        default: return 0;
      }
    });

    return filtered;
  }, [varieties, debouncedSearchQuery, selectedSubCategories, showPerennialOnly,
      userZoneMinTemp, plantType, filters, sortBy]);

  const paginatedVarieties = useMemo(
    () => filteredVarieties.slice(0, currentPage * itemsPerPage),
    [filteredVarieties, currentPage]
  );
  const hasMoreItems = filteredVarieties.length > paginatedVarieties.length;

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSubCategories([]);
    setShowPerennialOnly(false);
    setFilters({
      daysToMaturity: { min: null, max: null }, spacing: { min: null, max: null },
      heatLevel: { min: null, max: null }, growthHabits: [], colors: [], species: [],
      containerFriendly: null, trellisRequired: null, hasImage: null, seedTypes: [],
      organicOnly: false, speciesFilter: [], ornamentalOnly: false, seedLineTypes: [],
      organicSeedsOnly: false, seasonTimings: []
    });
    setSortBy('recommended');
    setCurrentPage(1);
  };

  // ─── Loading / not found ──────────────────────────────────
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

  const plantDisplayName = plantType?.common_name || plantType?.name || 'Plant';

  // ─── Zone banner helper ───────────────────────────────────
  const renderZoneBanner = () => {
    if (!userZone || !plantTypeZoneInfo) return null;
    const { behavior, zd } = plantTypeZoneInfo;
    const isPerennial = behavior === 'perennial';

    return (
      <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
        isPerennial
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
      }`}>
        <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isPerennial ? 'text-emerald-600' : 'text-amber-600'}`} />
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${isPerennial ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
            {isPerennial
              ? `✓ Perennial in Zone ${userZone} — returns every year`
              : zd.is_perennial_species
                ? `Annual in Zone ${userZone} — frost kills it (perennial in Zone 10+)`
                : `Annual everywhere — replant each season`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isPerennial
              ? `Winter lows in Zone ${userZone} (≥${userZoneMinTemp}°F) are above this plant's survival threshold (${zd.temp_min_f}°F). Plant once; it comes back.`
              : zd.is_perennial_species
                ? `This species can live ${Math.abs(zd.temp_min_f)}°F winters, but Zone ${userZone} sees lows around ${userZoneMinTemp}°F — below its ${zd.temp_min_f}°F minimum.`
                : `This is a true annual by nature regardless of climate.`}
          </p>
        </div>
        {/* Temp range pill */}
        {(() => {
          // Show ideal temp range from the first variety with temp data, or PLANT_ZONE_DATA
          const sampleVariety = varieties.find(v => v.temp_ideal_min_f && v.temp_ideal_max_f);
          if (!sampleVariety) return null;
          return (
            <div className="flex items-center gap-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1 whitespace-nowrap">
              <Thermometer className="w-3 h-3 text-orange-500" />
              <span className="text-gray-600 dark:text-gray-300">
                Thrives {sampleVariety.temp_ideal_min_f}°F – {sampleVariety.temp_ideal_max_f}°F
              </span>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <ErrorBoundary fallbackTitle="Plant Detail Error">
      <div className="space-y-6 max-w-5xl">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('PlantCatalog')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>

          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${plantType?.color || 'bg-emerald-100'}`}>
                {plantType?.icon || '🌱'}
              </div>

              <div className="flex-1">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{plantDisplayName}</h1>
                {plantType?.scientific_name && (
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

                {!isSquashUmbrella && !isBrowseCategory ? (
                  <Button
                    onClick={() => setShowAddVariety(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {user?.role === 'admin' || user?.role === 'editor' ? 'Add Variety' : 'Suggest Variety'}
                  </Button>
                ) : (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 max-w-xs">
                    ℹ️ Browse-only: Navigate to specific plant type to add varieties
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Browse Category Notice */}
        {(isSquashUmbrella || browseCategory) && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900">
            {browseCategory?.info_banner ||
              'ℹ️ Squash Browse View: This shows varieties from Summer Squash, Winter Squash, Zucchini, and Pumpkin.'}
          </div>
        )}

        {/* Buy Seeds Banner */}
        {plantType?.buy_seeds_link && !plantType?._is_browse_only && (
          <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">🌱</div>
              <div>
                <p className="font-semibold text-emerald-900 text-sm">Buy {plantDisplayName} Seeds</p>
                <p className="text-emerald-700 text-xs">Get seeds from our trusted partner</p>
              </div>
            </div>
            <a href={plantType.buy_seeds_link} target="_blank" rel="noopener noreferrer">
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <ExternalLink className="w-4 h-4" />Buy Now
              </Button>
            </a>
          </div>
        )}

        <SpecialCareWarnings variety={varieties[0]} />

        {/* ── Zone Banner ── */}
        {renderZoneBanner()}

        {/* ── Overview ── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 mb-0.5">Water Needs</span>
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium capitalize">{plantType?.typical_water || 'Moderate'}</span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-gray-500 mb-0.5">Sun Exposure</span>
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium capitalize">
                    {plantType?.typical_sun?.replace(/_/g, ' ') || 'Full Sun'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-gray-500 mb-0.5">Days to Maturity</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">{plantType?.default_days_to_maturity || 'Varies'}</span>
                </div>
              </div>

              {plantType?.typical_spacing_min && plantType?.typical_spacing_max && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-0.5">Spacing</span>
                  <span className="text-sm font-medium">
                    {plantType.typical_spacing_min}" – {plantType.typical_spacing_max}"
                  </span>
                </div>
              )}

              {plantType?.is_perennial !== undefined && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-0.5">Growth Habit</span>
                  <span className="text-sm font-medium">
                    {plantType.is_perennial ? 'Perennial' : 'Annual'}
                  </span>
                </div>
              )}

              {plantType?.default_start_indoors_weeks && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-0.5">Start Indoors</span>
                  <span className="text-sm font-medium">
                    {plantType.default_start_indoors_weeks} wks before frost
                  </span>
                </div>
              )}

              {plantType?.default_transplant_weeks !== undefined && (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-0.5">Transplant</span>
                  <span className="text-sm font-medium">
                    {plantType.default_transplant_weeks} wks{' '}
                    {plantType.default_transplant_weeks >= 0 ? 'after' : 'before'} frost
                  </span>
                </div>
              )}

              {user?.role === 'admin' && (
                <Button size="sm" variant="outline" className="ml-auto"
                  onClick={() => (window.location.href = `/EditPlantType?id=${plantType.id}`)}>
                  Edit PlantType
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Search, Sort, Filters ── */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search varieties..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Subcategory */}
              <Select
                value={selectedSubCategories[0] || 'all'}
                onValueChange={(v) => {
                  setSelectedSubCategories(v === 'all' ? [] : [v]);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Sub-Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({varieties.length})</SelectItem>
                  {subCategories
                    .filter(s => s.is_active)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map((subcat) => {
                      const count = varieties.filter(v => v.plant_subcategory_id === subcat.id).length;
                      if (count === 0) return null;
                      return (
                        <SelectItem key={subcat.id} value={subcat.id}>
                          {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                          {subcat.name} ({count})
                        </SelectItem>
                      );
                    })}
                  {(() => {
                    const n = varieties.filter(v => !v.plant_subcategory_id).length;
                    return n > 0 ? <SelectItem value="uncategorized">Uncategorized ({n})</SelectItem> : null;
                  })()}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">⭐ Recommended</SelectItem>
                  <SelectItem value="name_asc">Name A → Z</SelectItem>
                  <SelectItem value="name_desc">Name Z → A</SelectItem>
                  <SelectItem value="days_asc">Days: Low → High</SelectItem>
                  <SelectItem value="days_desc">Days: High → Low</SelectItem>
                  <SelectItem value="spacing_asc">Spacing: Low → High</SelectItem>
                  <SelectItem value="spacing_desc">Spacing: High → Low</SelectItem>
                  {availableFilters.heatLevel && (
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

              {/* ── Zone perennial filter toggle ── */}
              {userZone && (
                <Button
                  variant={showPerennialOnly ? 'default' : 'outline'}
                  onClick={() => { setShowPerennialOnly(p => !p); setCurrentPage(1); }}
                  className={`gap-2 whitespace-nowrap ${showPerennialOnly ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                >
                  <Leaf className="w-4 h-4" />
                  Perennial in Zone {userZone}
                </Button>
              )}

              <Button variant="outline" onClick={() => setShowFilters(true)} className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 bg-emerald-600">{activeFilterCount}</Badge>
                )}
              </Button>

              {activeFilterCount > 0 && (
                <Button variant="ghost" onClick={handleClearFilters} className="gap-2">
                  <X className="w-4 h-4" />Clear
                </Button>
              )}

              {viewMode === 'list' && (
                <Button variant="outline" onClick={() => setShowColumnSelector(!showColumnSelector)} className="gap-2">
                  <SlidersHorizontal className="w-4 h-4" />Columns
                </Button>
              )}
            </div>

            {/* Zone filter info strip */}
            {showPerennialOnly && userZone && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-800 dark:text-emerald-300">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Showing only varieties that survive as <strong>perennials</strong> in{' '}
                  <strong>Zone {userZone}</strong> (winter low ≥ {userZoneMinTemp}°F).
                  {filteredVarieties.length === 0 && plantTypeZoneInfo?.behavior === 'annual' &&
                    ` ${plantDisplayName} is grown as an annual in Zone ${userZone} — none qualify.`}
                </span>
              </div>
            )}

            {/* Column selector */}
            {showColumnSelector && viewMode === 'list' && (
              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-sm font-semibold mb-2">Select Columns</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'name', label: 'Name' }, { id: 'subcategory', label: 'Sub-Category' },
                    { id: 'days', label: 'Days' }, { id: 'spacing', label: 'Spacing' },
                    { id: 'height', label: 'Height' }, { id: 'sun', label: 'Sun' },
                    { id: 'water', label: 'Water' }, { id: 'color', label: 'Color' },
                    { id: 'species', label: 'Species' }, { id: 'seed_line', label: 'Seed Line' },
                    { id: 'season', label: 'Season' }, { id: 'traits', label: 'Flags' },
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

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500">Active filters:</span>
                {debouncedSearchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: "{debouncedSearchQuery}"
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                  </Badge>
                )}
                {showPerennialOnly && (
                  <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-800">
                    <Leaf className="w-3 h-3" />
                    Perennial in Zone {userZone}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setShowPerennialOnly(false)} />
                  </Badge>
                )}
                {filters.containerFriendly && (
                  <Badge variant="secondary" className="gap-1">
                    Container Friendly
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({ ...filters, containerFriendly: null })} />
                  </Badge>
                )}
                {filters.trellisRequired && (
                  <Badge variant="secondary" className="gap-1">
                    Needs Trellis
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters({ ...filters, trellisRequired: null })} />
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Varieties ── */}
        <Card>
          <CardHeader>
            <CardTitle>Varieties ({filteredVarieties.length})</CardTitle>
          </CardHeader>

          <CardContent>
            {filteredVarieties.length === 0 ? (
              <div className="text-center py-8">
                <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">
                  {activeFilterCount > 0 ? 'No varieties match your filters' : 'No varieties cataloged yet'}
                </p>
                {activeFilterCount > 0 ? (
                  <Button onClick={handleClearFilters} variant="outline" className="gap-2">
                    <X className="w-4 h-4" />Clear Filters
                  </Button>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-4">
                      {plantType?._is_browse_only
                        ? 'Navigate to specific plant types to add varieties'
                        : user?.role === 'admin' ? 'Import varieties or add them manually' : 'Be the first to suggest a variety!'}
                    </p>
                    {!plantType?._is_browse_only && (
                      <Button onClick={() => setShowAddVariety(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
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
                  onSortChange={(v) => { setSortBy(v); setCurrentPage(1); }}
                  onAddToStash={(variety) => { setSelectedVariety(variety); setShowAddToStash(true); }}
                  onAddToGrowList={(variety) => { setSelectedVariety(variety); setShowAddToGrowList(true); }}
                />
                {hasMoreItems && (
                  <div className="text-center mt-4">
                    <Button variant="outline" onClick={() => setCurrentPage(currentPage + 1)}>
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
                                  <Button size="sm" variant="ghost"><span className="text-xs">View</span></Button>
                                </Link>
                                <Link to={createPageUrl('EditVariety') + `?id=${variety.id}`}>
                                  <Button size="sm" variant="ghost"><span className="text-xs">Edit</span></Button>
                                </Link>
                              </>
                            )}
                            <Button size="sm" variant="ghost"
                              onClick={() => { setSelectedVariety(variety); setShowAddToStash(true); }}
                              title="Add to Seed Stash">
                              <Package className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => { setSelectedVariety(variety); setShowAddToGrowList(true); }}
                              title="Add to Grow List">
                              <ListChecks className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const isJunk = (val) => {
                              if (!val) return true;
                              if (typeof val !== 'string') return true;
                              const s = val.trim();
                              return s === '' || s === '[]' || s.includes('[') || s.includes('"psc') || s.includes('PSC_');
                            };
                            if (!variety.plant_subcategory_id || isJunk(variety.plant_subcategory_id)) {
                              return <Badge variant="outline" className="text-xs text-gray-500">Uncategorized</Badge>;
                            }
                            const subcat = subCategories.find(s => s.id === variety.plant_subcategory_id);
                            return subcat ? (
                              <Badge variant="secondary" className="text-xs">
                                {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                                {subcat.name}
                              </Badge>
                            ) : <Badge variant="outline" className="text-xs text-gray-500">Uncategorized</Badge>;
                          })()}

                          {(variety.days_to_maturity || variety.days_to_maturity_seed) && (
                            <Badge variant="outline" className="text-xs">
                              {variety.days_to_maturity || variety.days_to_maturity_seed} days
                            </Badge>
                          )}
                          {(variety.spacing_recommended || variety.spacing_in_min || variety.spacing_min) && (
                            <Badge variant="outline" className="text-xs">
                              {variety.spacing_recommended || variety.spacing_in_min || variety.spacing_min}" spacing
                            </Badge>
                          )}
                          {variety.trellis_required && <Badge className="bg-green-100 text-green-800 text-xs">Needs Trellis</Badge>}
                          {variety.container_friendly && <Badge className="bg-blue-100 text-blue-800 text-xs">Container</Badge>}
                          {(() => {
                            const st = variety.traits?.seed_type || (variety.popularity_tier === 'heirloom' ? 'heirloom' : null);
                            if (!st) return null;
                            const label = st === 'open_pollinated' ? 'OP' : st === 'hybrid_f1' ? 'Hybrid' : st === 'heirloom' ? 'Heirloom' : st;
                            return <Badge variant="outline" className="text-xs">{label}</Badge>;
                          })()}
                          {variety.traits?.organic_seed && <Badge className="bg-purple-100 text-purple-800 text-xs">Organic</Badge>}
                        </div>

                        {(variety.grower_notes || variety.notes_public) && (
                          <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                            {variety.grower_notes || variety.notes_public}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {hasMoreItems && (
                  <div className="text-center mt-4">
                    <Button variant="outline" onClick={() => setCurrentPage(currentPage + 1)}>
                      Load More ({filteredVarieties.length - paginatedVarieties.length} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <AddVarietyDialog
          plantType={plantType}
          open={showAddVariety}
          onOpenChange={setShowAddVariety}
          onSuccess={reloadVarieties}
          userRole={user?.role}
        />
        <AddToStashModal
          open={showAddToStash}
          onOpenChange={setShowAddToStash}
          variety={selectedVariety}
          plantType={plantType}
        />
        <AddToGrowListModal
          open={showAddToGrowList}
          onOpenChange={setShowAddToGrowList}
          variety={selectedVariety}
          plantType={plantType}
        />
        <AdvancedFiltersPanel
          open={showFilters}
          onOpenChange={setShowFilters}
          filters={filters}
          onFilterChange={(newFilters) => { setFilters(newFilters); setCurrentPage(1); }}
          onClearAll={() => {
            setFilters({
              daysToMaturity: { min: null, max: null }, spacing: { min: null, max: null },
              heatLevel: { min: null, max: null }, growthHabits: [], colors: [], species: [],
              containerFriendly: null, trellisRequired: null, hasImage: null, seedTypes: [],
              organicOnly: false, speciesFilter: [], ornamentalOnly: false, seedLineTypes: [],
              organicSeedsOnly: false, seasonTimings: []
            });
            setCurrentPage(1);
          }}
          availableFilters={availableFilters}
        />
      </div>
    </ErrorBoundary>
  );
}
