import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Two-phase fix for flower varieties missing subcategories:
 * Phase 1: Create missing PlantSubCategory records from the variety codes present in the data
 * Phase 2: Assign plant_subcategory_id on each variety that has a variety-level code pattern
 * 
 * The CSV had plant_subcategory_code like PSC_WAX_BEGONIA_STANDARD but those records
 * don't exist in PlantSubCategory table — so we create them first, then assign.
 * 
 * POST { dry_run: true/false }
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, retries = 5) {
  let backoff = 3000;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (err) {
      if (i < retries) { await sleep(backoff); backoff = Math.min(backoff * 2, 30000); continue; }
      throw err;
    }
  }
}

// Derive a human-readable subcat name from a PSC code
function subcatNameFromCode(code) {
  return code
    .replace(/^PSC_/, '')
    .replace(/_STANDARD$/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
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

    // 1. Load all plant types to build a map by ID
    const allPT = await withRetry(() => base44.asServiceRole.entities.PlantType.list('common_name', 500));
    const ptById = {};
    const ptByCode = {};
    allPT.forEach(pt => {
      ptById[pt.id] = pt;
      if (pt.plant_type_code) ptByCode[pt.plant_type_code] = pt;
    });

    // 2. Load existing PlantSubCategory to avoid duplicates
    const existingSubcats = await withRetry(() => base44.asServiceRole.entities.PlantSubCategory.list('subcat_code', 5000));
    const existingByCode = {};
    existingSubcats.forEach(sc => {
      if (sc.subcat_code) existingByCode[sc.subcat_code] = sc;
    });
    console.log(`Existing subcats: ${existingSubcats.length}`);

    // 3. Load all varieties that have a variety_code or variety_name with "Standard" pattern
    //    These varieties have plant_subcategory_id = null but their plant_type_id 
    //    plus variety name gives us the subcat_code pattern.
    //
    // The pattern: variety variety_name = "Standard [TypeName]"
    //              plant_type_code = PT_WAX_BEGONIA
    //              → subcat_code should be: PSC_WAX_BEGONIA_STANDARD
    //
    // We'll also check varieties that have non-null variety_code to guess subcat from code pattern
    
    const toFix = await withRetry(() => base44.asServiceRole.entities.Variety.filter(
      { plant_subcategory_id: null, status: 'active' }, 'variety_name', 9999
    ));
    console.log(`Varieties missing subcategory: ${toFix.length}`);

    // 4. For each variety, determine what subcat_code it SHOULD have
    const subcatCreations = new Map(); // code → { code, name, plant_type_id }
    const assignments = []; // { variety_id, subcat_code }

    for (const v of toFix) {
      const pt = ptById[v.plant_type_id];
      if (!pt || !pt.plant_type_code) continue;

      const ptCode = pt.plant_type_code; // e.g. PT_WAX_BEGONIA
      const ptCoreName = ptCode.replace(/^PT_/, ''); // e.g. WAX_BEGONIA
      
      let subcatCode = null;

      // Check variety_name for "Standard" prefix → PSC_TYPE_STANDARD
      const nameNorm = (v.variety_name || '').trim();
      if (/^Standard\s+/i.test(nameNorm)) {
        subcatCode = `PSC_${ptCoreName}_STANDARD`;
      }

      // Check variety_code pattern: VAR_TYPE_NAME → PSC_TYPE
      if (!subcatCode && v.variety_code) {
        const varCode = v.variety_code.replace(/^VAR_/, '');
        // Try to find a subcat code that the plant type should have
        // Look for existing subcat with this plant_type_id 
        const existing = existingSubcats.find(sc => sc.plant_type_id === v.plant_type_id);
        if (existing) {
          subcatCode = existing.subcat_code;
        }
      }

      // If we still have no code but the plant type has exactly one subcat, use it
      if (!subcatCode) {
        const ptSubcats = existingSubcats.filter(sc => sc.plant_type_id === v.plant_type_id);
        if (ptSubcats.length === 1) {
          subcatCode = ptSubcats[0].subcat_code;
        } else if (ptSubcats.length > 1) {
          // Pick STANDARD if available, else first
          const std = ptSubcats.find(sc => sc.subcat_code?.includes('STANDARD'));
          subcatCode = (std || ptSubcats[0]).subcat_code;
        }
      }

      if (!subcatCode) continue;

      // If subcat doesn't exist yet, plan to create it
      if (!existingByCode[subcatCode] && !subcatCreations.has(subcatCode)) {
        subcatCreations.set(subcatCode, {
          subcat_code: subcatCode,
          name: subcatNameFromCode(subcatCode),
          plant_type_id: v.plant_type_id,
          is_active: true,
          sort_order: 0,
          synonyms: [],
        });
      }

      assignments.push({ variety_id: v.id, variety_name: v.variety_name, subcat_code: subcatCode, plant_type_id: v.plant_type_id });
    }

    console.log(`Will create ${subcatCreations.size} new subcats, assign ${assignments.length} varieties`);

    // 5. Execute: Create subcats first, then assign
    const createdSubcats = { ...existingByCode }; // will accumulate new ones
    let subcatsCreated = 0, varietiesFixed = 0, errors = 0;
    const createLog = [], assignLog = [];

    if (!isDryRun) {
      for (const [code, data] of subcatCreations.entries()) {
        try {
          const created = await withRetry(() => base44.asServiceRole.entities.PlantSubCategory.create(data));
          createdSubcats[code] = created;
          subcatsCreated++;
          createLog.push({ code, name: data.name, plant_type_id: data.plant_type_id });
          await sleep(200);
        } catch (err) {
          console.warn(`Failed to create subcat ${code}:`, err.message);
          errors++;
        }
      }
    } else {
      subcatsCreated = subcatCreations.size;
      for (const [code, data] of subcatCreations.entries()) {
        createLog.push({ code, name: data.name });
        // In dry run, also put them in createdSubcats so assignment count is correct
        createdSubcats[code] = { id: 'DRY_RUN_' + code, ...data };
      }
    }

    // Now assign varieties
    const BATCH = 5;
    for (let i = 0; i < assignments.length; i += BATCH) {
      const chunk = assignments.slice(i, i + BATCH);
      for (const a of chunk) {
        const sc = createdSubcats[a.subcat_code];
        if (!sc) continue;
        if (isDryRun) {
          varietiesFixed++;
          if (assignLog.length < 30) assignLog.push({ name: a.variety_name, subcat: a.subcat_code });
          continue;
        }
        try {
          await withRetry(() => base44.asServiceRole.entities.Variety.update(a.variety_id, {
            plant_subcategory_id: sc.id,
            plant_subcategory_ids: [sc.id],
          }));
          varietiesFixed++;
          if (assignLog.length < 30) assignLog.push({ name: a.variety_name, subcat: a.subcat_code });
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
      sample_subcats: createLog.slice(0, 20),
      sample_assignments: assignLog.slice(0, 30),
      message: isDryRun
        ? `DRY RUN: Would create ${subcatsCreated} subcats and assign ${varietiesFixed} varieties.`
        : `Created ${subcatsCreated} subcats, assigned ${varietiesFixed} varieties. ${errors} errors.`
    });

  } catch (err) {
    console.error('[createAndAssignFlowerSubcats]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});