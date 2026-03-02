import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Upload, Loader2, Info, ChevronDown, ChevronUp, ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// ─── LOOKUP-ONLY — never sent to DB ──────────────────────────────────────────
const CODE_COLUMNS = new Set([
  'plant_type_code','plant_type_common_name',
  'plant_subcategory_code','plant_subcategory_codes',
  'id','created_date','updated_date','created_by_id','is_sample',
  'is_perennial_species','perennial_from_zone','zone_7a_behavior',
]);

// ─── FIELDS THAT MUST NEVER APPEAR IN A PAYLOAD ───────────────────────────────
const FORBIDDEN_FIELDS = new Set([
  'id','created_date','updated_date','created_by','created_by_id','is_sample',
  'plant_type_code','plant_type_common_name',
  'plant_subcategory_code','plant_subcategory_codes',
  'is_perennial_species','perennial_from_zone','zone_7a_behavior',
  // Causes 422 — only plant_subcategory_id (singular) is accepted
  'plant_subcategory_ids',
]);

// ─── ALL WRITABLE VARIETY FIELDS ─────────────────────────────────────────────
// Derived from Variety_export (65 cols) + Variety_export_1 (136 cols).
// Fields confirmed to exist as writeable in the Base44 Variety entity.
const ALL_COLUMNS = new Set([
  'variety_name','plant_type_id','plant_type_name','plant_subcategory_id',
  'variety_code','description','synonyms','status','is_custom',
  'days_to_maturity','days_to_maturity_min','days_to_maturity_max',
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
  'sources','affiliate_url','popularity_tier','grower_notes','source_attribution','traits',
  'scoville_min','scoville_max','heat_scoville_min','heat_scoville_max',
  'light_requirement_indoor','light_tolerance_range','min_light_hours','max_light_hours',
  'grow_light_compatible','watering_frequency_range','watering_method_preferred',
  'soil_dryness_rule','drought_tolerant','overwater_sensitivity',
  'temp_min_f','temp_max_f','temp_ideal_min_f','temp_ideal_max_f','cold_draft_sensitive',
  'humidity_preference','humidity_support_method','misting_beneficial',
  'soil_type_recommended','soil_drainage_speed','drainage_holes_required','recommended_pot_type',
  'fertilizer_type','fertilizer_frequency','fertilizer_strength','dormant_season_feeding',
  'fertilizer_rule',  // String field — free text OK per export schema
  'growth_pattern','mature_indoor_height','mature_indoor_width','growth_speed',
  'needs_support','pruning_needs','repot_frequency_years','rootbound_tolerance','best_repot_season',
  'toxic_to_cats','toxic_to_dogs','toxic_to_humans','sap_irritant','pet_safe','toxicity_notes',
  'common_pests','common_diseases','pest_susceptibility','preventive_care_tips',
  'winter_dormancy','reduced_winter_watering','winter_leaf_drop_normal','seasonal_notes',
  'propagation_methods','propagation_difficulty','propagation_best_season','propagation_notes',
  'care_difficulty','air_purifying','display_style','variegation_type',
  'flowering_indoors','fragrant',
  'water_type_required','dormancy_required',
  'dormancy_temp_min_f','dormancy_temp_max_f',
  'dormancy_duration_months_min','dormancy_duration_months_max',
  'soil_type_required','root_cooling_required','root_temp_max_f','is_aquatic',
  'care_warnings','images','extended_data',
]);

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────────
const BOOL_COLS = new Set([
  'trellis_required','container_friendly','is_ornamental','is_organic',
  'grow_light_compatible','drought_tolerant','cold_draft_sensitive','misting_beneficial',
  'drainage_holes_required','dormant_season_feeding','needs_support','winter_dormancy',
  'reduced_winter_watering','winter_leaf_drop_normal','air_purifying','flowering_indoors',
  'fragrant','root_cooling_required','is_aquatic',
  'toxic_to_cats','toxic_to_dogs','toxic_to_humans','sap_irritant','pet_safe',
  // is_custom forced to false via override — not processed from CSV
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

// Base44 stores these as JSON arrays (List type)
const JSON_ARRAY_COLS = new Set([
  'synonyms','sources','images','care_warnings',
  // display_style is a String in DB — do NOT parse it
]);

// Base44 stores these as plain String — join array items with ", "
// Error: "Input should be a valid string"
const JSON_TO_STRING_COLS = new Set([
  'propagation_methods',  // DB: String
  'common_pests',         // DB: String
  'common_diseases',      // DB: String (not List!)
]);

// traits: DB stores as dict { "trait_name": true, ... }
// CSV has array ["shade_tolerant","container_plant",...]
// Error: "Input should be a valid dictionary"
const TRAITS_FIELD = 'traits';

// JSON object fields
const JSON_OBJECT_COLS = new Set(['extended_data']);

// ─── ENUM NORMALISATION ───────────────────────────────────────────────────────
// Map raw CSV → valid DB enum value. null = omit the field entirely.
function normaliseEnum(field, raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  const lo = s.toLowerCase();

  switch (field) {
    case 'status':
      return ['active','pending_review','removed'].includes(s) ? s : 'active';

    case 'seed_line_type': {
      const valid = ['heirloom','hybrid','open_pollinated','unknown'];
      if (valid.includes(lo)) return lo;
      if (lo === 'organic') return 'open_pollinated';
      return 'unknown';
    }

    case 'season_timing': {
      const valid = ['early','mid','late','unknown'];
      if (valid.includes(lo)) return lo;
      if (lo === 'year_round') return null; // omit — not a valid value
      return null;
    }

    case 'popularity_tier': {
      const valid = ['common','popular','rare','heirloom'];
      if (valid.includes(lo)) return lo;
      if (lo === 'niche' || lo === 'specialty' || lo === 'uncommon') return 'rare';
      return null;
    }

    case 'species': {
      const valid = ['annuum','chinense','baccatum','frutescens','pubescens','unknown'];
      if (valid.includes(lo)) return lo;
      return 'unknown'; // anything else (Begonia × semperflorens, etc.) → 'unknown'
    }

    case 'fertilizer_strength': {
      const valid = ['full','half','quarter'];
      if (valid.includes(lo)) return lo;
      if (lo.includes('quarter') || lo === 'dilute' || lo === 'dilute (half-strength)' || lo === 'light') return 'quarter';
      if (lo === 'moderate' || lo.includes('half')) return 'half';
      if (lo === 'none') return null; // omit
      return null;
    }

    case 'fertilizer_frequency': {
      const valid = ['weekly_dilute','biweekly','monthly','seasonal_only'];
      if (valid.includes(lo)) return lo;
      if (lo.includes('every_2_weeks') || lo.includes('every 2') || lo === 'biweekly' || lo === 'every_3_weeks') return 'biweekly';
      if (lo === 'monthly' || lo.includes('every 4') || lo.includes('once a month')) return 'monthly';
      if (lo === 'weekly' || lo === 'weekly_dilute') return 'weekly_dilute';
      if (lo === 'annually' || lo === 'spring' || lo.includes('seasonal') || lo.includes('twice annually') || lo === 'spring and fall' || lo === 'avoid nitrogen' || lo === 'never' || lo === 'rarely') return 'seasonal_only';
      return null;
    }

    case 'fertilizer_type': {
      const valid = ['balanced','high_nitrogen','bloom_booster','orchid_specific','none'];
      if (valid.includes(lo)) return lo;
      if (lo.includes('balanced')) return 'balanced';
      if (lo.includes('phosphorus') || lo.includes('bloom') || lo.includes('african violet')) return 'bloom_booster';
      if (lo.includes('nitrogen')) return 'high_nitrogen';
      if (lo === 'none') return 'none';
      return null;
    }

    case 'growth_speed': {
      const valid = ['slow','moderate','fast'];
      if (valid.includes(lo)) return lo;
      if (lo.startsWith('slow')) return 'slow';
      if (lo.startsWith('moderate') || lo.includes('to moderate')) return 'moderate';
      if (lo.startsWith('fast')) return 'fast';
      return null;
    }

    case 'best_repot_season': {
      const valid = ['spring','spring_summer','anytime'];
      if (valid.includes(lo)) return lo;
      if (lo.includes('spring') && lo.includes('summer')) return 'spring_summer';
      if (lo.includes('spring')) return 'spring';
      if (lo.includes('any')) return 'anytime';
      return null;
    }

    case 'propagation_best_season': {
      const valid = ['spring','spring_summer','anytime'];
      if (valid.includes(lo)) return lo;
      if (lo.includes('spring') && lo.includes('summer')) return 'spring_summer';
      if (lo.includes('spring') || lo.includes('early spring') || lo.includes('late winter')) return 'spring';
      if (lo.includes('any') || lo.includes('leaf cutting')) return 'anytime';
      return null;
    }

    case 'care_difficulty':
    case 'propagation_difficulty': {
      const valid = ['beginner','easy','moderate','advanced','expert'];
      return valid.includes(lo) ? lo : null;
    }

    case 'rootbound_tolerance': {
      const valid = ['sensitive','moderate','tolerant','prefers_rootbound'];
      return valid.includes(lo) ? lo : null;
    }

    case 'overwater_sensitivity': {
      const valid = ['low','moderate','high','extreme'];
      return valid.includes(lo) ? lo : null;
    }

    case 'soil_drainage_speed': {
      const valid = ['fast','moderate','water_retentive'];
      if (valid.includes(lo)) return lo;
      if (lo.includes('fast')) return 'fast';
      if (lo.includes('moderate')) return 'moderate';
      if (lo.includes('water_retentive') || lo.includes('retentive')) return 'water_retentive';
      return null;
    }

    case 'humidity_preference': {
      const valid = ['low','medium','high','very_high'];
      return valid.includes(lo) ? lo : null;
    }

    case 'soil_type_required': {
      // Base44 enum: standard | carnivorous_mix | orchid_mix | succulent_mix | aquatic_none | custom
      const valid = ['standard','carnivorous_mix','orchid_mix','succulent_mix','aquatic_none','custom'];
      if (valid.includes(lo)) return lo;
      // Map free-text values from the flower CSV to closest enum
      if (lo === 'standard') return 'standard';
      // Everything else in the flower CSV ('well_drained', 'moist, well_drained', etc.)
      // doesn't match — omit rather than send an invalid enum value
      return null;
    }

    case 'variegation_type': {
      const valid = ['none','stable','unstable','chimeral'];
      return valid.includes(lo) ? lo : null;
    }

    case 'dormancy_required': {
      const valid = ['none','required_cold','optional_beneficial','succulent_phase','turion_aquatic'];
      return valid.includes(lo) ? lo : null;
    }

    case 'water_type_required': {
      const valid = ['any','distilled_only','distilled_preferred'];
      return valid.includes(lo) ? lo : null;
    }

    case 'recommended_pot_type': {
      // Allow free text — Base44 may not enforce enum here
      return s;
    }

    case 'humidity_support_method': {
      return s; // free text
    }

    case 'watering_method_preferred': {
      // Free-text string in DB — pass through as-is
      return s;
    }

    default:
      return s;
  }
}

// Fields that require enum normalisation before sending
const ENUM_FIELDS = new Set([
  'status','seed_line_type','season_timing','popularity_tier','species',
  'fertilizer_strength','fertilizer_frequency','fertilizer_type',
  'growth_speed','best_repot_season','propagation_best_season',
  'care_difficulty','propagation_difficulty','rootbound_tolerance',
  'overwater_sensitivity','soil_drainage_speed','humidity_preference',
  'soil_type_required','variegation_type','dormancy_required','water_type_required',
]);

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
// Handles both "" doubled-quote AND \" backslash-quote escape styles.
function parseCSV(text) {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = [];
  let i = 0, cur = '', inQ = false, currentRecord = [];

  while (i < raw.length) {
    const c = raw[i], n = raw[i + 1] ?? '', nn = raw[i + 2] ?? '';
    if (inQ) {
      // Backslash-quote: treat as escape ONLY when char after the " is not a field terminator.
      // If next char after " is , or \n or " or end-of-string, then \ is content and " closes the field.
      if (c === '\\' && n === '"' && nn !== ',' && nn !== '\n' && nn !== '"' && nn !== '') {
        cur += '"'; i += 2; continue;
      }
      if (c === '"' && n === '"')  { cur += '"'; i += 2; continue; }  // doubled-quote escape
      if (c === '"') { inQ = false; i++; continue; }                  // closing quote
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

// ─── VALUE CASTING ────────────────────────────────────────────────────────────
function castValue(col, raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str === '') return null;

  // Boolean
  if (BOOL_COLS.has(col)) {
    return ['true','1','yes'].includes(str.toLowerCase()) || raw === true;
  }

  // Numeric
  if (NUM_COLS.has(col)) {
    const n = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  // JSON arrays (synonyms, sources, images, care_warnings, common_diseases)
  if (JSON_ARRAY_COLS.has(col)) {
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(item => {
          if (typeof item === 'string') {
            try { const inner = JSON.parse(item); return Array.isArray(inner) ? inner : item; }
            catch { return item; }
          }
          return item;
        }).flat();
      }
      return [str];
    } catch {
      if (str.includes('|')) return str.split('|').map(s => s.trim()).filter(Boolean);
      if (str === '[]' || str === '') return [];
      return [str];
    }
  }

  // String fields that arrive as JSON arrays — join to comma-separated string
  // DB type is String, not List: "Input should be a valid string"
  if (JSON_TO_STRING_COLS.has(col)) {
    if (str === '[]' || str === '') return null;
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.join(', ');
      return str;
    } catch { return str; }
  }

  // traits: DB type is dict { "trait_name": true }
  // CSV has ["shade_tolerant","container_plant",...] — convert to object
  if (col === TRAITS_FIELD) {
    if (str === '[]' || str === '') return null;
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        const dict = {};
        parsed.forEach(t => { if (t && typeof t === 'string') dict[t] = true; });
        return Object.keys(dict).length > 0 ? dict : null;
      }
      if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
    return null;
  }

  // JSON objects (extended_data)
  if (JSON_OBJECT_COLS.has(col)) {
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(str); } catch { return {}; }
  }

  // Enum normalisation
  if (ENUM_FIELDS.has(col)) {
    return normaliseEnum(col, str);
  }

  // display_style: Base44 stores as String — send as-is, don't parse to array
  if (col === 'display_style') return str;

  // Everything else: string passthrough
  return str;
}

