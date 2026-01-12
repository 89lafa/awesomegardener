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

    console.log('[UpdateCropQty] Updating planted quantity for:', crop_plan_id);

    // Load crop plan
    const cropPlans = await base44.asServiceRole.entities.CropPlan.filter({ id: crop_plan_id });
    if (cropPlans.length === 0) {
      return Response.json({ error: 'Crop not found' }, { status: 404 });
    }

    const crop = cropPlans[0];

    // Count all PlantInstance records that match this crop
    const allPlantings = await base44.asServiceRole.entities.PlantInstance.list();
    
    const matchingPlantings = allPlantings.filter(p => {
      // Match by plant_type_id primarily
      if (p.plant_type_id !== crop.plant_type_id) return false;
      
      // If crop has specific variety, match that
      if (crop.variety_id && p.variety_id === crop.variety_id) return true;
      if (crop.plant_profile_id && p.variety_id === crop.plant_profile_id) return true;
      
      // Match by label/display_name if no specific variety
      if (!crop.variety_id && !crop.plant_profile_id) {
        return p.display_name?.includes(crop.label);
      }
      
      return false;
    });

    const quantityPlanted = matchingPlantings.length;

    console.log('[UpdateCropQty] Found', quantityPlanted, 'planted instances from', allPlantings.length, 'total');

    // Update crop plan
    await base44.asServiceRole.entities.CropPlan.update(crop_plan_id, {
      quantity_planted: quantityPlanted,
      status: quantityPlanted >= (crop.quantity_planned || 0) ? 'planted' : crop.status
    });

    return Response.json({
      success: true,
      quantity_planted: quantityPlanted
    });
  } catch (error) {
    console.error('[UpdateCropQty] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});