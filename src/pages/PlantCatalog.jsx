import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Search, Sprout, Plus, ChevronRight, Loader2,
  Grid3x3, List, Sparkles, Leaf
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import AdBanner from '@/components/monetization/AdBanner';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PlantRecommendations from '@/components/ai/PlantRecommendations';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import { useDebouncedValue } from '../components/utils/useDebouncedValue';

// ─── Section definitions ────────────────────────────────────
// Priority order: vegetable/fruit (1) → herb (2) → flower (3)
// → other/cover crops (4) → indoor (5)
// Browse categories always render first (priority -1).
const SECTIONS = {
  herb: {
    priority: 2,
    icon: '🌿',
    title: 'Herbs & Spices',
    subtitle: 'Culinary and medicinal herbs for your garden',
    borderColor: 'border-amber-300 dark:border-amber-600',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  flower: {
    priority: 3,
    icon: '🌸',
    title: 'Flowers & Ornamentals',
    subtitle: 'Annuals, perennials, bulbs, and wildflowers',
    borderColor: 'border-pink-300 dark:border-pink-600',
    textColor: 'text-pink-700 dark:text-pink-400',
  },
  other: {
    priority: 4,
    icon: '🌾',
    title: 'Cover Crops & Soil Builders',
    subtitle: 'Green manures, nitrogen-fixers, and soil improvers',
    borderColor: 'border-lime-300 dark:border-lime-600',
    textColor: 'text-lime-700 dark:text-lime-400',
  },
  indoor: {
    priority: 5,
    icon: '🏠',
    title: 'Indoor & Houseplants',
    subtitle: 'Tropical foliage, succulents, ferns, and more',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
};

// Maps a plant type to its section key
function getSection(type) {
  if (type._is_browse_only) return 'browse';
  // Indoor = plant group sort_order >= 50
  if ((type.plant_group_sort_order ?? 0) >= 50) return 'indoor';
  if (type.category === 'herb') return 'herb';
  if (type.category === 'flower' ||
      type.category === 'cut_flowers' ||
      type.category === 'bedding_annuals' ||
      type.category === 'perennials_bulbs' ||
      type.category === 'wildflowers_cottage') return 'flower';
  if (type.category === 'other') return 'other';
  // vegetable, fruit, carnivorous, cannabis → garden
  return 'garden';
}

// Section sort priority (used to guarantee grouping in sort)
function getSectionPriority(type) {
  if (type._is_browse_only) return -1;
  const s = getSection(type);
  if (s === 'garden') return 1;
  return SECTIONS[s]?.priority ?? 6;
}

const CATEGORIES = ['vegetable', 'fruit', 'herb', 'flower', 'carnivorous', 'other'];
const POPULAR_TYPES = [
  'Tomato', 'Pepper', 'Cucumber', 'Lettuce', 'Bean', 'Pea', 'Squash',
  'Zucchini', 'Carrot', 'Radish', 'Onion', 'Garlic', 'Basil', 'Cilantro', 'Parsley',
];

// ─── Zone utilities (mirrors PlantCatalogDetail) ───────────
function getZoneMinTemp(zoneStr) {
  if (!zoneStr) return null;
  const match = String(zoneStr).match(/(\d+)\s*([ab])?/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const sub = (match[2] || 'a').toLowerCase();
  return (num - 1) * 10 - 60 + (sub === 'b' ? 5 : 0);
}

function parseZoneLabel(zoneStr) {
  if (!zoneStr) return null;
  const match = String(zoneStr).match(/(\d+\s*[ab]?)/i);
  return match ? match[1].replace(/\s+/, '').toLowerCase() : zoneStr;
}

// Keyed by plant_type_code OR derived "PT_" + COMMON_NAME_UPPERCASED
// is_perennial_species: true = survives as perennial IF temp_min_f <= zone min
const PLANT_TYPE_ZONE_MAP = {
 // Vegetables — annuals (frost-killed, filtered out in any zone)
  PT_TOMATO:        { temp_min_f: 32,  is_perennial_species: false },
  PT_PEPPER:        { temp_min_f: 32,  is_perennial_species: false },
  PT_EGGPLANT:      { temp_min_f: 32,  is_perennial_species: false },
  PT_CUCUMBER:      { temp_min_f: 32,  is_perennial_species: false },
  PT_ZUCCHINI:      { temp_min_f: 32,  is_perennial_species: false },
  PT_SQUASH:        { temp_min_f: 32,  is_perennial_species: false },
  PT_SUMMER_SQUASH: { temp_min_f: 32,  is_perennial_species: false },
  PT_WINTER_SQUASH: { temp_min_f: 32,  is_perennial_species: false },
  PT_PUMPKIN:       { temp_min_f: 32,  is_perennial_species: false },
  PT_BEAN:          { temp_min_f: 32,  is_perennial_species: false },
  PT_CORN:          { temp_min_f: 32,  is_perennial_species: false },
  PT_SWEET_CORN:    { temp_min_f: 32,  is_perennial_species: false },
  PT_POTATO:        { temp_min_f: 32,  is_perennial_species: false },
  PT_SWEET_POTATO:  { temp_min_f: 32,  is_perennial_species: false },
  PT_OKRA:          { temp_min_f: 32,  is_perennial_species: false },
  PT_TOMATILLO:     { temp_min_f: 32,  is_perennial_species: false },
  PT_GROUNDCHERRY:  { temp_min_f: 32,  is_perennial_species: false },
  PT_WATERMELON:    { temp_min_f: 32,  is_perennial_species: false },
  PT_CANTALOUPE:    { temp_min_f: 32,  is_perennial_species: false },
  PT_BASIL:         { temp_min_f: 32,  is_perennial_species: false },
  PT_LETTUCE:       { temp_min_f: 28,  is_perennial_species: false },
  PT_SPINACH:       { temp_min_f: 20,  is_perennial_species: false },
  PT_CABBAGE:       { temp_min_f: 20,  is_perennial_species: false },
  PT_BROCCOLI:      { temp_min_f: 25,  is_perennial_species: false },
  PT_CAULIFLOWER:   { temp_min_f: 28,  is_perennial_species: false },
  PT_BRUSSELS:      { temp_min_f: 15,  is_perennial_species: false },
  PT_KALE:          { temp_min_f: 10,  is_perennial_species: false },
  PT_CARROT:        { temp_min_f: 15,  is_perennial_species: false },
  PT_RADISH:        { temp_min_f: 28,  is_perennial_species: false },
  PT_BEET:          { temp_min_f: 25,  is_perennial_species: false },
  PT_TURNIP:        { temp_min_f: 20,  is_perennial_species: false },
  PT_PARSNIP:       { temp_min_f: 10,  is_perennial_species: false },
  PT_ONION:         { temp_min_f: 20,  is_perennial_species: false },
  PT_LEEK:          { temp_min_f: 10,  is_perennial_species: false },
  PT_SCALLION:      { temp_min_f: 20,  is_perennial_species: false },
  PT_CELERY:        { temp_min_f: 28,  is_perennial_species: false },
  PT_BOK_CHOY:      { temp_min_f: 25,  is_perennial_species: false },
  PT_COLLARD_GREENS:{ temp_min_f: 15,  is_perennial_species: false },
  PT_SWISS_CHARD:   { temp_min_f: 25,  is_perennial_species: false },
  PT_ARUGULA:       { temp_min_f: 20,  is_perennial_species: false },
  PT_MUSTARD_GREENS:{ temp_min_f: 20,  is_perennial_species: false },
  PT_MUSTARD_ARUGULA:{ temp_min_f: 20, is_perennial_species: false },
  PT_KOHLRABI:      { temp_min_f: 20,  is_perennial_species: false },
  PT_RUTABAGA:      { temp_min_f: 15,  is_perennial_species: false },
  PT_PEA:           { temp_min_f: 20,  is_perennial_species: false },
  PT_CILANTRO:      { temp_min_f: 20,  is_perennial_species: false },
  PT_DILL:          { temp_min_f: 25,  is_perennial_species: false },
  PT_PARSLEY:       { temp_min_f: 10,  is_perennial_species: false },
  PT_FENNEL:        { temp_min_f: 15,  is_perennial_species: false },
  PT_SUNFLOWER:     { temp_min_f: 32,  is_perennial_species: false },
  PT_CALENDULA:     { temp_min_f: 20,  is_perennial_species: false },
  PT_BORAGE:        { temp_min_f: 25,  is_perennial_species: false },
  PT_NASTURTIUM:    { temp_min_f: 32,  is_perennial_species: false },
  // Vegetables — perennials (survive winter in right zone)
  PT_ASPARAGUS:     { temp_min_f: -40, is_perennial_species: true },
  PT_RHUBARB:       { temp_min_f: -40, is_perennial_species: true },
  PT_ARTICHOKE:     { temp_min_f:  15, is_perennial_species: true },
  PT_CHIVES:        { temp_min_f: -40, is_perennial_species: true },
  PT_GARLIC:        { temp_min_f: -20, is_perennial_species: true },
  PT_MINT:          { temp_min_f: -30, is_perennial_species: true },
  PT_OREGANO:       { temp_min_f: -10, is_perennial_species: true },
  PT_THYME:         { temp_min_f: -30, is_perennial_species: true },
  PT_ROSEMARY:      { temp_min_f:  10, is_perennial_species: true },
  PT_SAGE:          { temp_min_f: -20, is_perennial_species: true },
  PT_STRAWBERRY:    { temp_min_f: -30, is_perennial_species: true },
  PT_RASPBERRY:     { temp_min_f: -40, is_perennial_species: true },
  PT_BLACKBERRY:    { temp_min_f: -10, is_perennial_species: true },
  PT_BLUEBERRY:     { temp_min_f: -30, is_perennial_species: true },
  PT_APPLE:         { temp_min_f: -40, is_perennial_species: true },
  PT_PEAR:          { temp_min_f: -30, is_perennial_species: true },
  PT_PEACH:         { temp_min_f: -10, is_perennial_species: true },
  PT_CHERRY:        { temp_min_f: -30, is_perennial_species: true },
  PT_GRAPE:         { temp_min_f: -20, is_perennial_species: true },
  // Flowers — the main focus of this filter
  PT_ROSE:          { temp_min_f: -20, is_perennial_species: true },
  PT_PEONY:         { temp_min_f: -40, is_perennial_species: true },
  PT_HYDRANGEA:     { temp_min_f: -20, is_perennial_species: true },
  PT_TULIP:         { temp_min_f: -40, is_perennial_species: true },
  PT_DAFFODIL:      { temp_min_f: -40, is_perennial_species: true },
  PT_IRIS:          { temp_min_f: -40, is_perennial_species: true },
  PT_LILY:          { temp_min_f: -30, is_perennial_species: true },
  PT_DAYLILY:       { temp_min_f: -40, is_perennial_species: true },
  PT_LAVENDER:      { temp_min_f: -10, is_perennial_species: true },
  PT_CONEFLOWER:    { temp_min_f: -40, is_perennial_species: true },
  PT_ASTER:         { temp_min_f: -30, is_perennial_species: true },
  PT_LUPINE:        { temp_min_f: -30, is_perennial_species: true },
  PT_DAHLIA:        { temp_min_f:  28, is_perennial_species: true },  // bulb; dig in cold zones
  PT_SWEET_ALYSSUM: { temp_min_f:  20, is_perennial_species: true },
  PT_MARIGOLD:      { temp_min_f:  32, is_perennial_species: false }, // true annual
  PT_SUNFLOWER:     { temp_min_f:  32, is_perennial_species: false },
  PT_ZINNIA:        { temp_min_f:  32, is_perennial_species: false },
  PT_COSMOS:        { temp_min_f:  32, is_perennial_species: false },
  PT_CALENDULA:     { temp_min_f:  20, is_perennial_species: false },
  PT_NASTURTIUM:    { temp_min_f:  32, is_perennial_species: false },
  PT_BORAGE:        { temp_min_f:  25, is_perennial_species: false },
  // New flower types we just created
  PT_COREOPSIS:     { temp_min_f: -30, is_perennial_species: true },
  PT_GAILLARDIA:    { temp_min_f: -30, is_perennial_species: true },
  PT_SCABIOSA:      { temp_min_f: -20, is_perennial_species: true },
  PT_FORGET_ME_NOT: { temp_min_f: -20, is_perennial_species: true },
  PT_MILKWEED:      { temp_min_f: -30, is_perennial_species: true },
  PT_STATICE:       { temp_min_f: -10, is_perennial_species: true },  // perennial species exist
  PT_AMMI:          { temp_min_f:  20, is_perennial_species: false },
  PT_CELOSIA:       { temp_min_f:  32, is_perennial_species: false },
  PT_MORNING_GLORY: { temp_min_f:  32, is_perennial_species: false },
  PT_GOMPHRENA:     { temp_min_f:  32, is_perennial_species: false },
  PT_NIGELLA:       { temp_min_f:  20, is_perennial_species: false },
  PT_AMARANTH_ORNAMENTAL: { temp_min_f: 32, is_perennial_species: false },
  // Bachelors Button, Snapdragon, Sweet Pea, Larkspur, Foxglove, Hollyhock, Pansy = annuals/biennials
  PT_BACHELOR_BUTTON:  { temp_min_f:  20, is_perennial_species: false },
  PT_SNAPDRAGON:       { temp_min_f:  25, is_perennial_species: false },
  PT_SWEET_PEA:        { temp_min_f:  20, is_perennial_species: false },
  PT_LARKSPUR:         { temp_min_f:  20, is_perennial_species: false },
  PT_FOXGLOVE:         { temp_min_f: -20, is_perennial_species: true },  // biennial/perennial
  PT_HOLLYHOCK:        { temp_min_f: -30, is_perennial_species: true },  // short-lived perennial
  PT_PANSY:            { temp_min_f:  10, is_perennial_species: false },
  PT_PETUNIA:          { temp_min_f:  32, is_perennial_species: false },
  PT_IMPATIENS:        { temp_min_f:  32, is_perennial_species: false },
  PT_VERBENA:          { temp_min_f:  20, is_perennial_species: true },  // perennial in 7a+
  PT_STRAWFLOWER:      { temp_min_f:  28, is_perennial_species: false },
  PT_WAX_BEGONIA:      { temp_min_f:  32, is_perennial_species: false },
};

// Returns zone info for a plant type, matching by code then by derived name key
function getPlantTypeZoneInfo(plantType, zoneMinTemp) {
  if (zoneMinTemp === null || zoneMinTemp === undefined || !plantType) return null;
  let zd = null;
  // 1. Try plant_type_code directly
  if (plantType.plant_type_code) {
    zd = PLANT_TYPE_ZONE_MAP[plantType.plant_type_code];
  }
  // 2. Derive from common_name
  if (!zd && plantType.common_name) {
    const derived = 'PT_' + plantType.common_name
      .toUpperCase().trim()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    zd = PLANT_TYPE_ZONE_MAP[derived];
    // 3. Aliases
    if (!zd) {
      const ALIASES = {
        PT_BLANKET_FLOWER: 'PT_GAILLARDIA',
        PT_PINCUSHION_FLOWER: 'PT_SCABIOSA',
        PT_ORNAMENTAL_AMARANTH: 'PT_AMARANTH_ORNAMENTAL',
        PT_MILKWEED_ASCLEPIAS: 'PT_MILKWEED',
        PT_LOVE_IN_A_MIST: 'PT_NIGELLA',
        PT_GLOBE_AMARANTH: 'PT_GOMPHRENA',
        PT_BACHELOR_S_BUTTON: 'PT_BACHELOR_BUTTON',
      };
      if (ALIASES[derived]) zd = PLANT_TYPE_ZONE_MAP[ALIASES[derived]];
    }
  }
  if (!zd) return null; // unknown — caller decides whether to include
  const isPerennial = zd.is_perennial_species && zd.temp_min_f <= zoneMinTemp;
  return { isPerennial, temp_min_f: zd.temp_min_f };
}

// ─────────────────────────────────────────────────────────────
export default function PlantCatalog() {
  const [searchParams] = useSearchParams();

  const [plantTypes, setPlantTypes] = useState([]);
  const [allVarieties, setAllVarieties] = useState([]);
  const [allVarietiesLoaded, setAllVarietiesLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState('grid');
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);
// ── Zone state ──
const [userZone, setUserZone] = useState(null);
const [userZoneMinTemp, setUserZoneMinTemp] = useState(null);
const [showPerennialOnly, setShowPerennialOnly] = useState(false);
  // ─── Load ────────────────────────────────────────────────
  useEffect(() => {
    loadPlantTypes();
    const searchParam = searchParams.get('search');
    if (searchParam) setSearchQuery(searchParam);
  }, [searchParams]);

  // Lazy-load variety search only when user types
  useEffect(() => {
    if (debouncedSearchQuery && !allVarietiesLoaded) loadAllVarieties();
  }, [debouncedSearchQuery, allVarietiesLoaded]);

// Load zone from user object (same source as ZoneMap.jsx)
useEffect(() => {
  (async () => {
    try {
      const userData = await base44.auth.me();
      const zone = userData?.usda_zone_override || userData?.usda_zone;
      if (zone) {
        const minTemp = getZoneMinTemp(zone);
        setUserZone(parseZoneLabel(zone));
        setUserZoneMinTemp(minTemp !== null ? minTemp : null);
      }

    } catch (e) {
      console.error('[PlantCatalog] zone load error:', e);
    }
  })();
}, []);


  const loadPlantTypes = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true);

    // Clear stale cache (missing plantGroups)
    try {
      const existing = sessionStorage.getItem('plant_catalog_cache');
      if (existing) {
        const parsed = JSON.parse(existing);
        if (!parsed.plantGroups) sessionStorage.removeItem('plant_catalog_cache');
      }
    } catch { /* ignore */ }

    const cached = sessionStorage.getItem('plant_catalog_cache');
    if (cached && !isRetry) {
      try {
        const { types, browseCats, plantGroups: cGroups, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 2 * 60 * 1000) {
          setPlantTypes([
            ...buildBrowseTypes(browseCats),
            ...buildValidTypes(types, cGroups || []),
          ]);
          setLoading(false);
          return;
        }
      } catch { /* fall through */ }
    }

    try {
      const types = await smartQuery(base44, 'PlantType', {}, 'common_name', 5000);
      await delay(300);
      const browseCats = await smartQuery(base44, 'BrowseCategory', { is_active: true }, 'sort_order');
      await delay(300);
      const plantGroups = await smartQuery(base44, 'PlantGroup', {}, 'sort_order');

      sessionStorage.setItem('plant_catalog_cache', JSON.stringify({
        types, browseCats, plantGroups, timestamp: Date.now(),
      }));

      setPlantTypes([
        ...buildBrowseTypes(browseCats),
        ...buildValidTypes(types, plantGroups),
      ]);
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

  // ─── Filtering & sorting ──────────────────────────────────
  // KEY FIX: sort by section priority FIRST so all plants of the
  // same section are contiguous. Only THEN apply user's sort
  // preference within each section. This prevents dividers from
  // appearing repeatedly throughout the list.
  const filteredTypes = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase();

    return plantTypes.filter(type => {
      const matchesSearch = !q
        || (type.common_name || '').toLowerCase().includes(q)
        || (type.scientific_name || '').toLowerCase().includes(q)
        || (allVarietiesLoaded && allVarieties.some(
            v => v.plant_type_id === type.id &&
                 (v.variety_name || '').toLowerCase().includes(q)
          ));

      const matchesCategory = selectedCategory === 'all'
        || type.category === selectedCategory
        || type._is_browse_only;

      return matchesSearch && matchesCategory;



    }).filter(type => {
      if (!showPerennialOnly || userZoneMinTemp === null || userZoneMinTemp === undefined || type._is_browse_only) return true;
      const zoneInfo = getPlantTypeZoneInfo(type, userZoneMinTemp);
      if (!zoneInfo) return false;
      return zoneInfo.isPerennial;
    }).sort((a, b) => {
      // 1. Browse categories always first
      if (a._is_browse_only && b._is_browse_only) {
        return (a._sort_priority ?? 0) - (b._sort_priority ?? 0);
      }
      if (a._is_browse_only) return -1;
      if (b._is_browse_only) return 1;

      // 2. Section priority — THIS is the critical fix.
      //    Ensures all garden plants group together, then herbs,
      //    then flowers, then cover crops, then indoor.
      //    Without this, popularity/name sort interleaves sections.
      const spA = getSectionPriority(a);
      const spB = getSectionPriority(b);
      if (spA !== spB) return spA - spB;

      // 3. Within the same section, apply user's sort preference
      if (sortBy === 'name') {
        return (a.common_name || '').localeCompare(b.common_name || '');
      }
      if (sortBy === 'category') {
        return (a.category || '').localeCompare(b.category || '');
      }

      // Default: popularity (named plants first, then alphabetical)
      const ai = POPULAR_TYPES.indexOf(a.common_name);
      const bi = POPULAR_TYPES.indexOf(b.common_name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return (a.common_name || '').localeCompare(b.common_name || '');
    });
}, [plantTypes, debouncedSearchQuery, selectedCategory, sortBy,
      allVarieties, allVarietiesLoaded, showPerennialOnly, userZoneMinTemp]);

  // ─── Build render items (plants + section dividers) ───────
  // Walks the already-correctly-sorted filteredTypes and injects
  // a divider marker whenever the section changes.
  const renderItems = useMemo(() => {
    const items = [];
    let lastSection = null;

    for (const type of filteredTypes) {
      if (type._is_browse_only) {
        items.push({ kind: 'plant', data: type });
        continue;
      }

      const section = getSection(type);

      if (section !== lastSection) {
        // Insert divider for non-garden sections (garden = vegetables/fruit
        // which are the first items and need no header)
        if (SECTIONS[section]) {
          items.push({ kind: 'divider', section });
        }
        lastSection = section;
      }

      items.push({ kind: 'plant', data: type });
    }

    return items;
  }, [filteredTypes]);

  // ─── Render helpers ───────────────────────────────────────
  const renderDivider = (section, listMode = false) => {
    const cfg = SECTIONS[section];
    if (!cfg) return null;

    if (listMode) {
      return (
        <div className={`flex items-center gap-3 py-3 px-4 my-2 rounded-lg border ${cfg.borderColor} bg-white dark:bg-gray-900`}>
          <span className="text-xl">{cfg.icon}</span>
          <div>
            <h3 className={`font-bold text-sm ${cfg.textColor}`}>{cfg.title}</h3>
            <p className="text-xs text-gray-500">{cfg.subtitle}</p>
          </div>
        </div>
      );
    }

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

  // ─── Loading / empty states ───────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (plantTypes.length === 0) {
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
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search plants or varieties..."
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
              <SelectItem value="name">Sort: A–Z</SelectItem>
              <SelectItem value="category">Sort: Category</SelectItem>
            </SelectContent>
          </Select>

{userZone && (
            <Button
              variant={showPerennialOnly ? 'default' : 'outline'}
              onClick={() => setShowPerennialOnly(p => !p)}
              className={`gap-2 whitespace-nowrap ${showPerennialOnly ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
            >
              <Leaf className="w-4 h-4" />
              Zone {userZone} Perennials
            </Button>
          )}

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
          </div>        </div>

        <AdBanner placement="top_banner" pageType="catalog" />

        {/* Grid view */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <AnimatePresence>
              {renderItems.map((item, index) => {
                if (item.kind === 'divider') {
                  return (
                    <React.Fragment key={`divider-${item.section}`}>
                      {renderDivider(item.section, false)}
                    </React.Fragment>
                  );
                }

                const type = item.data;
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
                            {type.is_perennial && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">Perennial</Badge>
                            )}
                          </div>
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
          <div className="space-y-2">
            <AnimatePresence>
              {renderItems.map((item, index) => {
                if (item.kind === 'divider') {
                  return (
                    <React.Fragment key={`divider-${item.section}`}>
                      {renderDivider(item.section, true)}
                    </React.Fragment>
                  );
                }

                const type = item.data;
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
                            {type.is_perennial && <Badge variant="outline">Perennial</Badge>}
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
            <p className="text-gray-600">Try adjusting your search or filters.</p>
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
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildValidTypes(types, plantGroups) {
  return types
    .filter(t => t.id && t.common_name && t.is_active !== false && !t.notes?.includes('DEPRECATED'))
    .map(t => {
      const group = plantGroups.find(g => g.id === t.plant_group_id);
       return { ...t, plant_group_sort_order: group?.sort_order ?? 0 };
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
