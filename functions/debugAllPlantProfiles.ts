import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all plant profiles
    const profiles = await base44.entities.PlantProfile.list('created_date', 10);

    // Get all MyPlants
    const myPlants = await base44.entities.MyPlant.list('created_date', 10);

    return Response.json({
      profiles_count: profiles.length,
      profiles_sample: profiles.map(p => ({
        id: p.id,
        common_name: p.common_name,
        variety_name: p.variety_name,
        created_date: p.created_date,
        created_by: p.created_by
      })),
      my_plants_count: myPlants.length,
      my_plants_sample: myPlants.map(mp => ({
        id: mp.id,
        name: mp.name,
        plant_profile_id: mp.plant_profile_id,
        garden_season_id: mp.garden_season_id,
        status: mp.status,
        created_date: mp.created_date,
        created_by: mp.created_by
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});