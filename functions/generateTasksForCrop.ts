import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { crop_plan_id } = await req.json();

    if (!crop_plan_id) {
      return Response.json({ error: 'Missing crop_plan_id' }, { status: 400 });
    }

    console.log('[GenerateTasks] Loading crop plan:', crop_plan_id);

    const cropPlan = await base44.entities.CropPlan.filter({ id: crop_plan_id, created_by: user.email });
    if (cropPlan.length === 0) {
      return Response.json({ error: 'Crop plan not found' }, { status: 404 });
    }

    const crop = cropPlan[0];

    // Load season for frost date
    const season = await base44.asServiceRole.entities.GardenSeason.filter({ id: crop.garden_season_id });
    if (season.length === 0) {
      return Response.json({ error: 'Season not found' }, { status: 404 });
    }

    const seasonData = season[0];
    
    // Fallback to user frost dates if season doesn't have them
    let lastFrostDate = null;
    if (seasonData.last_frost_date) {
      lastFrostDate = new Date(seasonData.last_frost_date);
    } else {
      // Load user frost dates
      const userData = await base44.auth.me();
      if (userData.last_frost_date) {
        // User frost dates are stored with year, extract month/day and apply to season year
        const userFrostDate = new Date(userData.last_frost_date);
        const seasonYear = seasonData.year || new Date().getFullYear();
        lastFrostDate = new Date(seasonYear, userFrostDate.getMonth(), userFrostDate.getDate());
        console.log('[GenerateTasks] Using user frost date:', userData.last_frost_date, '→', lastFrostDate.toISOString().split('T')[0], 'for season year', seasonYear);
      } else {
        return Response.json({ 
          error: `Frost dates not set for season "${seasonData.name}" or user profile. Please set them in Settings → Location or in Garden Season settings.` 
        }, { status: 400 });
      }
    }

    if (!lastFrostDate || isNaN(lastFrostDate.getTime())) {
      return Response.json({ 
        error: `Invalid frost date calculated for season "${seasonData.name}". Please ensure frost dates are correctly configured.` 
      }, { status: 400 });
    }

    // Delete existing tasks for this crop
    const existingTasks = await base44.entities.CropTask.filter({ crop_plan_id, created_by: user.email });
    for (const task of existingTasks) {
      await base44.entities.CropTask.delete(task.id);
    }

    console.log('[GenerateTasks] Deleted', existingTasks.length, 'existing tasks');

    const tasksToCreate = [];
    
    console.log('[GenerateTasks] Using last frost date:', lastFrostDate.toISOString().split('T')[0]);

    // Load variety/profile for proper timing data
    let timingData = {};
    let varietyData = null;
    let plantTypeData = null;
    
    if (crop.variety_id) {
      const varieties = await base44.asServiceRole.entities.Variety.filter({ id: crop.variety_id });
      if (varieties.length > 0) {
        varietyData = varieties[0];
        timingData = varieties[0];
      }
    }
    if (crop.plant_profile_id) {
      const profiles = await base44.asServiceRole.entities.PlantProfile.filter({ id: crop.plant_profile_id });
      if (profiles.length > 0) {
        timingData = { ...timingData, ...profiles[0] };
      }
    }
    
    // Load plant type once for all task titles
    if (crop.plant_type_id) {
      const plantTypes = await base44.asServiceRole.entities.PlantType.filter({ id: crop.plant_type_id });
      if (plantTypes.length > 0) {
        plantTypeData = plantTypes[0];
      }
    }
    
    // Build variety name for all tasks
    let varietyName = crop.label;
    if (varietyData && plantTypeData) {
      varietyName = `${varietyData.variety_name} - ${plantTypeData.common_name}`;
    }

    // ── Helpers ──
    const fmt = (d) => d.toISOString().split('T')[0];
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    
    let seedDate = null;
    let transplantDate = null;
    let sowDate = null;
    
    // ═══════════════════════════════════════════════════════════
    // LIFECYCLE TASKS — with proper multi-day DURATIONS
    //
    // KEY CHANGE: Every task now has start_date ≠ end_date
    // so calendar bars show realistic time windows instead of
    // 1-pixel-wide single-day dots.
    // ═══════════════════════════════════════════════════════════
    
    if (crop.planting_method === 'transplant' || crop.planting_method === 'both') {
      // ── SEED START ──
      // Duration: uses start_indoors_weeks min/max for a seeding WINDOW
      seedDate = new Date(lastFrostDate);
      let seedOffsetDays = crop.seed_offset_days;
      if (seedOffsetDays === undefined || seedOffsetDays === null) {
        const weeksBeforeFrost = timingData.start_indoors_weeks || 6;
        seedOffsetDays = -(weeksBeforeFrost * 7);
      }
      seedDate.setDate(seedDate.getDate() + seedOffsetDays);
      
      // Calculate end date from min/max weeks (if available)
      const seedStartMin = timingData.start_indoors_weeks_min;
      const seedStartMax = timingData.start_indoors_weeks_max;
      let seedEndDate;
      if (seedStartMin && seedStartMax && seedStartMin < seedStartMax) {
        // End = frost minus MINIMUM weeks (the latest you'd still start seeds)
        seedEndDate = addDays(lastFrostDate, -(seedStartMin * 7));
      } else {
        // Default: 5-day seeding window
        seedEndDate = addDays(seedDate, 5);
      }
      
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'seed',
        title: `Start ${varietyName} Seeds`,
        start_date: fmt(seedDate),
        end_date: fmt(seedEndDate),
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });

      // ── TRANSPLANT ──
      // Duration: uses transplant_weeks min/max for a transplant WINDOW
      transplantDate = new Date(lastFrostDate);
      let transplantOffsetDays = crop.transplant_offset_days;
      if (transplantOffsetDays === undefined || transplantOffsetDays === null) {
        const weeksAfterFrost = timingData.transplant_weeks_after_last_frost_min || 2;
        transplantOffsetDays = weeksAfterFrost * 7;
      }
      transplantDate.setDate(transplantDate.getDate() + transplantOffsetDays);

      const tpMin = timingData.transplant_weeks_after_last_frost_min;
      const tpMax = timingData.transplant_weeks_after_last_frost_max;
      let transplantEndDate;
      if (tpMin !== undefined && tpMax !== undefined && tpMax > tpMin) {
        transplantEndDate = addDays(lastFrostDate, tpMax * 7);
      } else {
        // Default: 5-day transplant window
        transplantEndDate = addDays(transplantDate, 5);
      }

      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'transplant',
        title: `Transplant ${varietyName}`,
        start_date: fmt(transplantDate),
        end_date: fmt(transplantEndDate),
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });
    }

    if (crop.planting_method === 'direct_seed' || crop.planting_method === 'both') {
      // ── DIRECT SOW ──
      // Duration: uses direct_sow_weeks min/max for a sowing WINDOW
      sowDate = new Date(lastFrostDate);
      let sowOffsetDays = crop.direct_seed_offset_days;
      if (sowOffsetDays === undefined || sowOffsetDays === null) {
        const weeksAfterFrost = timingData.direct_sow_weeks_min || 0;
        sowOffsetDays = weeksAfterFrost * 7;
      }
      sowDate.setDate(sowDate.getDate() + sowOffsetDays);

      const dsMin = timingData.direct_sow_weeks_min;
      const dsMax = timingData.direct_sow_weeks_max;
      let sowEndDate;
      if (dsMin !== undefined && dsMax !== undefined && dsMax > dsMin) {
        sowEndDate = addDays(lastFrostDate, dsMax * 7);
      } else {
        // Default: 7-day sowing window
        sowEndDate = addDays(sowDate, 7);
      }

      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'direct_seed',
        title: `Direct Sow ${varietyName}`,
        start_date: fmt(sowDate),
        end_date: fmt(sowEndDate),
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });
    }

    // ── HARVEST ──
    // Duration: harvest window from DTM range or default 14 days
    let harvestBaseDate;
    if (sowDate) harvestBaseDate = sowDate;
    else if (transplantDate) harvestBaseDate = transplantDate;
    else harvestBaseDate = new Date(lastFrostDate);
    
    const harvestDate = new Date(harvestBaseDate);
    const dtmDays = crop.dtm_days || timingData.days_to_maturity || 80;
    harvestDate.setDate(harvestDate.getDate() + dtmDays);
    
    // Use DTM range for harvest window if available
    const dtmMin = timingData.days_to_maturity_min;
    const dtmMax = timingData.days_to_maturity_max;
    let harvestWindow = crop.harvest_window_days || 14;
    if (dtmMin && dtmMax && dtmMax > dtmMin) {
      harvestWindow = Math.max(14, dtmMax - dtmMin);
    }
    const harvestEndDate = addDays(harvestDate, harvestWindow);

    tasksToCreate.push({
      garden_season_id: crop.garden_season_id,
      crop_plan_id: crop.id,
      task_type: 'harvest',
      title: `Harvest ${varietyName}`,
      start_date: fmt(harvestDate),
      end_date: fmt(harvestEndDate),
      color_hex: crop.color_hex,
      quantity_target: crop.quantity_planned,
      quantity_completed: 0,
      created_by: user.email
    });
    
    // ═══════════════════════════════════════════════════════════
    // MAINTENANCE TASKS — with multi-day durations
    // ═══════════════════════════════════════════════════════════
    
    const plantingDate = transplantDate || sowDate || new Date(lastFrostDate);
    
    // ── BED PREP ── (7-14 days before planting → 7-day task)
    const bedPrepStart = addDays(plantingDate, -14);
    const bedPrepEnd = addDays(plantingDate, -7);
    tasksToCreate.push({
      garden_season_id: crop.garden_season_id,
      crop_plan_id: crop.id,
      task_type: 'bed_prep',
      title: `Prepare Bed for ${varietyName}`,
      start_date: fmt(bedPrepStart),
      end_date: fmt(bedPrepEnd),
      color_hex: crop.color_hex,
      quantity_target: 1,
      quantity_completed: 0,
      created_by: user.email
    });
    
    // ── HARDEN OFF ── (transplants only, 10 days before transplant → 9-day task!)
    if (transplantDate && seedDate) {
      const hardenStart = addDays(transplantDate, -10);
      const hardenEnd = addDays(transplantDate, -1);
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Harden Off ${varietyName}`,
        start_date: fmt(hardenStart),
        end_date: fmt(hardenEnd),
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });
    }
    
    // ── POT UP ── (3-4 weeks after seeding for long-season transplants → 3-day window)
    if (seedDate && (timingData.start_indoors_weeks >= 6 || crop.seed_offset_days <= -42)) {
      const potUpDate = addDays(seedDate, 24);
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Pot Up ${varietyName}`,
        start_date: fmt(potUpDate),
        end_date: fmt(addDays(potUpDate, 3)),
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });
    }
    
    // ── SUPPORT/TRELLIS ── (planting day → 3-day window)
    if (timingData.trellis_required || timingData.trellis_common) {
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Install Support for ${varietyName}`,
        start_date: fmt(plantingDate),
        end_date: fmt(addDays(plantingDate, 3)),
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
    }
    
    // ── MULCH ── (7 days after planting → 3-day window)
    const mulchDate = addDays(plantingDate, 7);
    tasksToCreate.push({
      garden_season_id: crop.garden_season_id,
      crop_plan_id: crop.id,
      task_type: 'cultivate',
      title: `Mulch ${varietyName}`,
      start_date: fmt(mulchDate),
      end_date: fmt(addDays(mulchDate, 3)),
      color_hex: crop.color_hex,
      quantity_target: 1,
      quantity_completed: 0,
      created_by: user.email
    });
    
    // ═══════════════════════════════════════════════════════════
    // RECURRING MAINTENANCE — Multi-day blocks instead of spam
    //
    // OLD: Water every 3 days → up to 40 single-day tasks per crop!
    //      With 5 crops = 200 water tasks alone = Kanban unusable
    //
    // NEW: Weekly water BLOCKS (7-day bars on calendar)
    //      + grouped weeding + grouped scouting
    //      → ~30 tasks total instead of ~70+
    // ═══════════════════════════════════════════════════════════

    // ── FERTILIZATION ── (every 3 weeks, single day — these are spot events)
    let fertDate = addDays(plantingDate, 14);
    let fertCount = 0;
    while (fertDate < harvestDate && fertCount < 6) {
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Fertilize ${varietyName}`,
        start_date: fmt(fertDate),
        end_date: fmt(fertDate),
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
      fertDate = addDays(fertDate, 21);
      fertCount++;
    }
    
    // ── WATERING ── Weekly blocks (NOT every 3 days!)
    // Shows as 7-day bars on calendar. Max 15 blocks.
    let waterStart = addDays(plantingDate, 3);
    let waterCount = 0;
    while (waterStart < harvestEndDate && waterCount < 15) {
      const waterEnd = addDays(waterStart, 6);
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Water ${varietyName}`,
        start_date: fmt(waterStart),
        end_date: fmt(waterEnd < harvestEndDate ? waterEnd : harvestEndDate),
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
      waterStart = addDays(waterStart, 7);
      waterCount++;
    }
    
    // ── WEEDING ── Weekly, shown as 2-day blocks
    let weedDate = addDays(plantingDate, 14);
    let weedCount = 0;
    while (weedDate < harvestDate && weedCount < 10) {
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Weed/Cultivate ${varietyName}`,
        start_date: fmt(weedDate),
        end_date: fmt(addDays(weedDate, 1)),
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
      weedDate = addDays(weedDate, 7);
      weedCount++;
    }
    
    // ── PEST & DISEASE SCOUTING ── Weekly, shown as 2-day blocks
    let scoutDate = addDays(plantingDate, 21);
    let scoutCount = 0;
    while (scoutDate < harvestDate && scoutCount < 8) {
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Pest/Disease Check ${varietyName}`,
        start_date: fmt(scoutDate),
        end_date: fmt(addDays(scoutDate, 1)),
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
      scoutDate = addDays(scoutDate, 7);
      scoutCount++;
    }

    // Create all tasks in bulk
    if (tasksToCreate.length > 0) {
      await base44.entities.CropTask.bulkCreate(tasksToCreate);
    }

    console.log('[GenerateTasks] Created', tasksToCreate.length, 'tasks for', crop.label);

    // Update crop status
    await base44.entities.CropPlan.update(crop.id, { 
      status: 'scheduled',
      quantity_scheduled: crop.quantity_planned
    });

    return Response.json({
      success: true,
      tasks_created: tasksToCreate.length
    });
  } catch (error) {
    console.error('[GenerateTasks] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});
