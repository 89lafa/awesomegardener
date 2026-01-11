import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { garden_season_id, crop_plan_id } = await req.json();
    
    if (!garden_season_id) {
      return Response.json({ error: 'garden_season_id required' }, { status: 400 });
    }
    
    // Load season data
    const seasons = await base44.entities.GardenSeason.filter({ id: garden_season_id });
    if (seasons.length === 0) {
      return Response.json({ error: 'Season not found' }, { status: 404 });
    }
    const season = seasons[0];
    
    // Load garden to get frost dates
    const gardens = await base44.entities.Garden.filter({ id: season.garden_id });
    if (gardens.length === 0) {
      return Response.json({ error: 'Garden not found' }, { status: 404 });
    }
    const garden = gardens[0];
    
    // Load settings for frost dates
    const userSettings = await base44.entities.UserSettings.filter({ created_by: user.email });
    const lastFrostDate = userSettings[0]?.last_frost_date 
      ? new Date(userSettings[0].last_frost_date) 
      : new Date(season.year, 4, 15); // Default May 15
    
    // Load crop plans
    const cropPlans = crop_plan_id 
      ? await base44.entities.CropPlan.filter({ id: crop_plan_id })
      : await base44.entities.CropPlan.filter({ garden_season_id });
    
    let tasksCreated = 0;
    
    for (const crop of cropPlans) {
      // Get existing crop tasks
      const existingTasks = await base44.entities.CropTask.filter({ crop_plan_id: crop.id });
      
      // Calculate key dates using frost date logic
      let seedStartDate = null;
      let transplantDate = null;
      let directSowDate = null;
      
      // Load variety/profile for timing data
      let timingData = {};
      if (crop.plant_profile_id) {
        const profiles = await base44.entities.PlantProfile.filter({ id: crop.plant_profile_id });
        if (profiles.length > 0) {
          timingData = profiles[0];
        }
      }
      if (crop.variety_id) {
        const varieties = await base44.entities.Variety.filter({ id: crop.variety_id });
        if (varieties.length > 0) {
          timingData = { ...timingData, ...varieties[0] };
        }
      }
      
      // Calculate seed start (BEFORE last frost = negative offset)
      if (timingData.start_indoors_weeks) {
        seedStartDate = new Date(lastFrostDate);
        seedStartDate.setDate(seedStartDate.getDate() - (timingData.start_indoors_weeks * 7));
      }
      
      // Calculate transplant (AFTER last frost = positive offset)
      if (timingData.transplant_weeks_after_last_frost_min !== undefined) {
        transplantDate = new Date(lastFrostDate);
        transplantDate.setDate(transplantDate.getDate() + (timingData.transplant_weeks_after_last_frost_min * 7));
      } else if (seedStartDate) {
        // Default: 6-8 weeks after seed start
        transplantDate = new Date(seedStartDate);
        transplantDate.setDate(transplantDate.getDate() + 42);
      }
      
      // Calculate direct sow
      if (timingData.direct_sow_weeks_min !== undefined) {
        directSowDate = new Date(lastFrostDate);
        directSowDate.setDate(directSowDate.getDate() + (timingData.direct_sow_weeks_min * 7));
      }
      
      const plantingDate = transplantDate || directSowDate || seedStartDate;
      
      if (!plantingDate) continue; // Skip if no dates available
      
      // Calculate harvest date
      let harvestStartDate = null;
      if (plantingDate && (timingData.days_to_maturity || timingData.dtm_days)) {
        harvestStartDate = new Date(plantingDate);
        harvestStartDate.setDate(harvestStartDate.getDate() + (timingData.days_to_maturity || timingData.dtm_days || 60));
      }
      
      // Generate maintenance tasks
      const maintenanceTasks = [];
      
      // 1. WATERING (every 2-3 days after planting)
      if (plantingDate) {
        for (let day = 0; day <= 90; day += 3) {
          const waterDate = new Date(plantingDate);
          waterDate.setDate(waterDate.getDate() + day);
          
          if (!existingTasks.some(t => t.task_type === 'water' && t.start_date === waterDate.toISOString().split('T')[0])) {
            maintenanceTasks.push({
              garden_season_id,
              crop_plan_id: crop.id,
              task_type: 'cultivate',
              title: `Water ${crop.label}`,
              start_date: waterDate.toISOString().split('T')[0],
              color_hex: crop.color_hex,
              quantity_target: 1
            });
          }
        }
      }
      
      // 2. FERTILIZATION (every 2-3 weeks for fruiting crops)
      if (transplantDate) {
        const isFruitingCrop = ['tomato', 'pepper', 'eggplant', 'cucumber', 'squash'].some(name => 
          crop.label?.toLowerCase().includes(name)
        );
        
        if (isFruitingCrop) {
          for (let week = 2; week <= 12; week += 3) {
            const fertDate = new Date(transplantDate);
            fertDate.setDate(fertDate.getDate() + (week * 7));
            
            if (!existingTasks.some(t => t.task_type === 'fertilize' && t.start_date === fertDate.toISOString().split('T')[0])) {
              maintenanceTasks.push({
                garden_season_id,
                crop_plan_id: crop.id,
                task_type: 'cultivate',
                title: `Fertilize ${crop.label}`,
                start_date: fertDate.toISOString().split('T')[0],
                color_hex: crop.color_hex,
                quantity_target: 1
              });
            }
          }
        }
      }
      
      // 3. WEEDING (weekly starting 1 week after planting)
      if (plantingDate) {
        for (let week = 1; week <= 12; week++) {
          const weedDate = new Date(plantingDate);
          weedDate.setDate(weedDate.getDate() + (week * 7));
          
          if (!existingTasks.some(t => t.task_type === 'weed' && t.start_date === weedDate.toISOString().split('T')[0])) {
            maintenanceTasks.push({
              garden_season_id,
              crop_plan_id: crop.id,
              task_type: 'cultivate',
              title: `Weed around ${crop.label}`,
              start_date: weedDate.toISOString().split('T')[0],
              color_hex: crop.color_hex,
              quantity_target: 1
            });
          }
        }
      }
      
      // Create maintenance tasks in batches
      for (const taskData of maintenanceTasks.slice(0, 20)) { // Limit to avoid overload
        try {
          await base44.entities.CropTask.create(taskData);
          tasksCreated++;
        } catch (error) {
          console.error('Error creating task:', error);
        }
      }
    }
    
    return Response.json({ 
      success: true, 
      tasks_created: tasksCreated
    });
  } catch (error) {
    console.error('Error generating maintenance tasks:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});