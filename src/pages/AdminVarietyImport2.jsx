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

// ─── LOOKUP-ONLY COLUMNS — never written to DB ────────────────────────────────
const CODE_COLUMNS = new Set([
  'plant_type_code','plant_type_common_name',
  'plant_subcategory_code','plant_subcategory_codes',
  'id','created_date','updated_date','created_by_id','is_sample',
  'is_perennial_species','perennial_from_zone','zone_7a_behavior',
]);

// ─── FIELDS NEVER SENT IN PAYLOAD ────────────────────────────────────────────
const FORBIDDEN_FIELDS = new Set([
  'id','created_date','updated_date','created_by','created_by_id','is_sample',
  'plant_type_code','plant_type_common_name',
  'plant_subcategory_code','plant_subcategory_codes',
  'is_perennial_species','perennial_from_zone','zone_7a_behavior',
  'plant_subcategory_ids',  // causes 422 — use singular plant_subcategory_id only
  // These free-text fields aren't in the Base44 Variety schema
  'fertilizer_rule',        // sentences like "Apply balanced fertilizer in early spring..."
  'light_tolerance_range',  // descriptive text, not a schema field
]);

// ─── CONFIRMED WRITABLE VARIETY FIELDS ───────────────────────────────────────
// Only fields confirmed in Base44 Variety entity schema.
// Source: Variety_export.csv (65 cols) + Variety_export_1.csv (136 cols, from DB).
const ALL_COLUMNS = new Set([
  // Core
  'variety_name','plant_type_id','plant_type_name','plant_subcategory_id',
  'variety_code','description','synonyms','status','is_custom',
  // Timing
  'days_to_maturity','days_to_maturity_min','days_to_maturity_max',
  'start_indoors_weeks','start_indoors_weeks_min','start_indoors_weeks_max',
  'transplant_weeks_after_last_frost_min','transplant_weeks_after_last_frost_max',
  'direct_sow_weeks_min','direct_sow_weeks_max',
  // Size / spacing
  'spacing_recommended','spacing_min','spacing_max',
  'plant_height_typical','height_min','height_max',
  // Growing conditions
  'sun_requirement','water_requirement','trellis_required','container_friendly',
  'growth_habit','species','is_ornamental','is_organic',
  // Classification
  'seed_line_type','season_timing','flavor_profile','uses',
  // Produce characteristics
  'fruit_color','fruit_shape','fruit_size','pod_color','pod_shape','pod_size',
  // Notes
  'disease_resistance','breeder_or_origin','seed_saving_notes','pollination_notes',
  'sources','affiliate_url','popularity_tier','grower_notes','source_attribution','traits',
  // Heat
  'scoville_min','scoville_max','heat_scoville_min','heat_scoville_max',
  // Indoor / houseplant care
  'light_requirement_indoor','min_light_hours','max_light_hours',
  'grow_light_compatible',
  'watering_frequency_range','watering_method_preferred','soil_dryness_rule',
  'drought_tolerant','overwater_sensitivity',
  'temp_min_f','temp_max_f','temp_ideal_min_f','temp_ideal_max_f','cold_draft_sensitive',
  'humidity_preference','humidity_support_method','misting_beneficial',
  'soil_type_recommended','soil_drainage_speed','drainage_holes_required',
  'recommended_pot_type',
  'fertilizer_type','fertilizer_frequency','fertilizer_strength','dormant_season_feeding',
  'growth_pattern','mature_indoor_height','mature_indoor_width','growth_speed',
  'needs_support','pruning_needs','repot_frequency_years','rootbound_tolerance',
  'best_repot_season',
  // Toxicity
  'toxic_to_cats','toxic_to_dogs','toxic_to_humans','sap_irritant','pet_safe','toxicity_notes',
  // Pests / diseases
  'common_pests','common_diseases','pest_susceptibility','preventive_care_tips',
  // Seasonal
  'winter_dormancy','reduced_winter_watering','winter_leaf_drop_normal','seasonal_notes',
  // Propagation
  'propagation_methods','propagation_difficulty','propagation_best_season','propagation_notes',
  // Misc
  'care_difficulty','air_purifying','display_style','variegation_type',
  'flowering_indoors','fragrant',
  'water_type_required','dormancy_required',
  'dormancy_temp_min_f','dormancy_temp_max_f',
  'dormancy_duration_months_min','dormancy_duration_months_max',
  'soil_type_required','root_cooling_required','root_temp_max_f','is_aquatic',
  'care_warnings','images','extended_data',
]);

