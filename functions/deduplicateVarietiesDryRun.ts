import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { plant_type_id, execute_merge = false } = await req.json();

    if (!plant_type_id) {
      return Response.json({ error: 'plant_type_id required' }, { status: 400 });
    }

    console.log(`[GenericDedup] ${execute_merge ? 'MERGE' : 'DRY RUN'} for plant_type_id:`, plant_type_id);

    // Load varieties for this plant type
    const varieties = await base44.asServiceRole.entities.Variety.filter({ 
      plant_type_id,
      status: 'active'
    });

    console.log('[GenericDedup] Loaded varieties:', varieties.length);

    // Normalize variety name
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

    // Field completeness score
    const getCompletenessScore = (v) => {
      const fields = [
        'description', 'days_to_maturity', 'spacing_recommended', 'plant_height_typical',
        'sun_requirement', 'water_requirement', 'growth_habit', 'grower_notes',
        'images', 'synonyms', 'sources', 'species', 'seed_line_type'
      ];
      let filled = 0;
      for (const field of fields) {
        if (v[field]) {
          if (Array.isArray(v[field]) && v[field].length > 0) filled++;
          else if (typeof v[field] === 'string' && v[field].trim()) filled++;
          else if (typeof v[field] === 'number') filled++;
        }
      }
      return filled;
    };

    // Group by variety_code (primary) and normalized name (fallback)
    const groups = {};

    for (const v of varieties) {
      let key;
      if (v.variety_code) {
        key = `code_${v.variety_code}`;
      } else {
        key = `name_${normalizeVarietyName(v.variety_name)}`;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    }

    // Filter to only duplicate groups
    const duplicateGroups = Object.entries(groups)
      .filter(([_, vars]) => vars.length > 1)
      .map(([key, vars]) => {
        // Pick canonical = most complete, then oldest
        const sorted = vars.sort((a, b) => {
          const scoreA = getCompletenessScore(a);
          const scoreB = getCompletenessScore(b);
          if (scoreB !== scoreA) return scoreB - scoreA;
          return new Date(a.created_date) - new Date(b.created_date);
        });

        const canonical = sorted[0];
        const duplicates = sorted.slice(1);

        return {
          key,
          canonical,
          duplicates,
          canonical_name: canonical.variety_name,
          duplicate_count: duplicates.length,
          completeness_score: getCompletenessScore(canonical)
        };
      });

    console.log('[GenericDedup] Duplicate groups found:', duplicateGroups.length);

    if (!execute_merge) {
      // DRY RUN
      return Response.json({
        success: true,
        dry_run: true,
        summary: {
          duplicate_groups: duplicateGroups.length,
          records_to_merge: duplicateGroups.reduce((sum, g) => sum + g.duplicate_count, 0)
        },
        groups: duplicateGroups.map(g => ({
          canonical_name: g.canonical_name,
          duplicates: g.duplicate_count,
          completeness_score: Math.round((g.completeness_score / 13) * 100)
        }))
      });
    }

    // EXECUTE MERGE
    let groupsMerged = 0;
    let recordsRemoved = 0;
    let referencesUpdated = 0;

    for (const group of duplicateGroups) {
      const { canonical, duplicates } = group;

      console.log(`[GenericDedup] Merging group: ${canonical.variety_name} (${duplicates.length} duplicates)`);

      // Merge data into canonical
      const mergedData = { ...canonical };

      for (const dup of duplicates) {
        // Merge scalar fields (fill if empty)
        for (const field of ['description', 'grower_notes', 'sun_requirement', 'water_requirement', 'growth_habit', 'species', 'seed_line_type', 'season_timing']) {
          if (!mergedData[field] && dup[field]) {
            mergedData[field] = dup[field];
          }
        }

        // Merge numeric fields (prefer filled)
        for (const field of ['days_to_maturity', 'days_to_maturity_min', 'days_to_maturity_max', 'spacing_recommended', 'scoville_min', 'scoville_max']) {
          if (!mergedData[field] && dup[field]) {
            mergedData[field] = dup[field];
          }
        }

        // Merge arrays (union)
        for (const field of ['synonyms', 'images', 'sources']) {
          if (Array.isArray(dup[field])) {
            const existing = Array.isArray(mergedData[field]) ? mergedData[field] : [];
            mergedData[field] = [...new Set([...existing, ...dup[field]])];
          }
        }

        // Merge subcategories (union)
        let canonicalSubcatIds = mergedData.plant_subcategory_ids || [];
        if (mergedData.plant_subcategory_id && !canonicalSubcatIds.includes(mergedData.plant_subcategory_id)) {
          canonicalSubcatIds = [mergedData.plant_subcategory_id, ...canonicalSubcatIds];
        }

        const dupSubcatIds = dup.plant_subcategory_ids || [];
        if (dup.plant_subcategory_id && !dupSubcatIds.includes(dup.plant_subcategory_id)) {
          dupSubcatIds.unshift(dup.plant_subcategory_id);
        }

        mergedData.plant_subcategory_ids = [...new Set([...canonicalSubcatIds, ...dupSubcatIds])];
        if (mergedData.plant_subcategory_ids.length > 0 && !mergedData.plant_subcategory_id) {
          mergedData.plant_subcategory_id = mergedData.plant_subcategory_ids[0];
        }

        // Merge extended_data/traits (deep merge, canonical wins)
        if (dup.extended_data && typeof dup.extended_data === 'object') {
          mergedData.extended_data = { ...dup.extended_data, ...mergedData.extended_data };
        }
        if (dup.traits && typeof dup.traits === 'object') {
          mergedData.traits = { ...dup.traits, ...mergedData.traits };
        }
      }

      // Update canonical
      await base44.asServiceRole.entities.Variety.update(canonical.id, {
        ...mergedData,
        plant_subcategory_id: mergedData.plant_subcategory_id,
        plant_subcategory_ids: mergedData.plant_subcategory_ids
      });

      // Update references to point to canonical
      const dupIds = duplicates.map(d => d.id);

      // SeedLot
      const seedLots = await base44.asServiceRole.entities.SeedLot.list();
      for (const lot of seedLots) {
        // Check plant_profile_id -> get PlantProfile -> check variety_id
        if (lot.plant_profile_id) {
          const profiles = await base44.asServiceRole.entities.PlantProfile.filter({ id: lot.plant_profile_id });
          if (profiles.length > 0 && dupIds.includes(profiles[0].variety_id)) {
            await base44.asServiceRole.entities.PlantProfile.update(profiles[0].id, {
              variety_id: canonical.id
            });
            referencesUpdated++;
          }
        }
      }

      // CropPlan
      const cropPlans = await base44.asServiceRole.entities.CropPlan.list();
      for (const plan of cropPlans) {
        if (dupIds.includes(plan.variety_id)) {
          await base44.asServiceRole.entities.CropPlan.update(plan.id, {
            variety_id: canonical.id
          });
          referencesUpdated++;
        }
      }

      // PlantInstance
      const plantInstances = await base44.asServiceRole.entities.PlantInstance.list();
      for (const instance of plantInstances) {
        if (dupIds.includes(instance.variety_id)) {
          await base44.asServiceRole.entities.PlantInstance.update(instance.id, {
            variety_id: canonical.id
          });
          referencesUpdated++;
        }
      }

      // Mark duplicates as removed
      for (const dup of duplicates) {
        await base44.asServiceRole.entities.Variety.update(dup.id, {
          status: 'removed',
          extended_data: {
            ...(dup.extended_data || {}),
            merged_into_variety_id: canonical.id,
            merged_at: new Date().toISOString()
          }
        });
        recordsRemoved++;
      }

      groupsMerged++;
    }

    console.log('[GenericDedup] Merge complete:', { groupsMerged, recordsRemoved, referencesUpdated });

    return Response.json({
      success: true,
      dry_run: false,
      summary: {
        duplicate_groups: duplicateGroups.length,
        records_merged: recordsRemoved,
        references_updated: referencesUpdated
      }
    });
  } catch (error) {
    console.error('[GenericDedup] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});