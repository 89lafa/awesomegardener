import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { batch_size = 100, offset = 0 } = await req.json();

    // Load active subcategories for validation
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.list();
    const activeSubcatIds = new Set(allSubcats.filter(s => s.is_active).map(s => s.id));

    // Get varieties to process
    const allVarieties = await base44.asServiceRole.entities.Variety.filter({ status: 'active' });
    const batch = allVarieties.slice(offset, offset + batch_size);

    let updated = 0;
    let skipped = 0;

    for (const variety of batch) {
      try {
        // Get effective IDs
        let effectiveIds = [];
        if (variety.plant_subcategory_id) effectiveIds.push(variety.plant_subcategory_id);
        if (Array.isArray(variety.plant_subcategory_ids)) {
          effectiveIds = effectiveIds.concat(variety.plant_subcategory_ids);
        }
        effectiveIds = [...new Set(effectiveIds.filter(id => 
          id && typeof id === 'string' && id.trim() !== '' && activeSubcatIds.has(id)
        ))];

        // Build update
        const updateData = {
          plant_subcategory_id: effectiveIds[0] || null,
          plant_subcategory_ids: effectiveIds
        };

        await base44.asServiceRole.entities.Variety.update(variety.id, updateData);
        updated++;
      } catch (error) {
        console.error(`Error updating variety ${variety.id}:`, error);
        skipped++;
      }
    }

    const hasMore = offset + batch_size < allVarieties.length;

    return Response.json({
      success: true,
      summary: {
        batch_size,
        offset,
        updated,
        skipped,
        has_more: hasMore,
        next_offset: offset + batch_size,
        total: allVarieties.length
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});