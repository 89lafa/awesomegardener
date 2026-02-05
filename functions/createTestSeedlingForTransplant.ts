import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: Get or create a plant type (Tomato)
    const plantTypes = await base44.entities.PlantType.filter({ common_name: 'Tomato' });
    let plantType = plantTypes[0];
    if (!plantType) {
      plantType = await base44.entities.PlantType.create({
        common_name: 'Tomato',
        category: 'vegetable',
        icon: '🍅'
      });
    }

    // Step 2: Create a plant profile
    const profile = await base44.entities.PlantProfile.create({
      plant_type_id: plantType.id,
      common_name: 'Tomato',
      variety_name: 'Early Girl'
    });

    // Step 3: Create a tray with cells
    const tray = await base44.entities.SeedTray.create({
      indoor_space_id: '6984df040623412334045158', // Your grow space
      name: 'Test Tray for Seedling',
      rows: 6,
      columns: 8,
      cell_type: 'standard'
    });

    // Step 4: Ensure cells exist
    await base44.functions.invoke('ensureTrayCells', { tray_id: tray.id });

    // Step 5: Get cells and mark one as planted
    const cells = await base44.entities.TrayCell.filter({ tray_id: tray.id }, 'cell_number', 1);
    const firstCell = cells[0];

    if (firstCell) {
      await base44.entities.TrayCell.update(firstCell.id, {
        status: 'planted',
        plant_type_id: plantType.id,
        plant_type_name: plantType.common_name,
        variety_id: null,
        variety_name: profile.variety_name,
        plant_profile_id: profile.id,
        seeded_date: new Date().toISOString().split('T')[0]
      });
    }

    // Step 6: Mark as ready to transplant
    if (firstCell) {
      await base44.entities.TrayCell.update(firstCell.id, {
        status: 'ready_to_transplant'
      });
    }

    return Response.json({
      success: true,
      tray_id: tray.id,
      tray_name: tray.name,
      cell_id: firstCell?.id,
      plant_type_id: plantType.id,
      profile_id: profile.id,
      profile_variety: profile.variety_name
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});