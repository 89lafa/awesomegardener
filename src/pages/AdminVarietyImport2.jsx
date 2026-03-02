import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Loader2, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// ── Columns that are resolved from codes (not direct DB fields)
const CODE_COLUMNS = new Set([
  'plant_type_code','plant_type_common_name','plant_subcategory_code','plant_subcategory_codes',
  'id','created_date','updated_date','created_by_id','is_sample',
  'is_perennial_species','perennial_from_zone','zone_7a_behavior',
]);

// ── ALL Variety schema columns (145 columns) ──────────────────────────────────
const ALL_COLUMNS = [
  'variety_name','plant_type_id','plant_type_name','plant_subcategory_id','plant_subcategory_ids',
  'variety_code','plant_type_code','plant_subcategory_code','plant_subcategory_codes','description','synonyms','days_to_maturity','days_to_maturity_min','days_to_maturity_max',
  'start_indoors_weeks','start_indoors_weeks_min','start_indoors_weeks_max',
  'transplant_weeks_after_last_frost_min','transplant_weeks_after_last_frost_max',
  'direct_sow_weeks_min','direct_sow_weeks_max',
  'spacing_recommended','spacing_min','spacing_max',
  'plant_height_typical','height_min','height_max',
  'sun_requirement','water_requirement','trellis_required','container_friendly',
  'growth_habit','species','is_ornamental','is_organic',
  'seed_line_type','season_timing','flavor_profile','uses',
  'fruit_color','fruit_shape','fruit_size','pod_color','pod_shape','pod_size',
  'disease_resistance','breeder_or_origin','seed_saving_notes','pollination_notes',
  'sources','affiliate_url','popularity_tier','grower_notes','source_attribution',
  'scoville_min','scoville_max','heat_scoville_min','heat_scoville_max',
  // Indoor plant fields
  'light_requirement_indoor','light_tolerance_range','min_light_hours','max_light_hours',
  'grow_light_compatible','watering_frequency_range','watering_method_preferred',
  'soil_dryness_rule','drought_tolerant','overwater_sensitivity',
  'temp_min_f','temp_max_f','temp_ideal_min_f','temp_ideal_max_f','cold_draft_sensitive',
  'humidity_preference','humidity_support_method','misting_beneficial',
  'soil_type_recommended','soil_drainage_speed','drainage_holes_required','recommended_pot_type',
  'fertilizer_type','fertilizer_frequency','fertilizer_strength','dormant_season_feeding',
  'growth_pattern','mature_indoor_height','mature_indoor_width','growth_speed',
  'needs_support','pruning_needs','repot_frequency_years','rootbound_tolerance','best_repot_season',
  'toxic_to_cats','toxic_to_dogs','toxic_to_humans','sap_irritant','pet_safe','toxicity_notes',
  'common_pests','common_diseases','pest_susceptibility','preventive_care_tips',
  'winter_dormancy','reduced_winter_watering','winter_leaf_drop_normal','seasonal_notes',
  'propagation_methods','propagation_difficulty','propagation_best_season','propagation_notes',
  'care_difficulty','air_purifying','display_style','variegation_type','flowering_indoors','fragrant',
  'water_type_required','fertilizer_rule','dormancy_required',
  'dormancy_temp_min_f','dormancy_temp_max_f','dormancy_duration_months_min','dormancy_duration_months_max',
  'soil_type_required','root_cooling_required','root_temp_max_f','is_aquatic',
  'care_warnings','images','traits','extended_data',
  'status','is_custom',
];

// Fields that have strict enums — free-text values from CSV will break 422
const ENUM_COLS = new Set([
  'sun_requirement','water_requirement','seed_line_type','season_timing','popularity_tier',
  'growth_habit','light_requirement_indoor','watering_method_preferred','soil_dryness_rule',
  'soil_type_recommended','soil_type_required','overwater_sensitivity','soil_drainage_speed',
  'humidity_preference','humidity_support_method','rootbound_tolerance','recommended_pot_type',
  'fertilizer_type','fertilizer_frequency','fertilizer_strength','growth_pattern','growth_speed',
  'pruning_needs','best_repot_season','propagation_difficulty','propagation_best_season',
  'care_difficulty','variegation_type','dormancy_required','water_type_required','fertilizer_rule',
  'status','plant_growth',
]);

