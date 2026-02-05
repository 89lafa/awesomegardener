import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ALL seedling sources
    const [containers, trayCells, myPlants] = await Promise.all([
      base44.entities.IndoorContainer.filter({ created_by: user.email }),
      base44.entities.TrayCell.filter({ created_by: user.email }),
      base44.entities.MyPlant.filter({ created_by: user.email })
    ]);

    // Filter by ready_to_transplant
    const readyContainers = containers.filter(c => c.status === 'ready_to_transplant');
    const readyTrayCells = trayCells.filter(c => c.status === 'ready_to_transplant');
    const readyMyPlants = myPlants.filter(c => c.status === 'ready_to_transplant');

    // Get sample details for ready seedlings
    const containerDetails = await Promise.all(
      readyContainers.slice(0, 5).map(c => 
        base44.entities.PlantProfile.filter({ id: c.plant_profile_id }).then(profiles => ({
          ...c,
          profile: profiles[0]
        }))
      )
    );

    const trayCellDetails = await Promise.all(
      readyTrayCells.slice(0, 5).map(tc => 
        base44.entities.PlantProfile.filter({ id: tc.plant_profile_id }).then(profiles => ({
          ...tc,
          profile: profiles[0]
        }))
      )
    );

    const myPlantDetails = await Promise.all(
      readyMyPlants.slice(0, 5).map(mp => 
        base44.entities.PlantProfile.filter({ id: mp.plant_profile_id }).then(profiles => ({
          ...mp,
          profile: profiles[0]
        }))
      )
    );

    return Response.json({
      user_email: user.email,
      total_counts: {
        all_containers: containers.length,
        all_tray_cells: trayCells.length,
        all_my_plants: myPlants.length,
        ready_containers: readyContainers.length,
        ready_tray_cells: readyTrayCells.length,
        ready_my_plants: readyMyPlants.length
      },
      ready_to_transplant: {
        containers: containerDetails,
        tray_cells: trayCellDetails,
        my_plants: myPlantDetails
      }
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});