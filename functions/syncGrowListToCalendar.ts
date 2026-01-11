import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { grow_list_id, garden_season_id, auto_generate_tasks } = body;

    if (!grow_list_id || !garden_season_id) {
      return Response.json({ error: 'Missing grow_list_id or garden_season_id' }, { status: 400 });
    }

    console.log('[SyncGrowList] Loading grow list:', grow_list_id);

    const growList = await base44.entities.GrowList.filter({ id: grow_list_id });
    if (growList.length === 0) {
      return Response.json({ error: 'Grow list not found' }, { status: 404 });
    }

    const list = growList[0];
    const items = list.items || [];

    console.log('[SyncGrowList] Found', items.length, 'items in grow list');

    // Load existing CropPlans for this season to avoid duplicates
    const existingPlans = await base44.entities.CropPlan.filter({ 
      garden_season_id,
      grow_list_id 
    });

    console.log('[SyncGrowList] Found', existingPlans.length, 'existing plans from this grow list');

    // Load season data for frost dates
    const season = await base44.entities.GardenSeason.filter({ id: garden_season_id });
    if (season.length === 0) {
      return Response.json({ error: 'Season not found' }, { status: 404 });
    }

    const seasonData = season[0];
    const lastFrostDate = seasonData.last_frost_date ? new Date(seasonData.last_frost_date) : null;

    // Load PlantTypes and Varieties for default timing
    const plantTypes = await base44.asServiceRole.entities.PlantType.list();
    const varieties = await base44.asServiceRole.entities.Variety.list();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex];

      // Find matching plant type
      const plantType = plantTypes.find(pt => 
        pt.common_name?.toLowerCase() === item.plant_type_name?.toLowerCase() ||
        pt.id === item.plant_type_id
      );

      if (!plantType) {
        console.log('[SyncGrowList] Skipping item - plant type not found:', item.plant_type_name);
        skipped++;
        continue;
      }

      // Find matching variety if specified
      let variety = null;
      if (item.variety_id) {
        variety = varieties.find(v => v.id === item.variety_id);
      } else if (item.variety_name) {
        variety = varieties.find(v => 
          v.plant_type_id === plantType.id &&
          v.variety_name?.toLowerCase() === item.variety_name?.toLowerCase()
        );
      }

      // Check if already synced
      const existing = existingPlans.find(p => p.grow_list_item_index === itemIndex);

      // Calculate default timing based on variety or plant type
      const daysToMaturity = variety?.days_to_maturity || plantType.default_days_to_maturity || 80;
      const startIndoorsWeeks = variety?.start_indoors_weeks || plantType.default_start_indoors_weeks || 6;
      const transplantWeeks = variety?.transplant_weeks_after_last_frost_min || plantType.default_transplant_weeks || 0;

      const seedOffsetDays = -(startIndoorsWeeks * 7); // Negative = before frost
      const transplantOffsetDays = transplantWeeks * 7; // Positive = after frost

      const cropData = {
        garden_season_id,
        garden_id: seasonData.garden_id,
        grow_list_id,
        grow_list_item_index: itemIndex,
        plant_type_id: plantType.id,
        variety_id: variety?.id || null,
        label: item.variety_name || item.plant_type_name || plantType.common_name,
        quantity_planned: item.target_count || item.quantity || 1,
        quantity_scheduled: 0,
        quantity_planted: 0,
        status: 'planned',
        color_hex: plantType.color || '#10b981',
        planting_method: 'transplant',
        date_mode: 'relative_to_frost',
        relative_anchor: 'last_frost',
        seed_offset_days: seedOffsetDays,
        transplant_offset_days: transplantOffsetDays,
        dtm_days: daysToMaturity,
        harvest_window_days: 14
      };

      if (existing) {
        // Update quantity if changed
        if (existing.quantity_planned !== cropData.quantity_planned) {
          await base44.asServiceRole.entities.CropPlan.update(existing.id, { 
            quantity_planned: cropData.quantity_planned 
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        const newPlan = await base44.asServiceRole.entities.CropPlan.create(cropData);
        created++;
        
        // Auto-generate tasks if requested
        if (auto_generate_tasks && lastFrostDate) {
          try {
            await base44.asServiceRole.functions.invoke('generateTasksForCrop', { 
              crop_plan_id: newPlan.id 
            });
          } catch (error) {
            console.error('[SyncGrowList] Failed to generate tasks for:', newPlan.label, error);
          }
        }
      }
    }

    console.log('[SyncGrowList] Sync complete:', { created, updated, skipped });

    return Response.json({
      success: true,
      created,
      updated,
      skipped,
      total: items.length
    });
  } catch (error) {
    console.error('[SyncGrowList] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});