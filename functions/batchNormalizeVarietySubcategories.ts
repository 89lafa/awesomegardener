import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dry_run = false } = await req.json().catch(() => ({}));

    // Fetch all varieties and subcategories
    const [varieties, subcategories] = await Promise.all([
      base44.asServiceRole.entities.Variety.list(),
      base44.asServiceRole.entities.PlantSubCategory.list()
    ]);

    const subcatMap = {};
    subcategories.forEach(sc => {
      subcatMap[sc.id] = sc;
    });

    let processed = 0;
    let fixed = 0;
    let errors = 0;
    const BATCH_SIZE = 30;
    const DELAY_MS = 1500;

    for (let i = 0; i < varieties.length; i++) {
      const variety = varieties[i];
      
      try {
        let needsUpdate = false;
        const updates = {};

        // Normalize primary subcategory
        if (variety.plant_subcategory_id) {
          const subcat = subcatMap[variety.plant_subcategory_id];
          if (!subcat) {
            updates.plant_subcategory_id = null;
            updates.plant_subcategory_code = null;
            needsUpdate = true;
          } else {
            // Ensure code is synced
            if (variety.plant_subcategory_code !== subcat.subcat_code) {
              updates.plant_subcategory_code = subcat.subcat_code;
              needsUpdate = true;
            }
          }
        }

        // Normalize arrays
        if (variety.plant_subcategory_ids && Array.isArray(variety.plant_subcategory_ids)) {
          const validIds = variety.plant_subcategory_ids.filter(id => subcatMap[id]);
          if (validIds.length !== variety.plant_subcategory_ids.length) {
            updates.plant_subcategory_ids = validIds;
            needsUpdate = true;
          }
        }

        // Sync single → array
        if (variety.plant_subcategory_id && (!variety.plant_subcategory_ids || !variety.plant_subcategory_ids.includes(variety.plant_subcategory_id))) {
          updates.plant_subcategory_ids = variety.plant_subcategory_id ? [variety.plant_subcategory_id] : [];
          needsUpdate = true;
        }

        if (needsUpdate && !dry_run) {
          await base44.asServiceRole.entities.Variety.update(variety.id, updates);
          fixed++;
        } else if (needsUpdate) {
          fixed++;
        }

        processed++;

        // Rate limiting: pause after each batch
        if ((i + 1) % BATCH_SIZE === 0 && i + 1 < varieties.length) {
          console.log(`[Normalize] Batch complete: ${i + 1}/${varieties.length}, pausing ${DELAY_MS}ms`);
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      } catch (error) {
        console.error(`[Normalize] Error on variety ${variety.id}:`, error.message);
        errors++;
      }
    }

    return Response.json({
      success: true,
      dry_run,
      processed,
      fixed,
      errors,
      total: varieties.length
    });
  } catch (error) {
    console.error('[Normalize] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});