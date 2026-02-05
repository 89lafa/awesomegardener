import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all trays
    const trays = await base44.entities.SeedTray.list();

    // Get cells from first tray
    if (trays.length === 0) {
      return Response.json({ error: 'No trays found' }, { status: 404 });
    }

    const firstTray = trays[0];
    const cells = await base44.entities.TrayCell.filter({ tray_id: firstTray.id }, 'cell_number', 10);

    return Response.json({
      tray_id: firstTray.id,
      tray_name: firstTray.name,
      cells_sample: cells.map(c => ({
        id: c.id,
        cell_number: c.cell_number,
        plant_type_id: c.plant_type_id,
        plant_type_name: c.plant_type_name,
        variety_id: c.variety_id,
        variety_name: c.variety_name,
        plant_profile_id: c.plant_profile_id,
        status: c.status
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});