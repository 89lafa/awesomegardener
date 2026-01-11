import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { plant_type_id, dry_run, batch_size } = body;
    const batchLimit = batch_size || 100;

    console.log('[AssignDefaultSubcats] Starting for plant_type_id:', plant_type_id, 'dry_run:', dry_run);

    // Load varieties without subcategories
    const filter = plant_type_id ? { plant_type_id, status: 'active' } : { status: 'active' };
    const allVarieties = await base44.asServiceRole.entities.Variety.filter(filter, 'variety_name', 2000);

    // Filter to those with empty subcategory data
    const needsDefault = allVarieties.filter(v => {
      const hasIds = Array.isArray(v.plant_subcategory_ids) && v.plant_subcategory_ids.length > 0;
      const hasPrimary = v.plant_subcategory_id && v.plant_subcategory_id.trim() !== '';
      return !hasIds && !hasPrimary;
    }).slice(0, batchLimit);

    console.log('[AssignDefaultSubcats] Found', needsDefault.length, 'varieties needing default subcategory');

    if (dry_run) {
      return Response.json({
        success: true,
        dry_run: true,
        would_assign: needsDefault.length,
        total_checked: allVarieties.length,
        samples: needsDefault.slice(0, 20).map(v => ({
          id: v.id,
          name: v.variety_name,
          plant_type: v.plant_type_name
        }))
      });
    }

    // Load all subcategories to find defaults
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({ is_active: true });
    const subcatsByType = {};
    allSubcats.forEach(sc => {
      if (!subcatsByType[sc.plant_type_id]) {
        subcatsByType[sc.plant_type_id] = [];
      }
      subcatsByType[sc.plant_type_id].push(sc);
    });

    let assigned = 0;
    let skipped = 0;

    for (const variety of needsDefault) {
      try {
        const subcatsForType = subcatsByType[variety.plant_type_id] || [];
        
        if (subcatsForType.length === 0) {
          skipped++;
          console.log('[AssignDefaultSubcats] No subcategories available for:', variety.plant_type_name);
          continue;
        }

        // Pick first active subcategory as default (sorted by sort_order)
        const sorted = [...subcatsForType].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        const defaultSubcat = sorted[0];

        await base44.asServiceRole.entities.Variety.update(variety.id, {
          plant_subcategory_id: defaultSubcat.id,
          plant_subcategory_ids: [defaultSubcat.id]
        });

        assigned++;
        console.log('[AssignDefaultSubcats] Assigned', defaultSubcat.name, 'to', variety.variety_name);
      } catch (error) {
        skipped++;
        console.error('[AssignDefaultSubcats] Error processing:', variety.variety_name, error);
      }
    }

    return Response.json({
      success: true,
      assigned,
      skipped,
      total_checked: allVarieties.length,
      has_more: allVarieties.filter(v => {
        const hasIds = Array.isArray(v.plant_subcategory_ids) && v.plant_subcategory_ids.length > 0;
        const hasPrimary = v.plant_subcategory_id && v.plant_subcategory_id.trim() !== '';
        return !hasIds && !hasPrimary;
      }).length > batchLimit
    });
  } catch (error) {
    console.error('[AssignDefaultSubcats] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});