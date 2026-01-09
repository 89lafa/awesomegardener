import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[Pepper Cleanup] Starting cleanup process...');
    
    // Step 1: Find Pepper PlantType
    const pepperTypes = await base44.asServiceRole.entities.PlantType.filter({ 
      common_name: 'Pepper' 
    });
    
    if (pepperTypes.length === 0) {
      return Response.json({ error: 'Pepper plant type not found' }, { status: 404 });
    }
    
    const pepperTypeId = pepperTypes[0].id;
    console.log('[Pepper Cleanup] Found Pepper plant type:', pepperTypeId);
    
    // Step 2: Define canonical heat subcategories
    const canonicalHeatSubcats = [
      { subcat_code: 'PSC_PEPPER_HEAT_SWEET', name: 'Sweet (0 SHU)', min: 0, max: 0, sort_order: 1 },
      { subcat_code: 'PSC_PEPPER_HEAT_MILD', name: 'Mild (1–2,500 SHU)', min: 1, max: 2500, sort_order: 2 },
      { subcat_code: 'PSC_PEPPER_HEAT_MEDIUM', name: 'Medium (2,501–30,000 SHU)', min: 2501, max: 30000, sort_order: 3 },
      { subcat_code: 'PSC_PEPPER_HEAT_HOT', name: 'Hot (30,001–100,000 SHU)', min: 30001, max: 100000, sort_order: 4 },
      { subcat_code: 'PSC_PEPPER_HEAT_EXTRA_HOT', name: 'Extra Hot (100,001–300,000 SHU)', min: 100001, max: 300000, sort_order: 5 },
      { subcat_code: 'PSC_PEPPER_HEAT_SUPERHOT', name: 'Superhot (300,001+ SHU)', min: 300001, max: 999999999, sort_order: 6 },
      { subcat_code: 'PSC_PEPPER_HEAT_UNKNOWN', name: 'Unknown / Varies', min: null, max: null, sort_order: 7 }
    ];
    
    // Step 3: Create or update canonical subcategories
    const heatSubcatMap = {};
    for (const heatDef of canonicalHeatSubcats) {
      const existing = await base44.asServiceRole.entities.PlantSubCategory.filter({
        plant_type_id: pepperTypeId,
        subcat_code: heatDef.subcat_code
      });
      
      if (existing.length > 0) {
        // Update to ensure it's active
        await base44.asServiceRole.entities.PlantSubCategory.update(existing[0].id, {
          name: heatDef.name,
          is_active: true,
          sort_order: heatDef.sort_order,
          dimension: 'HeatLevel'
        });
        heatSubcatMap[heatDef.subcat_code] = existing[0].id;
        console.log('[Pepper Cleanup] Updated heat subcat:', heatDef.name);
      } else {
        // Create new
        const newSubcat = await base44.asServiceRole.entities.PlantSubCategory.create({
          plant_type_id: pepperTypeId,
          subcat_code: heatDef.subcat_code,
          name: heatDef.name,
          dimension: 'HeatLevel',
          icon: '🌶️',
          is_active: true,
          sort_order: heatDef.sort_order
        });
        heatSubcatMap[heatDef.subcat_code] = newSubcat.id;
        console.log('[Pepper Cleanup] Created heat subcat:', heatDef.name);
      }
    }
    
    // Step 4: Deactivate all other Pepper subcategories
    const allPepperSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({
      plant_type_id: pepperTypeId
    });
    
    const canonicalIds = Object.values(heatSubcatMap);
    let deactivatedCount = 0;
    
    for (const subcat of allPepperSubcats) {
      if (!canonicalIds.includes(subcat.id) && subcat.is_active !== false) {
        await base44.asServiceRole.entities.PlantSubCategory.update(subcat.id, {
          is_active: false
        });
        deactivatedCount++;
        console.log('[Pepper Cleanup] Deactivated old subcat:', subcat.name);
      }
    }
    
    console.log('[Pepper Cleanup] Deactivated', deactivatedCount, 'old subcategories');
    
    // Step 5: Helper to determine heat level from scoville
    const getHeatLevelSubcatId = (scovilleMin, scovilleMax) => {
      const maxSHU = scovilleMax || scovilleMin || 0;
      
      if (maxSHU === 0) return heatSubcatMap.PSC_PEPPER_HEAT_SWEET;
      if (maxSHU <= 2500) return heatSubcatMap.PSC_PEPPER_HEAT_MILD;
      if (maxSHU <= 30000) return heatSubcatMap.PSC_PEPPER_HEAT_MEDIUM;
      if (maxSHU <= 100000) return heatSubcatMap.PSC_PEPPER_HEAT_HOT;
      if (maxSHU <= 300000) return heatSubcatMap.PSC_PEPPER_HEAT_EXTRA_HOT;
      if (maxSHU > 300000) return heatSubcatMap.PSC_PEPPER_HEAT_SUPERHOT;
      
      return heatSubcatMap.PSC_PEPPER_HEAT_UNKNOWN;
    };
    
    // Step 6: Helper to derive traits from old subcategory name
    const deriveTraitsFromOldSubcat = (oldSubcatName, currentTraits = {}) => {
      const traits = { ...currentTraits };
      const lower = (oldSubcatName || '').toLowerCase();
      
      // Species mapping
      if (lower.includes('chinense')) traits.species = 'chinense';
      else if (lower.includes('frutescens')) traits.species = 'frutescens';
      else if (lower.includes('baccatum')) traits.species = 'baccatum';
      else if (lower.includes('pubescens') || lower.includes('rocoto')) traits.species = 'pubescens';
      else if (lower.includes('annuum')) traits.species = 'annuum';
      
      // Pepper type mapping
      if (lower.includes('bell')) traits.pepper_type = 'bell';
      else if (lower.includes('frying')) traits.pepper_type = 'frying';
      else if (lower.includes('jalapeño') || lower.includes('jalapeno')) traits.pepper_type = 'jalapeño';
      else if (lower.includes('serrano')) traits.pepper_type = 'serrano';
      else if (lower.includes('cayenne')) traits.pepper_type = 'cayenne';
      else if (lower.includes('thai')) traits.pepper_type = 'thai';
      else if (lower.includes('poblano') || lower.includes('ancho')) traits.pepper_type = 'poblano';
      else if (lower.includes('anaheim')) traits.pepper_type = 'anaheim';
      else if (lower.includes('wax')) traits.pepper_type = 'wax';
      else if (lower.includes('aji')) traits.pepper_type = 'aji';
      else if (lower.includes('tabasco')) traits.pepper_type = 'tabasco';
      else if (lower.includes('habanero')) traits.pepper_type = 'habanero';
      
      // Culinary use
      if (!traits.culinary_use) traits.culinary_use = [];
      if (lower.includes('roast') || lower.includes('stuff')) {
        if (!traits.culinary_use.includes('roasting_stuffing')) {
          traits.culinary_use.push('roasting_stuffing');
        }
      }
      if (lower.includes('paprika') || lower.includes('drying')) {
        if (!traits.culinary_use.includes('paprika_drying')) {
          traits.culinary_use.push('paprika_drying');
        }
      }
      if (lower.includes('sauce')) {
        if (!traits.culinary_use.includes('hot_sauce')) {
          traits.culinary_use.push('hot_sauce');
        }
      }
      
      // Ornamental
      if (lower.includes('ornamental')) {
        traits.is_ornamental = true;
      }
      
      return traits;
    };
    
    // Step 7: Load all Pepper varieties and normalize
    const allPepperVarieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: pepperTypeId
    });
    
    console.log('[Pepper Cleanup] Found', allPepperVarieties.length, 'Pepper varieties to normalize');
    
    let updatedCount = 0;
    
    for (const variety of allPepperVarieties) {
      // Determine correct heat level
      const heatSubcatId = getHeatLevelSubcatId(variety.heat_scoville_min, variety.heat_scoville_max);
      
      // Get old subcategory name if exists (for traits derivation)
      let oldSubcatName = null;
      if (variety.plant_subcategory_id) {
        const oldSubcat = allPepperSubcats.find(s => s.id === variety.plant_subcategory_id);
        if (oldSubcat) oldSubcatName = oldSubcat.name;
      }
      
      // Derive traits
      let traits = variety.traits || {};
      if (oldSubcatName) {
        traits = deriveTraitsFromOldSubcat(oldSubcatName, traits);
      }
      
      // Update variety
      await base44.asServiceRole.entities.Variety.update(variety.id, {
        plant_subcategory_id: heatSubcatId,
        plant_subcategory_ids: [heatSubcatId],
        traits: traits
      });
      
      updatedCount++;
      
      if (updatedCount % 50 === 0) {
        console.log('[Pepper Cleanup] Updated', updatedCount, '/', allPepperVarieties.length, 'varieties...');
      }
    }
    
    console.log('[Pepper Cleanup] Completed! Updated', updatedCount, 'varieties');
    
    return Response.json({
      success: true,
      summary: {
        canonicalSubcatsCreated: Object.keys(heatSubcatMap).length,
        oldSubcatsDeactivated: deactivatedCount,
        varietiesUpdated: updatedCount
      }
    });
    
  } catch (error) {
    console.error('[Pepper Cleanup] Error:', error);
    console.error('[Pepper Cleanup] Stack:', error.stack);
    return Response.json({ 
      success: false,
      error: error.message,
      details: error.stack 
    }, { status: 200 });
  }
});