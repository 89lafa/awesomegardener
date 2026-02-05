import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Garden 2
    const gardens = await base44.entities.Garden.filter({ created_by: user.email });
    const garden2 = gardens.find(g => g.name === 'Garden 2');
    
    if (!garden2) {
      return Response.json({ error: 'Garden 2 not found' }, { status: 404 });
    }

    console.log('Found Garden 2:', garden2.id, garden2.current_season_year);

    // Get MyPlants for this garden's season
    const allMyPlants = await base44.entities.MyPlant.list();
    
    // Get seasons for this garden
    const seasons = await base44.entities.GardenSeason.filter({ garden_id: garden2.id });
    
    const seasonIds = seasons.map(s => s.id);
    const myPlantsForGarden = allMyPlants.filter(mp => seasonIds.includes(mp.garden_season_id));

    return Response.json({
      garden2_id: garden2.id,
      garden2_name: garden2.name,
      garden2_current_season_year: garden2.current_season_year,
      seasons_count: seasons.length,
      seasons: seasons.map(s => ({
        id: s.id,
        season_key: s.season_key,
        year: s.year,
        season: s.season
      })),
      my_plants_for_garden2: myPlantsForGarden.map(mp => ({
        id: mp.id,
        name: mp.name,
        status: mp.status,
        created_date: mp.created_date,
        notes: mp.notes
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});