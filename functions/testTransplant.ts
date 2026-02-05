import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check what's being created with current logic
    const allMyPlants = await base44.entities.MyPlant.list();
    const allGardenSeasons = await base44.entities.GardenSeason.list();

    return Response.json({
      total_my_plants: allMyPlants.length,
      total_garden_seasons: allGardenSeasons.length,
      my_plants_sample: allMyPlants.slice(0, 20).map(mp => ({
        id: mp.id,
        name: mp.name,
        garden_season_id: mp.garden_season_id,
        status: mp.status,
        transplant_date: mp.transplant_date,
        created_by: mp.created_by,
        created_date: mp.created_date
      })),
      garden_seasons: allGardenSeasons.map(gs => ({
        id: gs.id,
        garden_id: gs.garden_id,
        year: gs.year,
        season: gs.season,
        season_key: gs.season_key,
        created_by: gs.created_by
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});