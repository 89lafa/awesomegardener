import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { trayId } = await req.json();
    
    if (!trayId) {
      return Response.json({ error: 'trayId is required' }, { status: 400 });
    }
    
    // Get the tray
    const trays = await base44.entities.SeedTray.filter({ id: trayId });
    if (trays.length === 0) {
      return Response.json({ error: 'Tray not found' }, { status: 404 });
    }
    
    const tray = trays[0];
    const expectedCells = tray.total_cells || (tray.cells_rows * tray.cells_cols);
    
    // Get existing cells
    const existingCells = await base44.entities.TrayCell.filter({ tray_id: trayId });
    
    // Create a map of existing cell positions
    const existingPositions = new Set();
    existingCells.forEach(cell => {
      existingPositions.add(`${cell.row}-${cell.col}`);
    });
    
    // Find missing cells
    const missingCells = [];
    let cellNumber = 1;
    
    for (let row = 0; row < tray.cells_rows; row++) {
      for (let col = 0; col < tray.cells_cols; col++) {
        const key = `${row}-${col}`;
        if (!existingPositions.has(key)) {
          missingCells.push({
            tray_id: trayId,
            row,
            col,
            cell_number: cellNumber,
            status: 'empty'
          });
        }
        cellNumber++;
      }
    }
    
    // Create missing cells
    if (missingCells.length > 0) {
      for (const cellData of missingCells) {
        await base44.entities.TrayCell.create(cellData);
      }
      
      return Response.json({
        success: true,
        created: missingCells.length,
        message: `Created ${missingCells.length} missing tray cells`
      });
    }
    
    return Response.json({
      success: true,
      created: 0,
      message: 'All tray cells already exist'
    });
    
  } catch (error) {
    console.error('Error ensuring tray cells:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});