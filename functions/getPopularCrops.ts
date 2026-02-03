import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all grow list items and crop plans to determine popularity
    const [growListItems, cropPlans] = await Promise.all([
      base44.asServiceRole.entities.GrowList.list(),
      base44.asServiceRole.entities.CropPlan.list()
    ]);

    // Track unique users per variety
    const varietyUsers = new Map(); // variety_id => Set of user emails

    // Process grow list items
    for (const item of growListItems) {
      if (item.variety_id && item.created_by) {
        if (!varietyUsers.has(item.variety_id)) {
          varietyUsers.set(item.variety_id, new Set());
        }
        varietyUsers.get(item.variety_id).add(item.created_by);
      }
    }

    // Process crop plans
    for (const plan of cropPlans) {
      if (plan.variety_id && plan.created_by) {
        if (!varietyUsers.has(plan.variety_id)) {
          varietyUsers.set(plan.variety_id, new Set());
        }
        varietyUsers.get(plan.variety_id).add(plan.created_by);
      }
    }

    // Get all varieties with their plant profiles
    const varieties = await base44.asServiceRole.entities.Variety.list();
    const plantProfiles = await base44.asServiceRole.entities.PlantProfile.list();
    const plantTypes = await base44.asServiceRole.entities.PlantType.list();

    // Build profile and type maps
    const profileMap = new Map(plantProfiles.map(p => [p.id, p]));
    const typeMap = new Map(plantTypes.map(t => [t.id, t]));

    // Calculate popularity for each variety
    const varietyPopularity = [];
    
    for (const variety of varieties) {
      const uniqueUserCount = varietyUsers.get(variety.id)?.size || 0;
      if (uniqueUserCount === 0) continue;

      const profile = profileMap.get(variety.plant_profile_id);
      const plantType = profile ? typeMap.get(profile.plant_type_id) : null;

      varietyPopularity.push({
        variety_id: variety.id,
        variety_name: variety.name,
        plant_profile_id: variety.plant_profile_id,
        plant_type_id: plantType?.id,
        plant_type_name: plantType?.common_name,
        unique_users: uniqueUserCount,
        profile
      });
    }

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