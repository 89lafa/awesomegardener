import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[NormalizeSubcats] Starting normalization...');

    // Load all varieties and subcategories
    const [varieties, allSubcats] = await Promise.all([
      base44.asServiceRole.entities.Variety.list('variety_name', 20000),
      base44.asServiceRole.entities.PlantSubCategory.list()
    ]);

    const validSubcatIds = new Set(allSubcats.map(s => s.id));

    let scanned = 0;
    let updated = 0;
    let invalidIdsRemoved = 0;

    for (const v of varieties) {
      scanned++;
      let needsUpdate = false;
      let newSubcatId = v.plant_subcategory_id;
      let newSubcatIds = v.plant_subcategory_ids;

      // Step 1: Sanitize plant_subcategory_ids array
      if (newSubcatIds) {
        // Handle stringified JSON
        if (typeof newSubcatIds === 'string') {
          try {
            newSubcatIds = JSON.parse(newSubcatIds);
          } catch {
            newSubcatIds = [];
          }
        }
        
        // Ensure it's an array
        if (!Array.isArray(newSubcatIds)) {
          newSubcatIds = [];
        }

        // Remove nulls, empty strings, whitespace, invalid IDs
        const cleanedIds = newSubcatIds
          .filter(id => id && typeof id === 'string' && id.trim() !== '')
          .filter(id => validSubcatIds.has(id));

        // Deduplicate
        const uniqueIds = [...new Set(cleanedIds)];

        if (JSON.stringify(uniqueIds) !== JSON.stringify(newSubcatIds)) {
          newSubcatIds = uniqueIds;
          invalidIdsRemoved += (newSubcatIds?.length || 0) - uniqueIds.length;
          needsUpdate = true;
        }
      } else {
        newSubcatIds = [];
      }

      // Step 2: If plant_subcategory_id is empty but ids array has values, set primary
      if ((!newSubcatId || !validSubcatIds.has(newSubcatId)) && newSubcatIds.length > 0) {
        newSubcatId = newSubcatIds[0];
        needsUpdate = true;
      }

      // Step 3: If plant_subcategory_id is set but not in ids array, add it
      if (newSubcatId && validSubcatIds.has(newSubcatId) && !newSubcatIds.includes(newSubcatId)) {
        newSubcatIds = [newSubcatId, ...newSubcatIds];
        needsUpdate = true;
      }

      // Step 4: Validate primary ID exists
      if (newSubcatId && !validSubcatIds.has(newSubcatId)) {
        newSubcatId = newSubcatIds.length > 0 ? newSubcatIds[0] : null;
        invalidIdsRemoved++;
        needsUpdate = true;
      }

      // Update if needed
      if (needsUpdate) {
        await base44.asServiceRole.entities.Variety.update(v.id, {
          plant_subcategory_id: newSubcatId,
          plant_subcategory_ids: newSubcatIds
        });
        updated++;

        if (updated % 100 === 0) {
          console.log('[NormalizeSubcats] Progress:', updated, '/', scanned);
        }
      }
    }

    console.log('[NormalizeSubcats] Complete:', { scanned, updated, invalidIdsRemoved });

    return Response.json({
      success: true,
      summary: {
        varieties_scanned: scanned,
        varieties_updated: updated,
        invalid_ids_removed: invalidIdsRemoved
      }
    });
  } catch (error) {
    console.error('[NormalizeSubcats] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});