// ─── PAYLOAD BUILDER ──────────────────────────────────────────────────────────
function cleanPayload(raw) {
  const clean = {};
  for (const [k, v] of Object.entries(raw)) {
    if (FORBIDDEN_FIELDS.has(k)) continue;
    if (!ALL_COLUMNS.has(k)) continue;
    if (v === null || v === undefined) continue;
    clean[k] = v;
  }
  return clean;
}

// ─── RETRY WRAPPER ────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiRetry(fn, label = '', maxRetries = 6) {
  let backoff = 4000;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.response?.status;
      const msg = (err?.message || '').toLowerCase();
      const isRL = msg.includes('rate') || msg.includes('429') || status === 429;
      const isServer = status >= 500 && status < 600;
      if ((isRL || isServer) && i < maxRetries) {
        console.warn(`[Retry ${i+1}] ${label}: waiting ${backoff}ms`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 60000);
        continue;
      }
      throw err;
    }
  }
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function AdminVarietyImport2() {
  const [user, setUser] = React.useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [upsertMode, setUpsertMode] = useState('preserve_filled');
  const [selectedCols, setSelectedCols] = useState(new Set(['variety_name','plant_type_id']));
  const [showColPicker, setShowColPicker] = useState(false);
  const [debugMode, setDebugMode] = useState(false); // logs every payload to console
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

      console.log(`[Import2] ${allPT.length} plant types, ${allSC.length} subcats, ${allVar.length} varieties loaded`);

      const BATCH = 3;

      for (let i = 0; i < parsedData.length; i += BATCH) {
        const chunk = parsedData.slice(i, i + BATCH);

        for (const row of chunk) {
          const varietyName = (row.variety_name || row.name || '').trim();
          try {
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
            if (row.plant_subcategory_id && scById[row.plant_subcategory_id.trim()])
              resolvedSubcatId = row.plant_subcategory_id.trim();
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

            // Find existing variety for upsert
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

            // Always set these
            rawPayload.plant_type_id = pt.id;
            rawPayload.plant_type_name = pt.common_name;
            rawPayload.variety_name = varietyName;
            // Force is_custom to false (never import user-custom variety flag)
            rawPayload.is_custom = false;

            if (resolvedSubcatId) {
              if (upsertMode === 'overwrite_all' || upsertMode === 'selective'
                || (upsertMode === 'preserve_filled' && !existing?.plant_subcategory_id)) {
                rawPayload.plant_subcategory_id = resolvedSubcatId;
              }
            }

            const payload = cleanPayload(rawPayload);

            // Debug mode: log full payload to console before sending
            if (debugMode) {
              console.log(`[Payload] ${varietyName}:`, JSON.stringify(payload, null, 2));
            }

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
              const created = await apiRetry(
                () => base44.entities.Variety.create({ ...payload, status: 'active', is_custom: false }),
                `Create "${varietyName}"`
              );
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
            // Always log payload on error so devtools shows what failed
            console.error(`[422 payload] "${varietyName}":`, err.message);
            skipReasons.push(`"${varietyName}": ${(err.message || '').substring(0, 200)}`);
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
          : `Done! +${inserted} inserted, ↑${updated} updated, ${skipped} errors, ${rateLimitHits} rate limit retries`
      );
    } catch (err) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  if (!user) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  const schemaColsInFile = headers.filter(h => ALL_COLUMNS.has(h));
  const ignoredCols = headers.filter(h => !ALL_COLUMNS.has(h) && !CODE_COLUMNS.has(h) && !FORBIDDEN_FIELDS.has(h));

  return (
    <ErrorBoundary fallbackTitle="Import Error" fallbackMessage="An error occurred. Please refresh.">
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Variety Import 2 — Advanced (v3)</h1>
          <p className="text-gray-600 mt-1">Full schema import with enum normalisation and field filtering.</p>
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            <strong>Key fixes in v3 vs v2:</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
              <li><strong>display_style</strong> — no longer JSON-parsed (sent as String, matching DB type)</li>
              <li><strong>soil_type_required</strong> — maps free-text like "well_drained, acidic" → null (omitted); keeps only valid enum values</li>
              <li><strong>synonyms</strong> — double-nested JSON artifacts flattened</li>
              <li><strong>is_custom</strong> — always forced false regardless of CSV value</li>
              <li><strong>Debug mode</strong> — logs every payload to browser console before sending (enable below)</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader><CardTitle>1. Upload CSV</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept=".csv" onChange={handleFile} />
            {parsedData.length > 0 && (
              <div className="text-sm space-y-1 p-3 bg-gray-50 rounded-lg">
                <p>✅ <strong>{parsedData.length}</strong> rows</p>
                <p>✅ <strong>{schemaColsInFile.length}</strong> schema columns recognised</p>
                {ignoredCols.length > 0 && <p className="text-gray-500 text-xs">⚠ {ignoredCols.length} unrecognised cols ignored: {ignoredCols.slice(0,6).join(', ')}</p>}
                <p className="text-gray-500 text-xs">Row 1: <em>{parsedData[0]?.variety_name || '(no variety_name)'}</em></p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>2. Upsert Mode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { value: 'preserve_filled', label: '🛡️ Preserve Filled (Recommended)', desc: 'Only fills empty fields. Never overwrites existing data.' },
              { value: 'overwrite_all', label: '🔄 Overwrite All', desc: 'Replaces every field from CSV.' },
              { value: 'selective', label: '🎯 Selective Columns', desc: 'Choose exactly which columns to update.' },
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
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="w-4 h-4" />
                <span className="text-sm font-medium">Dry Run — preview only, no DB changes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} className="w-4 h-4" />
                <span className="text-sm font-medium text-blue-700">Debug Mode — log every payload to browser console (open DevTools → Console tab)</span>
              </label>
            </div>

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
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                : <><Upload className="w-4 h-4" /> {dryRun ? 'Preview Import' : 'Start Import'} ({parsedData.length} rows)</>
              }
            </Button>
          </CardContent>
        </Card>

        {results && !importing && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={results.skipped === 0 ? 'border-emerald-200' : 'border-amber-200'}>
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
                      <p className="text-xs font-semibold text-yellow-800 mb-1">
                        Issues — also check browser Console (F12) for full details:
                      </p>
                      <div className="max-h-48 overflow-auto space-y-0.5">
                        {results.skipReasons.map((r, i) => <p key={i} className="text-xs text-yellow-700 font-mono">{r}</p>)}
                      </div>
                    </div>
                  )}
                  {results.skipped > 0 && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <AlertDescription className="text-blue-800 text-sm">
                        Still getting 422s? Turn on <strong>Debug Mode</strong> above, run again (Dry Run unchecked),
                        then open <strong>F12 → Console</strong> and search for <code>[Payload]</code> to see the exact
                        JSON being sent. The 422 will be the last payload logged before an error.
                      </AlertDescription>
                    </Alert>
                  )}
                  {!dryRun && results.inserted + results.updated > 0 && (
                    <Alert className="border-green-200 bg-green-50">
                      <AlertDescription className="text-green-800 text-sm">
                        <strong>Next:</strong> Data Maintenance → Repair Subcategories for each flower plant type.
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
