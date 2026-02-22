import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ArrowUpDown,
  Sparkles,
  MapPin,
  Leaf
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AdBanner from '@/components/monetization/AdBanner';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PlantRecommendations from '@/components/ai/PlantRecommendations';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import { useDebouncedValue } from '../components/utils/useDebouncedValue';

// ─────────────────────────────────────────────────────────────
// ZONE DATA — temp_min_f per PlantType (keyed by plant_type_code)
// is_perennial_species = TRUE means the species is biologically
// perennial; whether it acts perennial in the USER'S zone is
// determined by comparing temp_min_f to their zone's coldest temp.
// TODO: Replace with PlantType.temp_min_f DB field when schema
//       credits are available.
// ─────────────────────────────────────────────────────────────
const PLANT_ZONE_DATA = {
  // VEGETABLES
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
  PT_MUSTARD_ARUGULA:{ temp_min_f: 20,  is_perennial_species: false },
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
  // FRUITS
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
  // HERBS
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
  // FLOWERS (existing)
  PT_SUNFLOWER:      { temp_min_f: 32,  is_perennial_species: false },
  PT_MARIGOLD:       { temp_min_f: 32,  is_perennial_species: true  },
  PT_CALENDULA:      { temp_min_f: 20,  is_perennial_species: false },
  PT_NASTURTIUM:     { temp_min_f: 32,  is_perennial_species: true  },
  PT_BORAGE:         { temp_min_f: 25,  is_perennial_species: false },
  PT_SWEET_ALYSSUM:  { temp_min_f: 20,  is_perennial_species: true  },
  // FLOWERS (new — add codes once created in Base44)
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
  PT_BLACK_EYED_SUSAN:{ temp_min_f:-30, is_perennial_species: true  },
  PT_SALVIA_PERENNI: { temp_min_f: -20, is_perennial_species: true  },
  PT_DAHLIA:         { temp_min_f: 28,  is_perennial_species: true  },
  PT_ZINNIA:         { temp_min_f: 32,  is_perennial_species: false },
  PT_COSMOS:         { temp_min_f: 32,  is_perennial_species: false },
  PT_SNAPDRAGON:     { temp_min_f: 20,  is_perennial_species: false },
  PT_SWEET_PEA:      { temp_min_f: 20,  is_perennial_species: false },
  PT_RANUNCULUS:     { temp_min_f: 20,  is_perennial_species: true  },
  PT_ASTER:          { temp_min_f: -30, is_perennial_species: true  },
  PT_LUPINE:         { temp_min_f: -30, is_perennial_species: true  },
  PT_HOLLYHOCK:      { temp_min_f: -30, is_perennial_species: true  },
  PT_FOXGLOVE:       { temp_min_f: -10, is_perennial_species: false },
  PT_POPPY:          { temp_min_f: 20,  is_perennial_species: false },
  PT_PETUNIA:        { temp_min_f: 32,  is_perennial_species: true  },
  PT_IMPATIENS:      { temp_min_f: 32,  is_perennial_species: true  },
  PT_GERANIUM:       { temp_min_f: 28,  is_perennial_species: true  },
  PT_PANSY:          { temp_min_f: 10,  is_perennial_species: false },
  PT_CALIBRACHOA:    { temp_min_f: 32,  is_perennial_species: true  },
  PT_VERBENA:        { temp_min_f: 20,  is_perennial_species: true  },
  PT_WAX_BEGONIA:    { temp_min_f: 32,  is_perennial_species: true  },
  // COVER CROPS
  PT_BUCKWHEAT:      { temp_min_f: 32,  is_perennial_species: false },
  PT_HAIRY_VETCH:    { temp_min_f: -30, is_perennial_species: false },
  PT_CEREAL_RYE:     { temp_min_f: -10, is_perennial_species: false },
  PT_CRIMSON_CLOVER: { temp_min_f: 20,  is_perennial_species: false },
  PT_OATS:           { temp_min_f: 20,  is_perennial_species: false },
};

// ─── Zone utilities ─────────────────────────────────────────
// Converts zone string (e.g. "7a", "6b") to minimum winter temp in °F
function getZoneMinTemp(zoneStr) {
  if (!zoneStr) return null;
  const num = parseInt(zoneStr);
  if (isNaN(num)) return null;
  const sub = String(zoneStr).slice(-1).toLowerCase();
  return (num - 1) * 10 - 60 + (sub === 'b' ? 5 : 0);
}

