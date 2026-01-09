import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { plant_type_id, matching_mode } = await req.json();
    
    console.log('[Merge] Starting merge process...');
    
    // Load varieties
    const query = plant_type_id ? { plant_type_id } : {};
    const allVarieties = await base44.asServiceRole.entities.Variety.filter(query, 'variety_name', 10000);
    
    // Helper to normalize variety name
    const normalizeVarietyName = (name) => {
      if (!name) return '';
      return name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/\.$/, '');
    };
    
    // Group by matching criteria
    const groups = {};
    
    for (const variety of allVarieties) {
      let key;
      
      if (matching_mode === 'code_first' && variety.variety_code) {
        key = `code:${variety.variety_code}`;
      } else {
        const normalized = normalizeVarietyName(variety.variety_name);
        key = `name:${variety.plant_type_id}:${normalized}`;
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(variety);
    }
    
    // Process duplicate groups
    let groupsMerged = 0;
    let recordsMerged = 0;
    let referencesUpdated = 0;
    
    for (const [key, varieties] of Object.entries(groups)) {
      if (varieties.length > 1) {
        // Determine canonical
        const sorted = [...varieties].sort((a, b) => {
          if (a.variety_code && !b.variety_code) return -1;
          if (!a.variety_code && b.variety_code) return 1;
          
          const countFields = (v) => Object.keys(v).filter(k => v[k] !== null && v[k] !== undefined && v[k] !== '').length;
          const aCount = countFields(a);
          const bCount = countFields(b);
          if (aCount !== bCount) return bCount - aCount;
          
          return new Date(a.created_date) - new Date(b.created_date);
        });
        
        const canonical = sorted[0];
        const duplicates = sorted.slice(1);
        
        console.log('[Merge] Processing group:', canonical.variety_name, 'with', duplicates.length, 'duplicates');
        
        // Merge data from all records
        const mergedData = { ...canonical };
        
        // Merge arrays (union + dedupe)
        const allImages = new Set(canonical.images || []);
        const allSynonyms = new Set(canonical.synonyms || []);
        const allSubcatIds = new Set(canonical.plant_subcategory_ids || (canonical.plant_subcategory_id ? [canonical.plant_subcategory_id] : []));
        const allSources = new Set(canonical.sources || []);
        
        for (const dup of duplicates) {
          (dup.images || []).forEach(img => allImages.add(img));
          (dup.synonyms || []).forEach(syn => allSynonyms.add(syn));
          (dup.plant_subcategory_ids || (dup.plant_subcategory_id ? [dup.plant_subcategory_id] : [])).forEach(id => allSubcatIds.add(id));
          (dup.sources || []).forEach(src => allSources.add(src));
          
          // Merge scalar fields (only if canonical is empty)
          for (const [key, val] of Object.entries(dup)) {
            if (val !== null && val !== undefined && val !== '' && 
                (mergedData[key] === null || mergedData[key] === undefined || mergedData[key] === '')) {
              mergedData[key] = val;
            }
          }
          
          // Merge objects (traits, extended_data)
          if (dup.traits) {
            mergedData.traits = { ...(dup.traits || {}), ...(mergedData.traits || {}) };
          }
          if (dup.extended_data) {
            mergedData.extended_data = { ...(dup.extended_data || {}), ...(mergedData.extended_data || {}) };
          }
        }
        
        mergedData.images = Array.from(allImages);
        mergedData.synonyms = Array.from(allSynonyms);
        mergedData.plant_subcategory_ids = Array.from(allSubcatIds);
        mergedData.sources = Array.from(allSources);
        mergedData.plant_subcategory_id = mergedData.plant_subcategory_ids[0] || canonical.plant_subcategory_id;
        
        // Update canonical with merged data
        await base44.asServiceRole.entities.Variety.update(canonical.id, mergedData);
        
        // Mark duplicates as removed and store canonical reference
        for (const dup of duplicates) {
          const extData = dup.extended_data || {};
          extData.merged_into_variety_id = canonical.id;
          
          await base44.asServiceRole.entities.Variety.update(dup.id, {
            status: 'removed',
            extended_data: extData
          });
          recordsMerged++;
        }
        
        // Update references
        const duplicateIds = duplicates.map(d => d.id);
        
        // Update SeedLot references
        const seedLots = await base44.asServiceRole.entities.SeedLot.list('', 10000);
        for (const lot of seedLots) {
          // Check PlantProfile first
          if (lot.plant_profile_id) {
            const profiles = await base44.asServiceRole.entities.PlantProfile.filter({ id: lot.plant_profile_id });
            if (profiles.length > 0 && duplicateIds.includes(profiles[0].variety_id)) {
              // Update PlantProfile to point to canonical
              await base44.asServiceRole.entities.PlantProfile.update(profiles[0].id, {
                variety_id: canonical.id
              });
              referencesUpdated++;
            }
          }
        }
        
        // Update PlantInstance references
        const plantInstances = await base44.asServiceRole.entities.PlantInstance.list('', 10000);
        for (const instance of plantInstances) {
          if (duplicateIds.includes(instance.variety_id)) {
            await base44.asServiceRole.entities.PlantInstance.update(instance.id, {
              variety_id: canonical.id
            });
            referencesUpdated++;
          }
        }
        
        // Update GrowList item references
        const growLists = await base44.asServiceRole.entities.GrowList.list('', 1000);
        for (const list of growLists) {
          if (list.items && Array.isArray(list.items)) {
            let updated = false;
            const newItems = list.items.map(item => {
              if (duplicateIds.includes(item.variety_id)) {
                updated = true;
                return { ...item, variety_id: canonical.id };
              }
              return item;
            });
            if (updated) {
              await base44.asServiceRole.entities.GrowList.update(list.id, { items: newItems });
              referencesUpdated++;
            }
          }
        }
        
        groupsMerged++;
      }
    }
    
    console.log('[Merge] Complete! Merged', groupsMerged, 'groups,', recordsMerged, 'records');
    
    return Response.json({
      success: true,
      summary: {
        groupsMerged,
        recordsMerged,
        referencesUpdated,
        remainingDuplicates: 0
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Merge] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});