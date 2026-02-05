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

    // Try to get Beds for Garden 2
    const beds = await base44.entities.Bed.filter({ garden_id: garden2.id });
    
    // Try to get Spaces for Garden 2
    const spaces = await base44.entities.GardenSpace.filter({ garden_id: garden2.id });

    return Response.json({
      garden2_id: garden2.id,
      garden2_name: garden2.name,
      beds_count: beds.length,
      beds: beds.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type
      })),
      spaces_count: spaces.length,
      spaces: spaces.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});