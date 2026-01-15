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
  Trash2
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
  { key: 'FacetGroup', label: 'Facet Groups', file: 'AG_FacetGroup.csv' },
  { key: 'Facet', label: 'Facets', file: 'AG_Facet.csv' },
  { key: 'PlantTypeFacetGroupMap', label: 'Plant Type Facet Maps', file: 'AG_PlantTypeFacetGroupMap.csv' },
  { key: 'TraitDefinition', label: 'Trait Definitions', file: 'AG_TraitDefinition.csv' },
  { key: 'PlantTypeTraitTemplate', label: 'Plant Type Trait Templates', file: 'AG_PlantTypeTraitTemplate.csv' },
];

export default function AdminDataImport() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState({});
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [importMode, setImportMode] = useState('UPSERT_BY_ID');
  const [results, setResults] = useState(null);

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
    
    // Parse CSV with proper quote handling
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
            i++; // Skip next quote
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
        // Remove surrounding quotes if present
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

    try {
      const importResults = {};

      for (const item of IMPORT_ORDER) {
        const file = files[item.key];
        if (!file) continue;

        const text = await file.text();
        const data = parseCSV(text);

        // For Variety imports with >40 rows, use batched processing
        if (item.key === 'Variety' && !dryRun && data.length > 40) {
          toast.info(`Processing ${data.length} varieties in batches...`);
          
          // Pre-load lookups
          const [allPlantTypes, allSubcats] = await Promise.all([
            base44.entities.PlantType.list(),
            base44.entities.PlantSubCategory.list()
          ]);

          const plantTypeLookup = {};
          allPlantTypes.forEach(pt => {
            if (pt.plant_type_code) plantTypeLookup[pt.plant_type_code] = pt;
            if (pt.common_name) plantTypeLookup[pt.common_name.toLowerCase()] = pt;
            plantTypeLookup[pt.id] = pt;
          });

          const subcatLookup = {};
          allSubcats.forEach(sc => {
            const key = `${sc.plant_type_id}_${sc.subcat_code}`;
            subcatLookup[key] = sc;
            if (sc.subcat_code) subcatLookup[sc.subcat_code] = sc;
            subcatLookup[sc.id] = sc;
          });

          let offset = 0;
          let totalInserted = 0;
          let totalUpdated = 0;
          let totalRejected = 0;
          const allSkipReasons = [];

          while (offset < data.length) {
            const response = await base44.functions.invoke('batchImportVarieties', {
              rows: data,
              batch_size: 30,
              offset,
              plant_type_lookup: plantTypeLookup,
              subcat_lookup: subcatLookup
            });

            if (!response.data.success) {
              throw new Error(response.data.error);
            }

            totalInserted += response.data.summary.inserted;
            totalUpdated += response.data.summary.updated;
            totalRejected += response.data.summary.rejected;
            allSkipReasons.push(...(response.data.summary.skipReasons || []));
            offset = response.data.summary.next_offset;

            // Update UI with progress
            setResults({
              ...importResults,
              [item.key]: {
                status: 'success',
                message: `Processing batch ${Math.floor(offset / 30)}...`,
                inserted: totalInserted,
                updated: totalUpdated,
                rejected: totalRejected,
                skipReasons: allSkipReasons.slice(0, 20)
              }
            });

            // Small delay between batches
            if (response.data.summary.has_more) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          importResults[item.key] = {
            status: 'success',
            message: 'Batch import completed',
            inserted: totalInserted,
            updated: totalUpdated,
            rejected: totalRejected,
            skipReasons: allSkipReasons.slice(0, 20)
          };

          continue; // Skip regular processing
        }

        if (data.length === 0) {
          importResults[item.key] = {
            status: 'error',
            message: 'No data found in file',
            inserted: 0,
            updated: 0,
            skipped: 0
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
        } else {
          let inserted = 0;
          let updated = 0;
          let skipped = 0;
          let rejected = 0;
          const skipReasons = [];

          // For Variety import, preload PlantType and PlantSubCategory lookup
          let plantTypeLookup = {};
          let plantTypeByName = {};
          let subCategoryLookup = {};
          if (item.key === 'Variety') {
            const [allPlantTypes, allSubCategories] = await Promise.all([
              base44.entities.PlantType.list(),
              base44.entities.PlantSubCategory.list()
            ]);
            console.log('[Variety Import] Loaded', allPlantTypes.length, 'plant types');
            allPlantTypes.forEach(pt => {
              if (pt.plant_type_code) {
                plantTypeLookup[pt.plant_type_code] = pt;
              }
              if (pt.common_name) {
                plantTypeByName[pt.common_name.toLowerCase()] = pt;
              }
              plantTypeLookup[pt.id] = pt; // Also map id to id
            });
            console.log('[Variety Import] Loaded', allSubCategories.length, 'subcategories');
            allSubCategories.forEach(sc => {
              const key = `${sc.plant_type_id}_${sc.subcat_code}`;
              subCategoryLookup[key] = sc;
              if (sc.subcat_code) {
                subCategoryLookup[sc.subcat_code] = sc;
              }
              subCategoryLookup[sc.id] = sc;
            });
            console.log('[Variety Import] Lookup keys:', Object.keys(plantTypeLookup).slice(0, 10));
          }

          for (const row of data) {
            try {
              // Process PlantSubCategory-specific data
              if (item.key === 'PlantSubCategory') {
                if (!row.subcat_code || !row.plant_type_id || !row.name) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing subcat_code, plant_type_id, or name' });
                  continue;
                }

                // Convert boolean fields
                if (row.is_active !== undefined) {
                  row.is_active = row.is_active === 'true' || row.is_active === '1' || row.is_active === true;
                } else {
                  row.is_active = true;
                }

                // Convert numeric fields
                if (row.sort_order) row.sort_order = parseInt(row.sort_order);

                // UPSERT by (plant_type_id, subcat_code) - the unique key
                const existing = await base44.entities.PlantSubCategory.filter({ 
                  plant_type_id: row.plant_type_id,
                  subcat_code: row.subcat_code 
                });

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

                if (existing.length > 0) {
                  // Update existing - PRESERVE is_active unless explicitly set to false in CSV
                  const updateData = { ...subcatData };
                  if (row.is_active === undefined || row.is_active === '' || row.is_active === null) {
                    delete updateData.is_active; // Don't change it
                  }
                  await base44.entities.PlantSubCategory.update(existing[0].id, updateData);
                  updated++;
                } else {
                  await base44.entities.PlantSubCategory.create(subcatData);
                  inserted++;
                }
                continue;
              }

              // Process PlantType-specific data
              if (item.key === 'PlantType') {
                if (!row.common_name || row.common_name.trim().length < 2) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing or invalid common_name' });
                  continue;
                }
                
                // Convert string booleans to actual booleans
                if (row.is_perennial) {
                  row.is_perennial = row.is_perennial.toLowerCase() === 'true' || row.is_perennial === '1';
                }
                if (row.trellis_common) {
                  row.trellis_common = row.trellis_common.toLowerCase() === 'true' || row.trellis_common === '1';
                }
                
                // Convert synonyms to array
                if (row.synonyms && row.synonyms.trim()) {
                  row.synonyms = row.synonyms.split('|').map(s => s.trim()).filter(Boolean);
                } else {
                  row.synonyms = [];
                }
                
                // Convert numeric fields
                if (row.typical_spacing_min) row.typical_spacing_min = parseFloat(row.typical_spacing_min);
                if (row.typical_spacing_max) row.typical_spacing_max = parseFloat(row.typical_spacing_max);
                if (row.default_days_to_maturity) row.default_days_to_maturity = parseFloat(row.default_days_to_maturity);
                if (row.default_start_indoors_weeks) row.default_start_indoors_weeks = parseFloat(row.default_start_indoors_weeks);
                if (row.default_transplant_weeks) row.default_transplant_weeks = parseFloat(row.default_transplant_weeks);
                if (row.default_direct_sow_weeks_min) row.default_direct_sow_weeks_min = parseFloat(row.default_direct_sow_weeks_min);
                if (row.default_direct_sow_weeks_max) row.default_direct_sow_weeks_max = parseFloat(row.default_direct_sow_weeks_max);
              }

              if (item.key === 'Variety') {
                if (!row.variety_name || !row.plant_type_id) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing variety_name or plant_type_id' });
                  continue;
                }

                // BLOCK Squash umbrella
                const SQUASH_UMBRELLA_ID = '69594ee83e086041528f2b15';
                if (row.plant_type_id === SQUASH_UMBRELLA_ID) {
                  rejected++;
                  skipReasons.push({ 
                    row, 
                    reason: 'Cannot import to Squash umbrella - use Summer Squash, Winter Squash, Zucchini, or Pumpkin' 
                  });
                  continue;
                }

                // Resolve plant_type_id via multiple strategies
                let plantType = null;

                // Strategy 1: Direct ID match
                if (plantTypeLookup[row.plant_type_id]) {
                  plantType = plantTypeLookup[row.plant_type_id];
                }

                // Strategy 2: plant_type_code match
                if (!plantType && row.plant_type_code && plantTypeLookup[row.plant_type_code]) {
                  plantType = plantTypeLookup[row.plant_type_code];
                }

                // Strategy 3: common_name match
                if (!plantType && row.plant_type_common_name) {
                  plantType = plantTypeByName[row.plant_type_common_name.toLowerCase()];
                }

                // Strategy 4: Treat plant_type_id as a code
                if (!plantType) {
                  plantType = plantTypeLookup[row.plant_type_id];
                }

                if (!plantType || typeof plantType !== 'object') {
                  rejected++;
                  skipReasons.push({ 
                    row, 
                    reason: `Unknown plant_type: ${row.plant_type_id}${row.plant_type_code ? ` / ${row.plant_type_code}` : ''}` 
                  });
                  continue;
                }

                const resolvedTypeId = plantType.id;
                const plantTypeName = plantType.common_name;

                // Store original codes for backfill
                const originalSubcatCode = row.plant_subcategory_code || row.subcat_code || null;
                const originalSubcatCodes = row.plant_subcategory_codes || null;
                
                // Normalize variety name for duplicate checking
                const normalizeVarietyName = (name) => {
                  if (!name) return '';
                  return name
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, ' ')
                    .replace(/['']/g, "'")
                    .replace(/[""]/g, '"')
                    .replace(/\.$/, '');
                };

                // CRITICAL: Resolve SINGLE primary subcategory from plant_subcategory_code
                let resolvedSubcategoryId = null;
                let resolvedSubcategoryCode = null;
                let subcatWarnings = [];

                // Use ONLY plant_subcategory_code (single primary) - ignore legacy arrays
                const primaryCode = row.plant_subcategory_code || row.subcat_code || null;

                if (primaryCode && primaryCode.trim()) {
                  // Normalize: CARROT_STORAGE -> PSC_CARROT_STORAGE
                  let normalizedCode = primaryCode.trim();
                  if (!normalizedCode.startsWith('PSC_')) {
                    normalizedCode = 'PSC_' + normalizedCode;
                  }

                  // Lookup in pre-loaded subcategory index
                  let subcat = Object.values(subCategoryLookup).find(sc => 
                    sc.subcat_code === normalizedCode && sc.plant_type_id === resolvedTypeId
                  );

                  if (subcat) {
                    resolvedSubcategoryId = subcat.id;
                    resolvedSubcategoryCode = subcat.subcat_code;
                    console.log(`[Variety Import] Resolved subcategory: ${primaryCode} -> ${subcat.name} (${subcat.id})`);
                  } else {
                    // Auto-create if code is reasonable
                    const subcatName = row.plant_subcategory_name || 
                                      normalizedCode.replace(/^PSC_/, '').replace(/_/g, ' ')
                                        .split(' ')
                                        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                                        .join(' ');

                    try {
                      const newSubcat = await base44.entities.PlantSubCategory.create({
                        subcat_code: normalizedCode,
                        plant_type_id: resolvedTypeId,
                        name: subcatName,
                        is_active: true,
                        sort_order: 0
                      });

                      resolvedSubcategoryId = newSubcat.id;
                      resolvedSubcategoryCode = newSubcat.subcat_code;
                      subCategoryLookup[normalizedCode] = newSubcat;
                      console.log('[Variety Import] Auto-created subcategory:', subcatName, normalizedCode);
                    } catch (err) {
                      subcatWarnings.push(`Code "${primaryCode}" failed: ${err.message}`);
                    }
                  }
                }

                // UPSERT logic: Check for existing by variety_code OR normalized name
                let existing = [];
                
                if (row.variety_code) {
                  existing = await base44.entities.Variety.filter({ 
                    variety_code: row.variety_code 
                  });
                }
                
                if (existing.length === 0) {
                  // Fallback to normalized name matching
                  const allVarieties = await base44.entities.Variety.filter({ 
                    plant_type_id: resolvedTypeId 
                  });
                  const normalized = normalizeVarietyName(row.variety_name);
                  const nameMatch = allVarieties.find(v => 
                    normalizeVarietyName(v.variety_name) === normalized
                  );
                  if (nameMatch) {
                    existing = [nameMatch];
                  }
                }
                
                // Validate and normalize enum fields
                const validSpecies = ['annuum', 'chinense', 'baccatum', 'frutescens', 'pubescens', 'unknown'];
                const validSeedLineTypes = ['heirloom', 'hybrid', 'open_pollinated', 'unknown'];
                const validSeasonTimings = ['early', 'mid', 'late', 'unknown'];
                
                let species = row.species || null;
                if (species && !validSpecies.includes(species)) {
                  console.log(`[Variety Import] Invalid species "${species}", setting to "unknown"`);
                  species = 'unknown';
                }
                
                let seedLineType = row.seed_line_type || null;
                if (seedLineType && !validSeedLineTypes.includes(seedLineType)) {
                  console.log(`[Variety Import] Invalid seed_line_type "${seedLineType}", setting to "unknown"`);
                  seedLineType = 'unknown';
                }
                
                let seasonTiming = row.season_timing || null;
                if (seasonTiming && !validSeasonTimings.includes(seasonTiming)) {
                  console.log(`[Variety Import] Invalid season_timing "${seasonTiming}", setting to "unknown"`);
                  seasonTiming = 'unknown';
                }

                // Parse SHU fields (support both old and new)
                const scovilleMin = row.scoville_min || row.heat_scoville_min || null;
                const scovilleMax = row.scoville_max || row.heat_scoville_max || null;

                // NEW SYSTEM: Single primary subcategory, arrays synced from primary
                const varietyData = {
                  plant_type_id: resolvedTypeId,
                  plant_type_name: plantTypeName,
                  plant_subcategory_id: resolvedSubcategoryId,
                  plant_subcategory_ids: resolvedSubcategoryId ? [resolvedSubcategoryId] : [],
                  plant_subcategory_code: resolvedSubcategoryCode,
                  plant_subcategory_codes: resolvedSubcategoryCode ? [resolvedSubcategoryCode] : [],
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
                
                // Add optional fields only if present in CSV (blank-safe)
                if (row.description && row.description.trim()) varietyData.description = row.description;
                if (row.synonyms) varietyData.synonyms = row.synonyms.split('|');
                if (row.days_to_maturity && row.days_to_maturity.trim()) varietyData.days_to_maturity = parseInt(row.days_to_maturity);
                if (row.days_to_maturity_min && row.days_to_maturity_min.trim()) varietyData.days_to_maturity_min = parseInt(row.days_to_maturity_min);
                if (row.days_to_maturity_max && row.days_to_maturity_max.trim()) varietyData.days_to_maturity_max = parseInt(row.days_to_maturity_max);
                
                // Timing fields (blank-safe)
                if (row.start_indoors_weeks_min && row.start_indoors_weeks_min.trim()) varietyData.start_indoors_weeks_min = parseFloat(row.start_indoors_weeks_min);
                if (row.start_indoors_weeks_max && row.start_indoors_weeks_max.trim()) varietyData.start_indoors_weeks_max = parseFloat(row.start_indoors_weeks_max);
                if (row.transplant_weeks_after_last_frost_min && row.transplant_weeks_after_last_frost_min.trim()) varietyData.transplant_weeks_after_last_frost_min = parseFloat(row.transplant_weeks_after_last_frost_min);
                if (row.transplant_weeks_after_last_frost_max && row.transplant_weeks_after_last_frost_max.trim()) varietyData.transplant_weeks_after_last_frost_max = parseFloat(row.transplant_weeks_after_last_frost_max);
                if (row.direct_sow_weeks_min && row.direct_sow_weeks_min.trim()) varietyData.direct_sow_weeks_min = parseFloat(row.direct_sow_weeks_min);
                if (row.direct_sow_weeks_max && row.direct_sow_weeks_max.trim()) varietyData.direct_sow_weeks_max = parseFloat(row.direct_sow_weeks_max);
                if (row.spacing_recommended && row.spacing_recommended.trim()) varietyData.spacing_recommended = parseInt(row.spacing_recommended);
                if (row.spacing_min && row.spacing_min.trim()) varietyData.spacing_min = parseInt(row.spacing_min);
                if (row.spacing_max && row.spacing_max.trim()) varietyData.spacing_max = parseInt(row.spacing_max);
                if (row.plant_height_typical && row.plant_height_typical.trim()) varietyData.plant_height_typical = row.plant_height_typical;
                if (row.height_min && row.height_min.trim()) varietyData.height_min = parseInt(row.height_min);
                if (row.height_max && row.height_max.trim()) varietyData.height_max = parseInt(row.height_max);
                if (row.sun_requirement && row.sun_requirement.trim()) varietyData.sun_requirement = row.sun_requirement;
                if (row.water_requirement && row.water_requirement.trim()) varietyData.water_requirement = row.water_requirement;
                if (row.growth_habit && row.growth_habit.trim()) varietyData.growth_habit = row.growth_habit;
                if (row.flavor_profile && row.flavor_profile.trim()) varietyData.flavor_profile = row.flavor_profile;
                if (row.uses) varietyData.uses = row.uses;
                if (row.fruit_color) varietyData.fruit_color = row.fruit_color;
                if (row.fruit_shape) varietyData.fruit_shape = row.fruit_shape;
                if (row.fruit_size) varietyData.fruit_size = row.fruit_size;
                if (row.pod_color) varietyData.pod_color = row.pod_color;
                if (row.pod_shape) varietyData.pod_shape = row.pod_shape;
                if (row.pod_size) varietyData.pod_size = row.pod_size;
                if (row.disease_resistance) varietyData.disease_resistance = row.disease_resistance;
                if (row.breeder_or_origin) varietyData.breeder_or_origin = row.breeder_or_origin;
                if (row.seed_saving_notes) varietyData.seed_saving_notes = row.seed_saving_notes;
                if (row.pollination_notes) varietyData.pollination_notes = row.pollination_notes;
                if (row.sources) varietyData.sources = row.sources.split('|');
                if (row.affiliate_url) varietyData.affiliate_url = row.affiliate_url;
                if (row.popularity_tier) varietyData.popularity_tier = row.popularity_tier;
                if (row.grower_notes) varietyData.grower_notes = row.grower_notes;
                if (row.source_attribution) varietyData.source_attribution = row.source_attribution;
                if (scovilleMin) {
                  varietyData.scoville_min = parseInt(scovilleMin);
                  varietyData.heat_scoville_min = parseInt(scovilleMin);
                }
                if (scovilleMax) {
                  varietyData.scoville_max = parseInt(scovilleMax);
                  varietyData.heat_scoville_max = parseInt(scovilleMax);
                }
                if (species) varietyData.species = species;
                if (seedLineType) varietyData.seed_line_type = seedLineType;
                if (seasonTiming) varietyData.season_timing = seasonTiming;
                
                // Booleans - default to false if not specified
                varietyData.trellis_required = row.trellis_required === 'true' || row.trellis_required === '1';
                varietyData.container_friendly = row.container_friendly === 'true' || row.container_friendly === '1';
                varietyData.is_ornamental = row.is_ornamental === 'true' || row.is_ornamental === '1';
                varietyData.is_organic = row.is_organic === 'true' || row.is_organic === '1';

                if (existing.length > 0) {
                  // UPSERT: Only update non-empty fields to preserve existing data
                  const existingData = existing[0];
                  const updatePayload = {};
                  
                  // Always update core fields
                  updatePayload.variety_name = varietyData.variety_name;
                  updatePayload.plant_type_id = varietyData.plant_type_id;
                  updatePayload.plant_type_name = varietyData.plant_type_name;
                  updatePayload.plant_subcategory_id = varietyData.plant_subcategory_id;
                  updatePayload.plant_subcategory_ids = varietyData.plant_subcategory_ids;
                  updatePayload.variety_code = varietyData.variety_code;
                  updatePayload.extended_data = varietyData.extended_data;
                  
                  // Only update optional fields if CSV has non-empty values (blank-safe upsert)
                  // CRITICAL: Check for both null AND empty string to prevent blanks from overwriting
                  if (varietyData.description && varietyData.description.trim()) updatePayload.description = varietyData.description;
                  if (varietyData.days_to_maturity !== null && varietyData.days_to_maturity !== undefined) updatePayload.days_to_maturity = varietyData.days_to_maturity;
                  if (varietyData.spacing_recommended) updatePayload.spacing_recommended = varietyData.spacing_recommended;
                  if (varietyData.sun_requirement) updatePayload.sun_requirement = varietyData.sun_requirement;
                  if (varietyData.water_requirement) updatePayload.water_requirement = varietyData.water_requirement;
                  if (varietyData.growth_habit) updatePayload.growth_habit = varietyData.growth_habit;
                  if (varietyData.species) updatePayload.species = varietyData.species;
                  if (varietyData.seed_line_type) updatePayload.seed_line_type = varietyData.seed_line_type;
                  if (varietyData.season_timing) updatePayload.season_timing = varietyData.season_timing;
                  if (varietyData.grower_notes) updatePayload.grower_notes = varietyData.grower_notes;
                  if (varietyData.scoville_min !== null && varietyData.scoville_min !== undefined) updatePayload.scoville_min = varietyData.scoville_min;
                  if (varietyData.scoville_max !== null && varietyData.scoville_max !== undefined) updatePayload.scoville_max = varietyData.scoville_max;
                  if (varietyData.heat_scoville_min !== null && varietyData.heat_scoville_min !== undefined) updatePayload.heat_scoville_min = varietyData.heat_scoville_min;
                  if (varietyData.heat_scoville_max !== null && varietyData.heat_scoville_max !== undefined) updatePayload.heat_scoville_max = varietyData.heat_scoville_max;
                  if (row.direct_sow_weeks_min) updatePayload.direct_sow_weeks_min = parseFloat(row.direct_sow_weeks_min);
                  if (row.direct_sow_weeks_max) updatePayload.direct_sow_weeks_max = parseFloat(row.direct_sow_weeks_max);
                  if (row.start_indoors_weeks_min) updatePayload.start_indoors_weeks_min = parseFloat(row.start_indoors_weeks_min);
                  if (row.start_indoors_weeks_max) updatePayload.start_indoors_weeks_max = parseFloat(row.start_indoors_weeks_max);
                  if (row.transplant_weeks_after_last_frost_min) updatePayload.transplant_weeks_after_last_frost_min = parseFloat(row.transplant_weeks_after_last_frost_min);
                  if (row.transplant_weeks_after_last_frost_max) updatePayload.transplant_weeks_after_last_frost_max = parseFloat(row.transplant_weeks_after_last_frost_max);
                  
                  // Always set booleans (they have defaults)
                  updatePayload.trellis_required = varietyData.trellis_required;
                  updatePayload.container_friendly = varietyData.container_friendly;
                  updatePayload.is_ornamental = varietyData.is_ornamental;
                  updatePayload.is_organic = varietyData.is_organic;
                  
                  await base44.entities.Variety.update(existing[0].id, updatePayload);
                  updated++;
                } else {
                  await base44.entities.Variety.create(varietyData);
                  inserted++;
                }
                continue;
              }

              if (importMode === 'INSERT_ONLY') {
                await base44.entities[item.key].create(row);
                inserted++;
              } else if (importMode === 'UPSERT_BY_ID') {
                // Try to find existing by id
                const existing = row.id ? await base44.entities[item.key].filter({ id: row.id }) : [];
                
                if (existing.length > 0) {
                  await base44.entities[item.key].update(existing[0].id, row);
                  updated++;
                } else {
                  await base44.entities[item.key].create(row);
                  inserted++;
                }
              }
            } catch (error) {
              console.error(`Error importing ${item.key}:`, error);
              skipped++;
              skipReasons.push({ row, reason: error.message });
            }
          }

          // Update progress periodically during import
          if ((inserted + updated + skipped + rejected) % 10 === 0) {
            setResults({
              ...importResults,
              [item.key]: {
                status: 'in_progress',
                message: `Processing... ${inserted + updated} / ${data.length}`,
                inserted,
                updated,
                skipped,
                rejected
              }
            });
          }

          importResults[item.key] = {
            status: 'success',
            message: 'Import completed',
            inserted,
            updated,
            skipped,
            rejected,
            skipReasons: skipReasons.slice(0, 20) // First 20 reasons
          };

          // Auto-normalize after Variety import
          if (item.key === 'Variety' && !dryRun && (inserted > 0 || updated > 0)) {
            console.log('[Import] Auto-running normalization after Variety import...');
            try {
              await base44.functions.invoke('normalizeVarietySubcategories', { dry_run: false });
              console.log('[Import] Normalization completed');
            } catch (error) {
              console.error('[Import] Normalization failed:', error);
            }
          }
          }
          }

          setResults(importResults);
      
      if (!dryRun) {
        toast.success('Import completed successfully!');
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

      {/* Import Method */}
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
              <p className="font-semibold text-xs text-blue-600 mb-1">OPTIONAL:</p>
              <ul className="text-xs text-gray-700 space-y-0.5">
                <li>• description, synonyms</li>
                <li>• height, water, growth_habit</li>
                <li>• scoville (peppers)</li>
                <li>• trellis, container flags</li>
                <li>• All others (see template)</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 border-t pt-3">
            <strong>Note:</strong> Blank cells will NOT overwrite existing data on UPSERT. Only populated cells update fields.
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

          {/* Individual File Uploads */}
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

          <div className="flex items-center justify-between">
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