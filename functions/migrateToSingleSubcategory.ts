import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[MigrateSingleSubcat] Starting migration...');

    // Get all active varieties
    const varieties = await base44.asServiceRole.entities.Variety.filter({ status: 'active' });
    console.log('[MigrateSingleSubcat] Processing', varieties.length, 'varieties');

    let migrated = 0;
    let alreadySet = 0;
    let skipped = 0;

    for (const v of varieties) {
      // If already has single subcategory, skip
      if (v.plant_subcategory_id) {
        alreadySet++;
        continue;
      }

      // Check if has legacy array
      if (Array.isArray(v.plant_subcategory_ids) && v.plant_subcategory_ids.length > 0) {
        const firstId = v.plant_subcategory_ids[0];
        
        await base44.asServiceRole.entities.Variety.update(v.id, {
          plant_subcategory_id: firstId
        });
        
        console.log(`[MigrateSingleSubcat] ${v.variety_name}: set subcategory_id to ${firstId}`);
        migrated++;
      } else {
        skipped++;
      }
    }

    console.log('[MigrateSingleSubcat] Complete:', { migrated, alreadySet, skipped });

    return Response.json({
      success: true,
      migrated,
      alreadySet,
      skipped,
      total: varieties.length
    });
  } catch (error) {
    console.error('[MigrateSingleSubcat] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message
    }, { status: 500 });
  }
});