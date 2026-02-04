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
    if (crop.variety_id) {
      const varieties = await base44.asServiceRole.entities.Variety.filter({ id: crop.variety_id });
      if (varieties.length > 0) {
        timingData = varieties[0];
      }
    }
    if (crop.plant_profile_id) {
      const profiles = await base44.asServiceRole.entities.PlantProfile.filter({ id: crop.plant_profile_id });
      if (profiles.length > 0) {
        timingData = { ...timingData, ...profiles[0] };
      }
    }
    
    let seedDate = null;
    let transplantDate = null;
    let sowDate = null;
    
    // LIFECYCLE TASKS
    if (crop.planting_method === 'transplant' || crop.planting_method === 'both') {
      // Seed start - BEFORE frost
      seedDate = new Date(lastFrostDate);
      let seedOffsetDays = crop.seed_offset_days;
      if (seedOffsetDays === undefined || seedOffsetDays === null) {
        const weeksBeforeFrost = timingData.start_indoors_weeks || 6;
        seedOffsetDays = -(weeksBeforeFrost * 7);
      }
      seedDate.setDate(seedDate.getDate() + seedOffsetDays);

      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'seed',
        title: `Start ${crop.label} Seeds`,
        start_date: seedDate.toISOString().split('T')[0],
        end_date: seedDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });

      // Transplant - AFTER frost
      transplantDate = new Date(lastFrostDate);
      let transplantOffsetDays = crop.transplant_offset_days;
      if (transplantOffsetDays === undefined || transplantOffsetDays === null) {
        const weeksAfterFrost = timingData.transplant_weeks_after_last_frost_min || 2;
        transplantOffsetDays = weeksAfterFrost * 7;
      }
      transplantDate.setDate(transplantDate.getDate() + transplantOffsetDays);

      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'transplant',
        title: `Transplant ${crop.label}`,
        start_date: transplantDate.toISOString().split('T')[0],
        end_date: transplantDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });
    }

    if (crop.planting_method === 'direct_seed' || crop.planting_method === 'both') {
      sowDate = new Date(lastFrostDate);
      let sowOffsetDays = crop.direct_seed_offset_days;
      if (sowOffsetDays === undefined || sowOffsetDays === null) {
        const weeksAfterFrost = timingData.direct_sow_weeks_min || 0;
        sowOffsetDays = weeksAfterFrost * 7;
      }
      sowDate.setDate(sowDate.getDate() + sowOffsetDays);

      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'direct_seed',
        title: `Direct Sow ${crop.label}`,
        start_date: sowDate.toISOString().split('T')[0],
        end_date: sowDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });
    }

    // Harvest
    let harvestBaseDate;
    if (sowDate) {
      harvestBaseDate = sowDate;
    } else if (transplantDate) {
      harvestBaseDate = transplantDate;
    } else {
      harvestBaseDate = new Date(lastFrostDate);
    }
    
    const harvestDate = new Date(harvestBaseDate);
    const dtmDays = crop.dtm_days || timingData.days_to_maturity || 80;
    harvestDate.setDate(harvestDate.getDate() + dtmDays);
    const harvestEndDate = new Date(harvestDate);
    harvestEndDate.setDate(harvestEndDate.getDate() + (crop.harvest_window_days || 14));

    tasksToCreate.push({
      garden_season_id: crop.garden_season_id,
      crop_plan_id: crop.id,
      task_type: 'harvest',
      title: `Harvest ${crop.label}`,
      start_date: harvestDate.toISOString().split('T')[0],
      end_date: harvestEndDate.toISOString().split('T')[0],
      color_hex: crop.color_hex,
      quantity_target: crop.quantity_planned,
      quantity_completed: 0,
      created_by: user.email
    });
    
    // MAINTENANCE TASKS
    const plantingDate = transplantDate || sowDate || new Date(lastFrostDate);
    
    // Harden Off (transplants only, 7 days before transplant)
    if (transplantDate && seedDate) {
      const hardenDate = new Date(transplantDate);
      hardenDate.setDate(hardenDate.getDate() - 7);
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Harden Off ${crop.label}`,
        start_date: hardenDate.toISOString().split('T')[0],
        end_date: hardenDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });
    }
    
    // Pot Up (3-4 weeks after seeding for transplants)
    if (seedDate && (timingData.start_indoors_weeks >= 6 || crop.seed_offset_days <= -42)) {
      const potUpDate = new Date(seedDate);
      potUpDate.setDate(potUpDate.getDate() + 24);
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Pot Up ${crop.label}`,
        start_date: potUpDate.toISOString().split('T')[0],
        end_date: potUpDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0,
        created_by: user.email
      });
    }
    
    // Support/Trellis (on planting day if needed)
    if (timingData.trellis_required || timingData.trellis_common) {
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Install Support for ${crop.label}`,
        start_date: plantingDate.toISOString().split('T')[0],
        end_date: plantingDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
    }
    
    // Mulch (7 days after planting)
    const mulchDate = new Date(plantingDate);
    mulchDate.setDate(mulchDate.getDate() + 7);
    tasksToCreate.push({
      garden_season_id: crop.garden_season_id,
      crop_plan_id: crop.id,
      task_type: 'cultivate',
      title: `Mulch ${crop.label}`,
      start_date: mulchDate.toISOString().split('T')[0],
      end_date: mulchDate.toISOString().split('T')[0],
      color_hex: crop.color_hex,
      quantity_target: 1,
      quantity_completed: 0,
      created_by: user.email
    });
    
    // Fertilization (first at 14 days, then every 21 days until harvest)
    const firstFertDate = new Date(plantingDate);
    firstFertDate.setDate(firstFertDate.getDate() + 14);
    
    let fertDate = new Date(firstFertDate);
    let fertCount = 0;
    while (fertDate < harvestDate && fertCount < 6) {
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Fertilize ${crop.label}`,
        start_date: fertDate.toISOString().split('T')[0],
        end_date: fertDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
      fertDate.setDate(fertDate.getDate() + 21);
      fertCount++;
    }
    
    // Watering (weekly from planting to harvest end)
    let waterDate = new Date(plantingDate);
    waterDate.setDate(waterDate.getDate() + 7);
    let waterCount = 0;
    while (waterDate < harvestEndDate && waterCount < 20) {
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Water ${crop.label}`,
        start_date: waterDate.toISOString().split('T')[0],
        end_date: waterDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
      waterDate.setDate(waterDate.getDate() + 7);
      waterCount++;
    }
    
    // Weeding (every 7 days from 14 days after planting)
    let weedDate = new Date(plantingDate);
    weedDate.setDate(weedDate.getDate() + 14);
    let weedCount = 0;
    while (weedDate < harvestDate && weedCount < 12) {
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Weed/Cultivate ${crop.label}`,
        start_date: weedDate.toISOString().split('T')[0],
        end_date: weedDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
      weedDate.setDate(weedDate.getDate() + 7);
      weedCount++;
    }
    
    // Pest & Disease Scouting (every 7 days from 21 days after planting)
    let scoutDate = new Date(plantingDate);
    scoutDate.setDate(scoutDate.getDate() + 21);
    let scoutCount = 0;
    while (scoutDate < harvestDate && scoutCount < 10) {
      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'cultivate',
        title: `Pest/Disease Check ${crop.label}`,
        start_date: scoutDate.toISOString().split('T')[0],
        end_date: scoutDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: 1,
        quantity_completed: 0,
        created_by: user.email
      });
      scoutDate.setDate(scoutDate.getDate() + 7);
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