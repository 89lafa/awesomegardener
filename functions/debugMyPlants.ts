import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all MyPlant records (no filter)
    const allMyPlants = await base44.entities.MyPlant.list();

    // Get all GardenSeasons
    const allSeasons = await base44.entities.GardenSeason.list();

    return Response.json({
      all_my_plants_count: allMyPlants.length,
      all_garden_seasons_count: allSeasons.length,
      my_plants_sample: allMyPlants.slice(0, 10).map(mp => ({
        id: mp.id,
        name: mp.name,
        garden_season_id: mp.garden_season_id,
        plant_profile_id: mp.plant_profile_id,
        status: mp.status,
        created_by: mp.created_by,
        notes: mp.notes?.substring(0, 100)
      })),
      garden_seasons_sample: allSeasons.map(gs => ({
        id: gs.id,
        garden_id: gs.garden_id,
        year: gs.year,
        season: gs.season,
        season_key: gs.season_key
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});