// Valid values per enum field (to validate before sending)
const ENUM_VALUES = {
  sun_requirement: ['full_sun','partial_sun','partial_shade','full_shade'],
  water_requirement: ['low','moderate','high'],
  seed_line_type: ['heirloom','hybrid','open_pollinated','unknown'],
  season_timing: ['early','mid','late','unknown'],
  popularity_tier: ['common','popular','rare','heirloom'],
  growth_habit: [],  // free text — keep as-is but allow
  soil_type_required: ['standard','carnivorous_mix','orchid_mix','succulent_mix','aquatic_none','custom'],
  dormancy_required: ['none','required_cold','optional_beneficial','succulent_phase','turion_aquatic'],
  water_type_required: ['any','distilled_only','distilled_preferred'],
  fertilizer_rule: ['normal','foliar_only_dilute','none_ever'],
  status: ['active','pending_review','removed'],
  care_difficulty: ['beginner','easy','moderate','advanced','expert'],
  propagation_difficulty: ['beginner','easy','moderate','advanced'],
  overwater_sensitivity: ['low','moderate','high','extreme'],
  soil_drainage_speed: ['fast','moderate','water_retentive'],
  humidity_preference: ['low','medium','high','very_high'],
  rootbound_tolerance: ['sensitive','moderate','tolerant','prefers_rootbound'],
  fertilizer_type: ['balanced','high_nitrogen','bloom_booster','orchid_specific','none'],
  fertilizer_frequency: ['weekly_dilute','biweekly','monthly','seasonal_only'],
  fertilizer_strength: ['full','half','quarter'],
  best_repot_season: ['spring','spring_summer','anytime'],
  propagation_best_season: ['spring','spring_summer','anytime'],
  variegation_type: ['none','stable','unstable','chimeral'],
  growth_speed: ['slow','moderate','fast'],
};

const BOOL_COLS = new Set([
  'trellis_required','container_friendly','is_ornamental','is_organic','grow_light_compatible',
  'drought_tolerant','cold_draft_sensitive','misting_beneficial','drainage_holes_required',
  'dormant_season_feeding','needs_support','winter_dormancy','reduced_winter_watering',
  'winter_leaf_drop_normal','air_purifying','flowering_indoors','fragrant','root_cooling_required',
  'is_aquatic','toxic_to_cats','toxic_to_dogs','toxic_to_humans','sap_irritant','pet_safe','is_custom',
]);

const NUM_COLS = new Set([
  'days_to_maturity','days_to_maturity_min','days_to_maturity_max',
  'start_indoors_weeks','start_indoors_weeks_min','start_indoors_weeks_max',
  'transplant_weeks_after_last_frost_min','transplant_weeks_after_last_frost_max',
  'direct_sow_weeks_min','direct_sow_weeks_max',
  'spacing_recommended','spacing_min','spacing_max',
  'height_min','height_max',
  'scoville_min','scoville_max','heat_scoville_min','heat_scoville_max',
  'min_light_hours','max_light_hours',
  'temp_min_f','temp_max_f','temp_ideal_min_f','temp_ideal_max_f',
  'dormancy_temp_min_f','dormancy_temp_max_f','dormancy_duration_months_min','dormancy_duration_months_max',
  'root_temp_max_f',
]);