// ─── ENUM NORMALISATION ───────────────────────────────────────────────────────
// For each enum field: map raw CSV value → valid DB value (or null to omit).
// Keys are the raw values that appear in the flower CSV.
const ENUM_NORMALISE = {
  status: {
    valid: ['active','pending_review','removed'],
    fallback: 'active',
  },
  seed_line_type: {
    valid: ['heirloom','hybrid','open_pollinated','unknown'],
    extra: { organic: 'open_pollinated' },
    fallback: 'unknown',
  },
  season_timing: {
    // 'year_round' is not valid — omit it (null)
    valid: ['early','mid','late','unknown'],
    fallback: null,  // null = skip this field rather than store wrong value
  },
  popularity_tier: {
    valid: ['common','popular','rare','heirloom'],
    extra: { niche: 'rare', specialty: 'rare', uncommon: 'rare' },
    fallback: null,
  },
  species: {
    valid: ['annuum','chinense','baccatum','frutescens','pubescens','unknown'],
    fallback: 'unknown',
  },
  // fertilizer_strength: Base44 expects full/half/quarter
  fertilizer_strength: {
    valid: ['full','half','quarter'],
    extra: {
      dilute: 'quarter', 'dilute (half-strength)': 'quarter',
      light: 'quarter', moderate: 'half', none: null, full: 'full',
      'half-strength': 'half', 'quarter-strength': 'quarter',
    },
    fallback: null,
  },
  // fertilizer_frequency: map free-text → closest enum or null
  fertilizer_frequency: {
    valid: ['weekly_dilute','biweekly','monthly','seasonal_only'],
    extra: {
      'every_2_weeks': 'biweekly',
      'every_3_weeks': 'biweekly',
      'every 2 weeks': 'biweekly',
      'every 3-4 weeks': 'monthly',
      'monthly': 'monthly',
      'weekly': 'weekly_dilute',
      'annually': 'seasonal_only',
      'seasonal': 'seasonal_only',
      'spring and fall': 'seasonal_only',
    },
    fallback: null,
  },
  // best_repot_season
  best_repot_season: {
    valid: ['spring','spring_summer','anytime'],
    extra: {
      'early spring': 'spring',
      'spring/summer': 'spring_summer',
      'any time': 'anytime',
      'any': 'anytime',
    },
    fallback: null,
  },
  // propagation_best_season
  propagation_best_season: {
    valid: ['spring','spring_summer','anytime'],
    extra: {
      'early spring': 'spring',
      'early spring or fall': 'spring',
      'early spring or fall sow': 'spring',
      'any time': 'anytime',
      'any time (leaf cuttings)': 'anytime',
      'anytime': 'anytime',
      'spring/summer': 'spring_summer',
    },
    fallback: null,
  },
  // growth_speed: strip compound descriptions like "slow (first year), moderate (established)"
  growth_speed: {
    valid: ['slow','moderate','fast'],
    extra: {},
    fallback: null,
    normalise: (raw) => {
      const lower = (raw || '').toLowerCase();
      if (lower.startsWith('slow')) return 'slow';
      if (lower.startsWith('moderate')) return 'moderate';
      if (lower.startsWith('fast')) return 'fast';
      return null;
    },
  },
  // propagation_difficulty / care_difficulty
  propagation_difficulty: {
    valid: ['beginner','easy','moderate','advanced'],
    fallback: null,
  },
  care_difficulty: {
    valid: ['beginner','easy','moderate','advanced','expert'],
    fallback: null,
  },
  // rootbound_tolerance
  rootbound_tolerance: {
    valid: ['sensitive','moderate','tolerant','prefers_rootbound'],
    fallback: null,
  },
  // overwater_sensitivity
  overwater_sensitivity: {
    valid: ['low','moderate','high','extreme'],
    fallback: null,
  },
  // soil_drainage_speed — "moderate to fast" → 'moderate'
  soil_drainage_speed: {
    valid: ['fast','moderate','water_retentive'],
    normalise: (raw) => {
      const lower = (raw || '').toLowerCase();
      if (lower.includes('fast')) return 'fast';
      if (lower.includes('moderate')) return 'moderate';
      if (lower.includes('water_retentive') || lower.includes('retentive')) return 'water_retentive';
      return null;
    },
  },
  // humidity_preference
  humidity_preference: {
    valid: ['low','medium','high','very_high'],
    fallback: null,
  },
  // variegation_type
  variegation_type: {
    valid: ['none','stable','unstable','chimeral'],
    fallback: null,
  },
  // dormancy_required
  dormancy_required: {
    valid: ['none','required_cold','optional_beneficial','succulent_phase','turion_aquatic'],
    fallback: null,
  },
  // water_type_required
  water_type_required: {
    valid: ['any','distilled_only','distilled_preferred'],
    fallback: null,
  },
  // fertilizer_type
  fertilizer_type: {
    valid: ['balanced','high_nitrogen','bloom_booster','orchid_specific','none'],
    extra: {
      'balanced liquid': 'balanced',
      'balanced liquid or slow-release': 'balanced',
      'balanced or low-phosphorus': 'balanced',
      'low-phosphorus': 'balanced',
      'african violet specific (high phosphorus)': 'bloom_booster',
      'bloom_booster': 'bloom_booster',
      'high phosphorus': 'bloom_booster',
    },
    fallback: null,
  },
};

