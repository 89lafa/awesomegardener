import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[Backfill] Starting subcategory backfill...');
    
    // Load all varieties
    const allVarieties = await base44.asServiceRole.entities.Variety.list('variety_name', 10000);
    console.log('[Backfill] Found', allVarieties.length, 'varieties');
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const variety of allVarieties) {
      // Check if needs backfill
      const hasSubcatId = variety.plant_subcategory_id;
      const hasSubcatIds = variety.plant_subcategory_ids && variety.plant_subcategory_ids.length > 0;
      
      if (hasSubcatId && !hasSubcatIds) {
        // Backfill: set plant_subcategory_ids = [plant_subcategory_id]
        await base44.asServiceRole.entities.Variety.update(variety.id, {
          plant_subcategory_ids: [variety.plant_subcategory_id]
        });
        updatedCount++;
        
        if (updatedCount % 50 === 0) {
          console.log('[Backfill] Updated', updatedCount, 'varieties...');
        }
      } else {
        skippedCount++;
      }
    }
    
    console.log('[Backfill] Complete!');
    console.log('[Backfill] Updated:', updatedCount);
    console.log('[Backfill] Skipped:', skippedCount);
    
    return Response.json({
      success: true,
      summary: {
        totalVarieties: allVarieties.length,
        updated: updatedCount,
        skipped: skippedCount
      }
    });
    
  } catch (error) {
    console.error('[Backfill] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});