const JSON_COLS = new Set([
  'synonyms','sources','images','care_warnings','traits','extended_data','plant_subcategory_ids',
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fields that must NEVER be sent in a create/update payload
const FORBIDDEN_FIELDS = new Set([
  'id','created_date','updated_date','created_by','created_by_id','is_sample',
  'plant_type_code','plant_type_common_name','plant_subcategory_code','plant_subcategory_codes',
  'is_perennial_species','perennial_from_zone','zone_7a_behavior',
  'plant_subcategory_ids', // legacy array — causes 422, we only use plant_subcategory_id
]);

function cleanPayload(payload) {
  const clean = {};
  for (const [k, v] of Object.entries(payload)) {
    if (FORBIDDEN_FIELDS.has(k)) continue;
    if (!ALL_COLUMNS.includes(k)) continue; // only known schema fields
    clean[k] = v;
  }
  return clean;
}

async function apiRetry(fn, label = '', maxRetries = 6) {
  let backoff = 4000;
  for (let i = 0; i <= maxRetries; i++) {
    try { return await fn(); } catch (err) {
      const status = err?.status || err?.response?.status;
      const isRL = (err?.message || '').toLowerCase().includes('rate') || status === 429;
      const isServerErr = status >= 500 && status < 600;
      if ((isRL || isServerErr) && i < maxRetries) {
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 60000);
        continue;
      }
      throw err;
    }
  }
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (!lines.length) return [];

  const parseLine = (line) => {
    const vals = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i], n = line[i + 1];
      if (c === '"') { if (inQ && n === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
      else if ((c === ',' || c === '\t') && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    vals.push(cur.trim());
    return vals;
  };

  const headers = parseLine(lines[0]).map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, ''); });
    return obj;
  });
}

function castValue(col, raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  if (BOOL_COLS.has(col)) {
    return raw === 'true' || raw === 'TRUE' || raw === '1' || raw === true;
  }
  if (NUM_COLS.has(col)) {
    const n = parseFloat(raw);
    return isNaN(n) ? null : n;
  }
  if (JSON_COLS.has(col)) {
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch {
      if (typeof raw === 'string' && raw.includes('|')) return raw.split('|').map(s => s.trim());
      if (typeof raw === 'string' && raw.length > 0) return [raw];
      return raw;
    }
  }
  // Validate enum values — if invalid, return null (don't send bad data)
  if (ENUM_COLS.has(col) && ENUM_VALUES[col] && ENUM_VALUES[col].length > 0) {
    const valid = ENUM_VALUES[col];
    if (valid.includes(raw)) return raw;
    // Try lowercase match
    const lower = (raw || '').toLowerCase().trim();
    const match = valid.find(v => v.toLowerCase() === lower);
    return match || null; // return null for invalid enum — skip this field
  }
  return raw;
}

