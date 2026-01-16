import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { crop_plan_id, quantity_to_add } = await req.json();

    if (!crop_plan_id) {
      return Response.json({ error: 'crop_plan_id is required' }, { status: 400 });
    }

    // Get the crop plan
    const plans = await base44.entities.CropPlan.filter({ id: crop_plan_id });
    if (plans.length === 0) {
      return Response.json({ error: 'Crop plan not found' }, { status: 404 });
    }

    const plan = plans[0];

    // Count actual plants for this crop plan (not grid slots)
    const plantings = await base44.entities.PlantInstance.filter({
      garden_id: plan.garden_id,
      variety_id: plan.variety_id
    });

    // Calculate total plants - if quantity_to_add is provided, use it
    // Otherwise, count plantings (for backwards compatibility)
    let totalPlanted;
    if (quantity_to_add !== undefined) {
      totalPlanted = (plan.quantity_planted || 0) + quantity_to_add;
    } else {
      // Legacy: just count the number of plantings
      totalPlanted = plantings.length;
    }

    // Update the crop plan
    await base44.entities.CropPlan.update(crop_plan_id, {
      quantity_planted: totalPlanted
    });

    return Response.json({
      success: true,
      quantity_planted: totalPlanted,
      quantity_planned: plan.quantity_planned
    });
  } catch (error) {
    console.error('Error updating crop quantity:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});