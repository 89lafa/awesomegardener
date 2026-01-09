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

    // Identify duplicate groups
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

    console.log('[TomatoMerge] Found', groups.length, 'duplicate groups to merge');

    let mergedGroups = 0;
    let removedRecords = 0;
    const primaryIds = [];
    const conflicts = [];

    for (const group of groups) {
      // Pick primary: highest completeness, then earliest created
      const withScores = group.map(v => ({ ...v, score: calculateCompleteness(v) }));
      withScores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.created_date) - new Date(b.created_date);
      });
      
      const primary = withScores[0];
      const duplicates = withScores.slice(1);

      console.log('[TomatoMerge] Merging group:', primary.variety_name, 'primary score:', primary.score);

      // Merge data into primary
      const mergedData = { ...primary };
      
      for (const dup of duplicates) {
        // Text fields: prefer longest non-empty
        ['description', 'flavor_profile', 'uses', 'disease_resistance', 'breeder_or_origin', 
         'grower_notes', 'plant_height_typical', 'growth_habit', 'fruit_color', 
         'fruit_shape', 'fruit_size', 'seed_saving_notes', 'pollination_notes'].forEach(field => {
          if (!mergedData[field] || (dup[field] && dup[field].length > mergedData[field].length)) {
            mergedData[field] = dup[field];
          }
        });

        // Numeric fields: fill if missing, log conflicts
        ['days_to_maturity', 'spacing_recommended', 'days_to_maturity_min', 'days_to_maturity_max',
         'spacing_min', 'spacing_max', 'height_min', 'height_max'].forEach(field => {
          if (!mergedData[field] && dup[field]) {
            mergedData[field] = dup[field];
          } else if (mergedData[field] && dup[field] && mergedData[field] !== dup[field]) {
            conflicts.push({
              variety: primary.variety_name,
              field,
              primary: mergedData[field],
              duplicate: dup[field]
            });
          }
        });

        // Arrays: union + dedupe
        ['synonyms', 'images', 'sources'].forEach(field => {
          const primaryArr = Array.isArray(mergedData[field]) ? mergedData[field] : [];
          const dupArr = Array.isArray(dup[field]) ? dup[field] : [];
          mergedData[field] = [...new Set([...primaryArr, ...dupArr])];
        });

        // Objects: deep merge
        ['traits', 'extended_data'].forEach(field => {
          if (dup[field] && typeof dup[field] === 'object') {
            mergedData[field] = { ...(mergedData[field] || {}), ...dup[field] };
          }
        });
      }

      // Update primary with merged data
      await base44.asServiceRole.entities.Variety.update(primary.id, mergedData);

      // Update all references
      const dupIds = duplicates.map(d => d.id);
      
      // Update SeedLot references
      const seedLots = await base44.asServiceRole.entities.SeedLot.list();
      for (const lot of seedLots) {
        if (dupIds.includes(lot.variety_id)) {
          await base44.asServiceRole.entities.SeedLot.update(lot.id, { variety_id: primary.id });
        }
      }

      // Update PlantInstance references
      const plantInstances = await base44.asServiceRole.entities.PlantInstance.list();
      for (const inst of plantInstances) {
        if (dupIds.includes(inst.variety_id)) {
          await base44.asServiceRole.entities.PlantInstance.update(inst.id, { variety_id: primary.id });
        }
      }

      // Update PlantProfile references
      const profiles = await base44.asServiceRole.entities.PlantProfile.list();
      for (const prof of profiles) {
        if (dupIds.includes(prof.variety_id)) {
          await base44.asServiceRole.entities.PlantProfile.update(prof.id, { variety_id: primary.id });
        }
      }

      // Update VarietyChangeRequest references
      const changeRequests = await base44.asServiceRole.entities.VarietyChangeRequest.list();
      for (const req of changeRequests) {
        if (dupIds.includes(req.variety_id)) {
          await base44.asServiceRole.entities.VarietyChangeRequest.update(req.id, { variety_id: primary.id });
        }
      }

      // Mark duplicates as removed with merge info
      for (const dup of duplicates) {
        await base44.asServiceRole.entities.Variety.update(dup.id, {
          status: 'removed',
          extended_data: {
            ...(dup.extended_data || {}),
            merged_into_variety_id: primary.id,
            merged_at: new Date().toISOString()
          }
        });
      }

      mergedGroups++;
      removedRecords += duplicates.length;
      primaryIds.push(primary.id);
    }

    console.log('[TomatoMerge] Merge complete:', {
      mergedGroups,
      removedRecords,
      conflicts: conflicts.length
    });

    return Response.json({
      success: true,
      summary: {
        groups_merged: mergedGroups,
        records_removed: removedRecords,
        primary_ids: primaryIds,
        conflicts_encountered: conflicts.length,
        conflict_details: conflicts.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('[TomatoMerge] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});