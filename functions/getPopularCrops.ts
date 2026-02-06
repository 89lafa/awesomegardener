import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all plantings AND crop plans to determine what's being grown
    // CRITICAL: Limit queries to reduce load
    const plantings = await base44.asServiceRole.entities.PlantInstance.list('-created_date', 100);
    const cropPlans = await base44.asServiceRole.entities.CropPlan.filter({ status: { $in: ['active', 'scheduled'] } }, '-created_date', 50);
    const varieties = await base44.asServiceRole.entities.Variety.list('variety_name', 200);
    const plantTypes = await base44.asServiceRole.entities.PlantType.list('common_name', 50);

    // Track unique users per variety
    const varietyUsers = new Map(); // variety_id => Set of user emails
    const plantTypeUsers = new Map(); // For items without variety_id, track by plant_type

    // Process plantings - actual plants in gardens
    for (const planting of plantings) {
      const createdBy = planting.created_by || '89lafa@gmail.com';
      
      if (planting.variety_id) {
        if (!varietyUsers.has(planting.variety_id)) {
          varietyUsers.set(planting.variety_id, new Set());
        }
        varietyUsers.get(planting.variety_id).add(createdBy);
      } else if (planting.plant_type_id) {
        // Track by plant type when no variety
        if (!plantTypeUsers.has(planting.plant_type_id)) {
          plantTypeUsers.set(planting.plant_type_id, new Set());
        }
        plantTypeUsers.get(planting.plant_type_id).add(createdBy);
      }
    }

    // Process crop plans
    for (const plan of cropPlans) {
      const createdBy = plan.created_by || plan.user_owner_email || '89lafa@gmail.com';
      
      if (plan.variety_id) {
        if (!varietyUsers.has(plan.variety_id)) {
          varietyUsers.set(plan.variety_id, new Set());
        }
        varietyUsers.get(plan.variety_id).add(createdBy);
      } else if (plan.plant_type_id) {
        if (!plantTypeUsers.has(plan.plant_type_id)) {
          plantTypeUsers.set(plan.plant_type_id, new Set());
        }
        plantTypeUsers.get(plan.plant_type_id).add(createdBy);
      }
    }

    console.log('[getPopularCrops] Tracking', varietyUsers.size, 'varieties and', plantTypeUsers.size, 'plant types from', plantings.length, 'plantings and', cropPlans.length, 'crop plans');

    // Build type map - handle arrays or objects
    const plantTypesArray = Array.isArray(plantTypes) ? plantTypes : [plantTypes];
    const varietiesArray = Array.isArray(varieties) ? varieties : [varieties];
    
    const typeMap = new Map(plantTypesArray.map(t => [t.id, t]));
    const varietyMap = new Map(varietiesArray.map(v => [v.id, v]));

    // Calculate popularity for each variety
    const varietyPopularity = [];
    
    // Add all varieties that users have
    for (const [varietyId, userSet] of varietyUsers.entries()) {
      const variety = varietyMap.get(varietyId);
      if (!variety) continue;
      
      const plantType = typeMap.get(variety.plant_type_id);
      
      varietyPopularity.push({
        variety_id: variety.id,
        variety_name: variety.variety_name,
        plant_type_id: plantType?.id,
        plant_type_name: plantType?.common_name,
        unique_users: userSet.size
      });
    }
    
    // Add plant types without specific varieties (use generic variety for display)
    for (const [plantTypeId, userSet] of plantTypeUsers.entries()) {
      const plantType = typeMap.get(plantTypeId);
      if (!plantType) continue;
      
      // Check if already counted via variety
      const alreadyCounted = varietyPopularity.some(v => v.plant_type_id === plantTypeId);
      if (!alreadyCounted) {
        // Find a representative variety for this plant type
        const representativeVariety = varietiesArray.find(v => v.plant_type_id === plantTypeId);
        if (representativeVariety) {
          varietyPopularity.push({
            variety_id: representativeVariety.id,
            variety_name: representativeVariety.variety_name,
            plant_type_id: plantType.id,
            plant_type_name: plantType.common_name,
            unique_users: userSet.size
          });
        }
      }
    }

    console.log('[getPopularCrops] Found', varietyPopularity.length, 'popular varieties');

    // Sort by unique users (descending)
    varietyPopularity.sort((a, b) => b.unique_users - a.unique_users);

    // Categorize into tomatoes, peppers, and other
    const tomatoes = varietyPopularity.filter(v => 
      v.plant_type_name?.toLowerCase().includes('tomato')
    ).slice(0, 5);

    const peppers = varietyPopularity.filter(v => 
      v.plant_type_name?.toLowerCase().includes('pepper')
    ).slice(0, 5);

    const other = varietyPopularity.filter(v => 
      !v.plant_type_name?.toLowerCase().includes('tomato') &&
      !v.plant_type_name?.toLowerCase().includes('pepper')
    ).slice(0, 5);

    return Response.json({
      tomatoes,
      peppers,
      other,
      total_varieties: varietyPopularity.length
    });
  } catch (error) {
    console.error('Error getting popular crops:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});