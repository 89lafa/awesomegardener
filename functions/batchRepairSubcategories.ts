import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { plant_type_id, batch_size = 50, offset = 0 } = await req.json();

    if (!plant_type_id) {
      return Response.json({ error: 'plant_type_id required' }, { status: 400 });
    }

    // Step 1: Activate all subcategories for this type
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({ 
      plant_type_id 
    });

    let subcatsActivated = 0;
    for (const subcat of allSubcats) {
      if (!subcat.is_active) {
        await base44.asServiceRole.entities.PlantSubCategory.update(subcat.id, { is_active: true });
        subcatsActivated++;
      }
    }

    // Build lookup for resolution
    const subcatLookup = {};
    allSubcats.forEach(sc => {
      if (sc.subcat_code) subcatLookup[sc.subcat_code] = sc;
    });

    // Step 2: Process varieties in batch
    const varieties = await base44.asServiceRole.entities.Variety.filter({ 
      plant_type_id,
      status: 'active'
    });

    const batch = varieties.slice(offset, offset + batch_size);
    let repaired = 0;
    let skipped = 0;
    let missingCode = 0;
    let unresolvable = 0;
    let junkCleaned = 0;
    const errors = [];

    for (const variety of batch) {
      try {
        const primaryCode = variety.plant_subcategory_code || 
                           variety.extended_data?.import_subcat_code || 
                           null;

        let resolvedId = null;
        let resolvedCode = null;

        if (primaryCode && primaryCode.trim()) {
          let normalized = primaryCode.trim();
          if (!normalized.startsWith('PSC_')) normalized = 'PSC_' + normalized;

          const subcat = subcatLookup[normalized];
          if (subcat) {
            resolvedId = subcat.id;
            resolvedCode = subcat.subcat_code;
          } else {
            unresolvable++;
          }
        } else {
          missingCode++;
        }

        // Check for junk arrays
        const hasJunk = (
          typeof variety.plant_subcategory_ids === 'string' ||
          (Array.isArray(variety.plant_subcategory_ids) && 
           variety.plant_subcategory_ids.some(id => typeof id !== 'string' || id.startsWith('[')))
        );

        if (hasJunk) junkCleaned++;

        const updateData = {
          plant_subcategory_id: resolvedId,
          plant_subcategory_ids: resolvedId ? [resolvedId] : [],
          plant_subcategory_code: resolvedCode,
          plant_subcategory_codes: resolvedCode ? [resolvedCode] : []
        };

        await base44.asServiceRole.entities.Variety.update(variety.id, updateData);
        repaired++;
      } catch (error) {
        errors.push(`${variety.variety_name}: ${error.message}`);
        skipped++;
      }
    }

    const hasMore = offset + batch_size < varieties.length;

    return Response.json({
      success: true,
      stats: {
        subcategories_activated: subcatsActivated,
        varieties_repaired: repaired,
        varieties_skipped: skipped,
        missing_subcategory_code: missingCode,
        unresolvable_subcategory_code: unresolvable,
        junk_arrays_cleaned: junkCleaned,
        errors,
        has_more: hasMore,
        next_offset: offset + batch_size,
        total_varieties: varieties.length
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});