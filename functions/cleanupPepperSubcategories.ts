import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[PepperCleanup] Starting pepper subcategory cleanup');

    // Find Pepper plant type
    const plantTypes = await base44.asServiceRole.entities.PlantType.list();
    const pepperType = plantTypes.find(pt => 
      pt.common_name?.toLowerCase() === 'pepper' || 
      pt.common_name?.toLowerCase() === 'peppers'
    );

    if (!pepperType) {
      return Response.json({ error: 'Pepper plant type not found' }, { status: 404 });
    }

    console.log('[PepperCleanup] Found Pepper plant type:', pepperType.id);

    // Define canonical heat level subcategories
    const canonicalBuckets = [
      { code: 'PSC_PEPPER_SWEET', name: 'Sweet (0 SHU)', shuMin: 0, shuMax: 0 },
      { code: 'PSC_PEPPER_MILD', name: 'Mild (1-2,500 SHU)', shuMin: 1, shuMax: 2500 },
      { code: 'PSC_PEPPER_MEDIUM', name: 'Medium (2,501-30,000 SHU)', shuMin: 2501, shuMax: 30000 },
      { code: 'PSC_PEPPER_HOT', name: 'Hot (30,001-100,000 SHU)', shuMin: 30001, shuMax: 100000 },
      { code: 'PSC_PEPPER_EXTRAHOT', name: 'Extra Hot (100,001-300,000 SHU)', shuMin: 100001, shuMax: 300000 },
      { code: 'PSC_PEPPER_SUPERHOT', name: 'Superhot (300,001+ SHU)', shuMin: 300001, shuMax: 9999999 },
      { code: 'PSC_PEPPER_UNKNOWN', name: 'Unknown / Varies', shuMin: null, shuMax: null }
    ];

    // Ensure all canonical buckets exist and are active
    const existingSubcats = await base44.asServiceRole.entities.PlantSubCategory.filter({
      plant_type_id: pepperType.id
    });

    const canonicalIds = {};
    for (const bucket of canonicalBuckets) {
      let subcat = existingSubcats.find(s => s.subcat_code === bucket.code);
      
      if (!subcat) {
        // Create missing canonical bucket
        console.log('[PepperCleanup] Creating canonical bucket:', bucket.name);
        subcat = await base44.asServiceRole.entities.PlantSubCategory.create({
          subcat_code: bucket.code,
          plant_type_id: pepperType.id,
          name: bucket.name,
          dimension: 'HeatLevel',
          is_active: true,
          sort_order: canonicalBuckets.indexOf(bucket)
        });
      } else if (!subcat.is_active) {
        // Reactivate if needed
        console.log('[PepperCleanup] Reactivating canonical bucket:', bucket.name);
        await base44.asServiceRole.entities.PlantSubCategory.update(subcat.id, { is_active: true });
      }
      
      canonicalIds[bucket.code] = subcat.id;
    }

    // Deactivate non-canonical HeatLevel subcategories
    const nonCanonicalHeat = existingSubcats.filter(s => 
      s.dimension === 'HeatLevel' && 
      !canonicalBuckets.some(b => b.subcat_code === s.subcat_code) &&
      s.is_active
    );

    for (const oldSubcat of nonCanonicalHeat) {
      console.log('[PepperCleanup] Deactivating old subcategory:', oldSubcat.name);
      await base44.asServiceRole.entities.PlantSubCategory.update(oldSubcat.id, { is_active: false });
    }

    // Load all active pepper varieties
    const allVarieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: pepperType.id,
      status: 'active'
    });

    console.log('[PepperCleanup] Processing', allVarieties.length, 'pepper varieties');

    let updated = 0;
    let skipped = 0;
    const bucketCounts = {};
    const sweetWithZeroSamples = [];

    for (const v of allVarieties) {
      // Get SHU from both old and new fields
      const shuMin = v.scoville_min ?? v.heat_scoville_min ?? v.traits?.scoville_min ?? null;
      const shuMax = v.scoville_max ?? v.heat_scoville_max ?? v.traits?.scoville_max ?? null;

      // Get existing subcategory for reference
      const existingSubcat = existingSubcats.find(s => s.id === v.plant_subcategory_id);
      const existingSubcatName = existingSubcat?.name?.toLowerCase() || '';
      const varietyNameLower = (v.variety_name || '').toLowerCase();

      let targetBucketCode;
      let reason = '';

      // Determine target bucket (FIXED: Missing SHU → Unknown, not Sweet)
      if (shuMin === null && shuMax === null) {
        // NO SHU DATA - try to infer from name/existing category
        if (varietyNameLower.includes('superhot') || varietyNameLower.includes('reaper') || 
            varietyNameLower.includes('ghost') || varietyNameLower.includes('bhut') || 
            varietyNameLower.includes('7 pot') || varietyNameLower.includes('scorpion') ||
            varietyNameLower.includes('primotalii') || existingSubcatName.includes('superhot')) {
          targetBucketCode = 'PSC_PEPPER_SUPERHOT';
          reason = 'Inferred from name/category (no SHU)';
        } else if (varietyNameLower.includes('habanero') || varietyNameLower.includes('scotch bonnet') ||
                   existingSubcatName.includes('extra hot')) {
          targetBucketCode = 'PSC_PEPPER_EXTRAHOT';
          reason = 'Inferred from name/category (no SHU)';
        } else if (varietyNameLower.includes('thai') || varietyNameLower.includes('cayenne') ||
                   varietyNameLower.includes('tabasco') || existingSubcatName.includes('hot')) {
          targetBucketCode = 'PSC_PEPPER_HOT';
          reason = 'Inferred from name/category (no SHU)';
        } else if (varietyNameLower.includes('jalape') || varietyNameLower.includes('serrano') ||
                   existingSubcatName.includes('medium')) {
          targetBucketCode = 'PSC_PEPPER_MEDIUM';
          reason = 'Inferred from name/category (no SHU)';
        } else if (varietyNameLower.includes('anaheim') || varietyNameLower.includes('poblano') ||
                   varietyNameLower.includes('pasilla') || varietyNameLower.includes('wax') ||
                   varietyNameLower.includes('banana') || existingSubcatName.includes('mild')) {
          targetBucketCode = 'PSC_PEPPER_MILD';
          reason = 'Inferred from name/category (no SHU)';
        } else if (varietyNameLower.includes('bell') || varietyNameLower.includes('sweet') ||
                   varietyNameLower.includes('pimento') || existingSubcatName.includes('sweet')) {
          targetBucketCode = 'PSC_PEPPER_SWEET';
          reason = 'Inferred from name/category (no SHU)';
        } else {
          // Keep existing if already canonical, otherwise Unknown
          const isAlreadyCanonical = canonicalBuckets.some(b => 
            canonicalIds[b.code] === v.plant_subcategory_id
          );
          if (isAlreadyCanonical && v.plant_subcategory_id !== canonicalIds['PSC_PEPPER_SWEET']) {
            // Keep existing canonical assignment
            skipped++;
            continue;
          }
          targetBucketCode = 'PSC_PEPPER_UNKNOWN';
          reason = 'No SHU, no confident inference';
        }
      } else if (shuMin === 0 && shuMax === 0) {
        // Explicit 0 SHU = Sweet (confirmed)
        targetBucketCode = 'PSC_PEPPER_SWEET';
        reason = 'Explicit 0 SHU';
        if (sweetWithZeroSamples.length < 5) {
          sweetWithZeroSamples.push({ 
            name: v.variety_name, 
            reason: 'Explicit 0 SHU'
          });
        }
      } else if ((shuMin === 0 || shuMin === null) && shuMax !== null && shuMax > 0) {
        // Has some heat data, categorize by shuMax
        const shu = shuMax;
        if (shu <= 2500) {
          targetBucketCode = 'PSC_PEPPER_MILD';
          reason = `SHU max ${shu}`;
        } else if (shu <= 30000) {
          targetBucketCode = 'PSC_PEPPER_MEDIUM';
          reason = `SHU max ${shu}`;
        } else if (shu <= 100000) {
          targetBucketCode = 'PSC_PEPPER_HOT';
          reason = `SHU max ${shu}`;
        } else if (shu <= 300000) {
          targetBucketCode = 'PSC_PEPPER_EXTRAHOT';
          reason = `SHU max ${shu}`;
        } else {
          targetBucketCode = 'PSC_PEPPER_SUPERHOT';
          reason = `SHU max ${shu}`;
        }
      } else {
        // SHU > 0 - assign by heat level
        if (shuMax <= 0) {
          targetBucketCode = 'PSC_PEPPER_SWEET';
          reason = 'SHU <= 0';
        } else if (shuMax <= 2500) {
          targetBucketCode = 'PSC_PEPPER_MILD';
          reason = `SHU ${shuMax}`;
        } else if (shuMax <= 30000) {
          targetBucketCode = 'PSC_PEPPER_MEDIUM';
          reason = `SHU ${shuMax}`;
        } else if (shuMax <= 100000) {
          targetBucketCode = 'PSC_PEPPER_HOT';
          reason = `SHU ${shuMax}`;
        } else if (shuMax <= 300000) {
          targetBucketCode = 'PSC_PEPPER_EXTRAHOT';
          reason = `SHU ${shuMax}`;
        } else {
          targetBucketCode = 'PSC_PEPPER_SUPERHOT';
          reason = `SHU ${shuMax}`;
        }
      }

      const targetId = canonicalIds[targetBucketCode];
      bucketCounts[targetBucketCode] = (bucketCounts[targetBucketCode] || 0) + 1;

      // Update both subcategory fields
      let subcatIds = Array.isArray(v.plant_subcategory_ids) ? v.plant_subcategory_ids : [];
      if (!subcatIds.includes(targetId)) {
        subcatIds = [targetId, ...subcatIds.filter(id => id !== targetId)];
      }

      try {
        await base44.asServiceRole.entities.Variety.update(v.id, {
          plant_subcategory_id: targetId,
          plant_subcategory_ids: subcatIds
        });
        updated++;
      } catch (error) {
        console.error('[PepperCleanup] Error updating variety:', v.variety_name, error);
      }
    }

    // Count varieties still on inactive subcats
    const varietiesOnInactive = allVarieties.filter(v => {
      const subcat = existingSubcats.find(s => s.id === v.plant_subcategory_id);
      return subcat && !subcat.is_active;
    }).length;

    console.log('[PepperCleanup] Cleanup complete:', {
      total: allVarieties.length,
      updated,
      skipped,
      bucketCounts,
      varietiesOnInactive
    });

    return Response.json({
      success: true,
      summary: {
        canonicalSubcatsCreated: 7,
        oldSubcatsDeactivated: nonCanonicalHeat.length,
        varietiesUpdated: updated
      },
      diagnostics: {
        bucketCounts,
        sweetWith0SHU: sweetWithZeroSamples
      }
    });
  } catch (error) {
    console.error('[PepperCleanup] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});