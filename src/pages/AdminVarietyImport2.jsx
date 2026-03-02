import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Upload, CheckCircle2, AlertCircle, Loader2, Info, ChevronDown, ChevronUp, ShieldAlert
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

// ─── COLUMNS USED ONLY FOR LOOKUPS — never written directly to DB ─────────────
const CODE_COLUMNS = new Set([
  'plant_type_code', 'plant_type_common_name',
  'plant_subcategory_code', 'plant_subcategory_codes',
  'id', 'created_date', 'updated_date', 'created_by_id', 'is_sample',
  'is_perennial_species', 'perennial_from_zone', 'zone_7a_behavior',
]);

// ─── FIELDS NEVER SENT IN CREATE/UPDATE PAYLOAD ──────────────────────────────
const FORBIDDEN_FIELDS = new Set([
  'id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'is_sample',
  'plant_type_code', 'plant_type_common_name',
  'plant_subcategory_code', 'plant_subcategory_codes',
  'is_perennial_species', 'perennial_from_zone', 'zone_7a_behavior',
  // Legacy array field — only use plant_subcategory_id (singular) to avoid 422
  'plant_subcategory_ids',
]);

// ─── ALL KNOWN VARIETY SCHEMA FIELDS (145+) ──────────────────────────────────
const ALL_COLUMNS = new Set([
  'variety_name','plant_type_id','plant_type_name','plant_subcategory_id',
  'variety_code','description','synonyms','days_to_maturity','days_to_maturity_min','days_to_maturity_max',
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
  // Indoor / houseplant fields
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
]);

// ─── ONLY the handful of enums proven strict in the Base44 DB ─────────────────
// For everything else, just pass the value through — don't null it out.
const STRICT_ENUM_FIELDS = {
  species: ['annuum','chinense','baccatum','frutescens','pubescens','unknown'],
  seed_line_type: ['heirloom','hybrid','open_pollinated','unknown'],
  season_timing: ['early','mid','late','unknown'],
  status: ['active','pending_review','removed'],
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

// Fields stored as JSON arrays/objects in DB
const JSON_COLS = new Set([
  'synonyms','sources','images','care_warnings','traits','extended_data',
  'propagation_methods','common_pests','common_diseases',
]);

// ─── UTILITIES ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function apiRetry(fn, label = '', maxRetries = 6) {
  let backoff = 4000;
  for (let i = 0; i <= maxRetries; i++) {
    try { return await fn(); } catch (err) {
      const status = err?.status || err?.response?.status;
      const msg = (err?.message || '').toLowerCase();
      const isRL = msg.includes('rate') || msg.includes('429') || status === 429;
      const isServerErr = status >= 500 && status < 600;
      if ((isRL || isServerErr) && i < maxRetries) {
        console.warn(`[Retry ${i+1}/${maxRetries}] ${label}: ${err.message}. Waiting ${backoff}ms...`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 60000);
        continue;
      }
      throw err;
    }
  }
}

/**
 * RFC 4180-compliant CSV parser.
 *
 * BUG FIX vs original: handles BOTH quote escape styles:
 *   1. "" (doubled-quote)  — standard RFC 4180
 *   2. \"  (backslash-quote) — common in JSON-exported CSVs
 *
 * Also handles multi-line fields (newlines inside quoted strings).
 */
function parseCSV(text) {
  // Normalise line endings
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const records = [];
  let i = 0;
  let currentRecord = [];
  let cur = '';
  let inQ = false;

  while (i < raw.length) {
    const c = raw[i];
    const n = raw[i + 1];

    if (inQ) {
      // ── FIX: backslash-escaped quote inside quoted field ──────────────────
      if (c === '\\' && n === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      // Standard doubled-quote ""
      if (c === '"' && n === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      // Closing quote
      if (c === '"') {
        inQ = false;
        i++;
        continue;
      }
      // Everything else (including newlines) is part of the field
      cur += c;
      i++;
    } else {
      if (c === '"') {
        inQ = true;
        i++;
        continue;
      }
      if (c === ',') {
        currentRecord.push(cur);
        cur = '';
        i++;
        continue;
      }
      if (c === '\n') {
        currentRecord.push(cur);
        cur = '';
        records.push(currentRecord);
        currentRecord = [];
        i++;
        continue;
      }
      cur += c;
      i++;
    }
  }
  // Flush final field/record
  if (cur || currentRecord.length > 0) {
    currentRecord.push(cur);
    if (currentRecord.some(v => v.trim() !== '')) records.push(currentRecord);
  }

  if (records.length < 2) return [];

  const headers = records[0].map(h => h.trim().replace(/^\uFEFF/, '')); // strip BOM
  return records.slice(1)
    .filter(row => row.some(v => v.trim() !== '')) // skip blank rows
    .map(row => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (row[idx] || '').trim(); });
      return obj;
    });
}

