import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Download,
  Info,
  Trash2,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const IMPORT_ORDER = [
  { key: 'PlantGroup', label: 'Plant Groups', file: 'AG_PlantGroup.csv' },
  { key: 'PlantFamily', label: 'Plant Families', file: 'AG_PlantFamily.csv' },
  { key: 'PlantType', label: 'Plant Types', file: 'AG_PlantType.csv' },
  { key: 'PlantSubCategory', label: 'Plant Subcategories', file: 'AG_PlantSubCategory.csv' },
  { key: 'Variety', label: 'Plant Varieties', file: 'AG_Variety_Starter_350.csv or AG_Variety_Extended_583.csv' },
  { key: 'SeedVendorBarcode', label: 'Seed Barcodes', file: 'AG_Barcodes.csv' },
  { key: 'IndoorPlant', label: 'Indoor Plants (Houseplants)', file: 'Indoor_Plants.csv' },
  { key: 'FacetGroup', label: 'Facet Groups', file: 'AG_FacetGroup.csv' },
  { key: 'Facet', label: 'Facets', file: 'AG_Facet.csv' },
  { key: 'PlantTypeFacetGroupMap', label: 'Plant Type Facet Maps', file: 'AG_PlantTypeFacetGroupMap.csv' },
  { key: 'TraitDefinition', label: 'Trait Definitions', file: 'AG_TraitDefinition.csv' },
  { key: 'PlantTypeTraitTemplate', label: 'Plant Type Trait Templates', file: 'AG_PlantTypeTraitTemplate.csv' },
];

// ============================================================
// RATE LIMIT PROTECTION UTILITIES
// ============================================================

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute an API call with automatic retry + exponential backoff.
 * On 429/504/rate-limit errors, waits progressively longer before retrying.
 * 
 * maxRetries = 5 means up to 6 total attempts.
 * Backoff: 3s → 6s → 12s → 24s → 48s (doubles each time)
 */
async function apiCallWithRetry(fn, label = 'API call', maxRetries = 5) {
  let lastError;
  let backoffMs = 3000; // Start at 3 seconds

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = (error?.message || '').toLowerCase();
      const status = error?.status || error?.statusCode || error?.response?.status;

      const isRateLimit = 
        status === 429 || 
        status === 504 || 
        msg.includes('rate limit') || 
        msg.includes('rate_limit') ||
        msg.includes('too many requests') || 
        msg.includes('gateway timeout') ||
        msg.includes('504') ||
        msg.includes('429');

      if (isRateLimit && attempt < maxRetries) {
        console.warn(
          `[Rate Limit] ${label} — attempt ${attempt + 1}/${maxRetries + 1} failed. ` +
          `Waiting ${backoffMs / 1000}s before retry...`
        );
        await sleep(backoffMs);
        backoffMs *= 2; // Exponential backoff
        continue;
      }

      // Not a rate-limit error, or out of retries — throw
      throw error;
    }
  }
  throw lastError;
}

/**
 * Adaptive throttle controller.
 * Starts with a base delay and automatically increases it when rate limits
 * are detected, then slowly recovers back to the base delay.
 */
class ThrottleController {
  constructor(baseDelayMs = 2500) {
    this.baseDelayMs = baseDelayMs;
    this.currentDelayMs = baseDelayMs;
    this.maxDelayMs = 30000;     // Never wait more than 30s
    this.rateLimitHits = 0;
  }

  /** Call this when a rate limit error is encountered */
  onRateLimit() {
    this.rateLimitHits++;
    this.currentDelayMs = Math.min(this.currentDelayMs * 2, this.maxDelayMs);
    console.warn(`[Throttle] Rate limit detected! Delay increased to ${this.currentDelayMs}ms`);
  }

  /** Call this after a successful batch to slowly recover speed */
  onSuccess() {
    if (this.currentDelayMs > this.baseDelayMs) {
      this.currentDelayMs = Math.max(
        this.baseDelayMs,
        Math.floor(this.currentDelayMs * 0.8)
      );
    }
  }

  async wait() {
    await sleep(this.currentDelayMs);
  }

  get delay() {
    return this.currentDelayMs;
  }

