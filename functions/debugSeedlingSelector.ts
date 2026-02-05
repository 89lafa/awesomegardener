import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check containers and trayCells ready to transplant
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

    console.log(`Found ${containers.length} ready containers and ${trayCells.length} ready tray cells`);

    // Get varieties for display
    const varietyIds = new Set();
    const plantProfileIds = new Set();

    containers.forEach(c => {
      if (c.variety_id) varietyIds.add(c.variety_id);
      if (c.plant_profile_id) plantProfileIds.add(c.plant_profile_id);
    });
    
    trayCells.forEach(tc => {
      if (tc.variety_id) varietyIds.add(tc.variety_id);
      if (tc.plant_profile_id) plantProfileIds.add(tc.plant_profile_id);
    });

    const [varieties, profiles] = await Promise.all([
      varietyIds.size > 0 ? base44.entities.Variety.list() : Promise.resolve([]),
      plantProfileIds.size > 0 ? base44.entities.PlantProfile.list() : Promise.resolve([])
    ]);

    // Get plant types
    const plantTypeIds = new Set();
    profiles.forEach(p => {
      if (p.plant_type_id) plantTypeIds.add(p.plant_type_id);
    });

    const plantTypes = plantTypeIds.size > 0 ? await base44.entities.PlantType.list() : [];

    const varietyMap = new Map(varieties.map(v => [v.id, v]));
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    const plantTypeMap = new Map(plantTypes.map(pt => [pt.id, pt]));

    // Build seedling list with display names
    const seedlings = [];

    containers.forEach(c => {
      let displayName = 'Unknown Seedling';
      if (c.plant_profile_id && profileMap.has(c.plant_profile_id)) {
        const profile = profileMap.get(c.plant_profile_id);
        const varietyName = profile.variety_name;
        const plantTypeName = profile.common_name;
        displayName = `${varietyName} - ${plantTypeName}`;
      }
      seedlings.push({
        id: c.id,
        type: 'container',
        display_name: displayName,
        source_location: `Container ${c.name}`,
        age: '?'
      });
    });

    trayCells.forEach(tc => {
      let displayName = 'Unknown Seedling';
      if (tc.plant_profile_id && profileMap.has(tc.plant_profile_id)) {
        const profile = profileMap.get(tc.plant_profile_id);
        const varietyName = profile.variety_name;
        const plantTypeName = profile.common_name;
        displayName = `${varietyName} - ${plantTypeName}`;
      }
      seedlings.push({
        id: tc.id,
        type: 'tray_cell',
        display_name: displayName,
        source_location: `Tray Cell ${tc.cell_number}`,
        age: '?'
      });
    });

    return Response.json({
      user_email: user.email,
      containers_ready: containers.length,
      tray_cells_ready: trayCells.length,
      seedlings_list: seedlings,
      sample_container: containers[0],
      sample_tray_cell: trayCells[0]
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});