import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const CARROT_PLANT_TYPE_ID = '69575e5ecdbb16ee56fa750c';
    const CANONICAL_CARROT_CODES = [
      'PSC_CARROT_STORAGE',
      'PSC_CARROT_COLOR',
      'PSC_CARROT_KURODA',
      'PSC_CARROT_ROUND',
      'PSC_CARROT_CHANTENAY',
      'PSC_CARROT_DANVERS',
      'PSC_CARROT_IMPERATOR',
      'PSC_CARROT_NANTES'
    ];
    
    const results = {
      step1_activated: 0,
      step2_normalized: 0,
      step3_cleared_junk: 0,
      errors: []
    };
    
    console.log('[REPAIR] Step 1: Activating canonical carrot subcategories...');
    
    // Step 1: Activate canonical carrot subcategories
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({
      plant_type_id: CARROT_PLANT_TYPE_ID
    });
    
    for (const subcat of allSubcats) {
      if (CANONICAL_CARROT_CODES.includes(subcat.subcat_code)) {
        if (!subcat.is_active) {
          await base44.asServiceRole.entities.PlantSubCategory.update(subcat.id, {
            is_active: true
          });
          results.step1_activated++;
          console.log(`[REPAIR] Activated: ${subcat.name} (${subcat.subcat_code})`);
        }
      }
    }
    
    // Build lookup map: code -> id
    const codeToIdMap = {};
    for (const subcat of allSubcats) {
      if (CANONICAL_CARROT_CODES.includes(subcat.subcat_code)) {
        codeToIdMap[subcat.subcat_code] = subcat.id;
      }
    }
    
    console.log('[REPAIR] Step 2: Normalizing carrot varieties...');
    
    // Step 2: Normalize all carrot varieties
    const carrotVarieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: CARROT_PLANT_TYPE_ID
    });
    
    console.log(`[REPAIR] Found ${carrotVarieties.length} carrot varieties to process`);
    
    for (const variety of carrotVarieties) {
      let needsUpdate = false;
      const updateData = {};
      
      // Case 1: plant_subcategory_id is null BUT plant_subcategory_code exists
      if (!variety.plant_subcategory_id && variety.plant_subcategory_code) {
        const resolvedId = codeToIdMap[variety.plant_subcategory_code];
        if (resolvedId) {
          updateData.plant_subcategory_id = resolvedId;
          updateData.plant_subcategory_ids = [resolvedId];
          updateData.plant_subcategory_codes = [variety.plant_subcategory_code];
          needsUpdate = true;
          console.log(`[REPAIR] Normalizing ${variety.variety_name}: code=${variety.plant_subcategory_code} -> id=${resolvedId}`);
        }
      }
      
      // Case 2: Check for junk values in arrays
      const hasJunkIds = Array.isArray(variety.plant_subcategory_ids) && 
                         variety.plant_subcategory_ids.some(v => 
                           typeof v === 'string' && (
                             v.includes('[') || 
                             v.includes('"psc') || 
                             v.includes('PSC_') ||
                             v === '[]' ||
                             v.trim() === ''
                           )
                         );
      
      const hasJunkCodes = Array.isArray(variety.plant_subcategory_codes) && 
                           variety.plant_subcategory_codes.some(v => 
                             typeof v === 'string' && (
                               v.includes('[') || 
                               v.includes('"') ||
                               v === '[]' ||
                               v.trim() === ''
                             )
                           );
      
      // Case 3: plant_subcategory_id is null AND arrays have junk
      if (!variety.plant_subcategory_id && (hasJunkIds || hasJunkCodes)) {
        updateData.plant_subcategory_ids = [];
        updateData.plant_subcategory_codes = [];
        updateData.plant_subcategory_code = null;
        needsUpdate = true;
        results.step3_cleared_junk++;
        console.log(`[REPAIR] Clearing junk from ${variety.variety_name}`);
      }
      
      // Case 4: Ensure arrays are synced if primary ID exists
      if (variety.plant_subcategory_id && !needsUpdate) {
        const correctIds = [variety.plant_subcategory_id];
        const currentCode = variety.plant_subcategory_code;
        const correctCodes = currentCode ? [currentCode] : [];
        
        const idsMatch = JSON.stringify(variety.plant_subcategory_ids || []) === JSON.stringify(correctIds);
        const codesMatch = JSON.stringify(variety.plant_subcategory_codes || []) === JSON.stringify(correctCodes);
        
        if (!idsMatch || !codesMatch) {
          updateData.plant_subcategory_ids = correctIds;
          updateData.plant_subcategory_codes = correctCodes;
          needsUpdate = true;
          console.log(`[REPAIR] Syncing arrays for ${variety.variety_name}`);
        }
      }
      
      if (needsUpdate) {
        try {
          await base44.asServiceRole.entities.Variety.update(variety.id, updateData);
          results.step2_normalized++;
        } catch (error) {
          results.errors.push(`Failed to update ${variety.variety_name}: ${error.message}`);
          console.error(`[REPAIR] Error updating ${variety.variety_name}:`, error);
        }
      }
    }
    
    console.log('[REPAIR] Complete!', results);
    
    return Response.json({
      success: true,
      message: 'Carrot subcategory repair complete',
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