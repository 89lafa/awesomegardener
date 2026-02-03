import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all crop plans and seed lots to determine popularity
    const [cropPlans, seedLots] = await Promise.all([
      base44.asServiceRole.entities.CropPlan.list(),
      base44.asServiceRole.entities.SeedLot.filter({ is_wishlist: false })
    ]);

    // Track unique users per variety
    const varietyUsers = new Map(); // variety_id => Set of user emails

    // Process crop plans
    for (const plan of cropPlans) {
      if (plan.variety_id && plan.created_by) {
        if (!varietyUsers.has(plan.variety_id)) {
          varietyUsers.set(plan.variety_id, new Set());
        }
        varietyUsers.get(plan.variety_id).add(plan.created_by);
      }
    }

    // Process seed lots
    for (const lot of seedLots) {
      // Get variety from PlantProfile
      if (lot.plant_profile_id && lot.created_by) {
        const profile = await base44.asServiceRole.entities.PlantProfile.get(lot.plant_profile_id);
        if (profile?.variety_id) {
          if (!varietyUsers.has(profile.variety_id)) {
            varietyUsers.set(profile.variety_id, new Set());
          }
          varietyUsers.get(profile.variety_id).add(lot.created_by);
        }
      }
    }

    console.log('[getPopularCrops] Tracking', varietyUsers.size, 'varieties');

    // Get all varieties with their plant types
    const varieties = await base44.asServiceRole.entities.Variety.list();
    const plantTypes = await base44.asServiceRole.entities.PlantType.list();

    // Build type map
    const typeMap = new Map(plantTypes.map(t => [t.id, t]));

    // Calculate popularity for each variety
    const varietyPopularity = [];
    
    for (const variety of varieties) {
      const uniqueUserCount = varietyUsers.get(variety.id)?.size || 0;
      if (uniqueUserCount < 2) continue; // Need at least 2 users

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