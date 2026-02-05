import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: Get or create plant type
    const plantTypes = await base44.entities.PlantType.filter({ common_name: 'Tomato' });
    let plantType = plantTypes[0];
    if (!plantType) {
      plantType = await base44.entities.PlantType.create({
        common_name: 'Tomato',
        category: 'vegetable',
        icon: '🍅'
      });
    }

    // Step 2: Create plant profile
    const profile = await base44.entities.PlantProfile.create({
      plant_type_id: plantType.id,
      common_name: 'Tomato',
      variety_name: 'Early Girl'
    });

    // Step 3: Simulate what TransplantDialog would create - MyPlant with ready_to_transplant status
    const myPlant = await base44.entities.MyPlant.create({
      plant_profile_id: profile.id,
      name: 'Early Girl - Tomato',
      status: 'ready_to_transplant',
      location_name: 'Ready to Plant',
      notes: 'Transplanted from tray - ready to plant in garden'
    });

    return Response.json({
      success: true,
      my_plant_id: myPlant.id,
      my_plant_status: myPlant.status,
      plant_profile_id: profile.id,
      plant_type_id: plantType.id,
      profile_variety: profile.variety_name,
      message: 'MyPlant created with ready_to_transplant status'
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});