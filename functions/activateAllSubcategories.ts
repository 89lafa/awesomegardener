import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { plant_type_id, dry_run } = body;

    console.log('[ActivateSubcats] Starting for plant_type_id:', plant_type_id, 'dry_run:', dry_run);

    // Load all subcategories for this plant type
    const subcats = plant_type_id 
      ? await base44.asServiceRole.entities.PlantSubCategory.filter({ plant_type_id })
      : await base44.asServiceRole.entities.PlantSubCategory.list();

    const inactive = subcats.filter(s => !s.is_active);

    console.log('[ActivateSubcats] Found', inactive.length, 'inactive subcategories');

    if (dry_run) {
      return Response.json({
        success: true,
        dry_run: true,
        inactive_count: inactive.length,
        inactive_samples: inactive.slice(0, 20).map(s => ({
          id: s.id,
          name: s.name,
          subcat_code: s.subcat_code
        }))
      });
    }

    // Activate all inactive subcategories
    let activated = 0;
    for (const subcat of inactive) {
      await base44.asServiceRole.entities.PlantSubCategory.update(subcat.id, { is_active: true });
      activated++;
    }

    console.log('[ActivateSubcats] Activated', activated, 'subcategories');

    return Response.json({
      success: true,
      activated
    });
  } catch (error) {
    console.error('[ActivateSubcats] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});