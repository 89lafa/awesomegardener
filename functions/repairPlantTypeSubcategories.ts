import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const { plant_type_id } = await req.json();
    
    if (!plant_type_id) {
      return Response.json({ 
        success: false, 
        error: 'plant_type_id is required' 
      }, { status: 400 });
    }
    
    const stats = {
      subcategories_activated: 0,
      varieties_repaired: 0,
      varieties_skipped: 0,
      missing_subcategory_code: 0,
      unresolvable_subcategory_code: 0,
      junk_arrays_cleaned: 0,
      errors: []
    };
    
    console.log(`[REPAIR] Starting repair for plant_type_id: ${plant_type_id}`);
    
    // Step 1: Activate all subcategories for this plant type
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({
      plant_type_id: plant_type_id
    });
    
    console.log(`[REPAIR] Found ${allSubcats.length} subcategories`);
    
    for (const subcat of allSubcats) {
      if (!subcat.is_active) {
        await base44.asServiceRole.entities.PlantSubCategory.update(subcat.id, { is_active: true });
        stats.subcategories_activated++;
        console.log(`[REPAIR] Activated: ${subcat.name}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Build lookup map: code -> id
    const codeToIdMap = {};
    allSubcats.forEach(s => {
      codeToIdMap[s.subcat_code] = s.id;
    });
    
    // Step 2: Repair all varieties for this plant type
    const varieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: plant_type_id
    });
    
    console.log(`[REPAIR] Found ${varieties.length} varieties to process`);
    
    for (const variety of varieties) {
      let needsUpdate = false;
      const updateData = {};
      
      const currentPrimaryId = variety.plant_subcategory_id;
      const currentPrimaryCode = variety.plant_subcategory_code;
      const currentIds = Array.isArray(variety.plant_subcategory_ids) ? variety.plant_subcategory_ids : [];
      const currentCodes = Array.isArray(variety.plant_subcategory_codes) ? variety.plant_subcategory_codes : [];
      
      // Detect junk stringified arrays
      const hasJunkIds = typeof variety.plant_subcategory_ids === 'string' && variety.plant_subcategory_ids.includes('[');
      const hasJunkCodes = typeof variety.plant_subcategory_codes === 'string' && variety.plant_subcategory_codes.includes('[');
      
      if (hasJunkIds || hasJunkCodes) {
        stats.junk_arrays_cleaned++;
      }
      
      // Resolve primary subcategory
      let resolvedId = null;
      let resolvedCode = null;
      
      if (currentPrimaryCode && currentPrimaryCode.trim()) {
        // Try to resolve from code
        resolvedId = codeToIdMap[currentPrimaryCode];
        resolvedCode = currentPrimaryCode;
        
        if (!resolvedId) {
          stats.unresolvable_subcategory_code++;
          console.log(`[REPAIR] Unresolvable code: ${currentPrimaryCode} for ${variety.variety_name}`);
        }
      } else if (variety.extended_data?.import_subcat_code) {
        // Fallback to import code
        const importCode = variety.extended_data.import_subcat_code;
        resolvedId = codeToIdMap[importCode];
        resolvedCode = importCode;
        
        if (!resolvedId) {
          stats.unresolvable_subcategory_code++;
        }
      } else {
        stats.missing_subcategory_code++;
      }
      
      // Determine expected arrays
      const expectedIds = resolvedId ? [resolvedId] : [];
      const expectedCodes = resolvedCode ? [resolvedCode] : [];
      
      // Check if update needed
      if (currentPrimaryId !== resolvedId) {
        updateData.plant_subcategory_id = resolvedId;
        needsUpdate = true;
      }
      if (currentPrimaryCode !== resolvedCode) {
        updateData.plant_subcategory_code = resolvedCode;
        needsUpdate = true;
      }
      if (JSON.stringify(currentIds.sort()) !== JSON.stringify(expectedIds.sort()) || hasJunkIds) {
        updateData.plant_subcategory_ids = expectedIds;
        needsUpdate = true;
      }
      if (JSON.stringify(currentCodes.sort()) !== JSON.stringify(expectedCodes.sort()) || hasJunkCodes) {
        updateData.plant_subcategory_codes = expectedCodes;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        try {
          await base44.asServiceRole.entities.Variety.update(variety.id, updateData);
          stats.varieties_repaired++;
          console.log(`[REPAIR] Repaired: ${variety.variety_name} -> ${resolvedCode || 'null'}`);
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
          stats.errors.push(`${variety.variety_name}: ${error.message}`);
          console.error(`[REPAIR] Error:`, error);
        }
      } else {
        stats.varieties_skipped++;
      }
    }
    
    console.log('[REPAIR] Complete!', stats);
    
    return Response.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('[REPAIR] Fatal error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});