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
        await base44.asServiceRole.entities.PlantSubCategory.update(existing[0].id, {
          name: heatDef.name,
          is_active: true,
          sort_order: heatDef.sort_order,
          dimension: 'HeatLevel'
        });
        heatSubcatMap[heatDef.subcat_code] = existing[0].id;
        console.log('[Pepper Cleanup] Updated heat subcat:', heatDef.name);
      } else {
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
    
    // Step 4: Load all subcategories for name matching
    const allPepperSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({
      plant_type_id: pepperTypeId
    });
    
    // Deactivate non-canonical subcategories
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
    
    // Step 5: Helper to check if variety is confidently sweet
    const isConfidentlySweet = (variety, oldSubcatName) => {
      const nameLower = (variety.variety_name || '').toLowerCase();
      const subcatLower = (oldSubcatName || '').toLowerCase();
      
      // Check name patterns
      if (nameLower.includes('bell') || 
          nameLower.includes('sweet') || 
          nameLower.includes('pimento') ||
          nameLower.includes('pimiento')) {
        return true;
      }
      
      // Check old subcategory
      if (subcatLower.includes('sweet') || subcatLower.includes('bell')) {
        return true;
      }
      
      // Check species - annuum sweet bells
      if (variety.species === 'annuum' && (nameLower.includes('bell') || subcatLower.includes('bell'))) {
        return true;
      }
      
      return false;
    };
    
    // Step 6: Infer heat level from keywords when SHU missing
    const inferHeatFromKeywords = (variety, oldSubcatName) => {
      const nameLower = (variety.variety_name || '').toLowerCase();
      const subcatLower = (oldSubcatName || '').toLowerCase();
      const combined = nameLower + ' ' + subcatLower;
      
      // Superhot patterns
      if (combined.match(/superhot|reaper|ghost|bhut|7 pot|scorpion|primotalii|moruga|douglah/)) {
        return heatSubcatMap.PSC_PEPPER_HEAT_SUPERHOT;
      }
      
      // Extra Hot patterns
      if (combined.match(/habanero|scotch bonnet|fatalii|trinidad|naga/)) {
        return heatSubcatMap.PSC_PEPPER_HEAT_EXTRA_HOT;
      }
      
      // Hot patterns
      if (combined.match(/thai|cayenne|tabasco|pequin|arbol|chipotle/)) {
        return heatSubcatMap.PSC_PEPPER_HEAT_HOT;
      }
      
      // Medium patterns
      if (combined.match(/jalape|serrano|chipotle/)) {
        return heatSubcatMap.PSC_PEPPER_HEAT_MEDIUM;
      }
      
      // Mild patterns
      if (combined.match(/anaheim|poblano|pasilla|wax|banana|cubanelle|pepperoncini/)) {
        return heatSubcatMap.PSC_PEPPER_HEAT_MILD;
      }
      
      // Sweet patterns
      if (combined.match(/bell|sweet|pimento|pimiento/)) {
        return heatSubcatMap.PSC_PEPPER_HEAT_SWEET;
      }
      
      return null; // No confident match
    };
    
    // Step 7: Determine heat level from SHU or inference
    const getHeatLevelSubcatId = (variety, oldSubcatName, existingSubcatId) => {
      // Prefer scoville_max/min, fallback to heat_scoville_max/min
      const scovilleMax = variety.scoville_max ?? variety.heat_scoville_max;
      const scovilleMin = variety.scoville_min ?? variety.heat_scoville_min;
      
      // Case 1: SHU is missing entirely
      if (scovilleMax == null && scovilleMin == null) {
        // Try keyword inference
        const inferred = inferHeatFromKeywords(variety, oldSubcatName);
        if (inferred) {
          console.log('[Pepper Cleanup] Inferred heat for', variety.variety_name, '→', 
                      Object.keys(heatSubcatMap).find(k => heatSubcatMap[k] === inferred));
          return inferred;
        }
        
        // If already assigned to a canonical heat bucket, keep it
        if (existingSubcatId && canonicalIds.includes(existingSubcatId)) {
          console.log('[Pepper Cleanup] Keeping existing canonical bucket for', variety.variety_name);
          return existingSubcatId;
        }
        
        // Default to Unknown
        console.log('[Pepper Cleanup] No SHU, no inference →', variety.variety_name, '→ Unknown');
        return heatSubcatMap.PSC_PEPPER_HEAT_UNKNOWN;
      }
      
      // Case 2: SHU is 0 - check if confidently sweet
      const maxSHU = scovilleMax ?? scovilleMin ?? 0;
      if (maxSHU === 0) {
        if (isConfidentlySweet(variety, oldSubcatName)) {
          console.log('[Pepper Cleanup] SHU=0 + sweet patterns →', variety.variety_name, '→ Sweet');
          return heatSubcatMap.PSC_PEPPER_HEAT_SWEET;
        } else {
          console.log('[Pepper Cleanup] SHU=0 but not confident sweet →', variety.variety_name, '→ Unknown');
          return heatSubcatMap.PSC_PEPPER_HEAT_UNKNOWN;
        }
      }
      
      // Case 3: SHU is present and > 0 - use standard bucketing
      if (maxSHU <= 2500) return heatSubcatMap.PSC_PEPPER_HEAT_MILD;
      if (maxSHU <= 30000) return heatSubcatMap.PSC_PEPPER_HEAT_MEDIUM;
      if (maxSHU <= 100000) return heatSubcatMap.PSC_PEPPER_HEAT_HOT;
      if (maxSHU <= 300000) return heatSubcatMap.PSC_PEPPER_HEAT_EXTRA_HOT;
      if (maxSHU > 300000) return heatSubcatMap.PSC_PEPPER_HEAT_SUPERHOT;
      
      return heatSubcatMap.PSC_PEPPER_HEAT_UNKNOWN;
    };
    
    // Step 8: Load all active Pepper varieties and normalize
    const allPepperVarieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: pepperTypeId,
      status: 'active'
    }, 'variety_name', 10000);
    
    console.log('[Pepper Cleanup] Found', allPepperVarieties.length, 'active Pepper varieties to normalize');
    
    let updatedCount = 0;
    let errorCount = 0;
    const bucketCounts = {};
    const sweetWith0SHU = [];
    
    // Initialize bucket counts
    Object.keys(heatSubcatMap).forEach(code => {
      bucketCounts[code] = 0;
    });
    
    for (const variety of allPepperVarieties) {
      try {
        // Get old subcategory name if exists
        let oldSubcatName = null;
        if (variety.plant_subcategory_id) {
          const oldSubcat = allPepperSubcats.find(s => s.id === variety.plant_subcategory_id);
          if (oldSubcat) oldSubcatName = oldSubcat.name;
        }
        
        // Determine correct heat level
        const heatSubcatId = getHeatLevelSubcatId(variety, oldSubcatName, variety.plant_subcategory_id);
        
        // Track bucket assignment
        const assignedCode = Object.keys(heatSubcatMap).find(k => heatSubcatMap[k] === heatSubcatId);
        if (assignedCode) {
          bucketCounts[assignedCode]++;
          
          // Track Sweet with 0 SHU for diagnostics
          if (assignedCode === 'PSC_PEPPER_HEAT_SWEET') {
            const maxSHU = variety.scoville_max ?? variety.heat_scoville_max;
            if (maxSHU === 0 || maxSHU == null) {
              sweetWith0SHU.push({
                name: variety.variety_name,
                shu: maxSHU,
                reason: isConfidentlySweet(variety, oldSubcatName) ? 'Name/species pattern match' : 'Default'
              });
            }
          }
        }
        
        // Prepare subcategory IDs array
        let subcatIds = variety.plant_subcategory_ids || [];
        if (typeof subcatIds === 'string') {
          try {
            subcatIds = JSON.parse(subcatIds);
          } catch {
            subcatIds = [];
          }
        }
        if (!Array.isArray(subcatIds)) {
          subcatIds = [];
        }
        
        // Ensure heat subcategory is in the array
        if (!subcatIds.includes(heatSubcatId)) {
          subcatIds = [heatSubcatId, ...subcatIds.filter(id => id !== heatSubcatId)];
        }
        
        // Preserve existing traits
        const traits = variety.traits || {};
        
        // Update variety with valid schema fields only
        const updateData = {
          plant_subcategory_id: heatSubcatId,
          plant_subcategory_ids: subcatIds
        };
        
        // Only add traits if non-empty
        if (Object.keys(traits).length > 0) {
          updateData.traits = traits;
        }
        
        // Migrate species from trait to field if available
        if (traits.species && !variety.species) {
          const validSpecies = ['annuum', 'chinense', 'baccatum', 'frutescens', 'pubescens', 'unknown'];
          if (validSpecies.includes(traits.species)) {
            updateData.species = traits.species;
          }
        }
        
        await base44.asServiceRole.entities.Variety.update(variety.id, updateData);
        
        updatedCount++;
        
        if (updatedCount % 50 === 0) {
          console.log('[Pepper Cleanup] Updated', updatedCount, '/', allPepperVarieties.length, 'varieties...');
        }
      } catch (error) {
        console.error('[Pepper Cleanup] Error updating variety', variety.id, ':', error);
        errorCount++;
      }
    }
    
    console.log('[Pepper Cleanup] Completed! Updated', updatedCount, 'varieties, errors:', errorCount);
    console.log('[Pepper Cleanup] Bucket distribution:', bucketCounts);
    
    return Response.json({
      success: true,
      summary: {
        canonicalSubcatsCreated: Object.keys(heatSubcatMap).length,
        oldSubcatsDeactivated: deactivatedCount,
        varietiesUpdated: updatedCount,
        errorsEncountered: errorCount
      },
      diagnostics: {
        bucketCounts,
        sweetWith0SHU: sweetWith0SHU.slice(0, 10), // First 10 examples
        totalSweet: bucketCounts.PSC_PEPPER_HEAT_SWEET || 0
      }
    });
    
  } catch (error) {
    console.error('[Pepper Cleanup] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});