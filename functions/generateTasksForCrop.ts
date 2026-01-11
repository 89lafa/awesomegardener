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

    const cropPlan = await base44.entities.CropPlan.filter({ id: crop_plan_id });
    if (cropPlan.length === 0) {
      return Response.json({ error: 'Crop plan not found' }, { status: 404 });
    }

    const crop = cropPlan[0];

    // Load season for frost date
    const season = await base44.entities.GardenSeason.filter({ id: crop.garden_season_id });
    if (season.length === 0) {
      return Response.json({ error: 'Season not found' }, { status: 404 });
    }

    const seasonData = season[0];
    
    if (!seasonData.last_frost_date) {
      return Response.json({ 
        error: 'Last frost date not set for this season. Please set it in garden settings.' 
      }, { status: 400 });
    }
    
    const lastFrostDate = new Date(seasonData.last_frost_date);

    // Delete existing tasks for this crop
    const existingTasks = await base44.entities.CropTask.filter({ crop_plan_id });
    for (const task of existingTasks) {
      await base44.entities.CropTask.delete(task.id);
    }

    console.log('[GenerateTasks] Deleted', existingTasks.length, 'existing tasks');

    // Generate tasks based on planting method and dates
    const tasksToCreate = [];
    
    console.log('[GenerateTasks] Using last frost date:', lastFrostDate.toISOString().split('T')[0]);
    console.log('[GenerateTasks] Crop offsets:', {
      seed: crop.seed_offset_days,
      transplant: crop.transplant_offset_days,
      dtm: crop.dtm_days
    });

    // Load variety/profile for proper timing data
    let timingData = {};
    if (crop.variety_id) {
      const varieties = await base44.entities.Variety.filter({ id: crop.variety_id });
      if (varieties.length > 0) {
        timingData = varieties[0];
      }
    }
    if (crop.plant_profile_id) {
      const profiles = await base44.entities.PlantProfile.filter({ id: crop.plant_profile_id });
      if (profiles.length > 0) {
        timingData = { ...timingData, ...profiles[0] };
      }
    }
    
    if (crop.planting_method === 'transplant' || crop.planting_method === 'both') {
      // Seed start task - BEFORE last frost (negative offset)
      const seedDate = new Date(lastFrostDate);
      let seedOffsetDays = crop.seed_offset_days;
      
      // If no offset, calculate from variety data
      if (seedOffsetDays === undefined || seedOffsetDays === null) {
        const weeksBeforeFrost = timingData.start_indoors_weeks || 6;
        seedOffsetDays = -(weeksBeforeFrost * 7); // Negative for BEFORE frost
      }
      
      seedDate.setDate(seedDate.getDate() + seedOffsetDays);
      console.log('[GenerateTasks] Seed start date:', seedDate.toISOString().split('T')[0], 'offset:', seedOffsetDays);

      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'seed',
        title: `Start ${crop.label} Seeds`,
        start_date: seedDate.toISOString().split('T')[0],
        end_date: seedDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0
      });

      // Transplant task - AFTER last frost (positive offset)
      const transplantDate = new Date(lastFrostDate);
      let transplantOffsetDays = crop.transplant_offset_days;
      
      // If no offset, calculate from variety data
      if (transplantOffsetDays === undefined || transplantOffsetDays === null) {
        const weeksAfterFrost = timingData.transplant_weeks_after_last_frost_min || 2;
        transplantOffsetDays = weeksAfterFrost * 7; // Positive for AFTER frost
      }
      
      transplantDate.setDate(transplantDate.getDate() + transplantOffsetDays);
      console.log('[GenerateTasks] Transplant date:', transplantDate.toISOString().split('T')[0], 'offset:', transplantOffsetDays);

      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'transplant',
        title: `Transplant ${crop.label}`,
        start_date: transplantDate.toISOString().split('T')[0],
        end_date: transplantDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0
      });
    }

    if (crop.planting_method === 'direct_seed' || crop.planting_method === 'both') {
      // Direct sow task - AFTER last frost
      const sowDate = new Date(lastFrostDate);
      let sowOffsetDays = crop.direct_seed_offset_days;
      
      // If no offset, calculate from variety data
      if (sowOffsetDays === undefined || sowOffsetDays === null) {
        const weeksAfterFrost = timingData.direct_sow_weeks_min || 0;
        sowOffsetDays = weeksAfterFrost * 7; // Positive for AFTER frost
      }
      
      sowDate.setDate(sowDate.getDate() + sowOffsetDays);
      console.log('[GenerateTasks] Direct sow date:', sowDate.toISOString().split('T')[0], 'offset:', sowOffsetDays);

      tasksToCreate.push({
        garden_season_id: crop.garden_season_id,
        crop_plan_id: crop.id,
        task_type: 'direct_seed',
        title: `Direct Sow ${crop.label}`,
        start_date: sowDate.toISOString().split('T')[0],
        end_date: sowDate.toISOString().split('T')[0],
        color_hex: crop.color_hex,
        quantity_target: crop.quantity_planned,
        quantity_completed: 0
      });
    }

    // Harvest task - calculated from transplant/sow date + DTM
    let harvestBaseDate;
    if (crop.planting_method === 'direct_seed') {
      const sowOffset = crop.direct_seed_offset_days !== undefined ? crop.direct_seed_offset_days : (timingData.direct_sow_weeks_min || 0) * 7;
      harvestBaseDate = new Date(lastFrostDate);
      harvestBaseDate.setDate(harvestBaseDate.getDate() + sowOffset);
    } else {
      const transplantOffset = crop.transplant_offset_days !== undefined ? crop.transplant_offset_days : (timingData.transplant_weeks_after_last_frost_min || 2) * 7;
      harvestBaseDate = new Date(lastFrostDate);
      harvestBaseDate.setDate(harvestBaseDate.getDate() + transplantOffset);
    }
    
    const harvestDate = new Date(harvestBaseDate);
    const dtmDays = crop.dtm_days || timingData.days_to_maturity || 80;
    harvestDate.setDate(harvestDate.getDate() + dtmDays);

    const harvestEndDate = new Date(harvestDate);
    harvestEndDate.setDate(harvestEndDate.getDate() + (crop.harvest_window_days || 14));

    console.log('[GenerateTasks] Harvest date:', harvestDate.toISOString().split('T')[0], 'from base:', harvestBaseDate.toISOString().split('T')[0], '+ DTM:', dtmDays);

    tasksToCreate.push({
      garden_season_id: crop.garden_season_id,
      crop_plan_id: crop.id,
      task_type: 'harvest',
      title: `Harvest ${crop.label}`,
      start_date: harvestDate.toISOString().split('T')[0],
      end_date: harvestEndDate.toISOString().split('T')[0],
      color_hex: crop.color_hex,
      quantity_target: crop.quantity_planned,
      quantity_completed: 0
    });
    
    // Add maintenance tasks (watering, weeding, pest checks)
    const transplantOrSowDate = crop.planting_method === 'direct_seed'
      ? new Date(lastFrostDate.getTime() + (crop.direct_seed_offset_days || 0) * 86400000)
      : new Date(lastFrostDate.getTime() + (crop.transplant_offset_days || 14) * 86400000);
    
    // Weekly watering reminder starting 1 week after planting
    const waterDate = new Date(transplantOrSowDate);
    waterDate.setDate(waterDate.getDate() + 7);
    
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
      notes: 'Check soil moisture regularly and water as needed'
    });
    
    // Weeding reminder 2 weeks after planting
    const weedDate = new Date(transplantOrSowDate);
    weedDate.setDate(weedDate.getDate() + 14);
    
    tasksToCreate.push({
      garden_season_id: crop.garden_season_id,
      crop_plan_id: crop.id,
      task_type: 'cultivate',
      title: `Weed around ${crop.label}`,
      start_date: weedDate.toISOString().split('T')[0],
      end_date: weedDate.toISOString().split('T')[0],
      color_hex: crop.color_hex,
      quantity_target: 1,
      quantity_completed: 0
    });
    
    // Pest check 3 weeks after planting
    const pestDate = new Date(transplantOrSowDate);
    pestDate.setDate(pestDate.getDate() + 21);
    
    tasksToCreate.push({
      garden_season_id: crop.garden_season_id,
      crop_plan_id: crop.id,
      task_type: 'cultivate',
      title: `Check ${crop.label} for Pests`,
      start_date: pestDate.toISOString().split('T')[0],
      end_date: pestDate.toISOString().split('T')[0],
      color_hex: crop.color_hex,
      quantity_target: 1,
      quantity_completed: 0,
      notes: 'Inspect leaves for pests or disease'
    });

    // Create all tasks
    for (const taskData of tasksToCreate) {
      await base44.entities.CropTask.create(taskData);
    }

    console.log('[GenerateTasks] Created', tasksToCreate.length, 'tasks');

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