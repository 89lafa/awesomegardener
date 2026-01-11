import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[AuditSubcats] Starting audit');

    // Load all active varieties
    const varieties = await base44.asServiceRole.entities.Variety.filter({ status: 'active' });
    const subcats = await base44.asServiceRole.entities.PlantSubCategory.list();

    const subcatMap = {};
    subcats.forEach(s => subcatMap[s.id] = s);

    // Find varieties with issues
    const emptyArrayButHasPrimary = [];
    const inactiveReferences = [];
    const missingReferences = [];
    const arrayMismatch = [];

    for (const v of varieties) {
      let ids = [];
      
      if (Array.isArray(v.plant_subcategory_ids)) {
        ids = v.plant_subcategory_ids;
      } else if (typeof v.plant_subcategory_ids === 'string' && v.plant_subcategory_ids) {
        try {
          ids = JSON.parse(v.plant_subcategory_ids);
        } catch (e) {
          // Not JSON
        }
      }

      // Issue 1: Has primary but array is empty
      if (v.plant_subcategory_id && ids.length === 0) {
        emptyArrayButHasPrimary.push({
          id: v.id,
          name: v.variety_name,
          primary: v.plant_subcategory_id
        });
      }

      // Issue 2: Primary not in array
      if (v.plant_subcategory_id && ids.length > 0 && !ids.includes(v.plant_subcategory_id)) {
        arrayMismatch.push({
          id: v.id,
          name: v.variety_name,
          primary: v.plant_subcategory_id,
          array: ids
        });
      }

      // Check all referenced IDs
      const allIds = [...new Set([...(ids || []), v.plant_subcategory_id].filter(Boolean))];
      
      for (const subcatId of allIds) {
        const subcat = subcatMap[subcatId];
        
        // Issue 3: Reference to non-existent subcategory
        if (!subcat) {
          missingReferences.push({
            variety_id: v.id,
            variety_name: v.variety_name,
            missing_id: subcatId
          });
        }
        // Issue 4: Reference to inactive subcategory
        else if (!subcat.is_active) {
          inactiveReferences.push({
            variety_id: v.id,
            variety_name: v.variety_name,
            subcat_id: subcatId,
            subcat_name: subcat.name
          });
        }
      }
    }

    console.log('[AuditSubcats] Found issues:', {
      emptyArrayButHasPrimary: emptyArrayButHasPrimary.length,
      inactiveReferences: inactiveReferences.length,
      missingReferences: missingReferences.length,
      arrayMismatch: arrayMismatch.length
    });

    return Response.json({
      success: true,
      total_varieties: varieties.length,
      issues: {
        emptyArrayButHasPrimary: {
          count: emptyArrayButHasPrimary.length,
          samples: emptyArrayButHasPrimary.slice(0, 10)
        },
        inactiveReferences: {
          count: inactiveReferences.length,
          samples: inactiveReferences.slice(0, 10)
        },
        missingReferences: {
          count: missingReferences.length,
          samples: missingReferences.slice(0, 10)
        },
        arrayMismatch: {
          count: arrayMismatch.length,
          samples: arrayMismatch.slice(0, 10)
        }
      }
    });
  } catch (error) {
    console.error('[AuditSubcats] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});