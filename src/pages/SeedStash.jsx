import React, { useState, useEffect, useRef } from 'react';
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
  Calendar,
  ExternalLink,
  FileText,
  Mic
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
import { cn } from '@/lib/utils';
import AddCustomSeedDialog from '@/components/seedstash/AddCustomSeedDialog';
import AddFromCatalogDialog from '@/components/seedstash/AddFromCatalogDialog';
import ImportFromURLDialog from '@/components/seedstash/ImportFromURLDialog';
import ImportSpreadsheetDialog from '@/components/seedstash/ImportSpreadsheetDialog';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import { useDebouncedValue } from '../components/utils/useDebouncedValue';
import { getPlantTypesCached, getSubcategoriesCached } from '../components/utils/dataCache';

import { usePullToRefresh } from '@/components/utils/usePullToRefresh';
import PullToRefreshIndicator from '@/components/common/PullToRefreshIndicator';
import SeedPacketScanner from '@/components/seedstash/SeedPacketScanner';
import BarcodeScanner from '@/components/seedstash/BarcodeScanner';
import UnifiedSeedScanner from '@/components/seedstash/UnifiedSeedScanner';

// ============================================================
// RATE LIMIT PROTECTION UTILITIES
// ============================================================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Detect if an error is a rate limit (429) error.
 * Base44 can surface these in many different formats.
 */
function isRateLimitError(error) {
  if (!error) return false;
  if (error.code === 'RATE_LIMIT') return true;
  if (error.status === 429) return true;
  const msg = (error?.message || error?.toString() || '').toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('too many requests') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('throttl')
  );
}

/**
 * Execute an API call with automatic retry on rate limit errors.
 * Retries up to maxRetries times with exponential backoff.
 */
