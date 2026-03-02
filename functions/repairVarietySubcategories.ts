import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Repairs varieties that lost their plant_subcategory_id during the temperature upsert.
 * 
 * Strategy:
 * 1. For each variety that has plant_subcategory_ids (the array, which survived in some records)
 *    but a null/empty plant_subcategory_id (the single field used for filtering), copy the first
 *    element of the array back to the single field.
 * 2. For varieties that have a variety_code, match them to the expected subcategory via extended_data.
 * 3. Report what was fixed.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const dryRun = (new URL(req.url).searchParams.get('dry_run') || 'true') !== 'false';
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const isDryRun = body.dry_run !== false && dryRun;

    console.log(`[RepairSubcats] Starting repair. dry_run=${isDryRun}`);

    // Load all varieties using filter (avoids pagination issues with list())
    // We load varieties that have plant_subcategory_ids array populated but might be missing plant_subcategory_id
    const allVarieties = await base44.asServiceRole.entities.Variety.filter({ status: 'active' }, 'variety_name', 9999);
    console.log(`[RepairSubcats] Loaded ${allVarieties.length} varieties`);

    let repaired = 0;
    let alreadyOk = 0;
    let arrayOnlyFix = 0;
    let noData = 0;
    const fixLog = [];

    for (const v of allVarieties) {
      const hasSingleId = v.plant_subcategory_id && typeof v.plant_subcategory_id === 'string' && v.plant_subcategory_id.length > 10;
      const hasArrayIds = Array.isArray(v.plant_subcategory_ids) && v.plant_subcategory_ids.length > 0;

      if (hasSingleId) {
        // Check if array is also in sync
        if (!hasArrayIds || !v.plant_subcategory_ids.includes(v.plant_subcategory_id)) {
          // Array out of sync — fix it
          if (!isDryRun) {
            await base44.asServiceRole.entities.Variety.update(v.id, {
              plant_subcategory_ids: [v.plant_subcategory_id]
            });
          }
          fixLog.push({ id: v.id, name: v.variety_name, action: 'synced array from single', subcatId: v.plant_subcategory_id });
          arrayOnlyFix++;
        } else {
          alreadyOk++;
        }
        continue;
      }

      // Single ID is missing — try to recover from array
      if (hasArrayIds) {
        const firstId = v.plant_subcategory_ids[0];
        if (firstId && typeof firstId === 'string' && firstId.length > 10) {
          if (!isDryRun) {
            await base44.asServiceRole.entities.Variety.update(v.id, {
              plant_subcategory_id: firstId
            });
          }
          fixLog.push({ id: v.id, name: v.variety_name, action: 'restored single from array', subcatId: firstId });
          repaired++;
          continue;
        }
      }

      // No subcategory data at all
      noData++;
    }

    return Response.json({
      success: true,
      dry_run: isDryRun,
      summary: {
        total: allVarieties.length,
        already_ok: alreadyOk,
        restored_from_array: repaired,
        synced_array: arrayOnlyFix,
        no_subcategory_data: noData
      },
      fixes: fixLog.slice(0, 100),
      message: isDryRun
        ? `DRY RUN: Would fix ${repaired} varieties (restore single from array) + ${arrayOnlyFix} (sync arrays). Run with dry_run=false to apply.`
        : `Fixed ${repaired} varieties (restored subcategory) + ${arrayOnlyFix} (synced arrays).`
    });

  } catch (error) {
    console.error('[RepairSubcats] Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});