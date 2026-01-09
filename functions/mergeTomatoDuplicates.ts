import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[Tomato Merge] Starting merge process...');
    
    // Find Tomato PlantType
    const tomatoTypes = await base44.asServiceRole.entities.PlantType.filter({ 
      common_name: 'Tomato' 
    });
    
    if (tomatoTypes.length === 0) {
      return Response.json({ error: 'Tomato plant type not found' }, { status: 404 });
    }
    
    const tomatoTypeId = tomatoTypes[0].id;
    
    // Load all active Tomato varieties
    const allTomatoes = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: tomatoTypeId,
      status: 'active'
    }, 'variety_name', 10000);
    
    console.log('[Tomato Merge] Found', allTomatoes.length, 'active Tomato varieties');
    
    // Normalize variety name
    const normalizeVarietyName = (name) => {
      if (!name) return '';
      return name
        .trim()
        .toLowerCase()
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/\(organic\)/gi, '')
        .replace(/\(heirloom\)/gi, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    // Group duplicates
    const groups = {};
    
    for (const v of allTomatoes) {
      let key = null;
      
      // Priority 1: variety_code
      if (v.variety_code) {
        key = `code:${v.variety_code}`;
      } else {
        // Priority 2: normalized name
        const normalized = normalizeVarietyName(v.variety_name);
        if (normalized) {
          key = `name:${normalized}`;
        }
      }
      
      if (key) {
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(v);
      }
    }
    
    // Filter to only groups with duplicates
    const duplicateGroups = Object.entries(groups).filter(([_, varieties]) => varieties.length > 1);
    
    console.log('[Tomato Merge] Found', duplicateGroups.length, 'groups with duplicates');
    
    let mergedGroups = 0;
    let varietiesRemoved = 0;
    const mergeLog = [];
    
    for (const [key, varieties] of duplicateGroups) {
      try {
        // Calculate completeness for each
        const scored = varieties.map(v => ({
          variety: v,
          score: calculateCompleteness(v),
          age: new Date(v.created_date).getTime()
        }));
        
        // Sort by score (desc), then by age (oldest first)
        scored.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.age - b.age;
        });
        
        const primary = scored[0].variety;
        const duplicates = scored.slice(1).map(s => s.variety);
        
        console.log('[Tomato Merge] Merging', duplicates.length, 'duplicates into primary:', primary.variety_name, '(id:', primary.id, ')');
        
        // Build merged data
        const mergedData = { ...primary };
        
        for (const dup of duplicates) {
          // Merge text fields - prefer longest/most detailed
          const textFields = ['description', 'flavor_profile', 'uses', 'disease_resistance', 'grower_notes', 'seed_saving_notes'];
          for (const field of textFields) {
            if (!mergedData[field] || (dup[field] && dup[field].length > mergedData[field].length)) {
              mergedData[field] = dup[field];
            }
          }
          
          // Merge numeric fields - fill missing
          const numFields = ['days_to_maturity', 'spacing_recommended', 'height_min', 'height_max', 'scoville_min', 'scoville_max'];
          for (const field of numFields) {
            if (mergedData[field] == null && dup[field] != null) {
              mergedData[field] = dup[field];
            }
          }
          
          // Merge arrays - union + dedupe
          if (dup.synonyms?.length > 0) {
            mergedData.synonyms = [...new Set([...(mergedData.synonyms || []), ...dup.synonyms])];
          }
          if (dup.images?.length > 0) {
            mergedData.images = [...new Set([...(mergedData.images || []), ...dup.images])];
          }
          if (dup.sources?.length > 0) {
            mergedData.sources = [...new Set([...(mergedData.sources || []), ...dup.sources])];
          }
          
          // Merge traits and extended_data
          if (dup.traits) {
            mergedData.traits = { ...mergedData.traits, ...dup.traits };
          }
          if (dup.extended_data) {
            mergedData.extended_data = { ...mergedData.extended_data, ...dup.extended_data };
          }
        }
        
        // Update primary with merged data
        await base44.asServiceRole.entities.Variety.update(primary.id, mergedData);
        
        // Update references to point to primary
        for (const dup of duplicates) {
          // Update SeedLot references
          const seedLots = await base44.asServiceRole.entities.SeedLot.filter({ variety_id: dup.id });
          for (const lot of seedLots) {
            await base44.asServiceRole.entities.SeedLot.update(lot.id, { variety_id: primary.id });
          }
          
          // Update PlantInstance references
          const plantInstances = await base44.asServiceRole.entities.PlantInstance.filter({ variety_id: dup.id });
          for (const instance of plantInstances) {
            await base44.asServiceRole.entities.PlantInstance.update(instance.id, { variety_id: primary.id });
          }
          
          // Update VarietyChangeRequest references
          const changeReqs = await base44.asServiceRole.entities.VarietyChangeRequest.filter({ variety_id: dup.id });
          for (const req of changeReqs) {
            await base44.asServiceRole.entities.VarietyChangeRequest.update(req.id, { variety_id: primary.id });
          }
          
          // Mark as removed with merge info
          await base44.asServiceRole.entities.Variety.update(dup.id, {
            status: 'removed',
            extended_data: {
              ...(dup.extended_data || {}),
              merged_into_variety_id: primary.id,
              merged_at: new Date().toISOString(),
              merged_by: user.email
            }
          });
          
          varietiesRemoved++;
        }
        
        mergedGroups++;
        mergeLog.push({
          primaryId: primary.id,
          primaryName: primary.variety_name,
          mergedCount: duplicates.length,
          mergedIds: duplicates.map(d => d.id)
        });
        
        if (mergedGroups % 10 === 0) {
          console.log('[Tomato Merge] Merged', mergedGroups, '/', duplicateGroups.length, 'groups...');
        }
      } catch (error) {
        console.error('[Tomato Merge] Error merging group', key, ':', error);
      }
    }
    
    console.log('[Tomato Merge] Completed!', mergedGroups, 'groups merged,', varietiesRemoved, 'varieties removed');
    
    return Response.json({
      success: true,
      summary: {
        groupsMerged: mergedGroups,
        varietiesRemoved,
        primaryVarietiesPreserved: mergedGroups
      },
      mergeLog: mergeLog.slice(0, 50) // First 50 for review
    });
    
  } catch (error) {
    console.error('[Tomato Merge] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});

function calculateCompleteness(variety) {
  const fields = [
    'description', 'days_to_maturity', 'spacing_recommended', 'plant_height_typical',
    'sun_requirement', 'water_requirement', 'growth_habit', 'seed_line_type',
    'flavor_profile', 'uses', 'fruit_color', 'fruit_shape', 'fruit_size',
    'disease_resistance', 'breeder_or_origin', 'grower_notes'
  ];
  
  let score = 0;
  for (const field of fields) {
    if (variety[field] != null && variety[field] !== '') {
      score++;
    }
  }
  
  // Bonus for arrays
  if (variety.synonyms?.length > 0) score++;
  if (variety.images?.length > 0) score += 2;
  if (variety.sources?.length > 0) score++;
  
  return score;
}