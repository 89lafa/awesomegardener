import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Repairs flower variety subcategories using plant_subcategory_code stored in the CSV.
 * The import wiped subcategories because PlantSubCategory records for flowers didn't exist yet.
 * This function reads ALL varieties for flower plant types that have no plant_subcategory_id,
 * then tries to match them using the subcat_code lookup.
 * 
 * Strategy:
 * 1. Load all PlantSubCategory records (all of them)
 * 2. Build a lookup by subcat_code
 * 3. For each flower variety missing plant_subcategory_id, check if any PlantSubCategory matches
 *    via variety_code pattern or variety_name → known subcat_code mapping
 * 
 * POST { dry_run: true/false, plant_type_id?: optional filter }
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, label = '', retries = 5) {
  let backoff = 3000;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (err) {
      if (i < retries) { await sleep(backoff); backoff = Math.min(backoff * 2, 30000); continue; }
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

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const isDryRun = body.dry_run !== false;
    const filterPlantTypeId = body.plant_type_id || null;

    // 1. Load ALL subcategories
    const allSubcats = await withRetry(() => base44.asServiceRole.entities.PlantSubCategory.list('subcat_code', 5000));
    const scByCode = {};
    allSubcats.forEach(sc => {
      if (sc.subcat_code) scByCode[sc.subcat_code] = sc;
    });
    console.log(`Loaded ${allSubcats.length} subcategories, ${Object.keys(scByCode).length} with codes`);

    // 2. Load all flower plant types
    const allPT = await withRetry(() => base44.asServiceRole.entities.PlantType.list('common_name', 500));
    // Flower types = category 'flower', 'bedding_annuals', 'ornamental', etc OR where plant_group matches flowers
    const flowerPTIds = new Set();
    allPT.forEach(pt => {
      const cat = (pt.category || '').toLowerCase();
      if (['flower', 'bedding_annuals', 'ornamental', 'bulb', 'perennial_flower', 'annual_flower'].some(c => cat.includes(c))) {
        flowerPTIds.add(pt.id);
      }
    });
    console.log(`Found ${flowerPTIds.size} flower plant type IDs`);

    // 3. Load varieties that need fixing
    // We'll load ALL varieties missing plant_subcategory_id (up to 9999)
    const filterQuery = filterPlantTypeId
      ? { plant_type_id: filterPlantTypeId, plant_subcategory_id: null }
      : { plant_subcategory_id: null };

    const toFix = await withRetry(() => base44.asServiceRole.entities.Variety.filter(filterQuery, 'variety_name', 9999));
    console.log(`Varieties missing subcategory: ${toFix.length}`);

    // Only process flower types (unless a specific plant_type_id was requested)
    const target = filterPlantTypeId 
      ? toFix 
      : toFix.filter(v => flowerPTIds.has(v.plant_type_id));
    console.log(`Targeting ${target.length} flower varieties`);

    // 4. For each variety, we need to find the right subcat code.
    // The CSV had plant_subcategory_code in the data. The import stripped it from payload.
    // HOWEVER the variety's variety_name typically starts with "Standard [TypeName]"
    // and the subcat_code follows the pattern PSC_[UPPERCASE_TYPE]_STANDARD
    // OR we can build a lookup: variety → plant_type → subcats for that plant_type → pick first
    
    // Build plant_type_id → subcategories map
    const subcatsByPT = {};
    allSubcats.forEach(sc => {
      if (!sc.plant_type_id) return;
      if (!subcatsByPT[sc.plant_type_id]) subcatsByPT[sc.plant_type_id] = [];
      subcatsByPT[sc.plant_type_id].push(sc);
    });

    let fixed = 0, noMatch = 0, skipped = 0;
    const fixLog = [], noMatchLog = [];

    for (const v of target) {
      // Strategy 1: Derive subcat_code from variety_code column if present in DB
      // The original CSV rows had plant_subcategory_code like "PSC_WAX_BEGONIA_STANDARD"
      // We can reconstruct from pattern: plant_type_code → subcat_code
      
      // Strategy 2: Use the plant_type's subcategories - pick "Standard" or first one
      const ptSubcats = subcatsByPT[v.plant_type_id] || [];
      
      let targetSubcat = null;

      // Try to find a "Standard" subcat first
      targetSubcat = ptSubcats.find(sc => 
        sc.subcat_code && sc.subcat_code.includes('STANDARD')
      );
      
      // If only one subcat for this plant type, use it
      if (!targetSubcat && ptSubcats.length === 1) {
        targetSubcat = ptSubcats[0];
      }
      
      // If multiple subcats and no STANDARD, try to match by variety name
      if (!targetSubcat && ptSubcats.length > 1) {
        const lname = v.variety_name.toLowerCase();
        targetSubcat = ptSubcats.find(sc => {
          const scName = (sc.name || '').toLowerCase();
          return lname.includes(scName) || scName.includes(lname.replace('standard ', ''));
        });
        // Fall back to first subcat
        if (!targetSubcat) targetSubcat = ptSubcats[0];
      }

      if (!targetSubcat) {
        noMatch++;
        if (noMatchLog.length < 30) noMatchLog.push({ 
          name: v.variety_name, 
          plant_type_id: v.plant_type_id,
          available_subcats: ptSubcats.map(s => s.subcat_code).join(', ')
        });
        continue;
      }

      if (isDryRun) {
        fixed++;
        fixLog.push({ name: v.variety_name, subcat: targetSubcat.name, code: targetSubcat.subcat_code });
        continue;
      }

      try {
        await withRetry(() => base44.asServiceRole.entities.Variety.update(v.id, {
          plant_subcategory_id: targetSubcat.id,
          plant_subcategory_ids: [targetSubcat.id],
        }), `Update ${v.variety_name}`);
        fixed++;
        if (fixLog.length < 50) fixLog.push({ name: v.variety_name, subcat: targetSubcat.name, code: targetSubcat.subcat_code });
        await sleep(120);
      } catch (err) {
        skipped++;
        console.warn(`Failed ${v.variety_name}:`, err.message);
        await sleep(2000);
      }
    }

    return Response.json({
      success: true,
      dry_run: isDryRun,
      total_checked: target.length,
      fixed,
      no_match: noMatch,
      skipped,
      sample_fixes: fixLog.slice(0, 30),
      no_match_sample: noMatchLog,
      message: isDryRun
        ? `DRY RUN: Would fix ${fixed}/${target.length}. ${noMatch} have no subcat in DB.`
        : `Fixed ${fixed}/${target.length}. ${noMatch} have no subcat in DB. ${skipped} errors.`
    });

  } catch (err) {
    console.error('[repairFlowerSubcats]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});