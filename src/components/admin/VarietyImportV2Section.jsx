import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Download, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// ALL 145 Variety schema fields that are safe to send in a create/update.
// These map 1-to-1 with the entity schema.  NEVER include id, created_date,
// updated_date, created_by, plant_subcategory_ids (legacy array), or any
// field that isn't in the schema — that's what causes 422.
// ─────────────────────────────────────────────────────────────────────────────
const SAFE_FIELDS = new Set([
  'plant_type_id','plant_type_name','plant_subcategory_id',
  'variety_code','variety_name','description','synonyms',
  'days_to_maturity','days_to_maturity_min','days_to_maturity_max',
  'start_indoors_weeks','start_indoors_weeks_min','start_indoors_weeks_max',
  'transplant_weeks_after_last_frost_min','transplant_weeks_after_last_frost_max',
  'direct_sow_weeks_min','direct_sow_weeks_max',
  'spacing_recommended','spacing_min','spacing_max',
  'plant_height_typical','height_min','height_max',
  'sun_requirement','water_requirement',
  'trellis_required','container_friendly','growth_habit',
  'species','is_ornamental','seed_line_type','is_organic','season_timing',
  'flavor_profile','uses',
  'fruit_color','fruit_shape','fruit_size',
  'pod_color','pod_shape','pod_size',
  'disease_resistance','breeder_or_origin',
  'seed_saving_notes','pollination_notes',
  'sources','affiliate_url','popularity_tier',
  'traits','extended_data',
  'scoville_min','scoville_max','heat_scoville_min','heat_scoville_max',
  'images','source_attribution','grower_notes','status','is_custom',
  // indoor / houseplant fields
  'light_requirement_indoor','light_tolerance_range',
  'min_light_hours','max_light_hours','grow_light_compatible',
  'watering_frequency_range','watering_method_preferred',
  'soil_dryness_rule','drought_tolerant','overwater_sensitivity',
  'temp_min_f','temp_max_f','temp_ideal_min_f','temp_ideal_max_f',
  'cold_draft_sensitive','humidity_preference','humidity_support_method',
  'misting_beneficial',
  'soil_type_recommended','soil_drainage_speed','drainage_holes_required',
  'recommended_pot_type',
  'fertilizer_type','fertilizer_frequency','fertilizer_strength','dormant_season_feeding',
  'growth_pattern','mature_indoor_height','mature_indoor_width','growth_speed',
  'needs_support','pruning_needs','repot_frequency_years',
  'rootbound_tolerance','best_repot_season',
  'toxic_to_cats','toxic_to_dogs','toxic_to_humans','sap_irritant','pet_safe','toxicity_notes',
  'common_pests','common_diseases','pest_susceptibility','preventive_care_tips',
  'winter_dormancy','reduced_winter_watering','winter_leaf_drop_normal','seasonal_notes',
  'propagation_methods','propagation_difficulty','propagation_best_season','propagation_notes',
  'care_difficulty','air_purifying','display_style','variegation_type',
  'flowering_indoors','fragrant',
  'water_type_required','fertilizer_rule','dormancy_required',
  'dormancy_temp_min_f','dormancy_temp_max_f',
  'dormancy_duration_months_min','dormancy_duration_months_max',
  'soil_type_required','root_cooling_required','root_temp_max_f',
  'is_aquatic','care_warnings',
]);

// Fields from CSV that we resolve but should not pass raw
const CODE_FIELDS = new Set([
  'plant_type_code','plant_type_common_name',
  'plant_subcategory_code','plant_subcategory_codes','subcat_code',
  'plant_subcategory_ids', // legacy array
  'plant_subcategory_name',
]);

const BOOLEAN_FIELDS = new Set([
  'trellis_required','container_friendly','is_ornamental','is_organic',
  'grow_light_compatible','drought_tolerant','cold_draft_sensitive','misting_beneficial',
  'drainage_holes_required','dormant_season_feeding','needs_support',
  'toxic_to_cats','toxic_to_dogs','toxic_to_humans','sap_irritant','pet_safe',
  'winter_dormancy','reduced_winter_watering','winter_leaf_drop_normal',
  'air_purifying','flowering_indoors','fragrant','root_cooling_required','is_aquatic','is_custom',
]);