async function safeApiCall(fn, label = 'API call', maxRetries = 2) {
  let lastError;
  let backoffMs = 2000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && attempt < maxRetries) {
        console.warn(`[SeedStash] ${label} rate limited (attempt ${attempt + 1}/${maxRetries + 1}). Waiting ${backoffMs}ms...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 15000);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// In-memory cache for user object to avoid repeated auth.me() calls
let _cachedUser = null;
let _cachedUserTime = 0;
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedUser() {
  const now = Date.now();
  if (_cachedUser && (now - _cachedUserTime) < USER_CACHE_TTL) {
    return _cachedUser;
  }
  _cachedUser = await base44.auth.me();
  _cachedUserTime = now;
  return _cachedUser;
}

// In-memory cache for varieties by plant_type_id
const _varietyCache = new Map();
const VARIETY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getCachedVarieties(plantTypeId) {
  const cacheKey = `var_${plantTypeId}`;
  const cached = _varietyCache.get(cacheKey);
  if (cached && (Date.now() - cached.time) < VARIETY_CACHE_TTL) {
    return cached.data;
  }
  const vars = await safeApiCall(
    () => base44.entities.Variety.filter({ plant_type_id: plantTypeId, status: 'active' }, 'variety_name'),
    `Varieties for ${plantTypeId}`
  );
  _varietyCache.set(cacheKey, { data: vars, time: Date.now() });
  return vars;
}

// ============================================================
// COMPONENT
// ============================================================

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
  const [showAddCustomDialog, setShowAddCustomDialog] = useState(false);
  const [showAddFromCatalogDialog, setShowAddFromCatalogDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSeed, setEditingSeed] = useState(null);
  const [showPacketScanner, setShowPacketScanner] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showUnifiedScanner, setShowUnifiedScanner] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [filterTab, setFilterTab] = useState('stash');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [filterType, setFilterType] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [varieties, setVarieties] = useState([]);
  const [selectedPlantType, setSelectedPlantType] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    type: true,
    source: true,
    year: true,
    age: true,
    maturity: true,
    spacing: true,
    quantity: true,
    tags: true
  });
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [settings, setSettings] = useState({ aging_threshold_years: 2, old_threshold_years: 3 });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  // Prevent double-loading
  const loadingRef = useRef(false);

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
    lot_images: [],
    is_wishlist: false
  });

  const { isPulling, pullDistance, isRefreshing } = usePullToRefresh(async () => {
    await loadData();
    toast.success('Seeds refreshed');
  });

  useEffect(() => {
    loadData();
    // NOTE: loadViewPreference is now MERGED into loadData() to avoid duplicate auth.me() calls
  }, []);

  // ==========================================================
  // FIX: MERGED loadViewPreference INTO loadData
  // Old code called loadData() AND loadViewPreference() simultaneously,
  // both calling base44.auth.me() — instant double API hit on every page load.
  // Now loadData() handles settings loading too, sequentially with delays.
  // ==========================================================

  const loadData = async (isRetry = false) => {
    // Prevent concurrent loads
    if (loadingRef.current && !isRetry) return;
    loadingRef.current = true;

    if (isRetry) setRetrying(true);
    
    try {
      console.log('[SeedStash] Loading data...');

      // STEP 1: Get user (cached — avoids redundant auth.me() calls)
      const user = await getCachedUser();
      
      // STEP 2: Load seeds
      const seedsData = await safeApiCall(
        () => smartQuery(base44, 'SeedLot', { created_by: user.email }, '-created_date'),
        'Load seeds'
      );
      
      // Small delay before next API call to stay under rate limit
      await sleep(300);
      
      // STEP 3: Extract unique profile IDs and batch fetch
      const uniqueProfileIds = [...new Set(seedsData.map(s => s.plant_profile_id).filter(Boolean))];
      
      let profilesData = [];
      if (uniqueProfileIds.length > 0) {
        profilesData = await safeApiCall(
          () => base44.entities.PlantProfile.filter({ id: { $in: uniqueProfileIds } }),
          'Load profiles'
        );
      }
      
      await sleep(300);
      
      // STEP 4: Use cached plant types (from dataCache utility)
      const typesData = await getPlantTypesCached(() => 
        smartQuery(base44, 'PlantType', {}, 'common_name')
      );
      
      await sleep(300);

      // STEP 5: Load user settings (view pref + aging thresholds)
      // This was previously a SEPARATE loadViewPreference() call that duplicated auth.me()
      try {
        const userSettings = await safeApiCall(
          () => base44.entities.UserSettings.filter({ created_by: user.email }),
          'Load settings'
        );
        if (userSettings.length > 0) {
          const s = userSettings[0];
          if (s.seed_stash_view_mode) setViewMode(s.seed_stash_view_mode);
          if (s.aging_threshold_years) setSettings({ 
            aging_threshold_years: s.aging_threshold_years,
            old_threshold_years: s.old_threshold_years || 3
          });
        }
      } catch (settingsErr) {
        // Non-critical — use defaults silently
        console.warn('[SeedStash] Settings load failed (non-critical):', settingsErr.message);
      }

      console.log('[SeedStash] Loaded:', seedsData.length, 'lots,', profilesData.length, 'profiles');
      setSeeds(seedsData);
      setPlantTypes(typesData.filter(t => t.common_name && t.common_name.trim()));
      
      const profilesMap = {};
      profilesData.forEach(p => {
        profilesMap[p.id] = p;
      });
      setProfiles(profilesMap);
      setRateLimitError(null);
    } catch (error) {
      console.error('[SeedStash] Error loading seed stash:', error);
      if (isRateLimitError(error)) {
        setRateLimitError(error);
        // Auto-retry after delay
        setTimeout(() => loadData(true), 5000);
      }
    } finally {
      setLoading(false);
      setRetrying(false);
      loadingRef.current = false;
    }
  };

  const saveViewPreference = async (mode) => {
    try {
      const user = await getCachedUser(); // FIX: was base44.auth.me() — uses cache now
      const userSettings = await safeApiCall(
        () => base44.entities.UserSettings.filter({ created_by: user.email }),
        'Save view pref - filter'
      );
      if (userSettings.length > 0) {
        await safeApiCall(
          () => base44.entities.UserSettings.update(userSettings[0].id, { seed_stash_view_mode: mode }),
          'Save view pref - update'
        );
      } else {
        await safeApiCall(
          () => base44.entities.UserSettings.create({ seed_stash_view_mode: mode }),
          'Save view pref - create'
        );
      }
    } catch (error) {
      console.warn('[SeedStash] Error saving view preference (non-critical):', error.message);
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    saveViewPreference(mode);
  };

  const getAge = (seed) => {
    const currentYear = new Date().getFullYear();
    const year = seed.packed_for_year || seed.year_acquired;
    return year ? currentYear - year : 0;
  };

  const getAgeStatus = (seed) => {
    const age = getAge(seed);
    if (age >= settings.old_threshold_years) return { status: 'OLD', color: 'red', icon: Star };
    if (age >= settings.aging_threshold_years) return { status: 'AGING', color: 'amber', icon: AlertTriangle };
    return { status: 'OK', color: 'green', icon: null };
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
        // FIX: Use cached varieties with rate limit protection
        const vars = await getCachedVarieties(plantTypeId);
        setVarieties(vars);
      } catch (error) {
        console.error('[SeedStash] Error loading varieties:', error);
        setVarieties([]);
      }
    } else {
      setVarieties([]);
    }
  };

  const handleVarietyChange = async (varietyId) => {
    const variety = varieties.find(v => v.id === varietyId);
    if (!variety) return;

    try {
      // FIX: Wrapped in safeApiCall with delay between calls
      const existingProfiles = await safeApiCall(
        () => base44.entities.PlantProfile.filter({
          variety_name: variety.variety_name,
          plant_type_id: variety.plant_type_id
        }),
        'Find profile for variety'
      );
      
      let profileId;
      if (existingProfiles.length > 0) {
        profileId = existingProfiles[0].id;
      } else {
        await sleep(500); // Delay before create
        const plantType = plantTypes.find(t => t.id === variety.plant_type_id);
        const newProfile = await safeApiCall(
          () => base44.entities.PlantProfile.create({
            plant_type_id: variety.plant_type_id,
            common_name: plantType?.common_name,
            variety_name: variety.variety_name,
            days_to_maturity_seed: variety.days_to_maturity,
            spacing_in_min: variety.spacing_recommended,
            spacing_in_max: variety.spacing_recommended,
            source_type: 'user_private'
          }),
          'Create profile for variety'
        );
        profileId = newProfile.id;
        setProfiles(prev => ({ ...prev, [profileId]: newProfile }));
      }
      
      setFormData(prev => ({ ...prev, plant_profile_id: profileId }));
    } catch (error) {
      console.error('[SeedStash] Error in handleVarietyChange:', error);
      toast.error('Error selecting variety. Please try again.');
    }
  };

  const [submitting, setSubmitting] = useState(false);

const handleSubmit = async () => {
  if (!formData.plant_profile_id) {
    toast.error('Please select a variety');
    return;
  }
  
  if (submitting) return;
  setSubmitting(true);

  try {
    if (editingSeed) {
      await safeApiCall(
        () => base44.entities.SeedLot.update(editingSeed.id, formData),
        'Update seed'
      );
      toast.success('Seed updated!');
    } else {
      const newSeed = await safeApiCall(
        () => base44.entities.SeedLot.create(formData),
        'Create seed'
      );
      // INSTANT UPDATE: Add to local state immediately
      setSeeds(prev => [newSeed, ...prev]);
      toast.success(formData.is_wishlist ? 'Added to wishlist!' : 'Seed added to stash!');
    }
    closeDialog();
    
    // Background refresh to ensure sync (without blocking UI)
    await sleep(500);
    loadingRef.current = false; // Reset the guard
    loadData();
  } catch (error) {
    console.error('[SeedStash] Error saving seed:', error);
    toast.error('Failed to save seed');
  } finally {
    setSubmitting(false);
  }
};

  // ==========================================================
  // FIX: Simplified handleDelete to avoid unnecessary API calls
  // Old code called base44.auth.me() + PlantInstance.filter() on EVERY delete
  // just to show a slightly different confirm message. Not worth 2 extra API calls.
  // ==========================================================
  const handleDelete = async (seed) => {
    const profile = profiles[seed.plant_profile_id];
    const seedName = profile?.variety_name || seed.custom_label || 'this seed';
    
    if (!confirm(`Delete "${seedName}" from your seed stash?`)) return;
    
    try {
      await safeApiCall(
        () => base44.entities.SeedLot.delete(seed.id),
        'Delete seed'
      );
      setSeeds(prev => prev.filter(s => s.id !== seed.id));
      toast.success('Seed deleted');
    } catch (error) {
      console.error('[SeedStash] Error deleting seed:', error);
      toast.error('Failed to delete seed');
    }
  };

  const handleToggleWishlist = async (seed) => {
    try {
      await safeApiCall(
        () => base44.entities.SeedLot.update(seed.id, { is_wishlist: !seed.is_wishlist }),
        'Toggle wishlist'
      );
      setSeeds(prev => prev.map(s => s.id === seed.id ? { ...s, is_wishlist: !s.is_wishlist } : s));
      toast.success(seed.is_wishlist ? 'Moved to stash' : 'Moved to wishlist');
    } catch (error) {
      console.error('[SeedStash] Error updating seed:', error);
      toast.error('Failed to update');
    }
  };

  const handleToggleTag = async (seed, tag) => {
    const newTags = seed.tags?.includes(tag) 
      ? seed.tags.filter(t => t !== tag)
      : [...(seed.tags || []), tag];
    
    try {
      await safeApiCall(
        () => base44.entities.SeedLot.update(seed.id, { tags: newTags }),
        'Update tags'
      );
      setSeeds(prev => prev.map(s => s.id === seed.id ? { ...s, tags: newTags } : s));
    } catch (error) {
      console.error('[SeedStash] Error updating tags:', error);
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
      lot_images: seed.lot_images || [],
      is_wishlist: seed.is_wishlist || false
    });

    if (profile?.plant_type_id) {
      try {
        const type = plantTypes.find(t => t.id === profile.plant_type_id);
        setSelectedPlantType(type);
        // FIX: Use cached varieties with rate limit protection
        const vars = await getCachedVarieties(profile.plant_type_id);
        setVarieties(vars);
      } catch (error) {
        console.error('[SeedStash] Error loading varieties for edit:', error);
      }
    }

    setShowAddDialog(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await safeApiCall(
        () => base44.integrations.Core.UploadFile({ file }),
        'Upload photo'
      );
      setFormData(prev => ({ 
        ...prev, 
        lot_images: [...(prev.lot_images || []), file_url] 
      }));
      toast.success('Photo added');
    } catch (error) {
      console.error('[SeedStash] Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Escape closes modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showAddDialog) closeDialog();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showAddDialog]);

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
      lot_images: [],
      is_wishlist: false
    });
  };

  const filteredSeeds = seeds
    .filter(seed => {
      // Tab filter
      if (filterTab === 'stash' && seed.is_wishlist) return false;
      if (filterTab === 'wishlist' && !seed.is_wishlist) return false;

      const profile = profiles[seed.plant_profile_id];
      if (!profile && seed.plant_profile_id) return false;

      // Search filter
      const searchLower = debouncedSearchQuery.toLowerCase();
      if (debouncedSearchQuery) {
        const varietyName = (profile?.variety_name || '').toLowerCase();
        const commonName = (profile?.common_name || '').toLowerCase();
        const customLabel = (seed.custom_label || '').toLowerCase();
        const plantTypeName = (seed.plant_type_name || '').toLowerCase();
        
        const matchesSearch = varietyName.includes(searchLower) || 
                             commonName.includes(searchLower) || 
                             customLabel.includes(searchLower) ||
                             plantTypeName.includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      if (filterType !== 'all' && profile?.common_name !== filterType) return false;
      if (filterTag !== 'all' && !seed.tags?.includes(filterTag)) return false;

      return true;
    })
    .sort((a, b) => {
      const profileA = profiles[a.plant_profile_id];
      const profileB = profiles[b.plant_profile_id];
      
      let result = 0;
      
      if (sortBy === 'name') {
        const nameA = (profileA?.variety_name || a.custom_label || '').toLowerCase();
        const nameB = (profileB?.variety_name || b.custom_label || '').toLowerCase();
        result = nameA.localeCompare(nameB);
      } else if (sortBy === 'type') {
        const typeA = profileA?.common_name || '';
        const typeB = profileB?.common_name || '';
        result = typeA.localeCompare(typeB);
      } else if (sortBy === 'source') {
        const sourceA = a.source_vendor_name || '';
        const sourceB = b.source_vendor_name || '';
        result = sourceA.localeCompare(sourceB);
      } else if (sortBy === 'year') {
        result = (a.year_acquired || 0) - (b.year_acquired || 0);
      } else if (sortBy === 'age') {
        result = getAge(b) - getAge(a);
      } else if (sortBy === 'maturity') {
        const matA = profileA?.days_to_maturity_seed || 999;
        const matB = profileB?.days_to_maturity_seed || 999;
        result = matA - matB;
      } else if (sortBy === 'spacing') {
        const spaceA = profileA?.spacing_in_min || 999;
        const spaceB = profileB?.spacing_in_min || 999;
        result = spaceA - spaceB;
      } else if (sortBy === 'quantity') {
        result = (b.quantity || 0) - (a.quantity || 0);
      } else if (sortBy === 'created_date') {
        result = new Date(a.created_date || 0) - new Date(b.created_date || 0);
      }
      
      return sortOrder === 'asc' ? result : -result;
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
    <>
      <PullToRefreshIndicator 
        isPulling={isPulling} 
        pullDistance={pullDistance} 
        isRefreshing={isRefreshing} 
      />
      <div className="space-y-6">
        {rateLimitError && (
          <RateLimitBanner 
            retryInMs={rateLimitError.retryInMs || 5000} 
            onRetry={() => loadData(true)}
            retrying={retrying}
          />
        )}
        
        <div className="flex flex-col gap-3 lg:gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl lg:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Seed Stash</h1>
              <p className="mt-1 text-xs lg:text-sm" style={{ color: 'var(--text-secondary)' }}>Track your seeds and wishlist</p>
            </div>
          </div>
        
        {/* Compact Mobile Action Row */}
        <div className="flex gap-1.5 lg:gap-2 flex-wrap">
           <Button 
             onClick={() => setShowUnifiedScanner(true)}
             size="sm"
             className="bg-blue-600 hover:bg-blue-700 gap-1 lg:gap-2 text-xs lg:text-sm h-8 lg:h-9"
           >
             <span className="hidden sm:inline">📷 Scan Seed Packet</span>
             <span className="sm:hidden">📷 Scan</span>
           </Button>

           <Button 
             onClick={() => setShowAddCustomDialog(true)}
             size="sm"
             className="bg-emerald-600 hover:bg-emerald-700 gap-1 lg:gap-2 text-xs lg:text-sm h-8 lg:h-9"
           >
             <Plus className="w-3 h-3 lg:w-4 lg:h-4" />
             <span className="hidden sm:inline">Add My Own Seeds</span>
             <span className="sm:hidden">Add</span>
           </Button>
           <Button 
             onClick={() => setShowAddFromCatalogDialog(true)}
             variant="outline"
             size="sm"
             className="gap-1 lg:gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs lg:text-sm h-8 lg:h-9"
           >
             <Package className="w-3 h-3 lg:w-4 lg:h-4" />
             <span className="hidden sm:inline">Add from Catalog</span>
             <span className="sm:hidden">Catalog</span>
           </Button>
           <Button 
             onClick={() => setShowImportDialog(true)}
             variant="outline"
             size="sm"
             className="gap-1 lg:gap-2 text-xs lg:text-sm h-8 lg:h-9 hidden md:flex"
           >
             <FileText className="w-3 h-3 lg:w-4 lg:h-4" />
             <span className="hidden lg:inline">Import Spreadsheet</span>
             <span className="lg:hidden">Import</span>
           </Button>
         </div>
      </div>

      <AdBanner placement="top_banner" pageType="seed_stash" />

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4">
        <Tabs value={filterTab} onValueChange={setFilterTab}>
          <TabsList className="h-8 lg:h-9">
            <TabsTrigger value="stash" className="gap-1 lg:gap-2 text-xs lg:text-sm px-2 lg:px-3">
              <Package className="w-3 h-3 lg:w-4 lg:h-4" />
              <span className="hidden sm:inline">Stash ({stashCount})</span>
              <span className="sm:hidden">({stashCount})</span>
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="gap-1 lg:gap-2 text-xs lg:text-sm px-2 lg:px-3">
              <Heart className="w-3 h-3 lg:w-4 lg:h-4" />
              <span className="hidden sm:inline">Wishlist ({wishlistCount})</span>
              <span className="sm:hidden">({wishlistCount})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1 lg:gap-2">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('grid')}
            className="h-8 w-8 lg:h-9 lg:w-9 p-0"
          >
            <Grid3X3 className="w-3 h-3 lg:w-4 lg:h-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('table')}
            className="h-8 w-8 lg:h-9 lg:w-9 p-0"
          >
            <List className="w-3 h-3 lg:w-4 lg:h-4" />
          </Button>
          {viewMode === 'table' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumnChooser(true)}
              className="gap-1 lg:gap-2 hidden sm:flex text-xs lg:text-sm h-8 lg:h-9"
            >
              <Filter className="w-3 h-3 lg:w-4 lg:h-4" />
              <span className="hidden lg:inline">Columns</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters & Sorting */}
      <div className="flex flex-col sm:flex-row gap-2 lg:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 lg:left-3 top-1/2 -translate-y-1/2 w-3 h-3 lg:w-4 lg:h-4 text-gray-400" />
          <Input
            placeholder="Search seeds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 lg:pl-10 text-xs lg:text-sm h-8 lg:h-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-32 lg:w-40 text-xs lg:text-sm h-8 lg:h-9">
            <SelectValue placeholder="All Types" />
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
          <SelectTrigger className="w-full sm:w-28 lg:w-40 text-xs lg:text-sm h-8 lg:h-9">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {TAGS.map((tag) => (
              <SelectItem key={tag.value} value={tag.value}>{tag.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 lg:gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-32 lg:w-48 text-xs lg:text-sm h-8 lg:h-9">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="type">Crop Type</SelectItem>
              <SelectItem value="age">Seed Age</SelectItem>
              <SelectItem value="year">Year Acquired</SelectItem>
              <SelectItem value="maturity">Days to Maturity</SelectItem>
              <SelectItem value="spacing">Spacing</SelectItem>
              <SelectItem value="source">Vendor</SelectItem>
              <SelectItem value="quantity">Quantity</SelectItem>
              <SelectItem value="created_date">Date Added</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            className="h-8 w-8 lg:h-9 lg:w-9 p-0"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      {/* Seeds Display */}
      {filteredSeeds.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Package className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {filterTab === 'wishlist' ? 'No wishlist items' : 'No seeds yet'}
            </h3>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              {filterTab === 'wishlist' 
                ? 'Add seeds you want to buy' 
                : 'Add your first seeds to track your collection'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button 
                onClick={() => setShowAddCustomDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add My Own Seeds
              </Button>
              <Button 
                onClick={() => setShowAddFromCatalogDialog(true)}
                variant="outline"
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              >
                <Package className="w-4 h-4 mr-2" />
                Add from Catalog
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredSeeds.map((seed, index) => {
              const ageStatus = getAgeStatus(seed);
              const age = getAge(seed);
              return (
              <motion.div
                key={seed.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link to={createPageUrl('SeedStashDetail') + `?id=${seed.id}`}>
                  <Card 
                    className={cn(
                      "group transition-all duration-300 cursor-pointer",
                      ageStatus.status === 'AGING' && "border-amber-300 dark:border-amber-600",
                      ageStatus.status === 'OLD' && "border-red-300 dark:border-red-600"
                    )}
                    style={{ 
                      background: ageStatus.status === 'AGING' ? 'var(--badge-warning-bg)' : 
                                  ageStatus.status === 'OLD' ? 'var(--badge-danger-bg)' : undefined
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                       <div className="flex-1 min-w-0">
                         {(() => {
                           const profile = profiles[seed.plant_profile_id];
                           return (
                             <>
                               <div className="flex items-center gap-2">
                                 <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                   {profile?.variety_name || seed.custom_label || 'Unknown'}
                                 </h3>
                                 {ageStatus.status !== 'OK' && (
                                   <Badge variant="outline" className={cn(
                                     "text-xs",
                                     ageStatus.status === 'AGING' && "border-amber-500 text-amber-700",
                                     ageStatus.status === 'OLD' && "border-red-500 text-red-700"
                                   )}>
                                     {ageStatus.icon && <ageStatus.icon className="w-3 h-3 mr-1" />}
                                     {age}yr
                                   </Badge>
                                 )}
                               </div>
                               {profile?.common_name && (
                                 <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{profile.common_name}</p>
                               )}
                             </>
                           );
                         })()}
                       </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); openEditDialog(seed); }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleToggleWishlist(seed); }}>
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
                            onClick={(e) => { e.preventDefault(); handleDelete(seed); }}
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
                        <p style={{ color: 'var(--text-secondary)' }}>{seed.source_vendor_name}</p>
                      )}
                      <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
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
                          onClick={(e) => { e.preventDefault(); handleToggleTag(seed, tag.value); }}
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
                    </Link>
                    </motion.div>
                    );
                    })}
                    </AnimatePresence>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.name && (
                  <TableHead 
                    className="cursor-pointer group"
                    style={{
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('name');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortBy === 'name' ? (
                        <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <span className="text-xs text-gray-300 group-hover:text-gray-400">⇅</span>
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.type && (
                 <TableHead 
                   className="cursor-pointer group"
                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                   onClick={() => {
                      if (sortBy === 'type') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('type');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Type
                      {sortBy === 'type' ? (
                        <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <span className="text-xs text-gray-300 group-hover:text-gray-400">⇅</span>
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.source && (
                 <TableHead 
                   className="cursor-pointer group"
                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                   onClick={() => {
                      if (sortBy === 'source') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('source');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Source
                      {sortBy === 'source' ? (
                        <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <span className="text-xs text-gray-300 group-hover:text-gray-400">⇅</span>
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.year && (
                 <TableHead 
                   className="cursor-pointer group"
                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                   onClick={() => {
                      if (sortBy === 'year') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('year');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Year
                      {sortBy === 'year' ? (
                        <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <span className="text-xs text-gray-300 group-hover:text-gray-400">⇅</span>
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.age && (
                 <TableHead 
                   className="cursor-pointer group"
                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                   onClick={() => {
                      if (sortBy === 'age') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('age');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Age
                      {sortBy === 'age' ? (
                        <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <span className="text-xs text-gray-300 group-hover:text-gray-400">⇅</span>
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.maturity && (
                 <TableHead 
                   className="cursor-pointer group"
                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                   onClick={() => {
                      if (sortBy === 'maturity') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('maturity');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      DTM
                      {sortBy === 'maturity' ? (
                        <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <span className="text-xs text-gray-300 group-hover:text-gray-400">⇅</span>
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.spacing && (
                 <TableHead 
                   className="cursor-pointer group"
                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                   onClick={() => {
                      if (sortBy === 'spacing') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('spacing');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Spacing
                      {sortBy === 'spacing' ? (
                        <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <span className="text-xs text-gray-300 group-hover:text-gray-400">⇅</span>
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.quantity && (
                 <TableHead 
                   className="cursor-pointer group"
                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                   onClick={() => {
                      if (sortBy === 'quantity') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('quantity');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Quantity
                      {sortBy === 'quantity' ? (
                        <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <span className="text-xs text-gray-300 group-hover:text-gray-400">⇅</span>
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.tags && <TableHead>Tags</TableHead>}
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSeeds.map((seed) => {
                const profile = profiles[seed.plant_profile_id];
                const ageStatus = getAgeStatus(seed);
                const age = getAge(seed);
                return (
                <TableRow 
                  key={seed.id} 
                  className={cn(
                    "cursor-pointer transition-colors",
                    ageStatus.status === 'AGING' && "bg-amber-50/30 dark:bg-amber-900/10",
                    ageStatus.status === 'OLD' && "bg-red-50/30 dark:bg-red-900/10"
                  )}
                  style={{
                    background: ageStatus.status === 'OK' ? 'transparent' : undefined
                  }}
                  onClick={() => window.location.href = createPageUrl('SeedStashDetail') + `?id=${seed.id}`}
                >
                  {visibleColumns.name && (
                    <TableCell className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {profile?.variety_name || seed.custom_label || 'Unknown'}
                    </TableCell>
                  )}
                  {visibleColumns.type && (
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{profile?.common_name || '-'}</TableCell>
                  )}
                  {visibleColumns.source && (
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{seed.source_vendor_name || '-'}</TableCell>
                  )}
                  {visibleColumns.year && (
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{seed.year_acquired || '-'}</TableCell>
                  )}
                  {visibleColumns.age && (
                    <TableCell>
                      {age > 0 ? (
                        <Badge variant="outline" className={cn(
                          ageStatus.status === 'AGING' && "border-amber-500 text-amber-700",
                          ageStatus.status === 'OLD' && "border-red-500 text-red-700"
                        )}>
                          {ageStatus.icon && <ageStatus.icon className="w-3 h-3 mr-1" />}
                          {age}yr
                        </Badge>
                      ) : '-'}
                    </TableCell>
                  )}
                  {visibleColumns.maturity && (
                    <TableCell style={{ color: 'var(--text-secondary)' }}>{profile?.days_to_maturity_seed ? `${profile.days_to_maturity_seed}d` : '-'}</TableCell>
                  )}
                  {visibleColumns.spacing && (
                    <TableCell style={{ color: 'var(--text-secondary)' }}>
                      {profile?.spacing_in_min && profile?.spacing_in_max
                        ? `${profile.spacing_in_min}-${profile.spacing_in_max}"`
                        : profile?.spacing_in_min || '-'
                      }
                    </TableCell>
                  )}
                  {visibleColumns.quantity && (
                    <TableCell style={{ color: 'var(--text-secondary)' }}>
                      {seed.quantity ? `${seed.quantity} ${seed.unit}` : '-'}
                    </TableCell>
                  )}
                  {visibleColumns.tags && (
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
                  )}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(seed); }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(seed); }} className="text-red-600">
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
                    <SelectContent className="max-h-64">
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
                value={formData.source_vendor_url}
                onChange={(e) => setFormData({ ...formData, source_vendor_url: e.target.value })}
                placeholder="pepperseeds.net or www.example.com"
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

            <div>
              <Label>Photos (optional)</Label>
              <div className="mt-2 space-y-2">
                {formData.lot_images?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {formData.lot_images.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="Seed" className="w-full h-20 object-cover rounded-lg" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            const updated = formData.lot_images.filter((_, i) => i !== idx);
                            setFormData({ ...formData, lot_images: updated });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingPhoto}
                  onClick={() => document.getElementById('stash-photo-upload').click()}
                  className="w-full"
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Photo
                </Button>
                <input
                  id="stash-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
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
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {editingSeed ? 'Saving...' : 'Adding...'}
                </>
              ) : (
                editingSeed ? 'Save Changes' : 'Add Seed'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Dialogs */}
      <AddCustomSeedDialog 
        open={showAddCustomDialog}
        onOpenChange={(open) => {
          setShowAddCustomDialog(open);
          if (!open) setScannedData(null);
        }}
        onSuccess={loadData}
        prefilledData={scannedData}
      />

      <AddFromCatalogDialog 
        open={showAddFromCatalogDialog}
        onOpenChange={setShowAddFromCatalogDialog}
        onSuccess={loadData}
      />

      <ImportSpreadsheetDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={loadData}
      />

      {/* Packet Scanner */}
      {showPacketScanner && (
        <SeedPacketScanner
          onScanComplete={(data) => {
            console.log('[SeedStash] Packet scanned:', data);
            setShowPacketScanner(false);
            setScannedData(data);
            setTimeout(() => {
              setShowAddCustomDialog(true);
            }, 100);
          }}
          onClose={() => {
            setShowPacketScanner(false);
            setScannedData(null);
          }}
        />
      )}

      {/* Unified Scanner */}
      {showUnifiedScanner && (
        <UnifiedSeedScanner
          onScanComplete={(result) => {
            console.log('[SeedStash] Scan complete:', result);
            setShowUnifiedScanner(false);
            loadData();
          }}
          onClose={() => setShowUnifiedScanner(false)}
        />
      )}

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScanComplete={(product) => {
            console.log('[SeedStash] Barcode scanned:', product);
            setShowBarcodeScanner(false);
            loadData();
          }}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* Column Chooser Dialog */}
      <Dialog open={showColumnChooser} onOpenChange={setShowColumnChooser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Visible Columns</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={visibleColumns.name}
                onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, name: checked })}
              />
              <span>Name</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={visibleColumns.type}
                onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, type: checked })}
              />
              <span>Type</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={visibleColumns.source}
                onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, source: checked })}
              />
              <span>Source</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={visibleColumns.year}
                onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, year: checked })}
              />
              <span>Year</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={visibleColumns.age}
                onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, age: checked })}
              />
              <span>Age</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={visibleColumns.maturity}
                onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, maturity: checked })}
              />
              <span>Days to Maturity</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={visibleColumns.spacing}
                onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, spacing: checked })}
              />
              <span>Spacing</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={visibleColumns.quantity}
                onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, quantity: checked })}
              />
              <span>Quantity</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={visibleColumns.tags}
                onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, tags: checked })}
              />
              <span>Tags</span>
            </label>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowColumnChooser(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
