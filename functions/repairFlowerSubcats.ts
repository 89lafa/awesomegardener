import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Repairs flower subcategories in 2 phases:
 * Phase 1: Scan varieties that have NO plant_subcategory_id but HAVE a plant_type_id for a flower type.
 *          Derive the subcat_code from the variety_name pattern (Standard X → PSC_X_STANDARD).
 *          Create the PlantSubCategory record if it doesn't exist.
 * Phase 2: Assign plant_subcategory_id to each variety from the newly created subcats.
 *
 * POST { dry_run: true/false }
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, retries = 5) {
  let backoff = 3000;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i < retries) { await sleep(backoff); backoff = Math.min(backoff * 2, 30000); continue; }
      throw err;
    }
  }
}

function makeSubcatCode(plantTypeCode) {
  // PT_WAX_BEGONIA → PSC_WAX_BEGONIA_STANDARD
  const core = plantTypeCode.replace(/^PT_/, '');
  return `PSC_${core}_STANDARD`;
}

function makeSubcatName(subcatCode) {
  // PSC_WAX_BEGONIA_STANDARD → Wax Begonia Standard
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

    // Load all plant types
    const allPT = await withRetry(() => base44.asServiceRole.entities.PlantType.list('common_name', 500));
    const ptById = {};
    allPT.forEach(pt => { ptById[pt.id] = pt; });
    console.log(`Loaded ${allPT.length} plant types`);

    // Load all existing PlantSubCategory records
    const existingSubcats = await withRetry(() => base44.asServiceRole.entities.PlantSubCategory.list('subcat_code', 5000));
    const existingByCode = {};
    existingSubcats.forEach(sc => { if (sc.subcat_code) existingByCode[sc.subcat_code] = sc; });
    console.log(`Existing subcats: ${existingSubcats.length}`);

    // Load ALL varieties with missing plant_subcategory_id (up to 9999)
    // Note: filter by null may not work perfectly — we check the value explicitly below
    const toFixRaw = await withRetry(() => base44.asServiceRole.entities.Variety.filter(
      { status: 'active' }, 'variety_name', 9999
    ));
    const toFix = Array.isArray(toFixRaw) ? toFixRaw : (toFixRaw?.results || toFixRaw?.data || []);
    const needsSubcat = toFix.filter(v => !v.plant_subcategory_id);
    console.log(`Varieties with no subcategory: ${needsSubcat.length} out of ${toFix.length}`);

    // For each variety, determine what subcat to create/assign
    const toCreate = new Map(); // subcat_code → { subcat_code, name, plant_type_id }
    const assignments = []; // { variety_id, variety_name, subcat_code }

    for (const v of needsSubcat) {
      const pt = ptById[v.plant_type_id];
      if (!pt || !pt.plant_type_code) continue;

      const subcatCode = makeSubcatCode(pt.plant_type_code);

      // Track for creation if not yet existing
      if (!existingByCode[subcatCode] && !toCreate.has(subcatCode)) {
        toCreate.set(subcatCode, {
          subcat_code: subcatCode,
          name: makeSubcatName(subcatCode),
          plant_type_id: v.plant_type_id,
          is_active: true,
          sort_order: 0,
          synonyms: [],
          description: `Standard ${pt.common_name} varieties`,
        });
      }

      assignments.push({
        variety_id: v.id,
        variety_name: v.variety_name,
        subcat_code: subcatCode,
        plant_type_id: v.plant_type_id,
      });
    }

    console.log(`Subcats to create: ${toCreate.size}, varieties to assign: ${assignments.length}`);

    // === Execute ===
    const createdSubcats = { ...existingByCode };
    let subcatsCreated = 0, varietiesFixed = 0, errors = 0;
    const createLog = [];
    const assignLog = [];

    // Phase 1: Create subcats
    for (const [code, data] of toCreate.entries()) {
      if (isDryRun) {
        createdSubcats[code] = { id: 'DRY_' + code, ...data };
        subcatsCreated++;
        createLog.push({ code, name: data.name, plant_type_id: data.plant_type_id });
        continue;
      }
      try {
        const created = await withRetry(() => base44.asServiceRole.entities.PlantSubCategory.create(data));
        createdSubcats[code] = created;
        subcatsCreated++;
        createLog.push({ code, name: data.name, id: created.id });
        await sleep(300);
      } catch (err) {
        errors++;
        console.warn(`Failed to create subcat ${code}:`, err.message);
      }
    }

    // Phase 2: Assign varieties
    const BATCH = 5;
    for (let i = 0; i < assignments.length; i += BATCH) {
      const chunk = assignments.slice(i, i + BATCH);
      for (const a of chunk) {
        const sc = createdSubcats[a.subcat_code];
        if (!sc) { errors++; continue; }
        if (isDryRun) {
          varietiesFixed++;
          if (assignLog.length < 30) assignLog.push({ name: a.variety_name, subcat: sc.name || a.subcat_code });
          continue;
        }
        try {
          await withRetry(() => base44.asServiceRole.entities.Variety.update(a.variety_id, {
            plant_subcategory_id: sc.id,
            plant_subcategory_ids: [sc.id],
          }));
          varietiesFixed++;
          if (assignLog.length < 30) assignLog.push({ name: a.variety_name, subcat: sc.name || a.subcat_code });
          await sleep(120);
        } catch (err) {
          errors++;
          console.warn(`Failed to assign ${a.variety_name}:`, err.message);
          await sleep(2000);
        }
      }
      if (!isDryRun && i + BATCH < assignments.length) await sleep(2000);
    }

    return Response.json({
      success: true,
      dry_run: isDryRun,
      subcats_created: subcatsCreated,
      varieties_assigned: varietiesFixed,
      errors,
      sample_subcats_created: createLog.slice(0, 20),
      sample_assignments: assignLog.slice(0, 30),
      message: isDryRun
        ? `DRY RUN: Would create ${subcatsCreated} subcats and assign ${varietiesFixed} varieties.`
        : `Done! Created ${subcatsCreated} subcats, assigned ${varietiesFixed} varieties. ${errors} errors.`
    });

  } catch (err) {
    console.error('[repairFlowerSubcats]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});