function castValue(col, raw) {
  if (raw === '' || raw === null || raw === undefined) return null;

  // Boolean
  if (BOOL_COLS.has(col)) {
    const lower = String(raw).toLowerCase().trim();
    return lower === 'true' || lower === '1' || raw === true;
  }

  // Numeric
  if (NUM_COLS.has(col)) {
    const n = parseFloat(raw);
    return isNaN(n) ? null : n;
  }

  // JSON arrays / objects
  if (JSON_COLS.has(col)) {
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch {
      if (typeof raw === 'string' && raw.includes('|')) return raw.split('|').map(s => s.trim()).filter(Boolean);
      if (typeof raw === 'string' && raw.length > 0) return [raw];
      return raw;
    }
  }

  // ── FIX: only enforce the handful of enums that Base44 actually validates ──
  if (STRICT_ENUM_FIELDS[col]) {
    const valid = STRICT_ENUM_FIELDS[col];
    if (valid.includes(raw)) return raw;
    const lower = raw.toLowerCase().trim();
    const match = valid.find(v => v.toLowerCase() === lower);
    if (match) return match;
    // For species / seed_line_type / season_timing, fall back to 'unknown'
    // rather than nulling out (better than losing the field entirely)
    return col === 'status' ? null : 'unknown';
  }

  // Everything else: pass through as string
  return raw;
}

