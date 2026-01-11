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

    console.log('[UpdateQuantities] Recalculating for crop:', crop_plan_id);

    // Load crop plan
    const cropPlan = await base44.entities.CropPlan.filter({ id: crop_plan_id });
    if (cropPlan.length === 0) {
      return Response.json({ error: 'Crop plan not found' }, { status: 404 });
    }

    const crop = cropPlan[0];

    // Load all tasks for this crop
    const cropTasks = await base44.entities.CropTask.filter({ crop_plan_id });

    // Calculate quantity_scheduled (sum of all task targets)
    const quantityScheduled = cropTasks.reduce((sum, t) => sum + (t.quantity_target || 0), 0);

    // Load planting spaces for this crop
    const plantingSpaces = crop.planting_space_ids && crop.planting_space_ids.length > 0
      ? await base44.asServiceRole.entities.PlantingSpace.filter({
          id: { $in: crop.planting_space_ids }
        })
      : [];

    // Calculate quantity_planted (count of planting spaces)
    const quantityPlanted = plantingSpaces.length;

    // Determine status based on quantities
    let status = 'planned';
    if (quantityPlanted >= (crop.quantity_planned || 0)) {
      status = 'planted';
    } else if (quantityScheduled > 0) {
      status = 'scheduled';
    }

    // Update crop plan
    await base44.entities.CropPlan.update(crop_plan_id, {
      quantity_scheduled: quantityScheduled,
      quantity_planted: quantityPlanted,
      status
    });

    console.log('[UpdateQuantities] Updated:', {
      quantity_scheduled: quantityScheduled,
      quantity_planted: quantityPlanted,
      status
    });

    return Response.json({
      success: true,
      quantity_scheduled: quantityScheduled,
      quantity_planted: quantityPlanted,
      status
    });
  } catch (error) {
    console.error('[UpdateQuantities] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});