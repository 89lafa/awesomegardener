import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { plant_type_id, dry_run = false } = await req.json().catch(() => ({}));

    if (!plant_type_id) {
      return Response.json({ error: 'plant_type_id required' }, { status: 400 });
    }

    // Fetch varieties for this plant type
    const varieties = await base44.asServiceRole.entities.Variety.filter({ plant_type_id });
    const subcategories = await base44.asServiceRole.entities.PlantSubCategory.filter({ plant_type_id });

    // Find uncategorized subcategory for this type
    const uncategorized = subcategories.find(sc => 
      sc.subcat_code?.includes('UNCATEGORIZED') || sc.name?.toLowerCase().includes('uncategorized')
    );

    if (!uncategorized) {
      return Response.json({ 
        error: 'No uncategorized subcategory found for this plant type',
        suggestion: 'Create one first via Admin Data Maintenance'
      }, { status: 400 });
    }

    let repaired = 0;
    let errors = 0;
    const BATCH_SIZE = 25;
    const DELAY_MS = 1500;

    for (let i = 0; i < varieties.length; i++) {
      const variety = varieties[i];

      try {
        // Check if variety has no subcategory assigned
        if (!variety.plant_subcategory_id) {
          if (!dry_run) {
            await base44.asServiceRole.entities.Variety.update(variety.id, {
              plant_subcategory_id: uncategorized.id,
              plant_subcategory_ids: [uncategorized.id],
              plant_subcategory_code: uncategorized.subcat_code,
              plant_subcategory_codes: [uncategorized.subcat_code]
            });
          }
          repaired++;
        }

        // Rate limiting: pause after each batch
        if ((i + 1) % BATCH_SIZE === 0 && i + 1 < varieties.length) {
          console.log(`[Repair] Batch complete: ${i + 1}/${varieties.length}, pausing ${DELAY_MS}ms`);
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      } catch (error) {
        console.error(`[Repair] Error on variety ${variety.id}:`, error.message);
        errors++;
      }
    }

    return Response.json({
      success: true,
      dry_run,
      total: varieties.length,
      repaired,
      errors,
      uncategorized_subcat: uncategorized.name
    });
  } catch (error) {
    console.error('[Repair] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});