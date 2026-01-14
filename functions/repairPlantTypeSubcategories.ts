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
      return Response.json({ error: 'plant_type_id is required' }, { status: 400 });
    }
    
    const results = {
      subcats_activated: 0,
      varieties_normalized: 0,
      junk_cleared: 0,
      missing_code: 0,
      errors: []
    };
    
    console.log('[REPAIR] Starting repair for plant_type_id:', plant_type_id);
    
    // Step 1: Activate all subcategories for this plant type
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({
      plant_type_id: plant_type_id
    });
    
    console.log(`[REPAIR] Found ${allSubcats.length} subcategories`);
    
    for (const subcat of allSubcats) {
      if (!subcat.is_active) {
        await base44.asServiceRole.entities.PlantSubCategory.update(subcat.id, { is_active: true });
        results.subcats_activated++;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Build lookup map: code -> id
    const codeToIdMap = {};
    allSubcats.forEach(s => {
      codeToIdMap[s.subcat_code] = s.id;
    });
    
    // Step 2: Normalize all varieties for this plant type
    const varieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: plant_type_id
    });
    
    console.log(`[REPAIR] Found ${varieties.length} varieties to process`);
    
    for (const variety of varieties) {
      let needsUpdate = false;
      const updateData = {};
      
      let primarySubcatId = variety.plant_subcategory_id;
      let primarySubcatCode = variety.plant_subcategory_code;
      
      // Try to resolve from plant_subcategory_code if primary ID is missing
      if (!primarySubcatId && primarySubcatCode && codeToIdMap[primarySubcatCode]) {
        primarySubcatId = codeToIdMap[primarySubcatCode];
        needsUpdate = true;
      }
      
      // Try to resolve from extended_data.import_subcat_code
      if (!primarySubcatId && variety.extended_data?.import_subcat_code) {
        const code = variety.extended_data.import_subcat_code;
        if (codeToIdMap[code]) {
          primarySubcatId = codeToIdMap[code];
          primarySubcatCode = code;
          needsUpdate = true;
        }
      }
      
      // Sync arrays to match primary
      const expectedIds = primarySubcatId ? [primarySubcatId] : [];
      const expectedCodes = primarySubcatCode ? [primarySubcatCode] : [];
      
      const currentIds = Array.isArray(variety.plant_subcategory_ids) ? variety.plant_subcategory_ids : [];
      const currentCodes = Array.isArray(variety.plant_subcategory_codes) ? variety.plant_subcategory_codes : [];
      
      if (JSON.stringify(currentIds.sort()) !== JSON.stringify(expectedIds.sort())) {
        updateData.plant_subcategory_ids = expectedIds;
        needsUpdate = true;
        if (currentIds.length > 0 && expectedIds.length === 0) results.junk_cleared++;
      }
      
      if (JSON.stringify(currentCodes.sort()) !== JSON.stringify(expectedCodes.sort())) {
        updateData.plant_subcategory_codes = expectedCodes;
        needsUpdate = true;
      }
      
      if (primarySubcatId !== variety.plant_subcategory_id) {
        updateData.plant_subcategory_id = primarySubcatId;
        needsUpdate = true;
      }
      
      if (primarySubcatCode !== variety.plant_subcategory_code) {
        updateData.plant_subcategory_code = primarySubcatCode;
        needsUpdate = true;
      }
      
      if (!primarySubcatId && !primarySubcatCode) {
        results.missing_code++;
      }
      
      if (needsUpdate) {
        try {
          await base44.asServiceRole.entities.Variety.update(variety.id, updateData);
          results.varieties_normalized++;
          console.log(`[REPAIR] Normalized variety: ${variety.variety_name}`);
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
          results.errors.push(`Failed to update ${variety.variety_name}: ${error.message}`);
          console.error(`[REPAIR] Error updating ${variety.variety_name}:`, error);
        }
      }
    }
    
    console.log('[REPAIR] Complete!', results);
    
    return Response.json({
      success: true,
      message: 'Repair complete',
      results
    });
    
  } catch (error) {
    console.error('[REPAIR] Fatal error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});