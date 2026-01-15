import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { rows, batch_size = 30, offset = 0, plant_type_lookup, subcat_lookup } = await req.json();

    const batch = rows.slice(offset, offset + batch_size);
    let inserted = 0;
    let updated = 0;
    let rejected = 0;
    const skipReasons = [];

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const rowNum = offset + i + 1;

      try {
        if (!row.variety_name || !row.plant_type_id) {
          rejected++;
          skipReasons.push({ row: rowNum, reason: 'Missing variety_name or plant_type_id' });
          continue;
        }

        // Resolve plant type
        const plantType = plant_type_lookup[row.plant_type_id] || 
                         plant_type_lookup[row.plant_type_code];
        
        if (!plantType) {
          rejected++;
          skipReasons.push({ row: rowNum, reason: 'Unknown plant type' });
          continue;
        }

        const resolvedTypeId = plantType.id;
        const plantTypeName = plantType.common_name;

        // Resolve subcategory
        const primaryCode = row.plant_subcategory_code || row.subcat_code || null;
        let resolvedSubcatId = null;
        let resolvedSubcatCode = null;

        if (primaryCode && primaryCode.trim()) {
          let normalized = primaryCode.trim();
          if (!normalized.startsWith('PSC_')) normalized = 'PSC_' + normalized;
          
          const subcat = Object.values(subcat_lookup).find(sc => 
            sc.subcat_code === normalized && sc.plant_type_id === resolvedTypeId
          );

          if (subcat) {
            resolvedSubcatId = subcat.id;
            resolvedSubcatCode = subcat.subcat_code;
          }
        }

        // Check for existing
        let existing = [];
        if (row.variety_code) {
          existing = await base44.asServiceRole.entities.Variety.filter({ 
            variety_code: row.variety_code 
          });
        }

        const varietyData = {
          plant_type_id: resolvedTypeId,
          plant_type_name: plantTypeName,
          plant_subcategory_id: resolvedSubcatId,
          plant_subcategory_ids: resolvedSubcatId ? [resolvedSubcatId] : [],
          plant_subcategory_code: resolvedSubcatCode,
          plant_subcategory_codes: resolvedSubcatCode ? [resolvedSubcatCode] : [],
          variety_code: row.variety_code || null,
          variety_name: row.variety_name,
          status: 'active',
          is_custom: false
        };

        // Add optional fields
        if (row.description?.trim()) varietyData.description = row.description;
        if (row.days_to_maturity?.trim()) varietyData.days_to_maturity = parseInt(row.days_to_maturity);
        if (row.spacing_recommended?.trim()) varietyData.spacing_recommended = parseInt(row.spacing_recommended);
        if (row.flavor_profile?.trim()) varietyData.flavor_profile = row.flavor_profile;
        if (row.uses?.trim()) varietyData.uses = row.uses;
        if (row.scoville_min?.trim()) {
          varietyData.scoville_min = parseInt(row.scoville_min);
          varietyData.heat_scoville_min = parseInt(row.scoville_min);
        }
        if (row.scoville_max?.trim()) {
          varietyData.scoville_max = parseInt(row.scoville_max);
          varietyData.heat_scoville_max = parseInt(row.scoville_max);
        }

        if (existing.length > 0) {
          await base44.asServiceRole.entities.Variety.update(existing[0].id, varietyData);
          updated++;
        } else {
          await base44.asServiceRole.entities.Variety.create(varietyData);
          inserted++;
        }
      } catch (error) {
        rejected++;
        skipReasons.push({ row: rowNum, reason: error.message });
      }
    }

    const hasMore = offset + batch_size < rows.length;

    return Response.json({
      success: true,
      summary: {
        inserted,
        updated,
        rejected,
        skipReasons,
        has_more: hasMore,
        next_offset: offset + batch_size,
        total: rows.length
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});