export default function AdminVarietyImport2() {
  const [user, setUser] = React.useState(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [upsertMode, setUpsertMode] = useState('preserve_filled'); // preserve_filled | overwrite_all | selective
  const [selectedCols, setSelectedCols] = useState(new Set(['variety_name', 'plant_type_id']));
  const [showColPicker, setShowColPicker] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(u => {
      if (!u || u.role !== 'admin') { window.location.href = '/Dashboard'; return; }
      setUser(u);
    });
  }, []);

  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResults(null);
    const text = await f.text();
    const data = parseCSV(text);
    if (data.length) {
      const hdrs = Object.keys(data[0]);
      setHeaders(hdrs);
      setParsedData(data);
      // Pre-select columns that appear in file AND are in schema
      const fileColsInSchema = hdrs.filter(h => ALL_COLUMNS.includes(h));
      setSelectedCols(new Set(fileColsInSchema));
      toast.success(`Parsed ${data.length} rows, ${hdrs.length} columns`);
    }
  };

  const toggleCol = (col) => {
    setSelectedCols(prev => {
      const s = new Set(prev);
      if (s.has(col)) s.delete(col); else s.add(col);
      return s;
    });
  };

  const handleImport = async () => {
    if (!parsedData.length) { toast.error('No data loaded'); return; }
    setImporting(true);
    setResults(null);
    setProgress({ current: 0, total: parsedData.length, inserted: 0, updated: 0, skipped: 0, rejected: 0 });

    try {
      // Pre-load lookups
      toast.info('Loading plant types and subcategories...');
      const [allPT, allSC, allVar] = await Promise.all([
        apiRetry(() => base44.entities.PlantType.list('common_name', 500), 'PlantTypes'),
        apiRetry(() => base44.entities.PlantSubCategory.list('subcat_code', 5000), 'SubCats'),
        apiRetry(() => base44.entities.Variety.list('variety_name', 9999), 'Varieties'),
      ]);

      const ptById = {}, ptByCode = {}, ptByName = {};
      allPT.forEach(pt => {
        ptById[pt.id] = pt;
        if (pt.plant_type_code) ptByCode[pt.plant_type_code] = pt;
        if (pt.common_name) ptByName[pt.common_name.toLowerCase()] = pt;
      });

      const scById = {}, scByCode = {};
      allSC.forEach(sc => {
        scById[sc.id] = sc;
        if (sc.subcat_code) scByCode[sc.subcat_code] = sc;
      });

      const varByCode = {}, varByTypeAndName = {};
      const norm = n => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
      allVar.forEach(v => {
        if (v.variety_code) varByCode[v.variety_code] = v;
        if (v.plant_type_id && v.variety_name) {
          varByTypeAndName[`${v.plant_type_id}__${norm(v.variety_name)}`] = v;
        }
      });

      let inserted = 0, updated = 0, skipped = 0, rejected = 0;
      const skipReasons = [];
      const BATCH = 3; // smaller batch for reliability

      for (let i = 0; i < parsedData.length; i += BATCH) {
        const chunk = parsedData.slice(i, i + BATCH);

        for (const row of chunk) {
          try {
            // Accept variety_name from multiple possible column names
            const varietyName = (row.variety_name || row.name || '').trim();
            if (!varietyName) {
              rejected++;
              skipReasons.push(`Row ${i + 1}: Missing variety_name`);
              continue;
            }

            // Resolve plant type: try plant_type_id as direct ID OR as code, then by code column, then by name
            const pt = ptById[row.plant_type_id]
              || ptByCode[row.plant_type_id]
              || ptByCode[row.plant_type_code]
              || ptByName[(row.plant_type_common_name || '').toLowerCase()]
              || ptByName[(row.plant_type_name || '').toLowerCase()];

            if (!pt) {
              rejected++;
              skipReasons.push(`Unknown plant type: "${row.plant_type_id || row.plant_type_code || row.plant_type_name}" for "${varietyName}"`);
              continue;
            }

            // Resolve subcategory
            let resolvedSubcatId = null;
            if (row.plant_subcategory_id && row.plant_subcategory_id.trim()) {
              resolvedSubcatId = scById[row.plant_subcategory_id.trim()]?.id || null;
            }
            if (!resolvedSubcatId && row.plant_subcategory_code && row.plant_subcategory_code.trim()) {
              resolvedSubcatId = scByCode[row.plant_subcategory_code.trim()]?.id || null;
            }
            if (!resolvedSubcatId && row.plant_subcategory_codes) {
              try {
                let codes = row.plant_subcategory_codes;
                if (typeof codes === 'string') {
                  codes = codes.startsWith('[') ? JSON.parse(codes) : codes.split('|').map(s => s.trim());
                }
                if (Array.isArray(codes)) {
                  for (const code of codes) {
                    const sc = scByCode[code.trim()] || scById[code.trim()];
                    if (sc) { resolvedSubcatId = sc.id; break; }
                  }
                }
              } catch { /* ignore */ }
            }

            // Find existing variety
            let existing = null;
            if (row.variety_code) existing = varByCode[row.variety_code];
            if (!existing) existing = varByTypeAndName[`${pt.id}__${norm(varietyName)}`];

            // Build raw payload — iterate over CSV columns that exist in this row
            const rawPayload = {};
            const colsToProcess = upsertMode === 'selective'
              ? [...selectedCols]
              : headers.filter(h => ALL_COLUMNS.includes(h) && !FORBIDDEN_FIELDS.has(h));

            for (const col of colsToProcess) {
              if (FORBIDDEN_FIELDS.has(col)) continue;
              const raw = row[col];
              if (raw === undefined || raw === null || raw === '') continue;

              if (upsertMode === 'preserve_filled' && existing) {
                const existingVal = existing[col];
                const hasValue = existingVal !== null && existingVal !== undefined && existingVal !== '' &&
                  !(Array.isArray(existingVal) && existingVal.length === 0);
                if (hasValue && !['variety_name', 'plant_type_id'].includes(col)) continue;
              }

              const casted = castValue(col, raw);
              if (casted !== null) rawPayload[col] = casted;
            }

            // Always set core identity fields
            rawPayload.plant_type_id = pt.id;
            rawPayload.plant_type_name = pt.common_name;
            rawPayload.variety_name = varietyName;

            // Set subcategory conditionally
            if (resolvedSubcatId) {
              if (upsertMode === 'overwrite_all' || upsertMode === 'selective') {
                rawPayload.plant_subcategory_id = resolvedSubcatId;
                rawPayload.plant_subcategory_ids = [resolvedSubcatId];
              } else if (upsertMode === 'preserve_filled' && !existing?.plant_subcategory_id) {
                rawPayload.plant_subcategory_id = resolvedSubcatId;
                rawPayload.plant_subcategory_ids = [resolvedSubcatId];
              }
            }

            // Strip any unknown or forbidden fields before sending to API
            const payload = cleanPayload(rawPayload);

            if (dryRun) {
              existing ? updated++ : inserted++;
              continue;
            }

            // Actual write
            if (existing) {
              await apiRetry(
                () => base44.entities.Variety.update(existing.id, payload),
                `Update ${varietyName}`
              );
              const merged = { ...existing, ...payload };
              varByTypeAndName[`${pt.id}__${norm(varietyName)}`] = merged;
              if (row.variety_code) varByCode[row.variety_code] = merged;
              updated++;
            } else {
              const toCreate = { ...payload, status: payload.status || 'active', is_custom: false };
              const created = await apiRetry(
                () => base44.entities.Variety.create(toCreate),
                `Create ${varietyName}`
              );
              varByTypeAndName[`${pt.id}__${norm(varietyName)}`] = created;
              if (row.variety_code) varByCode[row.variety_code] = created;
              inserted++;
            }
          } catch (err) {
            skipped++;
            skipReasons.push(`"${row.variety_name || row.name || '?'}": ${err.message}`);
          }
        }

        setProgress({ current: Math.min(i + BATCH, parsedData.length), total: parsedData.length, inserted, updated, skipped, rejected });
        if (i + BATCH < parsedData.length) await sleep(2000);
      }

      setResults({ inserted, updated, skipped, rejected, skipReasons: skipReasons.slice(0, 30) });
      toast.success(dryRun ? `Dry run: ${inserted + updated} would be processed` : `Done! +${inserted} inserted, ↑${updated} updated`);
    } catch (err) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  if (!user) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  const colsInFile = headers.filter(h => ALL_COLUMNS.includes(h));
  const colsNotInSchema = headers.filter(h => !ALL_COLUMNS.includes(h) && !CODE_COLUMNS.has(h));

  return (
    <ErrorBoundary fallbackTitle="Import Error" fallbackMessage="An error occurred. Please refresh.">
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Variety Import 2 — Advanced</h1>
          <p className="text-gray-600 mt-1">Full 145-column import with smart upsert options. Does NOT touch the original import tool.</p>
        </div>

        <Alert className="border-emerald-200 bg-emerald-50">
          <Info className="w-4 h-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800 text-sm">
            <strong>Key differences from Import 1:</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
              <li>Imports ALL 145 columns including care_warnings, images, traits, toxicity, etc.</li>
              <li>"Preserve Filled" mode never overwrites data that already exists in DB</li>
              <li>Subcategory is NEVER wiped — only set if CSV has a value AND existing row is empty</li>
              <li>"Selective" mode lets you choose exactly which columns to upsert</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* File Upload */}
        <Card>
          <CardHeader><CardTitle>1. Upload CSV</CardTitle></CardHeader>
          <CardContent>
            <Input type="file" accept=".csv" onChange={handleFile} />
            {parsedData.length > 0 && (
              <div className="mt-3 text-sm text-gray-600 space-y-1">
                <p>✅ <strong>{parsedData.length}</strong> rows parsed</p>
                <p>✅ <strong>{colsInFile.length}</strong> schema columns found in file</p>
                {colsNotInSchema.length > 0 && (
                  <p className="text-amber-600">⚠ {colsNotInSchema.length} unrecognized columns (ignored): {colsNotInSchema.slice(0, 5).join(', ')}{colsNotInSchema.length > 5 ? '...' : ''}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upsert Mode */}
        <Card>
          <CardHeader><CardTitle>2. Upsert Mode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { value: 'preserve_filled', label: '🛡️ Preserve Filled (Recommended)', desc: 'Only fills in EMPTY fields. Never overwrites existing data. Subcategory only set if currently empty.' },
              { value: 'overwrite_all', label: '🔄 Overwrite All', desc: 'Replaces ALL fields from CSV. Use with caution — overwrites existing subcategories and data.' },
              { value: 'selective', label: '🎯 Selective Columns', desc: 'You choose exactly which columns to update.' },
            ].map(opt => (
              <label key={opt.value} className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                <input type="radio" name="upsertMode" value={opt.value} checked={upsertMode === opt.value} onChange={e => setUpsertMode(e.target.value)} className="mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}

            {upsertMode === 'selective' && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setShowColPicker(!showColPicker)} className="gap-2">
                  {showColPicker ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Select Columns ({selectedCols.size} selected)
                </Button>
                {showColPicker && (
                  <div className="mt-3 border rounded-lg p-3 max-h-64 overflow-y-auto">
                    <div className="flex gap-2 mb-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedCols(new Set(colsInFile))}>All from file</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedCols(new Set(['variety_name','plant_type_id']))}>Required only</Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                      {ALL_COLUMNS.map(col => {
                        const inFile = headers.includes(col);
                        return (
                          <label key={col} className={`flex items-center gap-1.5 text-xs cursor-pointer ${!inFile ? 'opacity-40' : ''}`}>
                            <Checkbox
                              checked={selectedCols.has(col)}
                              onCheckedChange={() => toggleCol(col)}
                              disabled={!inFile}
                            />
                            <span className={inFile ? 'font-medium' : 'text-gray-400'}>{col}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import Options */}
        <Card>
          <CardHeader><CardTitle>3. Run Import</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Dry Run (preview only — no DB changes)</span>
            </label>

            {progress && importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing...</span>
                  <span className="font-semibold">{progress.current}/{progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-emerald-600 h-2 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span className="text-green-600">+{progress.inserted} new</span>
                  <span className="text-blue-600">↑{progress.updated} updated</span>
                  <span className="text-yellow-600">{progress.skipped} skipped</span>
                  <span className="text-red-600">{progress.rejected} rejected</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={importing || !parsedData.length}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2 w-full"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {dryRun ? 'Preview Import' : 'Start Import'} ({parsedData.length} rows)
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-emerald-200">
                <CardHeader><CardTitle>{dryRun ? '📋 Dry Run Preview' : '✅ Import Complete'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-green-50 rounded-lg"><p className="text-2xl font-bold text-green-700">{results.inserted}</p><p className="text-xs text-green-600">Inserted</p></div>
                    <div className="p-3 bg-blue-50 rounded-lg"><p className="text-2xl font-bold text-blue-700">{results.updated}</p><p className="text-xs text-blue-600">Updated</p></div>
                    <div className="p-3 bg-yellow-50 rounded-lg"><p className="text-2xl font-bold text-yellow-700">{results.skipped}</p><p className="text-xs text-yellow-600">Errors</p></div>
                    <div className="p-3 bg-red-50 rounded-lg"><p className="text-2xl font-bold text-red-700">{results.rejected}</p><p className="text-xs text-red-600">Rejected</p></div>
                  </div>
                  {results.skipReasons.length > 0 && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-xs font-semibold text-yellow-800 mb-2">Issues:</p>
                      {results.skipReasons.map((r, i) => <p key={i} className="text-xs text-yellow-700">{r}</p>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </ErrorBoundary>
  );
}