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
    const lastFrostDate = seasonData.last_frost_date ? new Date(seasonData.last_frost_date) : new Date();

    // Delete existing tasks for this crop
    const existingTasks = await base44.entities.CropTask.filter({ crop_plan_id });
    for (const task of existingTasks) {
      await base44.entities.CropTask.delete(task.id);
    }

    console.log('[GenerateTasks] Deleted', existingTasks.length, 'existing tasks');

    // Generate tasks based on planting method and dates
    const tasksToCreate = [];

    if (crop.planting_method === 'transplant' || crop.planting_method === 'both') {
      // Seed start task
      const seedDate = new Date(lastFrostDate);
      seedDate.setDate(seedDate.getDate() + (crop.seed_offset_days || -42));

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

      // Transplant task
      const transplantDate = new Date(lastFrostDate);
      transplantDate.setDate(transplantDate.getDate() + (crop.transplant_offset_days || 14));

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
      // Direct sow task
      const sowDate = new Date(lastFrostDate);
      sowDate.setDate(sowDate.getDate() + (crop.direct_seed_offset_days || 0));

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

    // Harvest task
    const harvestStartDate = new Date(lastFrostDate);
    const baseDate = crop.planting_method === 'direct_seed' 
      ? new Date(lastFrostDate).setDate(lastFrostDate.getDate() + (crop.direct_seed_offset_days || 0))
      : new Date(lastFrostDate).setDate(lastFrostDate.getDate() + (crop.transplant_offset_days || 14));
    
    const harvestDate = new Date(baseDate);
    harvestDate.setDate(harvestDate.getDate() + (crop.dtm_days || 80));

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
      quantity_completed: 0
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