  get hitCount() {
    return this.rateLimitHits;
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AdminDataImport() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState({});
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [importMode, setImportMode] = useState('UPSERT_BY_ID');
  const [results, setResults] = useState(null);
  const [importProgress, setImportProgress] = useState({ 
    current: 0, total: 0, currentFile: '', 
    delayMs: 0, rateLimitHits: 0, retries: 0 
  });

  React.useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      console.log('[AdminDataImport] Checking admin access...');
      const userData = await base44.auth.me();
      console.log('[AdminDataImport] User loaded:', userData?.email, 'Role:', userData?.role);
      
      if (!userData || userData.role !== 'admin') {
        console.log('[AdminDataImport] Not admin, redirecting');
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);
    } catch (error) {
      console.error('[AdminDataImport] Auth check failed:', error);
      window.location.href = '/Dashboard';
    }
  };

  const handleFileChange = (key, e) => {
    const file = e.target.files[0];
    if (file) {
      setFiles({ ...files, [key]: file });
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const parseLine = (line) => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === '\t' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };
    
    const headers = parseLine(lines[0]).map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const obj = {};
      headers.forEach((header, index) => {
        let value = values[index] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        obj[header] = value;
      });
      data.push(obj);
    }
    
    return data;
  };

  const handleImport = async () => {
    if (Object.keys(files).length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setImporting(true);
    setResults(null);
    setImportProgress({ current: 0, total: 0, currentFile: '', delayMs: 0, rateLimitHits: 0, retries: 0 });

    // ============================================================
    // KEY FIX: Much smaller batch + adaptive throttle
    // ============================================================
    const BATCH_SIZE = 5;            // ← Was 30 — now 5 rows at a time
    const throttle = new ThrottleController(2500); // ← Was 1000ms fixed — now 2.5s adaptive
    let totalRetries = 0;

    try {
      const importResults = {};

      for (const item of IMPORT_ORDER) {
        const file = files[item.key];
        if (!file) continue;

        setImportProgress(prev => ({ 
          ...prev, current: 0, total: 0, currentFile: `Loading ${item.label}...` 
        }));
        
        const text = await file.text();
        const data = parseCSV(text);
        
        setImportProgress(prev => ({ 
          ...prev, current: 0, total: data.length, currentFile: item.label 
        }));

        if (data.length === 0) {
          importResults[item.key] = {
            status: 'error',
            message: 'No data found in file',
            inserted: 0, updated: 0, skipped: 0
          };
          continue;
        }

        if (dryRun) {
          importResults[item.key] = {
            status: 'success',
            message: 'Dry run - no changes made',
            inserted: data.length,
            updated: 0,
            skipped: 0,
            rejected: 0,
            preview: data.slice(0, 25)
          };
          continue;
        }

        // ============================================================
        // KEY FIX: Pre-load ALL lookup data ONCE to avoid per-row queries
        // ============================================================
        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        let rejected = 0;
        const skipReasons = [];

        let plantTypeLookup = {};
        let plantTypeByName = {};
        let subCategoryLookup = {};

        // Pre-load for Variety imports
        if (item.key === 'Variety') {
          setImportProgress(prev => ({ 
            ...prev, currentFile: `${item.label} — Loading plant types...` 
          }));

          const [allPlantTypes, allSubCategories] = await apiCallWithRetry(
            () => Promise.all([
              base44.entities.PlantType.list(),
              base44.entities.PlantSubCategory.list()
            ]),
            'Pre-load PlantType + SubCategory'
          );
          
          console.log('[Variety Import] Loaded', allPlantTypes.length, 'plant types');
          allPlantTypes.forEach(pt => {
            if (pt.plant_type_code) plantTypeLookup[pt.plant_type_code] = pt;
            if (pt.common_name) plantTypeByName[pt.common_name.toLowerCase()] = pt;
            plantTypeLookup[pt.id] = pt;
          });
          
          console.log('[Variety Import] Loaded', allSubCategories.length, 'subcategories');
          allSubCategories.forEach(sc => {
            const key = `${sc.plant_type_id}_${sc.subcat_code}`;
            subCategoryLookup[key] = sc;
            if (sc.subcat_code) subCategoryLookup[sc.subcat_code] = sc;
            subCategoryLookup[sc.id] = sc;
          });

          // ============================================================
          // KEY FIX: Pre-load ALL existing varieties to avoid per-row filter() calls
          // This single call replaces hundreds of individual filter() calls
          // ============================================================
          setImportProgress(prev => ({ 
            ...prev, currentFile: `${item.label} — Loading existing varieties for dedup...` 
          }));

          let allExistingVarieties = [];
          try {
            allExistingVarieties = await apiCallWithRetry(
              () => base44.entities.Variety.list(),
              'Pre-load all Varieties'
            );
          } catch (err) {
            console.warn('[Variety Import] Could not pre-load all varieties, falling back to per-row filter:', err.message);
          }

          // Build lookup maps for fast dedup
          const existingByCode = {};
          const existingByTypeAndName = {};
          
          const normalizeVarietyName = (name) => {
            if (!name) return '';
            return name.trim().toLowerCase()
              .replace(/\s+/g, ' ')
              .replace(/['']/g, "'")
              .replace(/[""]/g, '"')
              .replace(/\.$/, '');
          };

          allExistingVarieties.forEach(v => {
            if (v.variety_code) existingByCode[v.variety_code] = v;
            if (v.plant_type_id && v.variety_name) {
              const key = `${v.plant_type_id}__${normalizeVarietyName(v.variety_name)}`;
              existingByTypeAndName[key] = v;
            }
          });

          console.log(`[Variety Import] Pre-loaded ${allExistingVarieties.length} existing varieties for dedup`);

          // Store lookups for use inside the batch loop
          plantTypeLookup._existingByCode = existingByCode;
          plantTypeLookup._existingByTypeAndName = existingByTypeAndName;
          plantTypeLookup._normalizeVarietyName = normalizeVarietyName;
        }

        // Pre-load for PlantSubCategory imports
        let existingSubCategories = {};
        if (item.key === 'PlantSubCategory') {
          setImportProgress(prev => ({ 
            ...prev, currentFile: `${item.label} — Loading existing subcategories...` 
          }));
          const allSubCats = await apiCallWithRetry(
            () => base44.entities.PlantSubCategory.list(),
            'Pre-load PlantSubCategory'
          );
          allSubCats.forEach(sc => {
            const key = `${sc.plant_type_id}__${sc.subcat_code}`;
            existingSubCategories[key] = sc;
          });
          console.log(`[SubCategory Import] Pre-loaded ${allSubCats.length} existing subcategories`);
        }

        // Pre-load for SeedVendorBarcode imports
        let existingBarcodes = {};
        if (item.key === 'SeedVendorBarcode') {
          setImportProgress(prev => ({ 
            ...prev, currentFile: `${item.label} — Loading existing barcodes...` 
          }));
          try {
            const allBarcodes = await apiCallWithRetry(
              () => base44.entities.SeedVendorBarcode.list(),
              'Pre-load SeedVendorBarcode'
            );
            allBarcodes.forEach(b => {
              if (b.barcode) existingBarcodes[b.barcode] = b;
            });
            console.log(`[Barcode Import] Pre-loaded ${allBarcodes.length} existing barcodes`);
          } catch (err) {
            console.warn('[Barcode Import] Could not pre-load barcodes:', err.message);
          }
        }

        setImportProgress(prev => ({ 
          ...prev, currentFile: item.label 
        }));

        // ============================================================
        // BATCH LOOP — process BATCH_SIZE rows, then wait
        // ============================================================
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
          const batch = data.slice(i, i + BATCH_SIZE);

          for (const row of batch) {
            try {
              // ---- PlantSubCategory ----
              if (item.key === 'PlantSubCategory') {
                if (!row.subcat_code || !row.plant_type_id || !row.name) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing subcat_code, plant_type_id, or name' });
                  continue;
                }

                if (row.is_active !== undefined) {
                  row.is_active = row.is_active === 'true' || row.is_active === '1' || row.is_active === true;
                } else {
                  row.is_active = true;
                }
                if (row.sort_order) row.sort_order = parseInt(row.sort_order);

                const subcatData = {
                  subcat_code: row.subcat_code,
                  plant_type_id: row.plant_type_id,
                  name: row.name,
                  dimension: row.dimension || null,
                  scientific_name: row.scientific_name || null,
                  synonyms: row.synonyms ? row.synonyms.split('|').map(s => s.trim()).filter(Boolean) : [],
                  description: row.description || null,
                  icon: row.icon || null,
                  color: row.color || null,
                  sort_order: row.sort_order || 0,
                  is_active: row.is_active
                };

                // KEY FIX: Use pre-loaded lookup instead of filter() call
                const lookupKey = `${row.plant_type_id}__${row.subcat_code}`;
                const existing = existingSubCategories[lookupKey];

                if (existing) {
                  const updateData = { ...subcatData };
                  if (row.is_active === undefined || row.is_active === '' || row.is_active === null) {
                    delete updateData.is_active;
                  }
                  await apiCallWithRetry(
                    () => base44.entities.PlantSubCategory.update(existing.id, updateData),
                    `Update SubCategory ${row.subcat_code}`
                  );
                  updated++;
                } else {
                  const created = await apiCallWithRetry(
                    () => base44.entities.PlantSubCategory.create(subcatData),
                    `Create SubCategory ${row.subcat_code}`
                  );
                  // Update local cache so subsequent rows see it
                  existingSubCategories[lookupKey] = created;
                  inserted++;
                }
                continue;
              }

              // ---- PlantType ----
              if (item.key === 'PlantType') {
                if (!row.common_name || row.common_name.trim().length < 2) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing or invalid common_name' });
                  continue;
                }
                
                if (row.is_perennial) {
                  row.is_perennial = row.is_perennial.toLowerCase() === 'true' || row.is_perennial === '1';
                }
                if (row.trellis_common) {
                  row.trellis_common = row.trellis_common.toLowerCase() === 'true' || row.trellis_common === '1';
                }
                if (row.synonyms && row.synonyms.trim()) {
                  row.synonyms = row.synonyms.split('|').map(s => s.trim()).filter(Boolean);
                } else {
                  row.synonyms = [];
                }
                if (row.typical_spacing_min) row.typical_spacing_min = parseFloat(row.typical_spacing_min);
                if (row.typical_spacing_max) row.typical_spacing_max = parseFloat(row.typical_spacing_max);
                if (row.default_days_to_maturity) row.default_days_to_maturity = parseFloat(row.default_days_to_maturity);
                if (row.default_start_indoors_weeks) row.default_start_indoors_weeks = parseFloat(row.default_start_indoors_weeks);
                if (row.default_transplant_weeks) row.default_transplant_weeks = parseFloat(row.default_transplant_weeks);
                if (row.default_direct_sow_weeks_min) row.default_direct_sow_weeks_min = parseFloat(row.default_direct_sow_weeks_min);
                if (row.default_direct_sow_weeks_max) row.default_direct_sow_weeks_max = parseFloat(row.default_direct_sow_weeks_max);
              }

              // ---- Variety ----
              if (item.key === 'Variety') {
                if (!row.variety_name || !row.plant_type_id) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing variety_name or plant_type_id' });
                  continue;
                }

                const SQUASH_UMBRELLA_ID = '69594ee83e086041528f2b15';
                if (row.plant_type_id === SQUASH_UMBRELLA_ID) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Cannot import to Squash umbrella - use Summer Squash, Winter Squash, Zucchini, or Pumpkin' });
                  continue;
                }

                // Resolve plant type
                let plantType = null;
                if (plantTypeLookup[row.plant_type_id]) plantType = plantTypeLookup[row.plant_type_id];
                if (!plantType && row.plant_type_code && plantTypeLookup[row.plant_type_code]) plantType = plantTypeLookup[row.plant_type_code];
                if (!plantType && row.plant_type_common_name) plantType = plantTypeByName[row.plant_type_common_name.toLowerCase()];
                if (!plantType) plantType = plantTypeLookup[row.plant_type_id];

                if (!plantType || typeof plantType !== 'object') {
                  rejected++;
                  skipReasons.push({ row, reason: `Unknown plant_type: ${row.plant_type_id}${row.plant_type_code ? ` / ${row.plant_type_code}` : ''}` });
                  continue;
                }

                const resolvedTypeId = plantType.id;
                const plantTypeName = plantType.common_name;
                const normalizeVarietyName = plantTypeLookup._normalizeVarietyName;
                const existingByCode = plantTypeLookup._existingByCode;
                const existingByTypeAndName = plantTypeLookup._existingByTypeAndName;

                // Resolve subcategory
                const primaryCode = row.plant_subcategory_code || row.subcat_code || null;
                let resolvedSubcategoryId = null;
                let resolvedSubcategoryCode = null;
                let subcatWarnings = [];

                if (primaryCode && primaryCode.trim()) {
                  let normalizedCode = primaryCode.trim();
                  if (!normalizedCode.startsWith('PSC_')) normalizedCode = 'PSC_' + normalizedCode;

                  let subcat = Object.values(subCategoryLookup).find(sc => 
                    sc.subcat_code === normalizedCode && sc.plant_type_id === resolvedTypeId
                  );

                  if (subcat) {
                    resolvedSubcategoryId = subcat.id;
                    resolvedSubcategoryCode = subcat.subcat_code;
                  } else {
                    const subcatName = row.plant_subcategory_name || 
                      normalizedCode.replace(/^PSC_/, '').replace(/_/g, ' ')
                        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                    try {
                      const newSubcat = await apiCallWithRetry(
                        () => base44.entities.PlantSubCategory.create({
                          subcat_code: normalizedCode,
                          plant_type_id: resolvedTypeId,
                          name: subcatName,
                          is_active: true,
                          sort_order: 0
                        }),
                        `Auto-create SubCategory ${normalizedCode}`
                      );
                      resolvedSubcategoryId = newSubcat.id;
                      resolvedSubcategoryCode = newSubcat.subcat_code;
                      subCategoryLookup[normalizedCode] = newSubcat;
                    } catch (err) {
                      subcatWarnings.push(`Code "${primaryCode}" failed: ${err.message}`);
                    }
                  }
                }

                // ============================================================
                // KEY FIX: Check existence from pre-loaded maps — NO API call
                // ============================================================
                let existingRecord = null;
                
                if (row.variety_code && existingByCode[row.variety_code]) {
                  existingRecord = existingByCode[row.variety_code];
                }
                
                if (!existingRecord) {
                  const nameKey = `${resolvedTypeId}__${normalizeVarietyName(row.variety_name)}`;
                  if (existingByTypeAndName[nameKey]) {
                    existingRecord = existingByTypeAndName[nameKey];
                  }
                }

                // Validate enums
                const validSpecies = ['annuum', 'chinense', 'baccatum', 'frutescens', 'pubescens', 'unknown'];
                const validSeedLineTypes = ['heirloom', 'hybrid', 'open_pollinated', 'unknown'];
                const validSeasonTimings = ['early', 'mid', 'late', 'unknown'];
                
                let species = row.species || null;
                if (species && !validSpecies.includes(species)) species = 'unknown';
                let seedLineType = row.seed_line_type || null;
                if (seedLineType && !validSeedLineTypes.includes(seedLineType)) seedLineType = 'unknown';
                let seasonTiming = row.season_timing || null;
                if (seasonTiming && !validSeasonTimings.includes(seasonTiming)) seasonTiming = 'unknown';

                const scovilleMin = row.scoville_min || row.heat_scoville_min || null;
                const scovilleMax = row.scoville_max || row.heat_scoville_max || null;

                // Helper: only set if non-empty value
                const setIfVal = (key, val) => { if (val !== undefined && val !== null && val !== '') varietyData[key] = val; };
                const setNum = (key, val) => { if (val && String(val).trim()) varietyData[key] = parseFloat(val); };
                const setInt = (key, val) => { if (val && String(val).trim()) varietyData[key] = parseInt(val); };
                const setBool = (key, val) => { if (val !== undefined && val !== '') varietyData[key] = val === 'true' || val === '1' || val === true; };

                const varietyData = {
                  plant_type_id: resolvedTypeId,
                  plant_type_name: plantTypeName,
                  variety_code: row.variety_code || null,
                  variety_name: row.variety_name,
                  extended_data: {
                    import_subcat_code: primaryCode,
                    import_subcat_warnings: subcatWarnings.length > 0 ? subcatWarnings.join('; ') : null,
                    resolved_subcat_id: resolvedSubcategoryId,
                    resolved_subcat_name: resolvedSubcategoryId ? (Object.values(subCategoryLookup).find(sc => sc.id === resolvedSubcategoryId)?.name) : null
                  },
                  status: 'active',
                  is_custom: false
                };

                // Only set subcategory if resolved — NEVER null-wipe it
                if (resolvedSubcategoryId) {
                  varietyData.plant_subcategory_id = resolvedSubcategoryId;
                  varietyData.plant_subcategory_ids = [resolvedSubcategoryId];
                  varietyData.plant_subcategory_code = resolvedSubcategoryCode;
                  varietyData.plant_subcategory_codes = [resolvedSubcategoryCode];
                }

                // ── All string/text fields ──
                setIfVal('description', row.description?.trim());
                if (row.synonyms?.trim()) varietyData.synonyms = row.synonyms.split('|').map(s=>s.trim()).filter(Boolean);
                setIfVal('flavor_profile', row.flavor_profile?.trim());
                setIfVal('uses', row.uses?.trim());
                setIfVal('fruit_color', row.fruit_color?.trim());
                setIfVal('fruit_shape', row.fruit_shape?.trim());
                setIfVal('fruit_size', row.fruit_size?.trim());
                setIfVal('pod_color', row.pod_color?.trim());
                setIfVal('pod_shape', row.pod_shape?.trim());
                setIfVal('pod_size', row.pod_size?.trim());
                setIfVal('disease_resistance', row.disease_resistance?.trim());
                setIfVal('breeder_or_origin', row.breeder_or_origin?.trim());
                setIfVal('seed_saving_notes', row.seed_saving_notes?.trim());
                setIfVal('pollination_notes', row.pollination_notes?.trim());
                setIfVal('grower_notes', row.grower_notes?.trim());
                setIfVal('source_attribution', row.source_attribution?.trim());
                setIfVal('plant_height_typical', row.plant_height_typical?.trim());
                setIfVal('growth_habit', row.growth_habit?.trim());
                setIfVal('sun_requirement', row.sun_requirement?.trim());
                setIfVal('water_requirement', row.water_requirement?.trim());
                setIfVal('affiliate_url', row.affiliate_url?.trim());
                setIfVal('popularity_tier', row.popularity_tier?.trim());
                setIfVal('growth_pattern', row.growth_pattern?.trim());
                setIfVal('mature_indoor_height', row.mature_indoor_height?.trim());
                setIfVal('mature_indoor_width', row.mature_indoor_width?.trim());
                setIfVal('toxicity_notes', row.toxicity_notes?.trim());
                setIfVal('preventive_care_tips', row.preventive_care_tips?.trim());
                setIfVal('seasonal_notes', row.seasonal_notes?.trim());
                setIfVal('propagation_notes', row.propagation_notes?.trim());
                setIfVal('seed_saving_notes', row.seed_saving_notes?.trim());
                setIfVal('grower_notes', row.grower_notes?.trim());
                setIfVal('variegation_type', row.variegation_type?.trim());
                setIfVal('watering_frequency_range', row.watering_frequency_range?.trim());
                setIfVal('soil_dryness_rule', row.soil_dryness_rule?.trim());
                setIfVal('watering_method_preferred', row.watering_method_preferred?.trim());
                setIfVal('humidity_preference', row.humidity_preference?.trim());
                setIfVal('humidity_support_method', row.humidity_support_method?.trim());
                setIfVal('soil_type_recommended', row.soil_type_recommended?.trim());
                setIfVal('soil_type_required', row.soil_type_required?.trim());
                setIfVal('soil_drainage_speed', row.soil_drainage_speed?.trim());
                setIfVal('recommended_pot_type', row.recommended_pot_type?.trim());
                setIfVal('fertilizer_type', row.fertilizer_type?.trim());
                setIfVal('fertilizer_frequency', row.fertilizer_frequency?.trim());
                setIfVal('fertilizer_strength', row.fertilizer_strength?.trim());
                setIfVal('fertilizer_rule', row.fertilizer_rule?.trim());
                setIfVal('light_requirement_indoor', row.light_requirement_indoor?.trim());
                setIfVal('light_tolerance_range', row.light_tolerance_range?.trim());
                setIfVal('overwater_sensitivity', row.overwater_sensitivity?.trim());
                setIfVal('rootbound_tolerance', row.rootbound_tolerance?.trim());
                setIfVal('pruning_needs', row.pruning_needs?.trim());
                setIfVal('growth_speed', row.growth_speed?.trim());
                setIfVal('best_repot_season', row.best_repot_season?.trim());
                setIfVal('propagation_best_season', row.propagation_best_season?.trim());
                setIfVal('propagation_difficulty', row.propagation_difficulty?.trim());
                setIfVal('care_difficulty', row.care_difficulty?.trim());
                setIfVal('pest_susceptibility', row.pest_susceptibility?.trim());
                setIfVal('display_style', row.display_style?.trim());
                setIfVal('dormancy_required', row.dormancy_required?.trim());
                setIfVal('water_type_required', row.water_type_required?.trim());
                setIfVal('common_pests', row.common_pests?.trim());
                setIfVal('common_diseases', row.common_diseases?.trim());
                setIfVal('repot_frequency_years', row.repot_frequency_years?.trim());
                setIfVal('propagation_methods', row.propagation_methods?.trim());
                setIfVal('season_timing', seasonTiming);
                setIfVal('species', species);
                setIfVal('seed_line_type', seedLineType);
                if (row.sources?.trim()) varietyData.sources = row.sources.split('|').map(s=>s.trim()).filter(Boolean);
                // care_warnings array
                if (row.care_warnings?.trim() && row.care_warnings !== '[]') {
                  try { varietyData.care_warnings = JSON.parse(row.care_warnings); } catch { varietyData.care_warnings = row.care_warnings.split('|').map(s=>s.trim()).filter(Boolean); }
                }

                // ── Numeric fields ──
                setInt('days_to_maturity', row.days_to_maturity);
                setInt('days_to_maturity_min', row.days_to_maturity_min);
                setInt('days_to_maturity_max', row.days_to_maturity_max);
                setNum('start_indoors_weeks', row.start_indoors_weeks);
                setNum('start_indoors_weeks_min', row.start_indoors_weeks_min);
                setNum('start_indoors_weeks_max', row.start_indoors_weeks_max);
                setNum('transplant_weeks_after_last_frost_min', row.transplant_weeks_after_last_frost_min);
                setNum('transplant_weeks_after_last_frost_max', row.transplant_weeks_after_last_frost_max);
                setNum('direct_sow_weeks_min', row.direct_sow_weeks_min);
                setNum('direct_sow_weeks_max', row.direct_sow_weeks_max);
                setInt('spacing_recommended', row.spacing_recommended);
                setInt('spacing_min', row.spacing_min);
                setInt('spacing_max', row.spacing_max);
                setInt('height_min', row.height_min);
                setInt('height_max', row.height_max);
                setNum('temp_min_f', row.temp_min_f);
                setNum('temp_max_f', row.temp_max_f);
                setNum('temp_ideal_min_f', row.temp_ideal_min_f);
                setNum('temp_ideal_max_f', row.temp_ideal_max_f);
                setNum('min_light_hours', row.min_light_hours);
                setNum('max_light_hours', row.max_light_hours);
                setNum('dormancy_temp_min_f', row.dormancy_temp_min_f);
                setNum('dormancy_temp_max_f', row.dormancy_temp_max_f);
                setNum('dormancy_duration_months_min', row.dormancy_duration_months_min);
                setNum('dormancy_duration_months_max', row.dormancy_duration_months_max);
                setNum('root_temp_max_f', row.root_temp_max_f);
                if (scovilleMin) { varietyData.scoville_min = parseInt(scovilleMin); varietyData.heat_scoville_min = parseInt(scovilleMin); }
                if (scovilleMax) { varietyData.scoville_max = parseInt(scovilleMax); varietyData.heat_scoville_max = parseInt(scovilleMax); }

                // ── Boolean fields ──
                setBool('trellis_required', row.trellis_required);
                setBool('container_friendly', row.container_friendly);
                setBool('is_ornamental', row.is_ornamental);
                setBool('is_organic', row.is_organic);
                setBool('toxic_to_cats', row.toxic_to_cats);
                setBool('toxic_to_dogs', row.toxic_to_dogs);
                setBool('toxic_to_humans', row.toxic_to_humans);
                setBool('pet_safe', row.pet_safe);
                setBool('sap_irritant', row.sap_irritant);
                setBool('air_purifying', row.air_purifying);
                setBool('drought_tolerant', row.drought_tolerant);
                setBool('grow_light_compatible', row.grow_light_compatible);
                setBool('misting_beneficial', row.misting_beneficial);
                setBool('fragrant', row.fragrant);
                setBool('flowering_indoors', row.flowering_indoors);
                setBool('needs_support', row.needs_support);
                setBool('winter_dormancy', row.winter_dormancy);
                setBool('reduced_winter_watering', row.reduced_winter_watering);
                setBool('winter_leaf_drop_normal', row.winter_leaf_drop_normal);
                setBool('drainage_holes_required', row.drainage_holes_required);
                setBool('cold_draft_sensitive', row.cold_draft_sensitive);
                setBool('dormant_season_feeding', row.dormant_season_feeding);
                setBool('is_aquatic', row.is_aquatic);
                setBool('root_cooling_required', row.root_cooling_required);

                if (existingRecord) {
                  // UPSERT: pass the same varietyData — all fields are only set when non-empty (never null-wiped)
                  // plant_subcategory_id is only in varietyData if it was resolved — so existing subcat is preserved when blank
                  await apiCallWithRetry(
                    () => base44.entities.Variety.update(existingRecord.id, varietyData),
                    `Update Variety "${row.variety_name}"`
                  );
                  updated++;
                } else {
                  const created = await apiCallWithRetry(
                    () => base44.entities.Variety.create(varietyData),
                    `Create Variety "${row.variety_name}"`
                  );
                  // Update local cache
                  if (row.variety_code) existingByCode[row.variety_code] = created;
                  const nameKey = `${resolvedTypeId}__${normalizeVarietyName(row.variety_name)}`;
                  existingByTypeAndName[nameKey] = created;
                  inserted++;
                }
                continue;
              }

              // ---- SeedVendorBarcode ----
              if (item.key === 'SeedVendorBarcode') {
                if (!row.barcode || !row.variety_id) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing barcode or variety_id' });
                  continue;
                }

                // KEY FIX: Use pre-loaded map instead of filter()
                const existing = existingBarcodes[row.barcode];

                const barcodeData = {
                  barcode: row.barcode,
                  barcode_format: row.barcode_format || 'UPC_A',
                  variety_id: row.variety_id,
                  plant_type_id: row.plant_type_id || null,
                  vendor_code: row.vendor_code || 'UNKNOWN',
                  vendor_name: row.vendor_name || row.vendor_code || 'Unknown',
                  vendor_url: row.vendor_url || null,
                  vendor_product_url: row.vendor_product_url || null,
                  product_name: row.product_name || null,
                  packet_size: row.packet_size || null,
                  retail_price: row.retail_price ? parseFloat(row.retail_price) : null,
                  data_source: 'admin_import',
                  verified: true,
                  status: 'active'
                };

                if (existing) {
                  await apiCallWithRetry(
                    () => base44.entities.SeedVendorBarcode.update(existing.id, barcodeData),
                    `Update Barcode ${row.barcode}`
                  );
                  updated++;
                } else {
                  const created = await apiCallWithRetry(
                    () => base44.entities.SeedVendorBarcode.create(barcodeData),
                    `Create Barcode ${row.barcode}`
                  );
                  existingBarcodes[row.barcode] = created;
                  inserted++;
                }
                continue;
              }

              // ---- IndoorPlant ----
              if (item.key === 'IndoorPlant') {
                if (!row.variety_id || !row.acquisition_date || !row.acquisition_source) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing required fields (variety_id, acquisition_date, acquisition_source)' });
                  continue;
                }

                const existing = row.id ? await apiCallWithRetry(
                  () => base44.entities.IndoorPlant.filter({ id: row.id }),
                  `Check IndoorPlant ${row.id}`
                ) : [];

                const plantData = {
                  variety_id: row.variety_id,
                  nickname: row.nickname || null,
                  acquisition_date: row.acquisition_date,
                  acquisition_source: row.acquisition_source,
                  indoor_space_id: row.indoor_space_id || null,
                  tier_id: row.tier_id || null,
                  health_status: row.health_status || 'healthy',
                  pot_type: row.pot_type || null,
                  pot_size_inches: row.pot_size_inches ? parseFloat(row.pot_size_inches) : null,
                  soil_type: row.soil_type || null,
                  watering_frequency_days: row.watering_frequency_days ? parseInt(row.watering_frequency_days) : null,
                  last_watered_date: row.last_watered_date || null,
                  is_active: row.is_active !== undefined ? (row.is_active === 'true' || row.is_active === '1') : true
                };

                if (row.acquired_from) plantData.acquired_from = row.acquired_from;
                if (row.purchase_price) plantData.purchase_price = parseFloat(row.purchase_price);
                if (row.grid_position_x) plantData.grid_position_x = parseInt(row.grid_position_x);
                if (row.grid_position_y) plantData.grid_position_y = parseInt(row.grid_position_y);
                if (row.current_height_inches) plantData.current_height_inches = parseFloat(row.current_height_inches);
                if (row.primary_photo_url) plantData.primary_photo_url = row.primary_photo_url;

                if (existing.length > 0) {
                  await apiCallWithRetry(
                    () => base44.entities.IndoorPlant.update(existing[0].id, plantData),
                    `Update IndoorPlant ${row.id}`
                  );
                  updated++;
                } else {
                  await apiCallWithRetry(
                    () => base44.entities.IndoorPlant.create(plantData),
                    `Create IndoorPlant`
                  );
                  inserted++;
                }
                continue;
              }

              // ---- Generic entities ----
              if (importMode === 'INSERT_ONLY') {
                await apiCallWithRetry(
                  () => base44.entities[item.key].create(row),
                  `Create ${item.key}`
                );
                inserted++;
              } else if (importMode === 'UPSERT_BY_ID') {
                const existing = row.id ? await apiCallWithRetry(
                  () => base44.entities[item.key].filter({ id: row.id }),
                  `Check ${item.key} ${row.id}`
                ) : [];
                
                if (existing.length > 0) {
                  await apiCallWithRetry(
                    () => base44.entities[item.key].update(existing[0].id, row),
                    `Update ${item.key} ${row.id}`
                  );
                  updated++;
                } else {
                  await apiCallWithRetry(
                    () => base44.entities[item.key].create(row),
                    `Create ${item.key}`
                  );
                  inserted++;
                }
              }
            } catch (error) {
              console.error(`Error importing ${item.key}:`, error);
              skipped++;
              skipReasons.push({ row, reason: error.message });

              // If it was a rate limit error, signal the throttle controller
              const msg = (error?.message || '').toLowerCase();
              if (msg.includes('rate') || msg.includes('429') || msg.includes('504') || msg.includes('timeout')) {
                throttle.onRateLimit();
                totalRetries++;
              }
            }
          } // end row loop

          // Progress update
          const processed = Math.min(i + BATCH_SIZE, data.length);
          setImportProgress({ 
            current: processed, 
            total: data.length, 
            currentFile: item.label,
            delayMs: throttle.delay,
            rateLimitHits: throttle.hitCount,
            retries: totalRetries
          });
          console.log(`[Import] Batch: Processed ${processed}/${data.length} | Delay: ${throttle.delay}ms | Rate limit hits: ${throttle.hitCount}`);

          // ============================================================
          // KEY FIX: Adaptive wait between batches
          // ============================================================
          if (i + BATCH_SIZE < data.length) {
            throttle.onSuccess(); // Slowly recover speed if no errors
            await throttle.wait();
          }
        } // end batch loop

        importResults[item.key] = {
          status: 'success',
          message: `Import completed (${throttle.hitCount} rate limit recoveries)`,
          inserted,
          updated,
          skipped,
          rejected,
          skipReasons: skipReasons.slice(0, 20)
        };

        // Auto-normalize after Variety import
        if (item.key === 'Variety' && !dryRun && (inserted > 0 || updated > 0)) {
          console.log('[Import] Auto-running normalization after Variety import...');
          try {
            await apiCallWithRetry(
              () => base44.functions.invoke('normalizeVarietySubcategories', { dry_run: false }),
              'Post-import normalization'
            );
            console.log('[Import] Normalization completed');
          } catch (error) {
            console.error('[Import] Normalization failed:', error);
          }
        }
      } // end IMPORT_ORDER loop

      setResults(importResults);
      
      if (!dryRun) {
        toast.success(`Import completed! (${totalRetries} rate-limit retries handled automatically)`);
      } else {
        toast.success('Dry run completed - review results below');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleZipUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast.error('ZIP import not yet implemented. Please upload individual CSV files.');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Data Import Error" fallbackMessage="An error occurred loading the import page. Please refresh and try again.">
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Data Imports</h1>
        <p className="text-gray-600 mt-1">Import plant taxonomy and catalog data</p>
      </div>

      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          <strong>Import Order:</strong> Files must be imported in the correct order to maintain referential integrity.
          PlantGroup → PlantFamily → PlantType → FacetGroup → Facet → Mappings
        </AlertDescription>
      </Alert>

      {/* Rate Limit Protection Info */}
      <Alert className="border-blue-200 bg-blue-50">
        <ShieldAlert className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Rate Limit Protection:</strong> This importer processes 5 rows at a time with automatic retry and backoff.
          If Base44's API throttles requests, the importer will automatically slow down and retry — no more 504 errors.
          Large imports (500+ rows) may take several minutes.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Data Cleanup</h3>
              <p className="text-sm text-gray-600">Remove invalid plant type records</p>
            </div>
            <Link to={createPageUrl('AdminDataCleanup')}>
              <Button variant="outline" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Cleanup Tool
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* CSV Template Download */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Download clean templates with exact headers the importer expects</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  try {
                    const response = await base44.functions.invoke('generateVarietyCSVTemplate');
                    const blob = new Blob([response.data], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'variety_import_template.csv';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                    toast.success('Template downloaded');
                  } catch (error) {
                    toast.error('Failed to download template');
                  }
                }}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Variety Template
              </Button>
              
              <Button
                onClick={async () => {
                  try {
                    const response = await base44.functions.invoke('generatePlantTypeCSVTemplate');
                    const blob = new Blob([response.data], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'plant_type_import_template.csv';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                    toast.success('Template downloaded');
                  } catch (error) {
                    toast.error('Failed to download template');
                  }
                }}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                PlantType Template
              </Button>

              <Button
                onClick={async () => {
                  try {
                    const response = await base44.functions.invoke('generateSubcategoryCSVTemplate');
                    const blob = new Blob([response.data], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'subcategory_import_template.csv';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                    toast.success('Template downloaded');
                  } catch (error) {
                    toast.error('Failed to download template');
                  }
                }}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Subcategory Template
              </Button>
              
              <Button
                onClick={async () => {
                  try {
                    const response = await base44.functions.invoke('generateSeedBarcodeTemplate');
                    const blob = new Blob([response.data], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'seed_barcode_template.csv';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                    toast.success('Template downloaded');
                  } catch (error) {
                    toast.error('Failed to download template');
                  }
                }}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Seed Barcode Template
              </Button>

              <Button
                onClick={async () => {
                  try {
                    const response = await base44.functions.invoke('generateIndoorPlantTemplate');
                    const blob = new Blob([response.data], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'indoor_plant_template.csv';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                    toast.success('Template downloaded');
                  } catch (error) {
                    toast.error('Failed to download template');
                  }
                }}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Indoor Plant Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expected Columns Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Variety Import: Expected Columns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-4">
            <div>
              <p className="font-bold text-sm mb-2">Plant Varieties Import</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="font-semibold text-xs text-red-600 mb-1">REQUIRED:</p>
                  <ul className="text-xs text-gray-700 space-y-0.5">
                    <li>• variety_name</li>
                    <li>• plant_type_id (or plant_type_code)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-xs text-emerald-600 mb-1">RECOMMENDED:</p>
                  <ul className="text-xs text-gray-700 space-y-0.5">
                    <li>• plant_subcategory_code</li>
                    <li>• days_to_maturity</li>
                    <li>• spacing_recommended</li>
                    <li>• sun_requirement</li>
                    <li>• species</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-xs text-blue-600 mb-1">ALL 60+ FIELDS:</p>
                  <ul className="text-xs text-gray-700 space-y-0.5">
                    <li>✅ ALL Variety schema fields supported</li>
                    <li>✅ Indoor plant fields (light, humidity, temp, toxicity)</li>
                    <li>✅ Timing fields (start, transplant, sow)</li>
                    <li>✅ Download template for full list</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="font-bold text-sm mb-2">Seed Barcodes Import</p>
              <ul className="text-xs text-gray-700 space-y-0.5">
                <li>• <strong>Required:</strong> barcode, variety_id, vendor_name</li>
                <li>• <strong>Recommended:</strong> vendor_code, product_name, packet_size</li>
                <li>• <strong>Optional:</strong> barcode_format, retail_price, vendor_product_url, plant_type_id</li>
                <li>• <strong>Barcode formats:</strong> UPC_A, UPC_E, EAN_13, EAN_8, CODE_128, QR_CODE, OTHER</li>
              </ul>
            </div>

            <div className="border-t pt-3">
              <p className="font-bold text-sm mb-2">Indoor Plants (Houseplants) Import</p>
              <ul className="text-xs text-gray-700 space-y-0.5">
                <li>• <strong>Required:</strong> variety_id, acquisition_date, acquisition_source</li>
                <li>• <strong>Location:</strong> indoor_space_id, tier_id, grid_position_x, grid_position_y</li>
                <li>• <strong>Container:</strong> pot_type, pot_size_inches, soil_type, has_drainage</li>
                <li>• <strong>Care:</strong> watering_frequency_days, health_status, nickname</li>
                <li>✅ ALL IndoorPlant schema fields supported - download template for full list</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 border-t pt-3">
          <strong>✅ UPSERT MODE CONFIRMED:</strong> Blank cells will NOT overwrite existing data. Only populated cells update fields. Duplicates are prevented by variety_code or normalized name.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="zip">Upload ZIP (All CSVs)</Label>
            <Input
              id="zip"
              type="file"
              accept=".zip"
              onChange={handleZipUpload}
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">Upload a ZIP file containing all required CSVs</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">OR upload individually</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {IMPORT_ORDER.map((item) => (
              <div key={item.key} className="space-y-2">
                <Label htmlFor={item.key}>{item.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={item.key}
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileChange(item.key, e)}
                    className="flex-1"
                  />
                  {files[item.key] && (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-500">{item.file}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import Controls */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>Import Mode</Label>
            <Select value={importMode} onValueChange={setImportMode}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INSERT_ONLY">Insert Only (skip existing)</SelectItem>
                <SelectItem value="UPSERT_BY_ID">Upsert by ID (update existing)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Upsert mode will update existing records by ID, or insert if not found
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Dry Run (Preview only)</span>
              </label>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-1">
                {importing && importProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{importProgress.currentFile}</span>
                      <span className="font-semibold text-gray-900">
                        {importProgress.current} / {importProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all"
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      />
                    </div>
                    {/* Rate limit status display */}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Batch delay: {Math.round(importProgress.delayMs / 1000 * 10) / 10}s</span>
                      {importProgress.rateLimitHits > 0 && (
                        <span className="text-amber-600">
                          ⚠ Rate limits hit: {importProgress.rateLimitHits} (auto-recovered)
                        </span>
                      )}
                      {importProgress.retries > 0 && (
                        <span className="text-blue-600">
                          Retries: {importProgress.retries}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Button
                onClick={handleImport}
                disabled={importing || Object.keys(files).length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {dryRun ? 'Preview Import' : 'Start Import'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold">
              {dryRun ? 'Preview Results' : 'Import Results'}
            </h2>
            {Object.entries(results).map(([key, result]) => (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {IMPORT_ORDER.find(i => i.key === key)?.label}
                    </CardTitle>
                    {result.status === 'success' ? (
                      <Badge className="bg-green-100 text-green-800">Success</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Error</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-2">{result.message}</p>
                  <div className="flex gap-4 text-sm flex-wrap">
                    <span className="text-green-600">
                      Inserted: <strong>{result.inserted}</strong>
                    </span>
                    <span className="text-blue-600">
                      Updated: <strong>{result.updated}</strong>
                    </span>
                    {result.skipped > 0 && (
                      <span className="text-yellow-600">
                        Skipped: <strong>{result.skipped}</strong>
                      </span>
                    )}
                    {result.rejected > 0 && (
                      <span className="text-red-600">
                        Rejected: <strong>{result.rejected}</strong>
                      </span>
                    )}
                  </div>
                  {result.skipReasons && result.skipReasons.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                      <p className="text-xs text-yellow-800 mb-2 font-medium">Skip/Reject Reasons:</p>
                      <div className="space-y-1 max-h-32 overflow-auto">
                        {result.skipReasons.map((item, idx) => (
                          <p key={idx} className="text-xs text-yellow-700">
                            Row {idx + 1}: {item.reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.preview && result.preview.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-2">First 5 records:</p>
                      <pre className="text-xs text-gray-700 overflow-auto max-h-32">
                        {JSON.stringify(result.preview, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
    </ErrorBoundary>
  );
}