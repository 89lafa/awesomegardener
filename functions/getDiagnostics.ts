import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[Diagnostics] Loading all data...');

    // Load all data
    const [varieties, subcats, plantTypes] = await Promise.all([
      base44.asServiceRole.entities.Variety.list('variety_name', 20000),
      base44.asServiceRole.entities.PlantSubCategory.list(),
      base44.asServiceRole.entities.PlantType.list()
    ]);

    const validSubcatIds = new Set(subcats.map(s => s.id));
    const activeSubcatIds = new Set(subcats.filter(s => s.is_active).map(s => s.id));

    // Helper: normalize variety name for duplicate detection
    const normalize = (name) => {
      if (!name) return '';
      return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/['']/g, "'").replace(/[""]/g, '"').replace(/\.$/, '');
    };

    // 1. Total varieties (active only)
    const activeVarieties = varieties.filter(v => v.status === 'active');
    const totalVarieties = activeVarieties.length;

    // 2. Find duplicate groups by variety_code
    const byCode = {};
    const byNameType = {};

    for (const v of activeVarieties) {
      // By variety_code
      if (v.variety_code) {
        if (!byCode[v.variety_code]) byCode[v.variety_code] = [];
        byCode[v.variety_code].push(v);
      }

      // By normalized name + plant_type_id
      const key = `${v.plant_type_id}_${normalize(v.variety_name)}`;
      if (!byNameType[key]) byNameType[key] = [];
      byNameType[key].push(v);
    }

    const duplicatesByCode = Object.values(byCode).filter(g => g.length > 1);
    const duplicatesByName = Object.values(byNameType).filter(g => g.length > 1);

    // 3. Varieties with invalid/inactive subcategory IDs
    let invalidSubcatCount = 0;
    let inactiveSubcatCount = 0;
    const invalidExamples = [];

    for (const v of activeVarieties) {
      let effectiveIds = [];
      if (v.plant_subcategory_id) effectiveIds.push(v.plant_subcategory_id);
      if (Array.isArray(v.plant_subcategory_ids)) {
        effectiveIds = effectiveIds.concat(v.plant_subcategory_ids);
      }
      effectiveIds = [...new Set(effectiveIds.filter(id => id && typeof id === 'string'))];

      const hasInvalid = effectiveIds.some(id => !validSubcatIds.has(id));
      const hasInactive = effectiveIds.some(id => validSubcatIds.has(id) && !activeSubcatIds.has(id));

      if (hasInvalid) {
        invalidSubcatCount++;
        if (invalidExamples.length < 10) {
          invalidExamples.push({ id: v.id, name: v.variety_name, ids: effectiveIds });
        }
      } else if (hasInactive) {
        inactiveSubcatCount++;
      }
    }

    // 4. True uncategorized (no valid subcategories at all)
    const uncategorized = activeVarieties.filter(v => {
      let effectiveIds = [];
      if (v.plant_subcategory_id && validSubcatIds.has(v.plant_subcategory_id)) {
        effectiveIds.push(v.plant_subcategory_id);
      }
      if (Array.isArray(v.plant_subcategory_ids)) {
        effectiveIds = effectiveIds.concat(v.plant_subcategory_ids.filter(id => validSubcatIds.has(id)));
      }
      return effectiveIds.length === 0;
    });

    return Response.json({
      success: true,
      diagnostics: {
        total_varieties: totalVarieties,
        duplicate_groups_by_code: duplicatesByCode.length,
        duplicate_groups_by_name: duplicatesByName.length,
        total_duplicate_records_by_code: duplicatesByCode.reduce((sum, g) => sum + g.length - 1, 0),
        total_duplicate_records_by_name: duplicatesByName.reduce((sum, g) => sum + g.length - 1, 0),
        varieties_with_invalid_subcats: invalidSubcatCount,
        varieties_with_inactive_subcats: inactiveSubcatCount,
        true_uncategorized: uncategorized.length,
        sample_duplicates_by_code: duplicatesByCode.slice(0, 5).map(g => ({
          code: g[0].variety_code,
          count: g.length,
          names: g.map(v => v.variety_name).join(', ')
        })),
        sample_duplicates_by_name: duplicatesByName.slice(0, 5).map(g => ({
          name: g[0].variety_name,
          type: g[0].plant_type_name,
          count: g.length,
          ids: g.map(v => v.id)
        })),
        sample_invalid: invalidExamples,
        sample_uncategorized: uncategorized.slice(0, 10).map(v => ({
          id: v.id,
          name: v.variety_name,
          type: v.plant_type_name
        }))
      }
    });
  } catch (error) {
    console.error('[Diagnostics] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});