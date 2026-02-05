import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: Get all ready_to_transplant MyPlants
    const readyPlants = await base44.entities.MyPlant.filter({ 
      created_by: user.email,
      status: 'ready_to_transplant'
    });

    // Step 2: Get plant profiles for these
    const profileIds = [...new Set(readyPlants.map(p => p.plant_profile_id).filter(Boolean))];
    let profiles = [];
    if (profileIds.length > 0) {
      profiles = await base44.entities.PlantProfile.filter({ id: { $in: profileIds } });
    }

    // Step 3: Get plant types
    const plantTypeIds = [...new Set(profiles.map(p => p.plant_type_id).filter(Boolean))];
    let plantTypes = [];
    if (plantTypeIds.length > 0) {
      plantTypes = await base44.entities.PlantType.filter({ id: { $in: plantTypeIds } });
    }

    // Step 4: Combine data
    const enrichedPlants = readyPlants.map(plant => {
      const profile = profiles.find(p => p.id === plant.plant_profile_id);
      const plantType = plantTypes.find(pt => pt.id === profile?.plant_type_id);
      
      return {
        id: plant.id,
        name: plant.name,
        status: plant.status,
        location_name: plant.location_name,
        plant_profile_id: plant.plant_profile_id,
        profile_variety: profile?.variety_name,
        profile_common: profile?.common_name,
        plant_type_id: plantType?.id,
        plant_type_name: plantType?.common_name
      };
    });

    return Response.json({
      ready_to_transplant_count: readyPlants.length,
      plants: enrichedPlants,
      profiles_count: profiles.length,
      plant_types_count: plantTypes.length
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});