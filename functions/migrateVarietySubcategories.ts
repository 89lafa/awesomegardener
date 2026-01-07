import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const varieties = await base44.asServiceRole.entities.Variety.list();
    
    let migrated = 0;
    let alreadyMigrated = 0;
    let errors = [];

    for (const variety of varieties) {
      try {
        // Skip if already migrated
        if (variety.plant_subcategory_ids && variety.plant_subcategory_ids.length > 0) {
          alreadyMigrated++;
          continue;
        }

        // Migrate if primary subcategory exists
        if (variety.plant_subcategory_id) {
          await base44.asServiceRole.entities.Variety.update(variety.id, {
            plant_subcategory_ids: [variety.plant_subcategory_id]
          });
          migrated++;
        }
      } catch (error) {
        errors.push({ 
          variety_id: variety.id, 
          variety_name: variety.variety_name,
          error: error.message 
        });
      }
    }

    return Response.json({
      success: true,
      total: varieties.length,
      migrated,
      alreadyMigrated,
      errors
    });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});