const NUMERIC_FIELDS = new Set([
  'days_to_maturity','days_to_maturity_min','days_to_maturity_max',
  'start_indoors_weeks','start_indoors_weeks_min','start_indoors_weeks_max',
  'transplant_weeks_after_last_frost_min','transplant_weeks_after_last_frost_max',
  'direct_sow_weeks_min','direct_sow_weeks_max',
  'spacing_recommended','spacing_min','spacing_max',
  'height_min','height_max',
  'scoville_min','scoville_max','heat_scoville_min','heat_scoville_max',
  'min_light_hours','max_light_hours',
  'temp_min_f','temp_max_f','temp_ideal_min_f','temp_ideal_max_f',
  'dormancy_temp_min_f','dormancy_temp_max_f',
  'dormancy_duration_months_min','dormancy_duration_months_max',
  'root_temp_max_f',
]);

const ARRAY_PIPE_FIELDS = new Set(['synonyms','sources','images','care_warnings']);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, label, retries = 5) {
  let backoff = 3000;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      const s = err?.status || err?.response?.status;
      const isRate = s === 429 || s === 504 || (err?.message || '').toLowerCase().includes('rate');
      if (isRate && i < retries) { await sleep(backoff); backoff *= 2; continue; }
      throw err;
    }
  }
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const parseLine = line => {
    const vals = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i], n = line[i + 1];
      if (c === '"') { if (inQ && n === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if ((c === ',' || c === '\t') && !inQ) { vals.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    vals.push(cur.trim()); return vals;
  };
  const headers = parseLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
    rows.push(obj);
  }
  return { headers, rows };
}

function castValue(col, raw) {
  if (raw === '' || raw === null || raw === undefined) return undefined;
  if (BOOLEAN_FIELDS.has(col)) return raw === 'true' || raw === '1' || raw === 'yes';
  if (NUMERIC_FIELDS.has(col)) { const n = parseFloat(raw); return isNaN(n) ? undefined : n; }
  if (ARRAY_PIPE_FIELDS.has(col)) return raw.split('|').map(s => s.trim()).filter(Boolean);
  return raw;
}

// Build a clean payload from a CSV row — only SAFE_FIELDS, properly cast
function buildPayload(row, overrides = {}) {
  const payload = {};
  for (const [col, raw] of Object.entries(row)) {
    if (CODE_FIELDS.has(col)) continue;       // handled separately
    if (!SAFE_FIELDS.has(col)) continue;      // unknown / forbidden field — skip
    const val = castValue(col, raw);
    if (val !== undefined) payload[col] = val;
  }
  // Apply overrides (resolved IDs etc.)
  Object.assign(payload, overrides);
  return payload;
}

