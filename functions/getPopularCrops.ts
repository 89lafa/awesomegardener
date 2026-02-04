import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all plantings (actual planted items) to determine what's being grown
    const [plantings, varieties, plantTypes] = await Promise.all([
      base44.asServiceRole.entities.PlantInstance.list(),
      base44.asServiceRole.entities.Variety.list(),
      base44.asServiceRole.entities.PlantType.list()
    ]);

    // Track unique users per variety (based on ACTUAL PLANTINGS)
    const varietyUsers = new Map(); // variety_id => Set of user emails

    // Process plantings - these are actual plants in gardens/plots
    for (const planting of plantings) {
      if (planting.variety_id && planting.created_by) {
        if (!varietyUsers.has(planting.variety_id)) {
          varietyUsers.set(planting.variety_id, new Set());
        }
        varietyUsers.get(planting.variety_id).add(planting.created_by);
      }
    }

    console.log('[getPopularCrops] Tracking', varietyUsers.size, 'varieties from', plantings.length, 'plantings');

    // Build type map
    const typeMap = new Map(plantTypes.map(t => [t.id, t]));

    // Calculate popularity for each variety
    const varietyPopularity = [];
    
    for (const variety of varieties) {
      const uniqueUserCount = varietyUsers.get(variety.id)?.size || 0;
      if (uniqueUserCount < 1) continue; // Need at least 1 user

      const plantType = typeMap.get(variety.plant_type_id);

      varietyPopularity.push({
        variety_id: variety.id,
        variety_name: variety.variety_name,
        plant_type_id: plantType?.id,
        plant_type_name: plantType?.common_name,
        unique_users: uniqueUserCount
      });
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