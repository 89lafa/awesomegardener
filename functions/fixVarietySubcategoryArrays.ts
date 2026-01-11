import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dry_run, batch_size } = await req.json();
    const batchSize = batch_size || 50;

    console.log('[FixSubcatArrays] Starting, dry_run:', dry_run);

    // Load all active varieties
    const varieties = await base44.asServiceRole.entities.Variety.filter({ status: 'active' });
    console.log('[FixSubcatArrays] Loaded', varieties.length, 'varieties');

    let fixed = 0;
    let skipped = 0;
    const fixes = [];

    for (const v of varieties.slice(0, batchSize)) {
      let ids = [];
      
      if (Array.isArray(v.plant_subcategory_ids)) {
        ids = v.plant_subcategory_ids;
      } else if (typeof v.plant_subcategory_ids === 'string' && v.plant_subcategory_ids) {
        try {
          ids = JSON.parse(v.plant_subcategory_ids);
        } catch (e) {
          ids = [];
        }
      }

      let needsUpdate = false;
      let newPrimary = v.plant_subcategory_id;
      let newArray = [...ids];

      // Fix 1: Has primary but not in array
      if (v.plant_subcategory_id && !ids.includes(v.plant_subcategory_id)) {
        newArray = [v.plant_subcategory_id, ...newArray];
        needsUpdate = true;
        fixes.push({ variety: v.variety_name, fix: 'Added primary to array' });
      }

      // Fix 2: Has array but no primary
      if ((!v.plant_subcategory_id || v.plant_subcategory_id === '') && newArray.length > 0) {
        newPrimary = newArray[0];
        needsUpdate = true;
        fixes.push({ variety: v.variety_name, fix: 'Set primary from array' });
      }

      if (needsUpdate) {
        if (!dry_run) {
          await base44.asServiceRole.entities.Variety.update(v.id, {
            plant_subcategory_id: newPrimary,
            plant_subcategory_ids: newArray
          });
        }
        fixed++;
      } else {
        skipped++;
      }
    }

    console.log('[FixSubcatArrays] Complete:', { fixed, skipped });

    return Response.json({
      success: true,
      dry_run,
      batch_size: batchSize,
      total_varieties: varieties.length,
      processed: Math.min(batchSize, varieties.length),
      fixed,
      skipped,
      fixes: fixes.slice(0, 20),
      has_more: varieties.length > batchSize
    });
  } catch (error) {
    console.error('[FixSubcatArrays] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});