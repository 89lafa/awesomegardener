import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Normalizes variety subcategory fields using the single source of truth rule:
 * 
 * EffectiveSubcategoryIds(variety):
 * 1. Start with empty list
 * 2. If plant_subcategory_ids exists and is array, append values
 * 3. If plant_subcategory_ids is string (JSON), parse and append
 * 4. If plant_subcategory_id exists, append it
 * 5. Dedupe and filter out invalid/inactive IDs
 * 6. Set plant_subcategory_ids = effective list
 * 7. Set plant_subcategory_id = effective[0] or null
 */

function getEffectiveSubcategoryIds(variety, validActiveIds) {
  let ids = [];
  
  // Handle plant_subcategory_ids (array or string)
  if (variety.plant_subcategory_ids) {
    if (Array.isArray(variety.plant_subcategory_ids)) {
      ids = ids.concat(variety.plant_subcategory_ids);
    } else if (typeof variety.plant_subcategory_ids === 'string') {
      // Might be a JSON string like '["id1","id2"]'
      try {
        const parsed = JSON.parse(variety.plant_subcategory_ids);
        if (Array.isArray(parsed)) {
          ids = ids.concat(parsed);
        }
      } catch (e) {
        // Invalid JSON, treat as empty
        console.log('[EffectiveIds] Failed to parse plant_subcategory_ids for', variety.variety_name);
      }
    }
  }
  
  // Add plant_subcategory_id if exists
  if (variety.plant_subcategory_id && variety.plant_subcategory_id.trim() !== '') {
    ids.push(variety.plant_subcategory_id.trim());
  }
  
  // Dedupe
  ids = [...new Set(ids.filter(id => id && typeof id === 'string' && id.trim() !== ''))];
  
  // Filter to only valid, active IDs
  const validIds = ids.filter(id => validActiveIds.has(id));
  
  return {
    effective: validIds,
    hadInvalid: ids.length > validIds.length,
    hadStringArray: typeof variety.plant_subcategory_ids === 'string' && variety.plant_subcategory_ids.length > 0
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { plant_type_id, dry_run } = body;

    console.log('[Normalize] Starting subcategory normalization...', { plant_type_id, dry_run });
    
    // Load all active subcategories for validation
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.list();
    console.log('[Normalize] Loaded', allSubcats.length, 'subcategories');
    
    const validActiveIds = new Set(
      allSubcats.filter(s => s.is_active === true).map(s => s.id)
    );
    
    // Load varieties (filtered by plant_type_id if provided)
    const filter = plant_type_id ? { plant_type_id, status: 'active' } : { status: 'active' };
    const allVarieties = await base44.asServiceRole.entities.Variety.filter(filter, 'variety_name', 5000);
    console.log('[Normalize] Loaded', allVarieties.length, 'varieties');
    
    let varietiesScanned = 0;
    let varietiesUpdated = 0;
    let alreadyOk = 0;
    let hadStringArrayFixed = 0;
    let hadInactiveRemoved = 0;
    let becameUncategorized = 0;
    const changes = [];
    
    // Process in batches to avoid timeouts
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < allVarieties.length; i += BATCH_SIZE) {
      const batch = allVarieties.slice(i, i + BATCH_SIZE);
      console.log(`[Normalize] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allVarieties.length / BATCH_SIZE)}`);
      
      for (const variety of batch) {
        varietiesScanned++;
        
        const { effective, hadInvalid, hadStringArray } = getEffectiveSubcategoryIds(variety, validActiveIds);
        
        const currentIds = Array.isArray(variety.plant_subcategory_ids) ? variety.plant_subcategory_ids : [];
        const currentPrimary = variety.plant_subcategory_id || null;
        const newPrimary = effective.length > 0 ? effective[0] : null;
        
        // Determine if update needed
        const needsUpdate = 
          JSON.stringify(effective.sort()) !== JSON.stringify(currentIds.sort()) ||
          newPrimary !== currentPrimary ||
          hadStringArray;
        
        if (needsUpdate) {
          if (hadStringArray) hadStringArrayFixed++;
          if (hadInvalid) hadInactiveRemoved++;
          if (effective.length === 0 && currentIds.length > 0) becameUncategorized++;
          
          changes.push({
            id: variety.id,
            name: variety.variety_name,
            before: { ids: currentIds, primary: currentPrimary },
            after: { ids: effective, primary: newPrimary },
            hadStringArray,
            hadInvalid
          });
          
          if (!dry_run) {
            try {
              await base44.asServiceRole.entities.Variety.update(variety.id, {
                plant_subcategory_ids: effective,
                plant_subcategory_id: newPrimary
              });
              varietiesUpdated++;
            } catch (error) {
              console.error('[Normalize] Error updating variety:', variety.variety_name, error);
            }
          }
        } else {
          alreadyOk++;
        }
      }
      
      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < allVarieties.length && !dry_run) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const summary = {
      varieties_scanned: varietiesScanned,
      varieties_updated: dry_run ? 0 : varietiesUpdated,
      would_update: dry_run ? changes.length : varietiesUpdated,
      already_ok: alreadyOk,
      had_string_array_fixed: hadStringArrayFixed,
      had_inactive_removed: hadInactiveRemoved,
      became_uncategorized: becameUncategorized,
      sample_changes: changes.slice(0, 20)
    };
    
    console.log('[Normalize] Complete:', summary);
    
    return Response.json({
      success: true,
      message: dry_run ? 'Dry run completed' : 'Subcategory normalization completed',
      summary,
      dry_run
    });
  } catch (error) {
    console.error('[Normalize] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});