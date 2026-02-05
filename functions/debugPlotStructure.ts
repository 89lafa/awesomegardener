import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all gardens
    const gardens = await base44.entities.Garden.filter({ created_by: user.email });
    const garden2 = gardens.find(g => g.name === 'Garden 2');

    if (!garden2) {
      return Response.json({ error: 'Garden 2 not found' }, { status: 404 });
    }

    // Get plot structures for Garden 2
    const plotStructures = await base44.entities.PlotStructure.filter({ garden_id: garden2.id });

    return Response.json({
      garden2_id: garden2.id,
      garden2_name: garden2.name,
      plot_structures_count: plotStructures.length,
      plot_structures: plotStructures.map(ps => ({
        id: ps.id,
        name: ps.name,
        structure_type: ps.structure_type
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});