// Returns 'perennial', 'annual', or null (unknown)
function getZoneBehavior(plantTypeCode, zoneMinTemp) {
  if (zoneMinTemp === null || zoneMinTemp === undefined) return null;
  const zd = PLANT_ZONE_DATA[plantTypeCode];
  if (!zd || zd.temp_min_f === null || zd.temp_min_f === undefined) return null;
  const survives = zd.temp_min_f <= zoneMinTemp;
  if (!survives) return 'annual';
  return zd.is_perennial_species ? 'perennial' : 'annual';
}

// ─── Section config ──────────────────────────────────────────
const SECTION_DIVIDERS = {
  herb: {
    icon: '🌿',
    title: 'Herbs & Spices',
    subtitle: 'Culinary and medicinal herbs for your garden',
    borderColor: 'border-amber-300 dark:border-amber-600',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  flower: {
    icon: '🌸',
    title: 'Flowers & Ornamentals',
    subtitle: 'Annuals, perennials, bulbs, and wildflowers',
    borderColor: 'border-pink-300 dark:border-pink-600',
    textColor: 'text-pink-700 dark:text-pink-400',
  },
  other: {
    icon: '🌾',
    title: 'Cover Crops & Soil Builders',
    subtitle: 'Green manures, nitrogen-fixers, and soil improvers',
    borderColor: 'border-lime-300 dark:border-lime-600',
    textColor: 'text-lime-700 dark:text-lime-400',
  },
  indoor: {
    icon: '🏠',
    title: 'Indoor & Houseplants',
    subtitle: 'Tropical foliage, succulents, ferns, and more',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
};

const CATEGORIES = ['vegetable', 'fruit', 'herb', 'flower', 'carnivorous', 'other'];

const POPULAR_TYPES = [
  'Tomato', 'Pepper', 'Cucumber', 'Lettuce', 'Bean', 'Pea', 'Squash',
  'Zucchini', 'Carrot', 'Radish', 'Onion', 'Garlic', 'Basil', 'Cilantro', 'Parsley',
];

// ─────────────────────────────────────────────────────────────
export default function PlantCatalog() {
  const [searchParams] = useSearchParams();

  // ── Core data ──
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [subCategories, setSubCategories] = useState([]);

  // ── Search varieties (lazy — only loaded after first keystroke) ──
  const [allVarieties, setAllVarieties] = useState([]);
  const [allVarietiesLoaded, setAllVarietiesLoaded] = useState(false);

  // ── UI state ──
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  // ── Zone filter ──
  const [userZone, setUserZone] = useState(null);
  const [userZoneMinTemp, setUserZoneMinTemp] = useState(null);
  const [showPerennialOnly, setShowPerennialOnly] = useState(false);

  // ── New variety form ──
  const [newVariety, setNewVariety] = useState({
    variety_name: '',
    days_to_maturity: '',
    spacing_recommended: '',
    plant_height_typical: '',
    sun_requirement: 'full_sun',
    water_requirement: 'moderate',
  });

  // ─── Initial load ─────────────────────────────────────────
  useEffect(() => {
    loadPlantTypes();
    loadUserZone();

    const searchParam = searchParams.get('search');
    if (searchParam) setSearchQuery(searchParam);
  }, [searchParams]);

  // Load varieties for search lazily — only when user starts typing
  useEffect(() => {
    if (debouncedSearchQuery && !allVarietiesLoaded) {
      loadAllVarieties();
    }
  }, [debouncedSearchQuery, allVarietiesLoaded]);

  // Load varieties/subcats when a type is selected
  useEffect(() => {
    if (selectedType) {
      loadVarieties(selectedType.id);
      loadSubCategories(selectedType.id);
      setSelectedSubCategory('all');
    }
  }, [selectedType]);

  // ─── Data loaders ────────────────────────────────────────
  const loadUserZone = useCallback(async () => {
    try {
      const settings = await base44.entities.UserSettings.list();
      const zone = settings?.[0]?.usda_zone;
      if (zone) {
        setUserZone(zone);
        setUserZoneMinTemp(getZoneMinTemp(zone));
      }
    } catch {
      // Zone not available — zone filter stays hidden
    }
  }, []);

  const loadPlantTypes = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true);

    // Clear stale cache missing plantGroups
    try {
      const existing = sessionStorage.getItem('plant_catalog_cache');
      if (existing) {
        const parsed = JSON.parse(existing);
        if (!parsed.plantGroups) sessionStorage.removeItem('plant_catalog_cache');
      }
    } catch { /* ignore */ }

    // Serve from cache if fresh (30 min)
    const cached = sessionStorage.getItem('plant_catalog_cache');
    if (cached && !isRetry) {
      try {
        const { types, browseCats, plantGroups: cGroups, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          const validTypes = buildValidTypes(types, cGroups || []);
          const browseTypes = buildBrowseTypes(browseCats);
          setPlantTypes([...browseTypes, ...validTypes]);
          setLoading(false);
          return;
        }
      } catch { /* fall through to fresh fetch */ }
    }

    try {
      // Sequential fetches with small delays to avoid rate limiting
      const types = await smartQuery(base44, 'PlantType', {}, 'common_name', 5000);
      await delay(300);
      const browseCats = await smartQuery(base44, 'BrowseCategory', { is_active: true }, 'sort_order');
      await delay(300);
      const plantGroups = await smartQuery(base44, 'PlantGroup', {}, 'sort_order');

      sessionStorage.setItem('plant_catalog_cache', JSON.stringify({
        types, browseCats, plantGroups, timestamp: Date.now(),
      }));

      const validTypes = buildValidTypes(types, plantGroups);
      const browseTypes = buildBrowseTypes(browseCats);
      setPlantTypes([...browseTypes, ...validTypes]);
      setRateLimitError(null);
    } catch (error) {
      console.error('[PlantCatalog] Error loading plant types:', error);
      if (error.code === 'RATE_LIMIT') setRateLimitError(error);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  const loadAllVarieties = useCallback(async () => {
    try {
      const vars = await smartQuery(base44, 'Variety', { status: 'active' }, 'variety_name', 500);
      setAllVarieties(vars);
      setAllVarietiesLoaded(true);
    } catch (error) {
      console.error('[PlantCatalog] Error loading varieties for search:', error);
    }
  }, []);

  const loadVarieties = useCallback(async (typeId) => {
    try {
      await delay(200);
      const vars = await base44.entities.Variety.filter(
        { plant_type_id: typeId, status: 'active' },
        'variety_name',
        50
      );
      setVarieties(vars);
    } catch (error) {
      console.error('[PlantCatalog] Error loading varieties:', error);
      setVarieties([]);
    }
  }, []);

  const loadSubCategories = useCallback(async (typeId) => {
    try {
      await delay(200);
      const subcats = await base44.entities.PlantSubCategory.filter(
        { plant_type_id: typeId, is_active: true },
        'sort_order'
      );
      setSubCategories(subcats);
    } catch (error) {
      console.error('[PlantCatalog] Error loading subcategories:', error);
      setSubCategories([]);
    }
  }, []);

  // ─── Handlers ────────────────────────────────────────────
  const handleAddVariety = useCallback(async () => {
    if (!selectedType || !newVariety.variety_name.trim()) return;
    try {
      const variety = await base44.entities.Variety.create({
        plant_type_id: selectedType.id,
        plant_type_name: selectedType.common_name,
        variety_name: newVariety.variety_name,
        days_to_maturity: newVariety.days_to_maturity ? parseInt(newVariety.days_to_maturity) : null,
        spacing_recommended: newVariety.spacing_recommended ? parseInt(newVariety.spacing_recommended) : null,
        plant_height_typical: newVariety.plant_height_typical,
        sun_requirement: newVariety.sun_requirement,
        water_requirement: newVariety.water_requirement,
        status: 'pending_review',
        is_custom: true,
      });
      setVarieties(prev => [...prev, variety]);
      setShowAddVariety(false);
      setNewVariety({
        variety_name: '', days_to_maturity: '', spacing_recommended: '',
        plant_height_typical: '', sun_requirement: 'full_sun', water_requirement: 'moderate',
      });
      toast.success('Variety added! It will be reviewed by moderators.');
    } catch (error) {
      console.error('Error adding variety:', error);
      toast.error('Failed to add variety');
    }
  }, [selectedType, newVariety]);

  const handleAddToSeedStash = useCallback(async (variety) => {
    try {
      await base44.entities.SeedLot.create({
        plant_type_id: selectedType.id,
        plant_type_name: selectedType.common_name,
        variety_id: variety.id,
        variety_name: variety.variety_name,
        is_wishlist: false,
      });
      toast.success('Added to your seed stash!');
    } catch (error) {
      console.error('Error adding to stash:', error);
      toast.error('Failed to add to stash');
    }
  }, [selectedType]);

  const handleAddToWishlist = useCallback(async (variety) => {
    try {
      await base44.entities.SeedLot.create({
        plant_type_id: selectedType.id,
        plant_type_name: selectedType.common_name,
        variety_id: variety.id,
        variety_name: variety.variety_name,
        is_wishlist: true,
      });
      toast.success('Added to your wishlist!');
    } catch (error) {
      console.error('Error adding to wishlist:', error);
    }
  }, [selectedType]);

  // ─── Filtering & sorting ──────────────────────────────────
  const filteredTypes = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase();

    return plantTypes.filter(type => {
      // Search: match name, scientific name, or variety names (if loaded)
      const matchesSearch = !q
        || (type.common_name || '').toLowerCase().includes(q)
        || (type.scientific_name || '').toLowerCase().includes(q)
        || (allVarietiesLoaded && allVarieties.some(
            v => v.plant_type_id === type.id &&
                 (v.variety_name || '').toLowerCase().includes(q)
          ));

      // Category filter (browse types always pass through)
      const matchesCategory = selectedCategory === 'all'
        || type.category === selectedCategory
        || type._is_browse_only;

      // Zone filter — only apply when toggle is on AND zone is known
      const matchesZone = !showPerennialOnly
        || !userZoneMinTemp
        || type._is_browse_only
        || getZoneBehavior(type.plant_type_code, userZoneMinTemp) === 'perennial';

      return matchesSearch && matchesCategory && matchesZone;
    }).sort((a, b) => {
      // Browse categories always first
      if (a._sort_priority !== undefined && b._sort_priority !== undefined)
        return a._sort_priority - b._sort_priority;
      if (a._sort_priority !== undefined) return -1;
      if (b._sort_priority !== undefined) return 1;

      // Sort by plant group order first
      const gA = a.plant_group_sort_order ?? 99;
      const gB = b.plant_group_sort_order ?? 99;
      if (gA !== gB) return gA - gB;

      // Within same group apply user sort
      if (sortBy === 'name')
        return (a.common_name || '').localeCompare(b.common_name || '');
      if (sortBy === 'category')
        return (a.category || '').localeCompare(b.category || '');

      // Default: popularity
      const ai = POPULAR_TYPES.indexOf(a.common_name);
      const bi = POPULAR_TYPES.indexOf(b.common_name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return (a.common_name || '').localeCompare(b.common_name || '');
    });
  }, [plantTypes, debouncedSearchQuery, selectedCategory, sortBy,
      allVarieties, allVarietiesLoaded, showPerennialOnly, userZoneMinTemp]);

  // ─── Section dividers ─────────────────────────────────────
  // Pre-process filteredTypes and inject divider markers between sections.
  // Sections (garden): vegetable/fruit → herb → flower → other
  // Then: indoor (plant_group_sort_order >= 50)
  const renderItems = useMemo(() => {
    const items = [];
    let lastSection = null;

    const getSection = (type) => {
      if ((type.plant_group_sort_order ?? 0) >= 50) return 'indoor';
      if (type.category === 'herb') return 'herb';
      if (type.category === 'flower') return 'flower';
      if (type.category === 'other') return 'other';
      return 'garden'; // vegetable, fruit, carnivorous (garden-side)
    };

    for (const type of filteredTypes) {
      if (type._is_browse_only) {
        items.push({ kind: 'plant', data: type });
        continue;
      }

      const section = getSection(type);

      // Insert divider on section transition
      // (never insert a divider before the very first section)
      if (section !== lastSection) {
        if (lastSection !== null && SECTION_DIVIDERS[section]) {
          items.push({ kind: 'divider', section });
        } else if (lastSection === null && section === 'indoor') {
          // No garden plants at all — still show indoor divider
          items.push({ kind: 'divider', section });
        }
        lastSection = section;
      }

      items.push({ kind: 'plant', data: type });
    }

    return items;
  }, [filteredTypes]);

  // ─── Helpers ──────────────────────────────────────────────
  const getSunIcon = (sun) => {
    const map = { full_sun: '☀️', partial_sun: '🌤️', partial_shade: '⛅', full_shade: '🌥️' };
    return map[sun] || '☀️';
  };

  const getWaterIcon = (water) => {
    const map = { low: '💧', moderate: '💧💧', high: '💧💧💧' };
    return map[water] || '💧💧';
  };

  const getZoneBadge = (type) => {
    if (!userZoneMinTemp || type._is_browse_only) return null;
    const behavior = getZoneBehavior(type.plant_type_code, userZoneMinTemp);
    if (!behavior) return null;
    if (behavior === 'perennial') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
          <Leaf className="w-2.5 h-2.5" />
          Zone {userZone}
        </span>
      );
    }
    // Only show "annual here" badge for species that are perennial elsewhere
    // (avoids cluttering true annuals with an obvious badge)
    if (PLANT_ZONE_DATA[type.plant_type_code]?.is_perennial_species) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-700">
          Annual here
        </span>
      );
    }
    return null;
  };

  // ─── Section divider renderer ─────────────────────────────
  const renderDivider = (section) => {
    const cfg = SECTION_DIVIDERS[section];
    if (!cfg) return null;
    return (
      <div className="col-span-full my-6">
        <div className={`border-t-2 ${cfg.borderColor} relative`}>
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 px-6 py-1.5 rounded-full shadow-sm">
            <h3 className={`text-base font-bold ${cfg.textColor} flex items-center gap-2`}>
              {cfg.icon} {cfg.title}
            </h3>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          {cfg.subtitle}
        </p>
      </div>
    );
  };

  // ─── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────
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

  // ─── Variety Detail View ──────────────────────────────────
  if (selectedVariety) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedVariety(null)} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to {selectedType?.common_name}
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedVariety.variety_name}</h1>
                <p className="text-gray-600">{selectedType?.common_name}</p>

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

                {/* Zone behavior for this variety */}
                {userZone && selectedType?.plant_type_code && (() => {
                  const behavior = getZoneBehavior(selectedType.plant_type_code, userZoneMinTemp);
                  if (!behavior) return null;
                  return (
                    <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${
                      behavior === 'perennial'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20'
                        : 'bg-amber-50 dark:bg-amber-900/20'
                    }`}>
                      <MapPin className={`w-5 h-5 ${behavior === 'perennial' ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <div>
                        <p className={`text-sm font-semibold ${behavior === 'perennial' ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                          {behavior === 'perennial'
                            ? `Perennial in your zone (Zone ${userZone}) ✓`
                            : `Grown as an annual in Zone ${userZone}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {behavior === 'perennial'
                            ? 'This plant will return year after year in your climate.'
                            : PLANT_ZONE_DATA[selectedType.plant_type_code]?.is_perennial_species
                              ? 'This species is perennial in warmer zones. Replant each season in your climate.'
                              : 'This is an annual — replant each growing season.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}
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
              <Button variant="outline" onClick={() => handleAddToWishlist(selectedVariety)} className="gap-2">
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

  // ─── Plant Type Detail View ───────────────────────────────
  if (selectedType) {
    const filteredVarieties = selectedSubCategory === 'all'
      ? varieties
      : varieties.filter(v => (v.subcategory_maps || []).includes(selectedSubCategory));

    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => { setSelectedType(null); setVarieties([]); setSubCategories([]); }}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </Button>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {selectedType.common_name}
            </h1>
            {selectedType.scientific_name && (
              <p className="text-gray-600 mt-1 italic">{selectedType.scientific_name}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-gray-500 capitalize">{selectedType.category}</p>
              {userZone && selectedType.plant_type_code && (() => {
                const behavior = getZoneBehavior(selectedType.plant_type_code, userZoneMinTemp);
                if (!behavior) return null;
                return (
                  <Badge
                    className={behavior === 'perennial'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'}
                  >
                    <MapPin className="w-3 h-3 mr-1" />
                    {behavior === 'perennial' ? `Perennial in Zone ${userZone}` : `Annual in Zone ${userZone}`}
                  </Badge>
                );
              })()}
            </div>
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

        {/* Subcategories filter */}
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
                    {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                    {subcat.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Growing info */}
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
                      {selectedType.typical_spacing_min}–{selectedType.typical_spacing_max}"
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

        {/* Varieties */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">
            Varieties ({filteredVarieties.length})
          </h3>
          {filteredVarieties.length === 0 ? (
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
              {filteredVarieties.map((variety) => (
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
                      {variety.is_custom && <Badge variant="secondary">Custom</Badge>}
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-gray-400 text-sm">
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
              <DialogTitle>Add New {selectedType.common_name} Variety</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="varietyName">Variety Name *</Label>
                <Input
                  id="varietyName"
                  placeholder="e.g., Cherokee Purple, Sugar Snap"
                  value={newVariety.variety_name}
                  onChange={(e) => setNewVariety(p => ({ ...p, variety_name: e.target.value }))}
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
                    onChange={(e) => setNewVariety(p => ({ ...p, days_to_maturity: e.target.value }))}
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
                    onChange={(e) => setNewVariety(p => ({ ...p, spacing_recommended: e.target.value }))}
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
                  onChange={(e) => setNewVariety(p => ({ ...p, plant_height_typical: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sun Requirement</Label>
                  <Select
                    value={newVariety.sun_requirement}
                    onValueChange={(v) => setNewVariety(p => ({ ...p, sun_requirement: v }))}
                  >
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
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
                    onValueChange={(v) => setNewVariety(p => ({ ...p, water_requirement: v }))}
                  >
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
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

  // ─── Main Catalog View ────────────────────────────────────
  return (
    <ErrorBoundary
      fallbackTitle="Plant Catalog Error"
      fallbackMessage="Unable to load plant catalog. Please refresh the page."
    >
      <div className="space-y-6">
        {rateLimitError && (
          <RateLimitBanner
            retryInMs={rateLimitError.retryInMs || 5000}
            onRetry={() => loadPlantTypes(true)}
            retrying={retrying}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Plant Catalog
            </h1>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              Browse plants and varieties for your garden
            </p>
          </div>
          <Button
            onClick={() => setShowAIRecommendations(true)}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <Sparkles className="w-4 h-4" />
            AI Recommendations
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search plants or varieties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category */}
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

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popularity">Top Categories</SelectItem>
              <SelectItem value="name">Sort: A–Z</SelectItem>
              <SelectItem value="category">Sort: Category</SelectItem>
            </SelectContent>
          </Select>

          {/* Zone filter — only visible when zone is known */}
          {userZone && (
            <Button
              variant={showPerennialOnly ? 'default' : 'outline'}
              onClick={() => setShowPerennialOnly(p => !p)}
              className={`gap-2 whitespace-nowrap ${
                showPerennialOnly ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
              }`}
            >
              <Leaf className="w-4 h-4" />
              Perennial in Zone {userZone}
            </Button>
          )}

          {/* View mode */}
          <div className="flex gap-1">
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

        {/* Zone filter info strip */}
        {showPerennialOnly && userZone && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700 text-sm text-emerald-800 dark:text-emerald-300">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>
              Showing plants that survive as <strong>perennials</strong> in{' '}
              <strong>Zone {userZone}</strong> (winter low ≈{' '}
              {userZoneMinTemp}°F to {userZoneMinTemp + 5}°F).
              Tender perennials and true annuals are hidden.
            </span>
          </div>
        )}

        <AdBanner placement="top_banner" pageType="catalog" />

        {/* Grid view */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <AnimatePresence>
              {renderItems.map((item, index) => {
                if (item.kind === 'divider') {
                  const cfg = SECTION_DIVIDERS[item.section];
                  return (
                    <div key={`divider-${item.section}`} className="col-span-full my-6">
                      <div className={`border-t-2 ${cfg.borderColor} relative`}>
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 px-6 py-1.5 rounded-full shadow-sm">
                          <h3 className={`text-base font-bold ${cfg.textColor} flex items-center gap-2`}>
                            {cfg.icon} {cfg.title}
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                        {cfg.subtitle}
                      </p>
                    </div>
                  );
                }

                const type = item.data;
                const zoneBadge = getZoneBadge(type);

                return (
                  <Link
                    key={type.id}
                    to={createPageUrl('PlantCatalogDetail') + `?id=${type.id}`}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.4) }}
                    >
                      <Card
                        className="cursor-pointer hover:shadow-lg transition-all duration-300 group h-full"
                        style={{
                          background: 'var(--glass-bg)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          border: '1px solid var(--glass-border)',
                        }}
                      >
                        <CardContent className="p-4 text-center">
                          <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl bg-white dark:bg-gray-800 group-hover:scale-110 transition-transform">
                            {type.icon || '🌱'}
                          </div>
                          <h3 className="font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                            {type.common_name}
                          </h3>
                          {type.scientific_name && (
                            <p className="text-xs italic truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {type.scientific_name}
                            </p>
                          )}
                          <div className="flex items-center justify-center gap-1 flex-wrap mt-1">
                            <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                              {type.category}
                            </p>
                            {type.is_perennial && !zoneBadge && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">Perennial</Badge>
                            )}
                          </div>
                          {zoneBadge && (
                            <div className="flex justify-center mt-1.5">{zoneBadge}</div>
                          )}
                          {!type._is_browse_only && (
                            <div
                              className="flex items-center justify-center gap-1 mt-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: 'var(--primary)' }}
                            >
                              <span>Browse</span>
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Link>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          // List view
          <div className="space-y-2">
            <AnimatePresence>
              {renderItems.map((item, index) => {
                if (item.kind === 'divider') {
                  const cfg = SECTION_DIVIDERS[item.section];
                  return (
                    <div key={`divider-${item.section}`} className={`flex items-center gap-3 py-3 px-4 my-2 rounded-lg border ${cfg.borderColor} bg-white dark:bg-gray-900`}>
                      <span className="text-xl">{cfg.icon}</span>
                      <div>
                        <h3 className={`font-bold text-sm ${cfg.textColor}`}>{cfg.title}</h3>
                        <p className="text-xs text-gray-500">{cfg.subtitle}</p>
                      </div>
                    </div>
                  );
                }

                const type = item.data;
                const zoneBadge = getZoneBadge(type);

                return (
                  <Link key={type.id} to={createPageUrl('PlantCatalogDetail') + `?id=${type.id}`}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(index * 0.015, 0.3) }}
                    >
                      <Card
                        className="cursor-pointer hover:shadow-lg transition-all duration-300 group"
                        style={{
                          background: 'var(--glass-bg)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          border: '1px solid var(--glass-border)',
                        }}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 bg-white dark:bg-gray-800 group-hover:scale-110 transition-transform">
                            {type.icon || '🌱'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {type.common_name}
                            </h3>
                            {type.scientific_name && (
                              <p className="text-sm italic truncate" style={{ color: 'var(--text-muted)' }}>
                                {type.scientific_name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className="capitalize">{type.category}</Badge>
                            {zoneBadge || (type.is_perennial && (
                              <Badge variant="outline">Perennial</Badge>
                            ))}
                            <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Link>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Empty state */}
        {renderItems.filter(i => i.kind === 'plant').length === 0 && (
          <div className="text-center py-12">
            <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No plants found</h3>
            <p className="text-gray-600">
              {showPerennialOnly
                ? `No perennials found for Zone ${userZone}. Try turning off the zone filter.`
                : 'Try adjusting your search or filters.'}
            </p>
            {showPerennialOnly && (
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setShowPerennialOnly(false)}
              >
                Clear zone filter
              </Button>
            )}
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

// ─── Private helpers ──────────────────────────────────────────
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function buildValidTypes(types, plantGroups) {
  return types
    .filter(t => t.id && t.common_name && t.is_active !== false && !t.notes?.includes('DEPRECATED'))
    .map(t => {
      const group = plantGroups.find(g => g.id === t.plant_group_id);
      return { ...t, plant_group_sort_order: group?.sort_order ?? 99 };
    });
}

function buildBrowseTypes(browseCats) {
  return browseCats.map(cat => ({
    id: `browse_${cat.category_code}`,
    common_name: cat.name,
    icon: cat.icon,
    category: 'browse',
    color: '',
    _is_browse_only: true,
    _browse_category: cat,
    _sort_priority: -1000 + cat.sort_order,
  }));
}
