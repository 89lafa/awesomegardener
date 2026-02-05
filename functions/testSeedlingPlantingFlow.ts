import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: Check seedlings ready to plant
    const [containers, trayCells] = await Promise.all([
      base44.entities.IndoorContainer.filter({ 
        created_by: user.email, 
        status: 'ready_to_transplant' 
      }),
      base44.entities.TrayCell.filter({ 
        created_by: user.email, 
        status: 'ready_to_transplant' 
      })
    ]);

    console.log(`Ready seedlings: ${containers.length} containers, ${trayCells.length} tray cells`);

    // Step 2: Get user gardens
    const gardens = await base44.entities.Garden.filter({ 
      created_by: user.email,
      archived: false
    });

    console.log(`User has ${gardens.length} gardens`);

    if (gardens.length === 0) {
      return Response.json({
        status: 'needs_garden',
        message: 'User has no gardens. Need to create one first.'
      });
    }

    const garden = gardens[0];
    console.log(`Using garden: ${garden.id} - ${garden.name}`);

    // Step 3: Get beds/spaces for the garden
    const spaces = await base44.entities.GardenSpace.filter({
      garden_id: garden.id
    });

    console.log(`Garden has ${spaces.length} spaces`);

    const beds = await base44.entities.Bed.filter({
      garden_id: garden.id
    });

    console.log(`Garden has ${beds.length} beds`);

    if (beds.length === 0) {
      return Response.json({
        status: 'needs_bed',
        message: 'Garden has no beds. Need to create one first.'
      });
    }

    const bed = beds[0];
    console.log(`Using bed: ${bed.id} - ${bed.name}`);

    // Step 4: If we have a container seedling, try to plant it
    let plantingResult = null;
    if (containers.length > 0) {
      const container = containers[0];
      const profile = await base44.entities.PlantProfile.filter({
        id: container.plant_profile_id
      }).then(profiles => profiles[0]);

      const plantType = profile && profile.plant_type_id 
        ? await base44.entities.PlantType.filter({
            id: profile.plant_type_id
          }).then(types => types[0])
        : null;

      console.log(`Attempting to plant: ${profile?.variety_name} - ${profile?.common_name}`);

      // Create a PlantInstance for this seedling
      const displayName = profile 
        ? `${profile.variety_name} - ${profile.common_name}`
        : 'Unknown Seedling';

      try {
        plantingResult = await base44.entities.PlantInstance.create({
          garden_id: garden.id,
          bed_id: bed.id,
          space_id: bed.space_id || spaces[0]?.id,
          plant_type_id: profile?.plant_type_id,
          plant_type_icon: plantType?.icon || '🌱',
          plant_family: profile?.plant_family,
          variety_id: profile?.plant_type_id, // Note: This should ideally be a variety ID
          display_name: displayName,
          placement_mode: 'grid_cell',
          cell_col: 0,
          cell_row: 0,
          cell_span_cols: 2,
          cell_span_rows: 2,
          season_year: `${new Date().getFullYear()}-Spring`,
          status: 'planned',
          growing_method: 'SEEDLING_TRANSPLANT',
          seedling_source_id: container.id,
          seedling_source_type: 'container',
          seedling_location: container.name,
          actual_transplant_date: new Date().toISOString().split('T')[0]
        });

        console.log(`Successfully created PlantInstance: ${plantingResult.id}`);
      } catch (error) {
        console.error(`Failed to create PlantInstance:`, error.message);
        plantingResult = { error: error.message };
      }
    }

    return Response.json({
      status: 'success',
      user_email: user.email,
      ready_seedlings: {
        containers: containers.length,
        tray_cells: trayCells.length
      },
      garden: {
        id: garden.id,
        name: garden.name
      },
      bed: {
        id: bed.id,
        name: bed.name,
        space_id: bed.space_id
      },
      planting_result: plantingResult,
      containers_sample: containers.slice(0, 2),
      gardens_available: gardens.length
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});