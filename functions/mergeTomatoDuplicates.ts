import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const plantTypes = await base44.asServiceRole.entities.PlantType.list();
    const tomatoType = plantTypes.find(pt => 
      pt.common_name?.toLowerCase() === 'tomato' || 
      pt.common_name?.toLowerCase() === 'tomatoes'
    );

    if (!tomatoType) {
      return Response.json({ error: 'Tomato plant type not found' }, { status: 404 });
    }

    const varieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: tomatoType.id,
      status: 'active'
    });

    console.log('[TomatoMerge] Loaded', varieties.length, 'tomatoes');

    const normalizeVarietyName = (name) => {
      if (!name) return '';
      return name
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\(organic\)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const calculateCompleteness = (v) => {
      const fields = [
        'description', 'days_to_maturity', 'spacing_recommended', 'plant_height_typical',
        'sun_requirement', 'water_requirement', 'growth_habit', 'flavor_profile',
        'uses', 'fruit_color', 'fruit_shape', 'fruit_size', 'disease_resistance',
        'breeder_or_origin', 'grower_notes'
      ];
      let score = 0;
      fields.forEach(f => {
        if (v[f] !== null && v[f] !== undefined && v[f] !== '') score++;
      });
      if (v.images && v.images.length > 0) score += v.images.length;
      if (v.synonyms && v.synonyms.length > 0) score += v.synonyms.length;
      return score;
    };

    // Group duplicates - process in smaller batches to avoid timeout
    const groups = [];
    const processed = new Set();

    // Group by variety_code
    for (const v of varieties) {
      if (processed.has(v.id) || !v.variety_code) continue;
      
      const codeGroup = varieties.filter(other => 
        other.variety_code === v.variety_code && 
        other.plant_type_id === v.plant_type_id
      );
      
      if (codeGroup.length > 1) {
        groups.push(codeGroup);
        codeGroup.forEach(x => processed.add(x.id));
      }
    }

    // Group by normalized name
    for (const v of varieties) {
      if (processed.has(v.id)) continue;
      
      const normalized = normalizeVarietyName(v.variety_name);
      if (!normalized) continue;
      
      const nameGroup = varieties.filter(other => 
        !processed.has(other.id) &&
        normalizeVarietyName(other.variety_name) === normalized &&
        other.plant_type_id === v.plant_type_id
      );
      
      if (nameGroup.length > 1) {
        groups.push(nameGroup);
        nameGroup.forEach(x => processed.add(x.id));
      }
    }

    console.log('[TomatoMerge] Found', groups.length, 'groups, processing first 20...');

    // PROCESS ONLY FIRST 20 groups to avoid timeout
    const groupsToProcess = groups.slice(0, 20);
    let mergedGroups = 0;
    let removedRecords = 0;

    for (const group of groupsToProcess) {
      try {
        const withScores = group.map(v => ({ ...v, score: calculateCompleteness(v) }));
        withScores.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(a.created_date) - new Date(b.created_date);
        });
        
        const primary = withScores[0];
        const duplicates = withScores.slice(1);

        // Merge data
        const mergedData = { ...primary };
        
        for (const dup of duplicates) {
          // Text fields: prefer longest
          ['description', 'flavor_profile', 'uses', 'disease_resistance', 
           'grower_notes', 'plant_height_typical', 'growth_habit'].forEach(field => {
            if (!mergedData[field] || (dup[field] && dup[field].length > mergedData[field].length)) {
              mergedData[field] = dup[field];
            }
          });

          // Numeric: fill missing
          ['days_to_maturity', 'spacing_recommended'].forEach(field => {
            if (!mergedData[field] && dup[field]) {
              mergedData[field] = dup[field];
            }
          });

          // Arrays: union
          ['synonyms', 'images', 'sources'].forEach(field => {
            const primaryArr = Array.isArray(mergedData[field]) ? mergedData[field] : [];
            const dupArr = Array.isArray(dup[field]) ? dup[field] : [];
            mergedData[field] = [...new Set([...primaryArr, ...dupArr])];
          });

          // Objects: merge
          if (dup.traits) {
            mergedData.traits = { ...(mergedData.traits || {}), ...dup.traits };
          }
        }

        // Update primary
        await base44.asServiceRole.entities.Variety.update(primary.id, mergedData);

        // Update references - do minimal batches
        const dupIds = duplicates.map(d => d.id);
        
        for (const dupId of dupIds) {
          // Update SeedLots
          const seedLots = await base44.asServiceRole.entities.SeedLot.filter({ variety_id: dupId });
          for (const lot of seedLots) {
            await base44.asServiceRole.entities.SeedLot.update(lot.id, { variety_id: primary.id });
          }

          // Update PlantInstances
          const instances = await base44.asServiceRole.entities.PlantInstance.filter({ variety_id: dupId });
          for (const inst of instances) {
            await base44.asServiceRole.entities.PlantInstance.update(inst.id, { variety_id: primary.id });
          }

          // Mark as removed
          await base44.asServiceRole.entities.Variety.update(dupId, {
            status: 'removed',
            extended_data: {
              merged_into_variety_id: primary.id,
              merged_at: new Date().toISOString()
            }
          });
        }

        mergedGroups++;
        removedRecords += duplicates.length;
      } catch (error) {
        console.error('[TomatoMerge] Error processing group:', error);
      }
    }

    const remaining = groups.length - groupsToProcess.length;

    return Response.json({
      success: true,
      summary: {
        groups_merged: mergedGroups,
        records_removed: removedRecords,
        groups_remaining: remaining,
        message: remaining > 0 ? `Processed ${mergedGroups} of ${groups.length} groups. Run again to continue.` : 'All duplicates merged!'
      }
    });
  } catch (error) {
    console.error('[TomatoMerge] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});