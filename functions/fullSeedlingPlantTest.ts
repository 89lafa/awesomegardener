import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`\n=== FULL SEEDLING PLANTING TEST ===\n`);

    // STEP 1: Check ready seedlings
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

    console.log(`✓ Ready seedlings found: ${containers.length} containers + ${trayCells.length} trays`);

    // STEP 2: Get user's gardens
    const gardens = await base44.entities.Garden.filter({ 
      created_by: user.email,
      archived: false
    });

    console.log(`✓ User gardens: ${gardens.length}`);

    // STEP 3: Get spaces and beds
    let allSpaces = [];
    let allBeds = [];
    
    if (gardens.length > 0) {
      for (const garden of gardens) {
        const [spaces, beds] = await Promise.all([
          base44.entities.GardenSpace.filter({ garden_id: garden.id }),
          base44.entities.Bed.filter({ garden_id: garden.id })
        ]);
        allSpaces = allSpaces.concat(spaces.map(s => ({ ...s, garden_id: garden.id })));
        allBeds = allBeds.concat(beds.map(b => ({ ...b, garden_id: garden.id })));
      }
    }

    console.log(`✓ Garden spaces: ${allSpaces.length}`);
    console.log(`✓ Beds in gardens: ${allBeds.length}`);

    // STEP 4: Get PlantInstances for this user to see what's planted
    const allPlantInstances = await base44.entities.PlantInstance.filter({
      created_by: user.email
    });

    console.log(`✓ Total PlantInstances for user: ${allPlantInstances.length}`);

    // Check for seedling-based plantings
    const seedlingPlantings = allPlantInstances.filter(p => 
      p.seedling_source_id || p.growing_method === 'SEEDLING_TRANSPLANT'
    );

    console.log(`✓ PlantInstances from seedlings: ${seedlingPlantings.length}`);

    // STEP 5: Check if there's a test ready-to-transplant container
    let testContainer = containers[0];
    const plantInfo = testContainer 
      ? {
          id: testContainer.id,
          name: testContainer.name,
          profile_id: testContainer.plant_profile_id,
          variety_name: testContainer.variety_name
        }
      : null;

    // STEP 6: Try to create a test bed and plant the seedling
    let testPlanting = null;
    if (gardens.length > 0 && testContainer) {
      const testGarden = gardens[0];
      
      // Check if any beds exist
      const existingBeds = await base44.entities.Bed.filter({
        garden_id: testGarden.id
      });

      let bedToUse = existingBeds[0];

      // If no beds exist, need to create space first
      if (!bedToUse) {
        console.log(`⚠ No beds found in ${testGarden.name}. Cannot test planting without a bed.`);
      } else {
        // Try to plant the container seedling
        try {
          const profile = await base44.entities.PlantProfile.filter({
            id: testContainer.plant_profile_id
          }).then(profiles => profiles[0]);

          const plantType = profile && profile.plant_type_id
            ? await base44.entities.PlantType.filter({
                id: profile.plant_type_id
              }).then(types => types[0])
            : null;

          const displayName = profile
            ? `${profile.variety_name} - ${profile.common_name}`
            : testContainer.variety_name;

          testPlanting = await base44.entities.PlantInstance.create({
            garden_id: testGarden.id,
            bed_id: bedToUse.id,
            space_id: bedToUse.space_id,
            plant_type_id: profile?.plant_type_id,
            plant_type_icon: plantType?.icon || '🌱',
            plant_family: profile?.plant_family,
            variety_id: profile?.plant_type_id,
            display_name: displayName,
            placement_mode: 'grid_cell',
            cell_col: 0,
            cell_row: 0,
            cell_span_cols: 2,
            cell_span_rows: 2,
            season_year: `${new Date().getFullYear()}-Spring`,
            status: 'planned',
            growing_method: 'SEEDLING_TRANSPLANT',
            seedling_source_id: testContainer.id,
            seedling_source_type: 'container',
            seedling_location: testContainer.name,
            actual_transplant_date: new Date().toISOString().split('T')[0]
          });

          console.log(`✓ Successfully planted seedling! ID: ${testPlanting.id}`);
        } catch (error) {
          console.error(`✗ Failed to plant seedling: ${error.message}`);
          testPlanting = { error: error.message };
        }
      }
    }

    return Response.json({
      summary: {
        ready_seedlings: containers.length + trayCells.length,
        gardens: gardens.length,
        spaces: allSpaces.length,
        beds: allBeds.length,
        existing_plantings: allPlantInstances.length,
        seedling_plantings: seedlingPlantings.length
      },
      ready_to_transplant: {
        containers: containers.slice(0, 3),
        tray_cells: trayCells.slice(0, 3)
      },
      gardens_info: gardens.slice(0, 2),
      test_result: {
        attempted_container: plantInfo,
        planting_created: testPlanting?.id || 'FAILED'
      },
      debug_issues: {
        no_beds: allBeds.length === 0,
        no_spaces: allSpaces.length === 0,
        no_ready_seedlings: (containers.length + trayCells.length) === 0
      }
    });
  } catch (error) {
    return Response.json({ 
      error: error.message, 
      stack: error.stack,
      location: error.location 
    }, { status: 500 });
  }
});