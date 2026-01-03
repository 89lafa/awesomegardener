import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all gardens
    const gardens = await base44.asServiceRole.entities.Garden.list();
    let migratedCount = 0;
    let skippedCount = 0;

    for (const garden of gardens) {
      // Get all plot items for this garden
      const plotItems = await base44.asServiceRole.entities.PlotItem.filter({ 
        garden_id: garden.id 
      });

      for (const item of plotItems) {
        // Check if PlantingSpace already exists
        const existingSpaces = await base44.asServiceRole.entities.PlantingSpace.filter({
          plot_item_id: item.id
        });

        if (existingSpaces.length > 0) {
          skippedCount++;
          continue;
        }

        // Determine if plantable
        const plantableTypes = ['RAISED_BED', 'IN_GROUND_BED', 'GREENHOUSE', 'OPEN_PLOT', 'GROW_BAG', 'CONTAINER'];
        if (!plantableTypes.includes(item.item_type)) {
          skippedCount++;
          continue;
        }

        // Calculate layout schema
        let layoutSchema = { type: 'slots', slots: 1 };
        let capacity = 1;

        if (item.item_type === 'RAISED_BED' && item.metadata?.gridEnabled) {
          const gridSize = item.metadata.gridSize || 12;
          const cols = Math.floor(item.width / gridSize);
          const rows = Math.floor(item.height / gridSize);
          layoutSchema = {
            type: 'grid',
            grid_size: gridSize,
            columns: cols,
            rows: rows
          };
          capacity = cols * rows;
        } else if (item.item_type === 'IN_GROUND_BED' || item.item_type === 'OPEN_PLOT') {
          const rowSpacing = item.metadata?.rowSpacing || 18;
          const rowCount = item.metadata?.rowCount || Math.floor(item.width / rowSpacing);
          layoutSchema = {
            type: 'rows',
            rows: rowCount,
            row_spacing: rowSpacing
          };
          capacity = rowCount;
        } else if (item.item_type === 'GREENHOUSE') {
          const slots = item.metadata?.capacity || 20;
          layoutSchema = { type: 'slots', slots };
          capacity = slots;
        } else if (item.item_type === 'GROW_BAG' || item.item_type === 'CONTAINER') {
          layoutSchema = { type: 'slots', slots: 1 };
          capacity = 1;
        }

        // Create PlantingSpace
        await base44.asServiceRole.entities.PlantingSpace.create({
          garden_id: garden.id,
          plot_item_id: item.id,
          space_type: item.item_type,
          name: item.label,
          capacity,
          layout_schema,
          is_active: true
        });

        migratedCount++;
      }
    }

    return Response.json({
      success: true,
      migratedCount,
      skippedCount,
      message: `Migrated ${migratedCount} plot items to planting spaces, skipped ${skippedCount}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});