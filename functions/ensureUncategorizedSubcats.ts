import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { auto_assign } = await req.json();

    console.log('[EnsureUncategorized] Starting...');

    // Get all plant types
    const plantTypes = await base44.asServiceRole.entities.PlantType.list();
    console.log('[EnsureUncategorized] Processing', plantTypes.length, 'plant types');

    let created = 0;
    let alreadyExists = 0;
    let assigned = 0;

    for (const pt of plantTypes) {
      // Check if Uncategorized exists
      const existing = await base44.asServiceRole.entities.PlantSubCategory.filter({
        plant_type_id: pt.id,
        subcat_code: `PSC_${pt.plant_type_code || pt.common_name.toUpperCase().replace(/\s+/g, '_')}_UNCATEGORIZED`
      });

      let uncategorizedId;
      if (existing.length === 0) {
        // Create it
        const newSubcat = await base44.asServiceRole.entities.PlantSubCategory.create({
          plant_type_id: pt.id,
          subcat_code: `PSC_${pt.plant_type_code || pt.common_name.toUpperCase().replace(/\s+/g, '_')}_UNCATEGORIZED`,
          name: 'Uncategorized',
          dimension: 'Other',
          sort_order: 999,
          is_active: true
        });
        uncategorizedId = newSubcat.id;
        created++;
        console.log(`[EnsureUncategorized] Created for ${pt.common_name}`);
      } else {
        uncategorizedId = existing[0].id;
        alreadyExists++;
        
        // Make sure it's active
        if (!existing[0].is_active) {
          await base44.asServiceRole.entities.PlantSubCategory.update(existing[0].id, { is_active: true });
        }
      }

      // If auto_assign, set uncategorized varieties to this
      if (auto_assign) {
        const uncategorizedVarieties = await base44.asServiceRole.entities.Variety.filter({
          plant_type_id: pt.id,
          status: 'active',
          plant_subcategory_id: null
        });

        for (const v of uncategorizedVarieties) {
          await base44.asServiceRole.entities.Variety.update(v.id, {
            plant_subcategory_id: uncategorizedId,
            plant_subcategory_ids: [uncategorizedId]
          });
          assigned++;
        }
      }
    }

    console.log('[EnsureUncategorized] Complete:', { created, alreadyExists, assigned });

    return Response.json({
      success: true,
      created,
      alreadyExists,
      assigned,
      total_plant_types: plantTypes.length
    });
  } catch (error) {
    console.error('[EnsureUncategorized] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message
    }, { status: 500 });
  }
});