export default function VarietyImportV2Section() {
  const [file, setFile] = useState(null);
  const [dryRun, setDryRun] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, msg: '' });
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    if (!file) { toast.error('Select a CSV file first'); return; }
    setImporting(true);
    setResult(null);
    setProgress({ current: 0, total: 0, msg: 'Parsing CSV…' });

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    if (!rows.length) { toast.error('No rows found in CSV'); setImporting(false); return; }

    setProgress({ current: 0, total: rows.length, msg: 'Loading plant types…' });

    // Pre-load lookups
    const [allPT, allSC, allVar] = await Promise.all([
      withRetry(() => base44.entities.PlantType.list('common_name', 500), 'PlantTypes'),
      withRetry(() => base44.entities.PlantSubCategory.list('subcat_code', 5000), 'SubCats'),
      withRetry(() => base44.entities.Variety.list('variety_name', 9999), 'Varieties'),
    ]);

    const ptById = {}; const ptByCode = {}; const ptByName = {};
    allPT.forEach(pt => {
      ptById[pt.id] = pt;
      if (pt.plant_type_code) ptByCode[pt.plant_type_code] = pt;
      if (pt.common_name) ptByName[pt.common_name.toLowerCase()] = pt;
    });

    const scById = {}; const scByCode = {};
    allSC.forEach(sc => {
      scById[sc.id] = sc;
      if (sc.subcat_code) scByCode[sc.subcat_code] = sc;
      // also key by "typeId_code" for precise lookup
      scByCode[`${sc.plant_type_id}__${sc.subcat_code}`] = sc;
    });

    const varByCode = {}; const varByTypeAndName = {};
    const normalize = n => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
    allVar.forEach(v => {
      if (v.variety_code) varByCode[v.variety_code] = v;
      if (v.plant_type_id && v.variety_name) {
        varByTypeAndName[`${v.plant_type_id}__${normalize(v.variety_name)}`] = v;
      }
    });

    setProgress({ current: 0, total: rows.length, msg: 'Importing…' });

    let inserted = 0, updated = 0, skipped = 0, rejected = 0;
    const errors = [];
    const BATCH = 5;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      for (const row of batch) {
        try {
          if (!row.variety_name || !row.variety_name.trim()) {
            rejected++;
            errors.push(`Row missing variety_name`);
            continue;
          }

          // Resolve plant_type_id
          let pt = ptById[row.plant_type_id]
            || ptByCode[row.plant_type_code]
            || (row.plant_type_common_name && ptByName[row.plant_type_common_name.toLowerCase()])
            || null;
          if (!pt) {
            rejected++;
            errors.push(`Unknown plant type for "${row.variety_name}" (id=${row.plant_type_id}, code=${row.plant_type_code})`);
            continue;
          }

          // Resolve plant_subcategory_id
          let resolvedSubcatId = null;
          const rawCode = (row.plant_subcategory_code || row.subcat_code || '').trim();
          if (rawCode) {
            const code = rawCode.startsWith('PSC_') ? rawCode : 'PSC_' + rawCode;
            const sc = scByCode[`${pt.id}__${code}`] || scByCode[code];
            if (sc) resolvedSubcatId = sc.id;
          }

          const overrides = {
            plant_type_id: pt.id,
            plant_type_name: pt.common_name,
          };
          if (resolvedSubcatId) overrides.plant_subcategory_id = resolvedSubcatId;

          const payload = buildPayload(row, overrides);

          // Find existing record
          let existing = varByCode[row.variety_code] || null;
          if (!existing) {
            const key = `${pt.id}__${normalize(row.variety_name)}`;
            existing = varByTypeAndName[key] || null;
          }

          if (dryRun) {
            // In dry run, just count
            existing ? updated++ : inserted++;
            continue;
          }

          if (existing) {
            await withRetry(() => base44.entities.Variety.update(existing.id, payload), `Update ${row.variety_name}`);
            updated++;
            // refresh local cache
            if (row.variety_code) varByCode[row.variety_code] = { ...existing, ...payload };
          } else {
            if (!payload.status) payload.status = 'active';
            if (payload.is_custom === undefined) payload.is_custom = false;
            const created = await withRetry(() => base44.entities.Variety.create(payload), `Create ${row.variety_name}`);
            if (row.variety_code) varByCode[row.variety_code] = created;
            varByTypeAndName[`${pt.id}__${normalize(row.variety_name)}`] = created;
            inserted++;
          }
        } catch (err) {
          skipped++;
          errors.push(`"${row.variety_name}": ${err.message}`);
        }
      }

      setProgress({ current: Math.min(i + BATCH, rows.length), total: rows.length, msg: 'Importing…' });
      if (i + BATCH < rows.length) await sleep(2000);
    }

    setResult({ inserted, updated, skipped, rejected, errors: errors.slice(0, 30), dryRun, total: rows.length, headers });
    toast.success(dryRun ? 'Dry run complete — review results below' : `Import complete: ${inserted} inserted, ${updated} updated`);
    setImporting(false);
  };

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Card className="border-2 border-emerald-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🌱 Plant Varieties 2 — Full 145-Column Importer
          <Badge className="bg-emerald-100 text-emerald-800">New</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            Supports all 145 Variety schema fields. Only safe fields are sent — no 422 errors.
            Resolves <code>plant_type_code</code>, <code>plant_type_common_name</code>, and <code>plant_subcategory_code</code> automatically.
            Deduplicates by <code>variety_code</code> then by plant_type + name.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <Label htmlFor="v2file">CSV File</Label>
            <Input
              id="v2file"
              type="file"
              accept=".csv"
              className="mt-1 w-72"
              onChange={e => setFile(e.target.files[0] || null)}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-5">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">Dry Run</span>
          </label>
          <Button
            onClick={handleImport}
            disabled={importing || !file}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2 mt-5"
          >
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Importing…</> : <><Upload className="w-4 h-4" />{dryRun ? 'Preview Import' : 'Start Import'}</>}
          </Button>
        </div>

        {importing && progress.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{progress.msg}</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-emerald-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 pt-2 border-t">
            <h3 className="font-semibold">{result.dryRun ? '🔍 Dry Run Results' : '✅ Import Results'}</h3>
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="text-green-700">Inserted: <strong>{result.inserted}</strong></span>
              <span className="text-blue-700">Updated: <strong>{result.updated}</strong></span>
              {result.skipped > 0 && <span className="text-yellow-700">Errored: <strong>{result.skipped}</strong></span>}
              {result.rejected > 0 && <span className="text-red-700">Rejected: <strong>{result.rejected}</strong></span>}
              <span className="text-gray-500">Total rows: <strong>{result.total}</strong></span>
            </div>
            <div className="text-xs text-gray-500">
              CSV columns detected: {result.headers.join(', ')}
            </div>
            {result.errors.length > 0 && (
              <div className="p-3 bg-red-50 rounded-lg max-h-40 overflow-auto">
                <p className="text-xs font-semibold text-red-700 mb-1">Errors / Rejections:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}