function normaliseEnum(field, raw) {
  const rule = ENUM_NORMALISE[field];
  if (!rule) return raw; // not an enum field — pass through

  if (rule.normalise) {
    return rule.normalise(raw);
  }

  const str = (raw || '').trim();
  const lower = str.toLowerCase();

  // Exact match
  if (rule.valid.includes(str)) return str;
  // Case-insensitive
  const ci = rule.valid.find(v => v.toLowerCase() === lower);
  if (ci) return ci;
  // Extra mappings
  if (rule.extra && rule.extra[lower] !== undefined) return rule.extra[lower];
  if (rule.extra && rule.extra[str] !== undefined) return rule.extra[str];
  // Fallback
  return rule.fallback !== undefined ? rule.fallback : null;
}

// ─── TYPE SETS ─────────────────────────────────────────────────────────────────
const BOOL_COLS = new Set([
  'trellis_required','container_friendly','is_ornamental','is_organic',
  'grow_light_compatible','drought_tolerant','cold_draft_sensitive','misting_beneficial',
  'drainage_holes_required','dormant_season_feeding','needs_support','winter_dormancy',
  'reduced_winter_watering','winter_leaf_drop_normal','air_purifying','flowering_indoors',
  'fragrant','root_cooling_required','is_aquatic',
  'toxic_to_cats','toxic_to_dogs','toxic_to_humans','sap_irritant','pet_safe','is_custom',
]);

const NUM_COLS = new Set([
  'days_to_maturity','days_to_maturity_min','days_to_maturity_max',
  'start_indoors_weeks','start_indoors_weeks_min','start_indoors_weeks_max',
  'transplant_weeks_after_last_frost_min','transplant_weeks_after_last_frost_max',
  'direct_sow_weeks_min','direct_sow_weeks_max',
  'spacing_recommended','spacing_min','spacing_max','height_min','height_max',
  'scoville_min','scoville_max','heat_scoville_min','heat_scoville_max',
  'min_light_hours','max_light_hours',
  'temp_min_f','temp_max_f','temp_ideal_min_f','temp_ideal_max_f',
  'dormancy_temp_min_f','dormancy_temp_max_f',
  'dormancy_duration_months_min','dormancy_duration_months_max','root_temp_max_f',
]);

