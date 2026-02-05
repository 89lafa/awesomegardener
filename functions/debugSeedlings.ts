import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all seedlings sources
    const [containers, trayCells, myPlants] = await Promise.all([
      base44.entities.IndoorContainer.filter({ created_by: user.email }),
      base44.entities.TrayCell.filter({ created_by: user.email }),
      base44.entities.MyPlant.filter({ created_by: user.email })
    ]);

    // Filter for "ready to transplant"
    const readyContainers = containers.filter(c => c.status === 'ready_to_transplant');
    const readyTrayCells = trayCells.filter(t => t.status === 'ready_to_transplant');

    // Check for MyPlant with source_type 'indoor_transplant'
    const myPlantsFromIndoor = myPlants.filter(mp => mp.source_type === 'indoor_transplant');

    return Response.json({
      summary: {
        total_containers: containers.length,
        ready_containers: readyContainers.length,
        total_tray_cells: trayCells.length,
        ready_tray_cells: readyTrayCells.length,
        total_my_plants: myPlants.length,
        my_plants_from_indoor: myPlantsFromIndoor.length
      },
      ready_containers: readyContainers.map(c => ({
        id: c.id,
        name: c.name,
        plant_type_name: c.plant_type_name,
        variety_name: c.variety_name,
        status: c.status,
        created_date: c.created_date
      })),
      ready_tray_cells: readyTrayCells.map(t => ({
        id: t.id,
        cell_number: t.cell_number,
        plant_type_name: t.plant_type_name,
        variety_name: t.variety_name,
        status: t.status,
        created_date: t.created_date
      })),
      my_plants_from_indoor: myPlantsFromIndoor.map(mp => ({
        id: mp.id,
        name: mp.name,
        plant_profile_id: mp.plant_profile_id,
        source_type: mp.source_type,
        source_tray_cell_id: mp.source_tray_cell_id,
        garden_item_id: mp.garden_item_id,
        status: mp.status,
        created_date: mp.created_date,
        notes: mp.notes
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});