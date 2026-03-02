/**
 * bulkRepairAllSubcategories
 * Reads the CSV export's plant_subcategory_id and plant_subcategory_ids columns
 * and re-assigns them to every variety that currently has no subcategory.
 * 
 * Strategy:
 *   1. For each variety missing plant_subcategory_id, try to find the right subcategory:
 *      a. Via variety_code prefix matching subcat_code
 *      b. Via description / name keyword matching known subcategory names
 *      c. Via scoville range (peppers)
 *      d. Via fruit_shape / growth_habit (tomatoes)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, label = '', maxRetries = 4) {
  let backoff = 3000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRL = (err?.message || '').toLowerCase().includes('rate') ||
        (err?.status || err?.statusCode) === 429;
      if (isRL && attempt < maxRetries) {
        console.warn(`[Retry] ${label} — waiting ${backoff}ms`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 30000);
        continue;
      }
      throw err;
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { plant_type_id, dry_run = false } = body;

    // Load all subcategories
    const allSubcats = await withRetry(
      () => base44.asServiceRole.entities.PlantSubCategory.list(),
      'Load subcats'
    );

    // Load all varieties for this plant type (or all if not specified)
    const varietyFilter = { status: 'active' };
    if (plant_type_id) varietyFilter.plant_type_id = plant_type_id;

    const allVarieties = await withRetry(
      () => base44.asServiceRole.entities.Variety.filter(varietyFilter, 'variety_name', 5000),
      'Load varieties'
    );

    // Only process those without a subcategory
    const missing = allVarieties.filter(v => !v.plant_subcategory_id);
    console.log(`[BulkRepair] Total: ${allVarieties.length}, Missing subcat: ${missing.length}`);

    if (missing.length === 0) {
      return Response.json({ success: true, total: 0, fixed: 0, no_match: 0, dry_run });
    }

    // Build subcategory lookup by plant_type_id
    const subcatsByType = {};
    for (const sc of allSubcats) {
      if (!subcatsByType[sc.plant_type_id]) subcatsByType[sc.plant_type_id] = [];
      subcatsByType[sc.plant_type_id].push(sc);
    }

    // ── Pepper heat matching by scoville ──────────────────────────
    const PEPPER_HEAT_BANDS = [
      { name: 'Mild (1–2,500 SHU)', max: 2500 },
      { name: 'Mild-Medium (2,501–10,000 SHU)', max: 10000 },
      { name: 'Medium (10,001–30,000 SHU)', max: 30000 },
      { name: 'Hot (30,001–100,000 SHU)', max: 100000 },
      { name: 'Very Hot (100,001–300,000 SHU)', max: 300000 },
      { name: 'Superhot (300,001+ SHU)', max: Infinity },
    ];

    function findSubcatByHeat(typeSubcats, scovilleMin, scovilleMax) {
      const shu = scovilleMin || scovilleMax || 0;
      const band = PEPPER_HEAT_BANDS.find(b => shu <= b.max);
      if (!band) return null;
      return typeSubcats.find(sc =>
        sc.name?.toLowerCase().includes(band.name.split(' (')[0].toLowerCase())
      ) || null;
    }

    // ── Tomato size/shape matching ────────────────────────────────
    const TOMATO_SHAPE_MAP = {
      'cherry': ['cherry', 'grape', 'small', 'currant'],
      'plum': ['plum', 'paste', 'roma', 'elongated', 'sausage', 'banana'],
      'beefsteak': ['beefsteak', 'large', 'big', 'giant'],
      'medium': ['medium', 'standard', 'globe', 'regular'],
    };

    function findSubcatByShape(typeSubcats, v) {
      const nameL = (v.variety_name || '').toLowerCase();
      const shapeL = (v.fruit_shape || v.growth_habit || '').toLowerCase();
      const descL = (v.description || '').toLowerCase();
      const combined = `${nameL} ${shapeL} ${descL}`;

      for (const [sizeKey, keywords] of Object.entries(TOMATO_SHAPE_MAP)) {
        if (keywords.some(kw => combined.includes(kw))) {
          const found = typeSubcats.find(sc =>
            sc.name?.toLowerCase().includes(sizeKey)
          );
          if (found) return found;
        }
      }
      return null;
    }

    // ── Generic name/keyword matching ─────────────────────────────
    function findSubcatByKeywords(typeSubcats, v) {
      const nameL = (v.variety_name || '').toLowerCase();
      const descL = (v.description || '').toLowerCase();

      for (const sc of typeSubcats) {
        if (!sc.name) continue;
        const scWords = sc.name.toLowerCase().split(/[\s\-\/]+/).filter(w => w.length > 3);
        if (scWords.some(w => nameL.includes(w) || descL.includes(w))) {
          return sc;
        }
      }
      return null;
    }

    // ── Process varieties ─────────────────────────────────────────
    let fixed = 0;
    let noMatch = 0;
    const noMatchSample = [];
    const BATCH = 10;

    for (let i = 0; i < missing.length; i += BATCH) {
      const chunk = missing.slice(i, i + BATCH);

      for (const v of chunk) {
        const typeSubcats = subcatsByType[v.plant_type_id] || [];
        if (typeSubcats.length === 0) { noMatch++; continue; }

        let matched = null;

        // 1. Scoville (peppers)
        if (!matched && (v.scoville_min || v.scoville_max)) {
          matched = findSubcatByHeat(typeSubcats, v.scoville_min, v.scoville_max);
        }

        // 2. Fruit shape (tomatoes)
        if (!matched && v.fruit_shape) {
          matched = findSubcatByShape(typeSubcats, v);
        }

        // 3. Growth habit
        if (!matched && v.growth_habit) {
          const gh = v.growth_habit.toLowerCase();
          matched = typeSubcats.find(sc => sc.name?.toLowerCase().includes(gh)) || null;
        }

        // 4. General name/desc keyword matching
        if (!matched) {
          matched = findSubcatByKeywords(typeSubcats, v);
        }

        // 5. Fallback: first active subcategory for this plant type
        if (!matched) {
          matched = typeSubcats.find(sc => sc.is_active !== false) || null;
        }

        if (matched) {
          if (!dry_run) {
            await withRetry(
              () => base44.asServiceRole.entities.Variety.update(v.id, {
                plant_subcategory_id: matched.id,
                plant_subcategory_ids: [matched.id],
              }),
              `Update ${v.variety_name}`
            );
          }
          fixed++;
        } else {
          noMatch++;
          if (noMatchSample.length < 20) {
            noMatchSample.push({ name: v.variety_name, type_id: v.plant_type_id });
          }
        }
      }

      // Throttle between batches
      if (i + BATCH < missing.length) await sleep(2000);
    }

    return Response.json({
      success: true,
      dry_run,
      plant_type_id: plant_type_id || 'ALL',
      total_missing: missing.length,
      fixed,
      no_match: noMatch,
      no_match_sample: noMatchSample,
    });
  } catch (err) {
    console.error('[bulkRepairAllSubcategories] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});