// Fields that must be parsed as JSON arrays / objects before sending
const JSON_COLS = new Set([
  'synonyms','sources','images','care_warnings','traits',
  'extended_data','propagation_methods','common_pests','common_diseases',
  'display_style',  // CSV has ["garden_bed","cut_flower"] — must be parsed
]);

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiRetry(fn, label = '', maxRetries = 6) {
  let backoff = 4000;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      // ── Capture response body for debugging 422s ──────────────────────────
      if (err?.response) {
        try {
          const body = await err.response.json?.();
          console.error(`[422 body] ${label}:`, JSON.stringify(body));
          // Surface the DB validation message so it appears in skipReasons
          if (body?.detail || body?.message || body?.error) {
            err.message = `${err.message} | DB says: ${JSON.stringify(body?.detail || body?.message || body?.error)}`;
          }
        } catch { /* response already consumed */ }
      }
      const status = err?.status || err?.response?.status;
      const msg = (err?.message || '').toLowerCase();
      const isRL = msg.includes('rate') || msg.includes('429') || status === 429;
      const isServer = status >= 500 && status < 600;
      if ((isRL || isServer) && i < maxRetries) {
        console.warn(`[Retry ${i+1}/${maxRetries}] ${label}: ${err.message}. Waiting ${backoff}ms`);
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
 * Handles both "" (doubled-quote) AND \" (backslash-quote) escape styles.
 * Also handles multi-line fields.
 */
function parseCSV(text) {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = [];
  let i = 0, cur = '', inQ = false, currentRecord = [];

  while (i < raw.length) {
    const c = raw[i], n = raw[i + 1];
    if (inQ) {
      if (c === '\\' && n === '"') { cur += '"'; i += 2; continue; }  // backslash-escape
      if (c === '"' && n === '"')  { cur += '"'; i += 2; continue; }  // doubled-quote
      if (c === '"')               { inQ = false; i++; continue; }    // closing quote
      cur += c; i++;
    } else {
      if (c === '"')  { inQ = true; i++; continue; }
      if (c === ',')  { currentRecord.push(cur); cur = ''; i++; continue; }
      if (c === '\n') { currentRecord.push(cur); cur = ''; records.push(currentRecord); currentRecord = []; i++; continue; }
      cur += c; i++;
    }
  }
  if (cur || currentRecord.length > 0) {
    currentRecord.push(cur);
    if (currentRecord.some(v => v.trim())) records.push(currentRecord);
  }
  if (records.length < 2) return [];

  const headers = records[0].map(h => h.trim().replace(/^\uFEFF/, ''));
  return records.slice(1)
    .filter(row => row.some(v => v.trim()))
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
    return ['true','1','yes'].includes(String(raw).toLowerCase().trim()) || raw === true;
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

  // Enum normalisation
  if (ENUM_NORMALISE[col]) {
    return normaliseEnum(col, raw);
  }

  // Everything else: string passthrough
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
  const [selectedCols, setSelectedCols] = useState(new Set(['variety_name','plant_type_id']));
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
      setSelectedCols(new Set(hdrs.filter(h => ALL_COLUMNS.has(h))));
      toast.success(`Parsed ${data.length} rows, ${hdrs.length} columns`);
    } else {
      toast.error('No data found — check file format');
    }
  };

  const toggleCol = col => {
    setSelectedCols(prev => { const s = new Set(prev); s.has(col) ? s.delete(col) : s.add(col); return s; });
  };

  const handleImport = async () => {
    if (!parsedData.length) { toast.error('No data loaded'); return; }
    setImporting(true);
    setResults(null);
    setProgress({ current: 0, total: parsedData.length, inserted: 0, updated: 0, skipped: 0, rejected: 0, rateLimitHits: 0 });

    let inserted = 0, updated = 0, skipped = 0, rejected = 0, rateLimitHits = 0;
    const skipReasons = [];
    let backoffMs = 2500;

    try {
      toast.info('Loading lookups...');
      const [allPT, allSC, allVar] = await Promise.all([
        apiRetry(() => base44.entities.PlantType.list(), 'PlantTypes'),
        apiRetry(() => base44.entities.PlantSubCategory.list(), 'SubCats'),
        apiRetry(() => base44.entities.Variety.list(), 'Varieties'),
      ]);

      const ptById = {}, ptByCode = {}, ptByName = {};
      allPT.forEach(pt => {
        ptById[pt.id] = pt;
        if (pt.plant_type_code) ptByCode[pt.plant_type_code.toLowerCase()] = pt;
        if (pt.common_name) ptByName[pt.common_name.toLowerCase()] = pt;
      });

      const scById = {}, scByCode = {};
      allSC.forEach(sc => {
        scById[sc.id] = sc;
        if (sc.subcat_code) scByCode[sc.subcat_code.toUpperCase()] = sc;
      });

      const varByCode = {}, varByTypeAndName = {};
      const norm = n => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
      allVar.forEach(v => {
        if (v.variety_code) varByCode[v.variety_code] = v;
        if (v.plant_type_id && v.variety_name)
          varByTypeAndName[`${v.plant_type_id}__${norm(v.variety_name)}`] = v;
      });

      console.log(`[Import2] Loaded ${allPT.length} plant types, ${allSC.length} subcats, ${allVar.length} varieties`);

      const BATCH = 3;

      for (let i = 0; i < parsedData.length; i += BATCH) {
        const chunk = parsedData.slice(i, i + BATCH);

        for (const row of chunk) {
          try {
            const varietyName = (row.variety_name || row.name || '').trim();
            if (!varietyName) {
              rejected++;
              skipReasons.push(`Row ~${i+1}: Missing variety_name`);
              continue;
            }

            // Resolve plant type
            const pt = ptById[row.plant_type_id]
              || ptByCode[(row.plant_type_id || '').toLowerCase()]
              || ptByCode[(row.plant_type_code || '').toLowerCase()]
              || ptByName[(row.plant_type_common_name || '').toLowerCase()]
              || ptByName[(row.plant_type_name || '').toLowerCase()];

            if (!pt) {
              rejected++;
              skipReasons.push(`Unknown plant type for "${varietyName}": "${row.plant_type_id || row.plant_type_code || row.plant_type_name}"`);
              continue;
            }

            // Resolve subcategory
            let resolvedSubcatId = null;
            if (row.plant_subcategory_id && scById[row.plant_subcategory_id.trim()]) {
              resolvedSubcatId = row.plant_subcategory_id.trim();
            }
            if (!resolvedSubcatId && row.plant_subcategory_code?.trim()) {
              const code = row.plant_subcategory_code.trim().toUpperCase();
              resolvedSubcatId = scByCode[code]?.id || scByCode['PSC_'+code]?.id || null;
            }
            if (!resolvedSubcatId && row.plant_subcategory_codes) {
              try {
                let codes = row.plant_subcategory_codes;
                if (typeof codes === 'string') codes = codes.startsWith('[') ? JSON.parse(codes) : codes.split('|').map(s => s.trim());
                if (Array.isArray(codes)) {
                  for (const c of codes) {
                    const cUp = c.trim().toUpperCase();
                    const found = scByCode[cUp] || scByCode['PSC_'+cUp] || scById[c.trim()];
                    if (found) { resolvedSubcatId = found.id; break; }
                  }
                }
              } catch { /* ignore */ }
            }

            // Find existing variety
            let existing = null;
            if (row.variety_code) existing = varByCode[row.variety_code];
            if (!existing) existing = varByTypeAndName[`${pt.id}__${norm(varietyName)}`];

            // Build payload
            const rawPayload = {};
            const colsToProcess = upsertMode === 'selective'
              ? [...selectedCols].filter(c => !FORBIDDEN_FIELDS.has(c))
              : headers.filter(h => ALL_COLUMNS.has(h) && !FORBIDDEN_FIELDS.has(h));

            for (const col of colsToProcess) {
              const raw = row[col];
              if (raw === undefined || raw === null || raw === '') continue;

              if (upsertMode === 'preserve_filled' && existing) {
                const ev = existing[col];
                const hasValue = ev !== null && ev !== undefined && ev !== ''
                  && !(Array.isArray(ev) && ev.length === 0);
                if (hasValue && !['variety_name','plant_type_id'].includes(col)) continue;
              }

              const casted = castValue(col, raw);
              if (casted !== null && casted !== undefined) rawPayload[col] = casted;
            }

            rawPayload.plant_type_id = pt.id;
            rawPayload.plant_type_name = pt.common_name;
            rawPayload.variety_name = varietyName;

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

            if (existing) {
              await apiRetry(() => base44.entities.Variety.update(existing.id, payload), `Update "${varietyName}"`);
              const merged = { ...existing, ...payload };
              varByTypeAndName[`${pt.id}__${norm(varietyName)}`] = merged;
              if (row.variety_code) varByCode[row.variety_code] = merged;
              updated++;
            } else {
              const toCreate = { ...payload, status: payload.status || 'active', is_custom: false };
              const created = await apiRetry(() => base44.entities.Variety.create(toCreate), `Create "${varietyName}"`);
              varByTypeAndName[`${pt.id}__${norm(varietyName)}`] = created;
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
            skipReasons.push(`"${row.variety_name || '?'}": ${(err.message || '').substring(0, 200)}`);
          }
        }

        const processed = Math.min(i + BATCH, parsedData.length);
        setProgress({ current: processed, total: parsedData.length, inserted, updated, skipped, rejected, rateLimitHits });

        if (i + BATCH < parsedData.length) {
          await sleep(backoffMs);
          if (rateLimitHits === 0 && backoffMs > 2500) backoffMs = Math.max(2500, Math.floor(backoffMs * 0.8));
        }
      }

      setResults({ inserted, updated, skipped, rejected, skipReasons: skipReasons.slice(0, 50) });
      toast.success(
        dryRun
          ? `Dry run: ${inserted} new, ${updated} updates, ${rejected} rejected`
          : `Done! +${inserted} inserted, ↑${updated} updated, ${skipped} errors`
      );
    } catch (err) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  if (!user) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  const schemaColsInFile = headers.filter(h => ALL_COLUMNS.has(h));
  const lookupColsInFile = headers.filter(h => CODE_COLUMNS.has(h));
  const ignoredCols = headers.filter(h => !ALL_COLUMNS.has(h) && !CODE_COLUMNS.has(h) && !FORBIDDEN_FIELDS.has(h));
  const forbiddenColsInFile = headers.filter(h => FORBIDDEN_FIELDS.has(h));

  return (
    <ErrorBoundary fallbackTitle="Import Error" fallbackMessage="An error occurred. Please refresh.">
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Variety Import 2 — Advanced</h1>
          <p className="text-gray-600 mt-1">Full schema import. Fixes CSV parser, enum normalisation, and field filtering.</p>
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            <strong>What's fixed vs old version:</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
              <li><strong>CSV parser</strong> — handles <code>\"</code>-escaped quotes (was making all fields after <code>traits</code> empty)</li>
              <li><strong>Enum normalisation</strong> — maps <code>year_round→null</code>, <code>niche→rare</code>, <code>organic→open_pollinated</code>, <code>dilute→quarter</code>, <code>balanced liquid→balanced</code>, etc.</li>
              <li><strong>Free-text enum guards</strong> — <code>fertilizer_rule</code> and <code>light_tolerance_range</code> removed (not valid API fields)</li>
              <li><strong>display_style</strong> — parsed as JSON array, not sent as raw string</li>
              <li><strong>422 body capture</strong> — any remaining failures log the exact DB error message</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader><CardTitle>1. Upload CSV</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept=".csv" onChange={handleFile} />
            {parsedData.length > 0 && (
              <div className="text-sm space-y-1 p-3 bg-gray-50 rounded-lg">
                <p>✅ <strong>{parsedData.length}</strong> rows parsed</p>
                <p>✅ <strong>{schemaColsInFile.length}</strong> schema columns will be imported</p>
                {lookupColsInFile.length > 0 && <p className="text-blue-600">🔍 {lookupColsInFile.length} lookup columns (plant_type_code etc.) — used for resolution only</p>}
                {forbiddenColsInFile.length > 0 && <p className="text-amber-600">🚫 {forbiddenColsInFile.length} forbidden columns stripped: {forbiddenColsInFile.join(', ')}</p>}
                {ignoredCols.length > 0 && <p className="text-gray-500 text-xs">⚠ {ignoredCols.length} unrecognised columns ignored: {ignoredCols.slice(0,6).join(', ')}{ignoredCols.length > 6 ? '...' : ''}</p>}
                <p className="text-gray-500 text-xs">Row 1: <em>{parsedData[0]?.variety_name || '(no variety_name)'}</em> — {parsedData[0]?.plant_type_name || parsedData[0]?.plant_type_id}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>2. Upsert Mode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { value: 'preserve_filled', label: '🛡️ Preserve Filled (Recommended)', desc: 'Only fills empty fields. Never overwrites existing data. Subcategory only set if currently null.' },
              { value: 'overwrite_all', label: '🔄 Overwrite All', desc: 'Replaces every field present in the CSV. Overwrites existing subcategory assignments.' },
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
                      <Button size="sm" variant="outline" onClick={() => setSelectedCols(new Set(schemaColsInFile))}>All from file</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedCols(new Set(['variety_name','plant_type_id']))}>Required only</Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                      {[...ALL_COLUMNS].sort().map(col => {
                        const inFile = headers.includes(col);
                        return (
                          <label key={col} className={`flex items-center gap-1.5 text-xs cursor-pointer ${!inFile ? 'opacity-40' : ''}`}>
                            <Checkbox checked={selectedCols.has(col)} onCheckedChange={() => toggleCol(col)} disabled={!inFile} />
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

        <Card>
          <CardHeader><CardTitle>3. Run Import</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Dry Run — preview only, no DB changes</span>
            </label>

            {progress && importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing...</span>
                  <span className="font-semibold">{progress.current} / {progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-emerald-600 h-2 rounded-full transition-all" style={{ width: `${(progress.current/progress.total)*100}%` }} />
                </div>
                <div className="flex gap-4 text-xs flex-wrap text-gray-500">
                  <span className="text-green-600">+{progress.inserted} new</span>
                  <span className="text-blue-600">↑{progress.updated} updated</span>
                  <span className="text-yellow-600">{progress.skipped} errors</span>
                  <span className="text-red-600">{progress.rejected} rejected</span>
                  {progress.rateLimitHits > 0 && <span className="text-amber-600">⚠ {progress.rateLimitHits} rate limit retries</span>}
                </div>
              </div>
            )}

            <Button onClick={handleImport} disabled={importing || !parsedData.length} className="bg-emerald-600 hover:bg-emerald-700 gap-2 w-full">
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><Upload className="w-4 h-4" /> {dryRun ? 'Preview Import' : 'Start Import'} ({parsedData.length} rows)</>}
            </Button>

            {!dryRun && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠ After importing, run <strong>Data Maintenance → Repair Subcategories</strong> for each flower plant type to wire up subcategory codes.
              </p>
            )}
          </CardContent>
        </Card>

        {results && !importing && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={results.rejected + results.skipped === 0 ? 'border-emerald-200' : 'border-amber-200'}>
                <CardHeader><CardTitle>{dryRun ? '📋 Dry Run Preview' : '✅ Import Complete'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-green-50 rounded-lg"><p className="text-2xl font-bold text-green-700">{results.inserted}</p><p className="text-xs text-green-600">New</p></div>
                    <div className="p-3 bg-blue-50 rounded-lg"><p className="text-2xl font-bold text-blue-700">{results.updated}</p><p className="text-xs text-blue-600">Updated</p></div>
                    <div className="p-3 bg-yellow-50 rounded-lg"><p className="text-2xl font-bold text-yellow-700">{results.skipped}</p><p className="text-xs text-yellow-600">API Errors</p></div>
                    <div className="p-3 bg-red-50 rounded-lg"><p className="text-2xl font-bold text-red-700">{results.rejected}</p><p className="text-xs text-red-600">Rejected</p></div>
                  </div>
                  {results.skipReasons.length > 0 && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-xs font-semibold text-yellow-800 mb-2">Issues (showing first {results.skipReasons.length}):</p>
                      <div className="max-h-48 overflow-auto space-y-0.5">
                        {results.skipReasons.map((r, i) => <p key={i} className="text-xs text-yellow-700 font-mono">{r}</p>)}
                      </div>
                    </div>
                  )}
                  {!dryRun && results.inserted + results.updated > 0 && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <AlertDescription className="text-blue-800 text-sm">
                        <strong>Next:</strong> Data Maintenance → Repair Subcategories &amp; Varieties → select each flower plant type → Run Repair.
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
