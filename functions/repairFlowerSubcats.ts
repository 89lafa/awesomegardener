import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Repairs flower subcategories — chunked per plant type to avoid timeout.
 *
 * POST { dry_run: bool, plant_type_id?: string }
 *   - If plant_type_id is given: process only that one plant type.
 *   - If omitted: process ALL flower plant types (creates subcats only, skips variety assignment if >50).
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, retries = 4) {
  let backoff = 2000;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i < retries) { await sleep(backoff); backoff = Math.min(backoff * 2, 20000); continue; }
      throw err;
    }
  }
}

function makeSubcatCode(plantTypeCode) {
  const core = plantTypeCode.replace(/^PT_/, '');
  return `PSC_${core}_STANDARD`;
}

function makeSubcatName(subcatCode) {
  return subcatCode
    .replace(/^PSC_/, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const isDryRun = body.dry_run !== false;
    const limitToPTId = body.plant_type_id || null;

    // Load all plant types
    const allPT = await withRetry(() => base44.asServiceRole.entities.PlantType.list('common_name', 500));
    const ptById = {};
    allPT.forEach(pt => { ptById[pt.id] = pt; });

    // Identify flower plant types
    const flowerPTs = allPT.filter(pt => {
      if (limitToPTId) return pt.id === limitToPTId;
      const cat = (pt.category || '').toLowerCase();
      return ['flower', 'bedding_annuals', 'ornamental', 'bulb', 'perennial_flower', 'annual_flower'].some(c => cat.includes(c));
    });
    console.log(`Processing ${flowerPTs.length} flower plant types`);

    // Load existing subcats
    const existingSubcats = await withRetry(() => base44.asServiceRole.entities.PlantSubCategory.list('subcat_code', 5000));
    const existingByCode = {};
    existingSubcats.forEach(sc => { if (sc.subcat_code) existingByCode[sc.subcat_code] = sc; });
    console.log(`Existing subcats: ${existingSubcats.length}`);

    let subcatsCreated = 0, varietiesFixed = 0, errors = 0;
    const createLog = [];
    const assignLog = [];
    const createdSubcats = { ...existingByCode };

    for (const pt of flowerPTs) {
      if (!pt.plant_type_code) {
        console.log(`  Skipping PT ${pt.common_name} — no plant_type_code`);
        continue;
      }

      const subcatCode = makeSubcatCode(pt.plant_type_code);

      // Phase 1: Ensure subcat exists
      let sc = createdSubcats[subcatCode];
      if (!sc) {
        const data = {
          subcat_code: subcatCode,
          name: makeSubcatName(subcatCode),
          plant_type_id: pt.id,
          is_active: true,
          sort_order: 0,
          synonyms: [],
          description: `Standard ${pt.common_name} varieties`,
        };
        if (!isDryRun) {
          try {
            const created = await withRetry(() => base44.asServiceRole.entities.PlantSubCategory.create(data));
            createdSubcats[subcatCode] = created;
            sc = created;
            subcatsCreated++;
            createLog.push({ code: subcatCode, name: data.name, id: created.id });
            await sleep(300);
          } catch (err) {
            errors++;
            console.warn(`Failed to create subcat ${subcatCode}:`, err.message);
            continue;
          }
        } else {
          const fakeId = 'DRY_' + subcatCode;
          createdSubcats[subcatCode] = { id: fakeId, ...data };
          sc = createdSubcats[subcatCode];
          subcatsCreated++;
          createLog.push({ code: subcatCode, name: data.name, plant_type_id: pt.id });
        }
      }

      // Phase 2: Assign varieties for this plant type
      const vars = await withRetry(() => base44.asServiceRole.entities.Variety.filter({ plant_type_id: pt.id }, 'variety_name', 500));
      const varArr = Array.isArray(vars) ? vars : [];
      const missing = varArr.filter(v => !v.plant_subcategory_id);
      console.log(`  ${pt.common_name}: ${varArr.length} varieties, ${missing.length} need subcat`);

      for (const v of missing) {
        if (isDryRun) {
          varietiesFixed++;
          if (assignLog.length < 50) assignLog.push({ name: v.variety_name, subcat: sc.name || subcatCode });
          continue;
        }
        try {
          await withRetry(() => base44.asServiceRole.entities.Variety.update(v.id, {
            plant_subcategory_id: sc.id,
          }));
          varietiesFixed++;
          if (assignLog.length < 50) assignLog.push({ name: v.variety_name, subcat: sc.name || subcatCode });
          await sleep(150);
        } catch (err) {
          errors++;
          console.warn(`Failed to assign ${v.variety_name}:`, err.message);
          await sleep(2000);
        }
      }

      // Small pause between plant types
      if (!isDryRun) await sleep(500);
    }

    return Response.json({
      success: true,
      dry_run: isDryRun,
      subcats_created: subcatsCreated,
      varieties_assigned: varietiesFixed,
      errors,
      sample_subcats_created: createLog.slice(0, 20),
      sample_assignments: assignLog.slice(0, 50),
      message: isDryRun
        ? `DRY RUN: Would create ${subcatsCreated} subcats and assign ${varietiesFixed} varieties.`
        : `Done! Created ${subcatsCreated} subcats, assigned ${varietiesFixed} varieties. ${errors} errors.`,
    });

  } catch (err) {
    console.error('[repairFlowerSubcats]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});