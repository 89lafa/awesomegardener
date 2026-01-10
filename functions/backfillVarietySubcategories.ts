import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { plant_type_id } = await req.json();
    
    console.log('[Backfill] Starting subcategory backfill for plant_type_id:', plant_type_id);
    
    // Load all subcategories for lookup
    const allSubcats = plant_type_id 
      ? await base44.asServiceRole.entities.PlantSubCategory.filter({ plant_type_id })
      : await base44.asServiceRole.entities.PlantSubCategory.list();
    
    console.log('[Backfill] Loaded', allSubcats.length, 'subcategories');
    
    // Build lookup map: code -> subcat
    const subcatLookup = {};
    allSubcats.forEach(sc => {
      if (sc.subcat_code) {
        subcatLookup[sc.subcat_code] = sc;
        // Also map by plant_type + code
        subcatLookup[`${sc.plant_type_id}_${sc.subcat_code}`] = sc;
      }
    });
    
    // Load varieties that need backfill
    const filter = plant_type_id ? { plant_type_id } : {};
    const allVarieties = await base44.asServiceRole.entities.Variety.filter(filter, 'variety_name', 2000);
    
    console.log('[Backfill] Loaded', allVarieties.length, 'varieties');
    
    // Find varieties with empty subcategory_ids
    const needsBackfill = allVarieties.filter(v => {
      const hasIds = Array.isArray(v.plant_subcategory_ids) && v.plant_subcategory_ids.length > 0;
      const hasPrimary = v.plant_subcategory_id && v.plant_subcategory_id.trim() !== '';
      return !hasIds && !hasPrimary;
    });
    
    console.log('[Backfill] Found', needsBackfill.length, 'varieties needing backfill');
    
    let fixed = 0;
    let failed = 0;
    const failures = [];
    
    for (const variety of needsBackfill) {
      try {
        // Extract codes from extended_data (import metadata)
        const importCode = variety.extended_data?.import_subcat_code || null;
        const importCodes = variety.extended_data?.import_subcat_codes || null;
        
        let resolvedIds = [];
        
        // Try multi-code first
        if (importCodes) {
          const codes = importCodes.includes('|') 
            ? importCodes.split('|').map(c => c.trim()).filter(Boolean)
            : [importCodes.trim()];
          
          for (const code of codes) {
            let normalizedCode = code;
            if (!normalizedCode.startsWith('PSC_')) {
              normalizedCode = 'PSC_' + normalizedCode;
            }
            
            const subcat = subcatLookup[normalizedCode] || 
                          subcatLookup[`${variety.plant_type_id}_${normalizedCode}`];
            
            if (subcat) {
              resolvedIds.push(subcat.id);
            }
          }
        }
        // Try single code
        else if (importCode) {
          let normalizedCode = importCode;
          if (!normalizedCode.startsWith('PSC_')) {
            normalizedCode = 'PSC_' + normalizedCode;
          }
          
          const subcat = subcatLookup[normalizedCode] || 
                        subcatLookup[`${variety.plant_type_id}_${normalizedCode}`];
          
          if (subcat) {
            resolvedIds.push(subcat.id);
          }
        }
        
        // Dedupe
        resolvedIds = [...new Set(resolvedIds)];
        
        if (resolvedIds.length > 0) {
          // Update variety with resolved IDs
          await base44.asServiceRole.entities.Variety.update(variety.id, {
            plant_subcategory_ids: resolvedIds,
            plant_subcategory_id: resolvedIds[0]
          });
          fixed++;
          console.log('[Backfill] Fixed:', variety.variety_name, '→', resolvedIds.length, 'categories');
        } else {
          failed++;
          failures.push({
            id: variety.id,
            name: variety.variety_name,
            reason: 'No code found in extended_data'
          });
        }
      } catch (error) {
        failed++;
        failures.push({
          id: variety.id,
          name: variety.variety_name,
          reason: error.message
        });
        console.error('[Backfill] Error processing variety:', variety.variety_name, error);
      }
    }
    
    return Response.json({
      success: true,
      message: 'Subcategory backfill completed',
      stats: {
        total: allVarieties.length,
        needed_backfill: needsBackfill.length,
        fixed,
        failed,
        failures: failures.slice(0, 20) // First 20 failures
      }
    });
  } catch (error) {
    console.error('[Backfill] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});