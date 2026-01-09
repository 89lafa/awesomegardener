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
              }

              if (item.key === 'Variety') {
                if (!row.variety_name || !row.plant_type_id) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing variety_name or plant_type_id' });
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

                // Resolve plant_subcategory_id using multiple strategies
                let resolvedSubcategoryId = null;
                
                // Strategy 1: Direct ID provided
                if (row.plant_subcategory_id) {
                  const subcat = subCategoryLookup[row.plant_subcategory_id];
                  if (subcat && subcat.plant_type_id === resolvedTypeId) {
                    resolvedSubcategoryId = subcat.id;
                  } else {
                    rejected++;
                    skipReasons.push({ 
                      row, 
                      reason: `Invalid plant_subcategory_id: ${row.plant_subcategory_id} (doesn't exist or wrong plant_type)` 
                    });
                    continue;
                  }
                }
                // Strategy 2: Subcategory code provided (preferred for imports)
                else if (row.plant_subcategory_code) {
                  // Normalize code: TOMATO_CHERRY -> PSC_TOMATO_CHERRY
                  let normalizedCode = row.plant_subcategory_code;
                  if (!normalizedCode.startsWith('PSC_')) {
                    normalizedCode = 'PSC_' + normalizedCode;
                  }
                  
                  const lookupKey = `${resolvedTypeId}_${normalizedCode}`;
                  let subcat = subCategoryLookup[lookupKey];
                  
                  if (!subcat) {
                    // Try without plant_type_id prefix
                    subcat = Object.values(subCategoryLookup).find(sc => 
                      sc.subcat_code === normalizedCode && sc.plant_type_id === resolvedTypeId
                    );
                  }
                  
                  if (subcat) {
                    resolvedSubcategoryId = subcat.id;
                  } else {
                    // Create new subcategory
                    const subcatName = row.plant_subcategory_name || 
                                      normalizedCode.replace(/^PSC_/, '').replace(/_/g, ' ')
                                        .split(' ')
                                        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                                        .join(' ');
                    
                    const newSubcat = await base44.entities.PlantSubCategory.create({
                      subcat_code: normalizedCode,
                      plant_type_id: resolvedTypeId,
                      name: subcatName,
                      is_active: true,
                      sort_order: 0
                    });
                    
                    resolvedSubcategoryId = newSubcat.id;
                    subCategoryLookup[lookupKey] = newSubcat;
                    subCategoryLookup[normalizedCode] = newSubcat;
                    console.log('[Variety Import] Created subcategory:', subcatName, normalizedCode);
                  }
                }
                // Strategy 3: Subcategory name only
                else if (row.plant_subcategory_name) {
                  const subcat = Object.values(subCategoryLookup).find(sc => 
                    sc.plant_type_id === resolvedTypeId && 
                    sc.name?.toLowerCase() === row.plant_subcategory_name.toLowerCase()
                  );
                  
                  if (subcat) {
                    resolvedSubcategoryId = subcat.id;
                  } else {
                    // Create with generated code
                    const generatedCode = 'PSC_' + plantType.plant_type_code + '_' + 
                                         row.plant_subcategory_name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                    
                    const newSubcat = await base44.entities.PlantSubCategory.create({
                      subcat_code: generatedCode,
                      plant_type_id: resolvedTypeId,
                      name: row.plant_subcategory_name,
                      is_active: true,
                      sort_order: 0
                    });
                    
                    resolvedSubcategoryId = newSubcat.id;
                    subCategoryLookup[`${resolvedTypeId}_${generatedCode}`] = newSubcat;
                    console.log('[Variety Import] Created subcategory from name:', row.plant_subcategory_name);
                  }
                }

                // UPSERT logic: Check for existing by ID, variety_code, OR normalized name
                let existing = [];
                
                // Priority 1: ID match
                if (row.id) {
                  existing = await base44.entities.Variety.filter({ id: row.id });
                }
                
                // Priority 2: variety_code match
                if (existing.length === 0 && row.variety_code) {
                  existing = await base44.entities.Variety.filter({ 
                    variety_code: row.variety_code 
                  });
                }
                
                // Priority 3: normalized name matching
                if (existing.length === 0) {
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
                
                // Build subcategory ids array
                let subcatIds = [];
                if (resolvedSubcategoryId) {
                  subcatIds = [resolvedSubcategoryId];
                }

                const varietyData = {
                  plant_type_id: resolvedTypeId,
                  plant_type_name: plantTypeName,
                  plant_subcategory_id: resolvedSubcategoryId,
                  plant_subcategory_ids: subcatIds,
                  variety_code: row.variety_code || null,
                  variety_name: row.variety_name,
                  description: row.description || null,
                  synonyms: row.synonyms ? row.synonyms.split('|') : [],
                  days_to_maturity: row.days_to_maturity ? parseInt(row.days_to_maturity) : null,
                  days_to_maturity_min: row.days_to_maturity_min ? parseInt(row.days_to_maturity_min) : null,
                  days_to_maturity_max: row.days_to_maturity_max ? parseInt(row.days_to_maturity_max) : null,
                  spacing_recommended: row.spacing_recommended ? parseInt(row.spacing_recommended) : null,
                  spacing_min: row.spacing_min ? parseInt(row.spacing_min) : null,
                  spacing_max: row.spacing_max ? parseInt(row.spacing_max) : null,
                  plant_height_typical: row.plant_height_typical || null,
                  height_min: row.height_min ? parseInt(row.height_min) : null,
                  height_max: row.height_max ? parseInt(row.height_max) : null,
                  sun_requirement: row.sun_requirement || null,
                  water_requirement: row.water_requirement || null,
                  trellis_required: row.trellis_required === 'true' || row.trellis_required === '1',
                  container_friendly: row.container_friendly === 'true' || row.container_friendly === '1',
                  growth_habit: row.growth_habit || null,
                  species: species,
                  is_ornamental: row.is_ornamental === 'true' || row.is_ornamental === '1',
                  seed_line_type: seedLineType,
                  is_organic: row.is_organic === 'true' || row.is_organic === '1',
                  season_timing: seasonTiming,
                  flavor_profile: row.flavor_profile || null,
                  uses: row.uses || null,
                  fruit_color: row.fruit_color || null,
                  fruit_shape: row.fruit_shape || null,
                  fruit_size: row.fruit_size || null,
                  pod_color: row.pod_color || null,
                  pod_shape: row.pod_shape || null,
                  pod_size: row.pod_size || null,
                  disease_resistance: row.disease_resistance || null,
                  breeder_or_origin: row.breeder_or_origin || null,
                  seed_saving_notes: row.seed_saving_notes || null,
                  pollination_notes: row.pollination_notes || null,
                  sources: row.sources ? row.sources.split('|') : [],
                  affiliate_url: row.affiliate_url || null,
                  popularity_tier: row.popularity_tier || null,
                  grower_notes: row.grower_notes || null,
                  scoville_min: row.scoville_min ? parseFloat(row.scoville_min) : null,
                  scoville_max: row.scoville_max ? parseFloat(row.scoville_max) : null,
                  heat_scoville_min: row.heat_scoville_min ? parseFloat(row.heat_scoville_min) : null,
                  heat_scoville_max: row.heat_scoville_max ? parseFloat(row.heat_scoville_max) : null,
                  source_attribution: row.source_attribution || 'CSV Import',
                  status: 'active',
                  is_custom: false
                };

                if (existing.length > 0) {
                  await base44.entities.Variety.update(existing[0].id, varietyData);
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

          importResults[item.key] = {
            status: 'success',
            message: 'Import completed',
            inserted,
            updated,
            skipped,
            rejected,
            skipReasons: skipReasons.slice(0, 20) // First 20 reasons
          };
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