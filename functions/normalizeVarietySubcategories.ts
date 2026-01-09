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
    const varieties = await base44.asServiceRole.entities.Variety.list('variety_name', 20000);
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.list();

    const validSubcatIds = new Set(allSubcats.map(s => s.id));

    let scanned = 0;
    let updated = 0;
    let invalidIdsRemoved = 0;

    for (const v of varieties) {
      scanned++;
      let needsUpdate = false;
      let newSubcatId = v.plant_subcategory_id;
      let newSubcatIds = v.plant_subcategory_ids;

      // Determine effective IDs (CANONICAL LOGIC)
      let effectiveIds = [];

      // Step 1: Sanitize plant_subcategory_ids array
      if (newSubcatIds) {
        if (typeof newSubcatIds === 'string') {
          try {
            newSubcatIds = JSON.parse(newSubcatIds);
          } catch {
            newSubcatIds = [];
          }
        }
        
        if (!Array.isArray(newSubcatIds)) {
          newSubcatIds = [];
        }

        // Remove invalid/inactive IDs
        const cleanedIds = newSubcatIds
          .filter(id => id && typeof id === 'string' && id.trim() !== '')
          .filter(id => validSubcatIds.has(id));

        effectiveIds = [...new Set(cleanedIds)];
      } else {
        effectiveIds = [];
      }

      // Step 2: If primary ID is valid and not in array, add it to effectiveIds
      if (newSubcatId && validSubcatIds.has(newSubcatId)) {
        if (!effectiveIds.includes(newSubcatId)) {
          effectiveIds = [newSubcatId, ...effectiveIds];
        }
      } else if (newSubcatId && !validSubcatIds.has(newSubcatId)) {
        // Primary is invalid, clear it
        newSubcatId = null;
        invalidIdsRemoved++;
        needsUpdate = true;
      }

      // Step 3: If no valid primary but effectiveIds has values, set primary
      if (!newSubcatId && effectiveIds.length > 0) {
        newSubcatId = effectiveIds[0];
        needsUpdate = true;
      }

      // Step 4: Write back canonical values
      if (JSON.stringify(effectiveIds) !== JSON.stringify(newSubcatIds)) {
        newSubcatIds = effectiveIds;
        needsUpdate = true;
      }

      if (newSubcatId !== v.plant_subcategory_id) {
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