function cleanPayload(payload) {
  const clean = {};
  for (const [k, v] of Object.entries(payload)) {
    if (FORBIDDEN_FIELDS.has(k)) continue;
    if (!ALL_COLUMNS.has(k)) continue;
    clean[k] = v;
  }
  return clean;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function AdminVarietyImport2() {
  const [user, setUser] = React.useState(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [upsertMode, setUpsertMode] = useState('preserve_filled');
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
    setProgress(null);
    const text = await f.text();
    const data = parseCSV(text);
    if (data.length) {
      const hdrs = Object.keys(data[0]);
      setHeaders(hdrs);
      setParsedData(data);
      const schemaColsInFile = hdrs.filter(h => ALL_COLUMNS.has(h));
      setSelectedCols(new Set(schemaColsInFile));
      toast.success(`Parsed ${data.length} rows, ${hdrs.length} columns (${schemaColsInFile.length} schema fields)`);
    } else {
      toast.error('No data found — check file format');
    }
  };

  const toggleCol = (col) => {
    setSelectedCols(prev => {
      const s = new Set(prev);
      s.has(col) ? s.delete(col) : s.add(col);
      return s;
    });
  };

  const handleImport = async () => {
    if (!parsedData.length) { toast.error('No data loaded'); return; }
    setImporting(true);
    setResults(null);
    setProgress({ current: 0, total: parsedData.length, inserted: 0, updated: 0, skipped: 0, rejected: 0, rateLimitHits: 0 });

    let inserted = 0, updated = 0, skipped = 0, rejected = 0, rateLimitHits = 0;
    const skipReasons = [];

    try {
      // ── Pre-load lookups once ──────────────────────────────────────────────
      toast.info('Loading plant types & subcategories...');
      const [allPT, allSC, allVar] = await Promise.all([
        apiRetry(() => base44.entities.PlantType.list(), 'PlantTypes'),
        apiRetry(() => base44.entities.PlantSubCategory.list(), 'SubCats'),
        apiRetry(() => base44.entities.Variety.list(), 'Varieties'),
      ]);

      // Plant type lookup maps
      const ptById = {}, ptByCode = {}, ptByName = {};
      allPT.forEach(pt => {
        ptById[pt.id] = pt;
        if (pt.plant_type_code) ptByCode[pt.plant_type_code.toLowerCase()] = pt;
        if (pt.common_name) ptByName[pt.common_name.toLowerCase()] = pt;
      });

      // Subcategory lookup maps
      const scById = {}, scByCode = {};
      allSC.forEach(sc => {
        scById[sc.id] = sc;
        if (sc.subcat_code) scByCode[sc.subcat_code.toUpperCase()] = sc;
      });

      // Existing variety lookup (for upsert dedup)
      const varByCode = {}, varByTypeAndName = {};
      const normName = n => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
      allVar.forEach(v => {
        if (v.variety_code) varByCode[v.variety_code] = v;
        if (v.plant_type_id && v.variety_name) {
          varByTypeAndName[`${v.plant_type_id}__${normName(v.variety_name)}`] = v;
        }
      });

      console.log(`[Import2] Loaded: ${allPT.length} plant types, ${allSC.length} subcats, ${allVar.length} varieties`);

      const BATCH = 3;
      let backoffMs = 2500;

      for (let i = 0; i < parsedData.length; i += BATCH) {
        const chunk = parsedData.slice(i, i + BATCH);

        for (const row of chunk) {
          try {
            // ── Resolve variety name ──────────────────────────────────────
            const varietyName = (row.variety_name || row.name || '').trim();
            if (!varietyName) {
              rejected++;
              skipReasons.push(`Row ${i + 1}: Missing variety_name`);
              continue;
            }

            // ── Resolve plant type ────────────────────────────────────────
            // Tries: direct ID → ID-as-code → plant_type_code column → common name → plant_type_name
            const pt = ptById[row.plant_type_id]
              || ptByCode[(row.plant_type_id || '').toLowerCase()]
              || ptByCode[(row.plant_type_code || '').toLowerCase()]
              || ptByName[(row.plant_type_common_name || '').toLowerCase()]
              || ptByName[(row.plant_type_name || '').toLowerCase()];

            if (!pt) {
              rejected++;
              skipReasons.push(
                `Unknown plant type "${row.plant_type_id || row.plant_type_code || row.plant_type_name}" for "${varietyName}"`
              );
              continue;
            }

            // ── Resolve subcategory ───────────────────────────────────────
            // Tries: plant_subcategory_id (direct) → plant_subcategory_code column
            // → plant_subcategory_codes array → existing variety's subcat
            let resolvedSubcatId = null;
            if (row.plant_subcategory_id && scById[row.plant_subcategory_id.trim()]) {
              resolvedSubcatId = row.plant_subcategory_id.trim();
            }
            if (!resolvedSubcatId && row.plant_subcategory_code && row.plant_subcategory_code.trim()) {
              const code = row.plant_subcategory_code.trim().toUpperCase();
              const prefixed = code.startsWith('PSC_') ? code : 'PSC_' + code;
              resolvedSubcatId = scByCode[prefixed]?.id || scByCode[code]?.id || null;
            }
            if (!resolvedSubcatId && row.plant_subcategory_codes) {
              try {
                let codes = row.plant_subcategory_codes;
                if (typeof codes === 'string') {
                  codes = codes.startsWith('[') ? JSON.parse(codes) : codes.split('|').map(s => s.trim());
                }
                if (Array.isArray(codes)) {
                  for (const c of codes) {
                    const cUp = c.trim().toUpperCase();
                    const prefixed = cUp.startsWith('PSC_') ? cUp : 'PSC_' + cUp;
                    const found = scByCode[prefixed] || scByCode[cUp] || scById[c.trim()];
                    if (found) { resolvedSubcatId = found.id; break; }
                  }
                }
              } catch { /* ignore parse error */ }
            }

            // ── Find existing variety for upsert ─────────────────────────
            let existing = null;
            if (row.variety_code) existing = varByCode[row.variety_code];
            if (!existing) existing = varByTypeAndName[`${pt.id}__${normName(varietyName)}`];

            // ── Build payload ─────────────────────────────────────────────
            const rawPayload = {};

            // Determine which columns to iterate
            const colsToProcess = upsertMode === 'selective'
              ? [...selectedCols].filter(c => !FORBIDDEN_FIELDS.has(c))
              : headers.filter(h => ALL_COLUMNS.has(h) && !FORBIDDEN_FIELDS.has(h));

            for (const col of colsToProcess) {
              const raw = row[col];
              if (raw === undefined || raw === null || raw === '') continue;

              // preserve_filled: skip fields that already have a value in DB
              if (upsertMode === 'preserve_filled' && existing) {
                const existingVal = existing[col];
                const hasValue = existingVal !== null && existingVal !== undefined && existingVal !== ''
                  && !(Array.isArray(existingVal) && existingVal.length === 0);
                if (hasValue && !['variety_name', 'plant_type_id'].includes(col)) continue;
              }

              const casted = castValue(col, raw);
              if (casted !== null) rawPayload[col] = casted;
            }

            // Always set identity fields
            rawPayload.plant_type_id = pt.id;
            rawPayload.plant_type_name = pt.common_name;
            rawPayload.variety_name = varietyName;

            // Set subcategory — only if resolved AND (overwrite mode OR existing is empty)
            if (resolvedSubcatId) {
              if (upsertMode === 'overwrite_all' || upsertMode === 'selective'
                || (upsertMode === 'preserve_filled' && !existing?.plant_subcategory_id)) {
                rawPayload.plant_subcategory_id = resolvedSubcatId;
              }
            }

            const payload = cleanPayload(rawPayload);

            if (dryRun) {
              existing ? updated++ : inserted++;
              continue;
            }

            // ── Write to DB ───────────────────────────────────────────────
            if (existing) {
              await apiRetry(
                () => base44.entities.Variety.update(existing.id, payload),
                `Update "${varietyName}"`
              );
              // Update local cache
              const merged = { ...existing, ...payload };
              varByTypeAndName[`${pt.id}__${normName(varietyName)}`] = merged;
              if (row.variety_code) varByCode[row.variety_code] = merged;
              updated++;
            } else {
              const toCreate = { ...payload, status: payload.status || 'active', is_custom: false };
              const created = await apiRetry(
                () => base44.entities.Variety.create(toCreate),
                `Create "${varietyName}"`
              );
              varByTypeAndName[`${pt.id}__${normName(varietyName)}`] = created;
              if (row.variety_code) varByCode[row.variety_code] = created;
              inserted++;
            }

          } catch (err) {
            skipped++;
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('rate') || msg.includes('429') || msg.includes('504')) {
              rateLimitHits++;
              backoffMs = Math.min(backoffMs * 2, 30000);
            }
            skipReasons.push(`"${row.variety_name || '?'}": ${err.message?.substring(0, 120)}`);
          }
        } // end chunk loop

        const processed = Math.min(i + BATCH, parsedData.length);
        setProgress({ current: processed, total: parsedData.length, inserted, updated, skipped, rejected, rateLimitHits });

        if (i + BATCH < parsedData.length) {
          await sleep(backoffMs);
          if (rateLimitHits === 0 && backoffMs > 2500) {
            backoffMs = Math.max(2500, Math.floor(backoffMs * 0.8));
          }
        }
      } // end batch loop

      setResults({ inserted, updated, skipped, rejected, skipReasons: skipReasons.slice(0, 40) });
      toast.success(
        dryRun
          ? `Dry run: ${inserted} new, ${updated} updates, ${rejected} rejected`
          : `Done! +${inserted} inserted, ↑${updated} updated, ${rateLimitHits} rate limit retries`
      );
    } catch (err) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  if (!user) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );

  const schemaColsInFile = headers.filter(h => ALL_COLUMNS.has(h));
  const ignoredCols = headers.filter(h => !ALL_COLUMNS.has(h) && !CODE_COLUMNS.has(h) && !FORBIDDEN_FIELDS.has(h));
  const lookupCols = headers.filter(h => CODE_COLUMNS.has(h));

  return (
    <ErrorBoundary fallbackTitle="Import Error" fallbackMessage="An error occurred. Please refresh.">
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Variety Import 2 — Advanced (Fixed)</h1>
          <p className="text-gray-600 mt-1">
            Supports all 145 schema columns. Handles <code>\"</code>-escaped and <code>""</code>-doubled CSV quotes.
            Mirror of AdminDataImport logic but without the 65-column cap.
          </p>
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <ShieldAlert className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            <strong>Fixes vs old Import 2:</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
              <li><strong>CSV parser fixed</strong> — now handles <code>\"</code>-escaped quotes (was breaking traits/description/care_warnings → empty varieties)</li>
              <li><strong>Enum validation relaxed</strong> — only enforces 4 strict DB enums; free text like <code>"well_drained, fertile, moist"</code> passes through</li>
              <li><strong>plant_type_code resolved</strong> — looks up by ID, code, or common name (same as AdminDataImport)</li>
              <li><strong>plant_subcategory_code resolved</strong> — PSC_ prefix auto-added; falls back to plant_subcategory_codes array</li>
              <li><strong>plant_subcategory_ids NEVER sent</strong> — uses singular plant_subcategory_id only (prevents 422 errors)</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Step 1: File Upload */}
        <Card>
          <CardHeader><CardTitle>1. Upload CSV</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept=".csv" onChange={handleFile} />
            {parsedData.length > 0 && (
              <div className="text-sm text-gray-700 space-y-1 p-3 bg-gray-50 rounded-lg">
                <p>✅ <strong>{parsedData.length}</strong> data rows parsed</p>
                <p>✅ <strong>{schemaColsInFile.length}</strong> schema columns recognised and will be imported</p>
                {lookupCols.length > 0 && (
                  <p className="text-blue-700">🔍 <strong>{lookupCols.length}</strong> lookup columns (plant_type_code, subcat_code, etc.) — used for resolution, not stored</p>
                )}
                {ignoredCols.length > 0 && (
                  <p className="text-amber-600">⚠ <strong>{ignoredCols.length}</strong> unrecognised columns ignored: {ignoredCols.slice(0, 6).join(', ')}{ignoredCols.length > 6 ? '...' : ''}</p>
                )}
                <p className="text-gray-500 text-xs">Sample row 1: <em>{parsedData[0]?.variety_name || parsedData[0]?.name || '(name column not found)'}</em> — {parsedData[0]?.plant_type_name || parsedData[0]?.plant_type_id}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Upsert Mode */}
        <Card>
          <CardHeader><CardTitle>2. Upsert Mode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                value: 'preserve_filled',
                label: '🛡️ Preserve Filled (Recommended)',
                desc: 'Only fills in empty fields. Existing data is NEVER overwritten. Subcategory only set if currently null.',
              },
              {
                value: 'overwrite_all',
                label: '🔄 Overwrite All',
                desc: 'Replaces every field in the CSV. Use with caution — overwrites existing subcategory assignments.',
              },
              {
                value: 'selective',
                label: '🎯 Selective Columns',
                desc: 'You choose exactly which columns to update. Good for surgical patches.',
              },
            ].map(opt => (
              <label key={opt.value} className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                <input
                  type="radio" name="upsertMode" value={opt.value}
                  checked={upsertMode === opt.value}
                  onChange={e => setUpsertMode(e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}

            {upsertMode === 'selective' && (
              <div className="mt-3">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setShowColPicker(!showColPicker)}
                  className="gap-2"
                >
                  {showColPicker ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Select Columns ({selectedCols.size} selected)
                </Button>
                {showColPicker && (
                  <div className="mt-3 border rounded-lg p-3 max-h-64 overflow-y-auto">
                    <div className="flex gap-2 mb-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedCols(new Set(schemaColsInFile))}>All from file</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedCols(new Set(['variety_name', 'plant_type_id']))}>Required only</Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                      {[...ALL_COLUMNS].map(col => {
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

        {/* Step 3: Run */}
        <Card>
          <CardHeader><CardTitle>3. Run Import</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={dryRun}
                onChange={e => setDryRun(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Dry Run — preview only, no DB changes</span>
            </label>

            {progress && importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing rows...</span>
                  <span className="font-semibold">{progress.current} / {progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                  <span className="text-green-600">+{progress.inserted} new</span>
                  <span className="text-blue-600">↑{progress.updated} updated</span>
                  <span className="text-yellow-600">{progress.skipped} errors</span>
                  <span className="text-red-600">{progress.rejected} rejected</span>
                  {progress.rateLimitHits > 0 && (
                    <span className="text-amber-600">⚠ {progress.rateLimitHits} rate limit retries</span>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={importing || !parsedData.length}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2 w-full"
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                : <><Upload className="w-4 h-4" /> {dryRun ? 'Preview Import' : 'Start Import'} ({parsedData.length} rows)</>
              }
            </Button>

            {!dryRun && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠ After importing, run <strong>Data Maintenance → Repair Subcategories</strong> for the relevant plant type
                to resolve any subcategory codes that couldn't be matched at import time.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {results && !importing && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={results.rejected + results.skipped === 0 ? 'border-emerald-200' : 'border-amber-200'}>
                <CardHeader>
                  <CardTitle>{dryRun ? '📋 Dry Run Preview' : '✅ Import Complete'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-700">{results.inserted}</p>
                      <p className="text-xs text-green-600">New</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-700">{results.updated}</p>
                      <p className="text-xs text-blue-600">Updated</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-700">{results.skipped}</p>
                      <p className="text-xs text-yellow-600">API Errors</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-700">{results.rejected}</p>
                      <p className="text-xs text-red-600">Rejected (bad data)</p>
                    </div>
                  </div>

                  {results.skipReasons.length > 0 && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-xs font-semibold text-yellow-800 mb-2">Issues (first {results.skipReasons.length}):</p>
                      <div className="max-h-40 overflow-auto space-y-0.5">
                        {results.skipReasons.map((r, i) => (
                          <p key={i} className="text-xs text-yellow-700">{r}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {!dryRun && results.inserted + results.updated > 0 && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <AlertDescription className="text-blue-800 text-sm">
                        <strong>Next step:</strong> Go to <strong>Data Maintenance → Repair Subcategories &amp; Varieties</strong>,
                        select the flower plant type, and run the repair. This resolves any subcategory codes
                        that were queued (stored in extended_data) but not yet matched.
                      </AlertDescription>
                    </Alert>
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
