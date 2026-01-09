import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { plant_type_id, dry_run = true, max_groups = 20 } = await req.json();

    if (!plant_type_id) {
      return Response.json({ error: 'plant_type_id required' }, { status: 400 });
    }

    console.log('[GenericDedup] Starting:', { plant_type_id, dry_run, max_groups });

    // Helper: normalize name
    const normalize = (name) => {
      if (!name) return '';
      return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/['']/g, "'").replace(/[""]/g, '"').replace(/\.$/, '');
    };

    // Helper: field completeness score
    const scoreCompleteness = (variety) => {
      let score = 0;
      const fields = [
        'description', 'days_to_maturity', 'spacing_recommended', 'sun_requirement', 'water_requirement',
        'growth_habit', 'species', 'seed_line_type', 'flavor_profile', 'uses', 'fruit_color',
        'fruit_shape', 'fruit_size', 'breeder_or_origin', 'source_attribution', 'grower_notes'
      ];
      for (const field of fields) {
        if (variety[field] && variety[field] !== '' && variety[field] !== null) score++;
      }
      if (variety.images?.length > 0) score += 2;
      if (variety.sources?.length > 0) score += 2;
      if (variety.synonyms?.length > 0) score++;
      return score;
    };

    // Load varieties for this plant type
    const varieties = await base44.asServiceRole.entities.Variety.filter({ 
      plant_type_id,
      status: 'active'
    });

    console.log('[GenericDedup] Loaded varieties:', varieties.length);

    // Group by variety_code (primary), then by normalized name (fallback)
    const groups = {};

    for (const v of varieties) {
      let key;
      if (v.variety_code) {
        key = `code:${v.variety_code}`;
      } else {
        key = `name:${normalize(v.variety_name)}`;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    }

    const duplicateGroups = Object.values(groups).filter(g => g.length > 1);
    console.log('[GenericDedup] Found duplicate groups:', duplicateGroups.length);

    if (dry_run) {
      // Dry run - return preview
      return Response.json({
        success: true,
        dry_run: true,
        summary: {
          total_varieties: varieties.length,
          duplicate_groups: duplicateGroups.length,
          total_duplicates: duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0)
        },
        groups: duplicateGroups.slice(0, max_groups).map(group => {
          const scored = group.map(v => ({ ...v, _score: scoreCompleteness(v) }));
          scored.sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            return new Date(a.created_date) - new Date(b.created_date);
          });
          
          const canonical = scored[0];
          const duplicates = scored.slice(1);

          return {
            canonical: {
              id: canonical.id,
              name: canonical.variety_name,
              code: canonical.variety_code,
              score: canonical._score,
              created: canonical.created_date
            },
            duplicates: duplicates.map(d => ({
              id: d.id,
              name: d.variety_name,
              code: d.variety_code,
              score: d._score,
              created: d.created_date
            })),
            count: group.length
          };
        })
      });
    }

    // Execute merge
    console.log('[GenericDedup] Executing merge for', Math.min(max_groups, duplicateGroups.length), 'groups...');

    let groupsMerged = 0;
    let recordsRemoved = 0;
    const groupsToProcess = duplicateGroups.slice(0, max_groups);

    for (const group of groupsToProcess) {
      const scored = group.map(v => ({ ...v, _score: scoreCompleteness(v) }));
      scored.sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return new Date(a.created_date) - new Date(b.created_date);
      });

      const canonical = scored[0];
      const duplicates = scored.slice(1);

      console.log('[GenericDedup] Merging group:', canonical.variety_name, '- keeping', canonical.id);

      // Build merged data
      const mergedData = { ...canonical };

      for (const dup of duplicates) {
        // Scalar fields - fill missing
        for (const field of ['description', 'days_to_maturity', 'spacing_recommended', 'sun_requirement', 'water_requirement', 'growth_habit', 'species', 'seed_line_type', 'flavor_profile', 'uses', 'fruit_color', 'fruit_shape', 'fruit_size', 'breeder_or_origin', 'source_attribution', 'grower_notes']) {
          if (!mergedData[field] && dup[field]) {
            mergedData[field] = dup[field];
          }
        }

        // Arrays - union
        if (dup.synonyms?.length > 0) {
          mergedData.synonyms = [...new Set([...(mergedData.synonyms || []), ...dup.synonyms])];
        }
        if (dup.images?.length > 0) {
          mergedData.images = [...new Set([...(mergedData.images || []), ...dup.images])];
        }
        if (dup.sources?.length > 0) {
          mergedData.sources = [...new Set([...(mergedData.sources || []), ...dup.sources])];
        }

        // Subcategories - union
        let subcatIds = new Set();
        if (mergedData.plant_subcategory_id) subcatIds.add(mergedData.plant_subcategory_id);
        if (Array.isArray(mergedData.plant_subcategory_ids)) {
          mergedData.plant_subcategory_ids.forEach(id => subcatIds.add(id));
        }
        if (dup.plant_subcategory_id) subcatIds.add(dup.plant_subcategory_id);
        if (Array.isArray(dup.plant_subcategory_ids)) {
          dup.plant_subcategory_ids.forEach(id => subcatIds.add(id));
        }

        const allSubcatIds = Array.from(subcatIds).filter(id => id);
        mergedData.plant_subcategory_ids = allSubcatIds;
        mergedData.plant_subcategory_id = allSubcatIds.length > 0 ? allSubcatIds[0] : null;
      }

      // Update canonical with merged data
      await base44.asServiceRole.entities.Variety.update(canonical.id, mergedData);

      // Update references and mark duplicates as removed
      for (const dup of duplicates) {
        // Update all references
        const [seedLots, cropPlans, plantInstances] = await Promise.all([
          base44.asServiceRole.entities.SeedLot.filter({ variety_id: dup.id }),
          base44.asServiceRole.entities.CropPlan.filter({ variety_id: dup.id }),
          base44.asServiceRole.entities.PlantInstance.filter({ variety_id: dup.id })
        ]);

        for (const lot of seedLots) {
          await base44.asServiceRole.entities.SeedLot.update(lot.id, { variety_id: canonical.id });
        }
        for (const plan of cropPlans) {
          await base44.asServiceRole.entities.CropPlan.update(plan.id, { variety_id: canonical.id });
        }
        for (const instance of plantInstances) {
          await base44.asServiceRole.entities.PlantInstance.update(instance.id, { variety_id: canonical.id });
        }

        // Mark duplicate as removed
        await base44.asServiceRole.entities.Variety.update(dup.id, {
          status: 'removed',
          extended_data: {
            ...dup.extended_data,
            merged_into_variety_id: canonical.id,
            merged_at: new Date().toISOString()
          }
        });

        recordsRemoved++;
      }

      groupsMerged++;
    }

    const groupsRemaining = duplicateGroups.length - groupsToProcess.length;

    return Response.json({
      success: true,
      summary: {
        groups_merged: groupsMerged,
        records_removed: recordsRemoved,
        groups_remaining: groupsRemaining,
        message: groupsRemaining > 0 
          ? `Merged ${groupsMerged} groups. ${groupsRemaining} groups remaining.`
          : `All duplicate groups merged successfully.`
      }
    });
  } catch (error) {
    console.error('[GenericDedup] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});