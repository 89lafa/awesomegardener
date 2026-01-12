import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Load all browse categories
    const categories = await base44.asServiceRole.entities.BrowseCategory.list();
    
    // Load all plant types to validate IDs
    const plantTypes = await base44.asServiceRole.entities.PlantType.list();
    const validPlantTypeIds = new Set(plantTypes.map(pt => pt.id));
    
    console.log('[Cleanup] Found', plantTypes.length, 'valid plant type IDs');
    
    const results = [];
    let totalCleaned = 0;
    
    for (const cat of categories) {
      const originalIds = cat.plant_type_ids || [];
      
      // Filter to ONLY valid 24-character MongoDB IDs that exist in PlantType
      const cleanIds = originalIds.filter(id => {
        // Must be string
        if (!id || typeof id !== 'string') return false;
        
        // Must be 24 characters
        if (id.length !== 24) return false;
        
        // Must be valid hex
        if (!/^[a-f0-9]{24}$/.test(id)) return false;
        
        // Must exist in plant types
        return validPlantTypeIds.has(id);
      });
      
      const removed = originalIds.length - cleanIds.length;
      
      if (removed > 0) {
        // Update category with clean IDs
        await base44.asServiceRole.entities.BrowseCategory.update(cat.id, {
          plant_type_ids: cleanIds
        });
        
        totalCleaned += removed;
        
        results.push({
          category: cat.name,
          before: originalIds.length,
          after: cleanIds.length,
          removed: removed,
          invalid_ids: originalIds.filter(id => !cleanIds.includes(id))
        });
      }
    }
    
    console.log('[Cleanup] Total invalid IDs removed:', totalCleaned);
    
    return Response.json({
      success: true,
      total_cleaned: totalCleaned,
      details: results
    });
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});