import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { addDays, addWeeks } from 'npm:date-fns@3.6.0';

/**
 * Generates recurring maintenance tasks for a garden season
 * Creates watering, weeding, pest check tasks automatically
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { garden_season_id } = body;

    if (!garden_season_id) {
      return Response.json({ error: 'Missing garden_season_id' }, { status: 400 });
    }

    // Load season using regular auth (user-scoped)
    const seasons = await base44.entities.GardenSeason.filter({ id: garden_season_id });
    if (seasons.length === 0) {
      return Response.json({ error: 'Season not found or no access' }, { status: 404 });
    }

    const season = seasons[0];
    const lastFrostDate = season.last_frost_date ? new Date(season.last_frost_date) : new Date(season.year, 4, 1);
    
    // Generate season dates (April through October)
    const seasonStart = new Date(season.year, 3, 1); // April
    const seasonEnd = new Date(season.year, 9, 31); // October

    // Check if maintenance tasks already exist
    const existingMaintenance = await base44.asServiceRole.entities.CropTask.filter({
      garden_season_id,
      crop_plan_id: null // Maintenance tasks have no crop_plan_id
    });

    if (existingMaintenance.length > 0) {
      return Response.json({
        success: true,
        created: 0,
        message: 'Maintenance tasks already exist for this season'
      });
    }

    const maintenanceTasks = [];
    let taskDate = seasonStart;

    // Watering tasks - every 3 days during growing season
    while (taskDate <= seasonEnd) {
      maintenanceTasks.push({
        garden_season_id,
        crop_plan_id: null,
        task_type: 'cultivate',
        title: 'Water Garden',
        start_date: taskDate.toISOString().split('T')[0],
        color_hex: '#3b82f6',
        is_completed: false,
        how_to_content: '# Watering\n\n- Water deeply in morning\n- Check soil moisture first\n- Focus on roots, not leaves'
      });
      taskDate = addDays(taskDate, 3);
    }

    // Weeding tasks - weekly
    taskDate = seasonStart;
    while (taskDate <= seasonEnd) {
      maintenanceTasks.push({
        garden_season_id,
        crop_plan_id: null,
        task_type: 'cultivate',
        title: 'Weed Garden Beds',
        start_date: taskDate.toISOString().split('T')[0],
        color_hex: '#8b5cf6',
        is_completed: false,
        how_to_content: '# Weeding\n\n- Pull weeds when young\n- Remove entire root system\n- Mulch to prevent regrowth'
      });
      taskDate = addWeeks(taskDate, 1);
    }

    // Pest check - biweekly
    taskDate = seasonStart;
    while (taskDate <= seasonEnd) {
      maintenanceTasks.push({
        garden_season_id,
        crop_plan_id: null,
        task_type: 'cultivate',
        title: 'Check for Pests',
        start_date: taskDate.toISOString().split('T')[0],
        color_hex: '#f59e0b',
        is_completed: false,
        how_to_content: '# Pest Monitoring\n\n- Inspect leaves (top & bottom)\n- Check for damage patterns\n- Look for eggs or larvae\n- Take action early'
      });
      taskDate = addWeeks(taskDate, 2);
    }

    // Create all tasks using asServiceRole
    for (const task of maintenanceTasks) {
      await base44.asServiceRole.entities.CropTask.create(task);
    }

    return Response.json({
      success: true,
      created: maintenanceTasks.length,
      message: `Generated ${maintenanceTasks.length} maintenance tasks`
    });
  } catch (error) {
    console.error('[GenerateMaintenanceTasks] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});