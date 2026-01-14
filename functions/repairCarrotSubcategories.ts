import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const CARROT_PLANT_TYPE_ID = '69575e5ecdbb16ee56fa750c';
    const CANONICAL_CARROT_SUBCATS = [
      { code: 'PSC_CARROT_STORAGE', name: 'Storage / Winter' },
      { code: 'PSC_CARROT_COLOR', name: 'Color / Specialty' },
      { code: 'PSC_CARROT_KURODA', name: 'Kuroda (Asian-Type)' },
      { code: 'PSC_CARROT_ROUND', name: 'Round / Parisian' },
      { code: 'PSC_CARROT_CHANTENAY', name: 'Chantenay (Short, Broad-Shouldered)' },
      { code: 'PSC_CARROT_DANVERS', name: 'Danvers (Tapered, Versatile)' },
      { code: 'PSC_CARROT_IMPERATOR', name: 'Imperator (Long, Tapered)' },
      { code: 'PSC_CARROT_NANTES', name: 'Nantes (Cylindrical, Sweet)' }
    ];
    
    const results = {
      step1_subcats_cleaned: 0,
      step2_subcats_activated: 0,
      step3_varieties_normalized: 0,
      step4_cleared_junk_arrays: 0,
      errors: []
    };
    
    console.log('[REPAIR] Step 1: Cleaning up malformed carrot subcategories...');
    
    // Step 1: Find and clean malformed canonical subcategories
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({
      plant_type_id: CARROT_PLANT_TYPE_ID
    });
    
    for (const canonical of CANONICAL_CARROT_SUBCATS) {
      const malformedSubcat = allSubcats.find(s =>
        s.plant_type_id === CARROT_PLANT_TYPE_ID &&
        (
          (typeof s.name === 'string' && s.name.includes(canonical.name.split(' ')[0]) && s.name.includes('[')) ||
          (typeof s.subcat_code === 'string' && s.subcat_code.includes(canonical.code) && s.subcat_code.includes('['))
        )
      );

      if (malformedSubcat) {
        if (malformedSubcat.subcat_code !== canonical.code || malformedSubcat.name !== canonical.name || !malformedSubcat.is_active) {
          await base44.asServiceRole.entities.PlantSubCategory.update(malformedSubcat.id, {
            subcat_code: canonical.code,
            name: canonical.name,
            is_active: true
          });
          results.step1_subcats_cleaned++;
          console.log(`[REPAIR] Cleaned and activated malformed subcategory: ${canonical.name}`);
        }
      }
    }
    
    console.log('[REPAIR] Step 2: Ensuring canonical carrot subcategories are active...');
    
    // Step 2: Ensure canonical subcategories exist and are active
    let currentCanonicalSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({
      plant_type_id: CARROT_PLANT_TYPE_ID,
    });
    
    // Build lookup map: code -> id
    const codeToIdMap = {};
    currentCanonicalSubcats.forEach(s => codeToIdMap[s.subcat_code] = s.id);

    for (const canonical of CANONICAL_CARROT_SUBCATS) {
      let subcat = currentCanonicalSubcats.find(s => s.subcat_code === canonical.code);
      if (!subcat) {
        // Create if missing
        subcat = await base44.asServiceRole.entities.PlantSubCategory.create({
          plant_type_id: CARROT_PLANT_TYPE_ID,
          subcat_code: canonical.code,
          name: canonical.name,
          is_active: true
        });
        results.step2_subcats_activated++;
        console.log(`[REPAIR] Created missing canonical subcategory: ${canonical.name}`);
        codeToIdMap[canonical.code] = subcat.id;
      } else if (!subcat.is_active) {
        // Activate if inactive
        await base44.asServiceRole.entities.PlantSubCategory.update(subcat.id, { is_active: true });
        results.step2_subcats_activated++;
        console.log(`[REPAIR] Activated inactive canonical subcategory: ${canonical.name}`);
      }
    }
    
    console.log('[REPAIR] Step 3: Normalizing carrot varieties...');
    
    // Step 3: Normalize all carrot varieties
    const carrotVarieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: CARROT_PLANT_TYPE_ID
    });
    
    console.log(`[REPAIR] Found ${carrotVarieties.length} carrot varieties to process`);
    
    for (const variety of carrotVarieties) {
      let needsUpdate = false;
      const updateData = {};

      let primarySubcatId = variety.plant_subcategory_id;
      let primarySubcatCode = variety.plant_subcategory_code;
      let legacySubcatIds = Array.isArray(variety.plant_subcategory_ids) ? variety.plant_subcategory_ids : [];
      let legacySubcatCodes = Array.isArray(variety.plant_subcategory_codes) ? variety.plant_subcategory_codes : [];

      // Attempt to resolve from existing code in variety if primary ID is missing or malformed
      if (!primarySubcatId || !codeToIdMap[primarySubcatCode]) {
        // Try to resolve from variety's plant_subcategory_code
        if (primarySubcatCode && codeToIdMap[primarySubcatCode]) {
          primarySubcatId = codeToIdMap[primarySubcatCode];
          needsUpdate = true;
        }
        // Try to resolve from legacy codes (e.g., from extended_data.import_subcat_code)
        else if (variety.extended_data?.import_subcat_code && codeToIdMap[variety.extended_data.import_subcat_code]) {
          primarySubcatCode = variety.extended_data.import_subcat_code;
          primarySubcatId = codeToIdMap[primarySubcatCode];
          needsUpdate = true;
        }
      }

      // Clean up junk values in arrays or set based on primary
      // Always ensure the arrays reflect the primary ID and code
      const expectedSubcatIds = primarySubcatId ? [primarySubcatId] : [];
      const expectedSubcatCodes = primarySubcatCode ? [primarySubcatCode] : [];

      if (JSON.stringify(legacySubcatIds.sort()) !== JSON.stringify(expectedSubcatIds.sort())) {
        updateData.plant_subcategory_ids = expectedSubcatIds;
        needsUpdate = true;
        if (legacySubcatIds.length > 0 && expectedSubcatIds.length === 0) results.step4_cleared_junk_arrays++;
      }
      if (JSON.stringify(legacySubcatCodes.sort()) !== JSON.stringify(expectedSubcatCodes.sort())) {
        updateData.plant_subcategory_codes = expectedSubcatCodes;
        needsUpdate = true;
        if (legacySubcatCodes.length > 0 && expectedSubcatCodes.length === 0) results.step4_cleared_junk_arrays++;
      }
      
      // Only update primary if it actually changed or needed fixing
      if (primarySubcatId !== variety.plant_subcategory_id) {
        updateData.plant_subcategory_id = primarySubcatId;
        needsUpdate = true;
      }
      if (primarySubcatCode !== variety.plant_subcategory_code) {
        updateData.plant_subcategory_code = primarySubcatCode;
        needsUpdate = true;
      }

      if (needsUpdate) {
        try {
          await base44.asServiceRole.entities.Variety.update(variety.id, updateData);
          results.step3_varieties_normalized++;
          console.log(`[REPAIR] Normalized variety: ${variety.variety_name} (ID: ${variety.id}) to primary subcat ID: ${primarySubcatId}`);
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