import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch from multiple data sources in parallel for maximum coverage
    const [plantInstances, cropPlans, trayCells, myPlants, varieties, plantTypes] = await Promise.all([
      base44.asServiceRole.entities.PlantInstance.list('-created_date', 200),
      base44.asServiceRole.entities.CropPlan.list('-created_date', 200),   // all statuses
      base44.asServiceRole.entities.TrayCell.filter({ status: { $ne: 'empty' } }, '-created_date', 300),
      base44.asServiceRole.entities.MyPlant.list('-created_date', 300),
      base44.asServiceRole.entities.Variety.list('variety_name', 1000),
      base44.asServiceRole.entities.PlantType.list('common_name', 100),
    ]);

    const varietiesArr  = Array.isArray(varieties)  ? varieties  : [];
    const plantTypesArr = Array.isArray(plantTypes) ? plantTypes : [];

    const typeMap    = new Map(plantTypesArr.map(t => [t.id, t]));
    const varietyMap = new Map(varietiesArr.map(v => [v.id, v]));

    // Track unique users per variety_id and plant_type_id
    const varietyUsers   = new Map(); // variety_id → Set<email>
    const plantTypeUsers = new Map(); // plant_type_id → Set<email>

    const recordUser = (email, varietyId, plantTypeId) => {
      const user = email || 'unknown';
      if (varietyId) {
        if (!varietyUsers.has(varietyId)) varietyUsers.set(varietyId, new Set());
        varietyUsers.get(varietyId).add(user);
      } else if (plantTypeId) {
        if (!plantTypeUsers.has(plantTypeId)) plantTypeUsers.set(plantTypeId, new Set());
        plantTypeUsers.get(plantTypeId).add(user);
      }
    };

    for (const p of plantInstances) recordUser(p.created_by, p.variety_id, p.plant_type_id);
    for (const c of cropPlans)      recordUser(c.created_by, c.variety_id, c.plant_type_id);
    for (const t of trayCells)      recordUser(t.created_by, t.variety_id, t.plant_type_id);
    for (const m of myPlants)       recordUser(m.created_by, m.variety_id, m.plant_type_id);

    console.log('[getPopularCrops] varieties tracked:', varietyUsers.size, 'plant types tracked:', plantTypeUsers.size);

    // Build popularity list
    const pop = [];

    for (const [vid, users] of varietyUsers.entries()) {
      const variety   = varietyMap.get(vid);
      if (!variety) continue;
      const plantType = typeMap.get(variety.plant_type_id);
      pop.push({
        variety_id:      variety.id,
        variety_name:    variety.variety_name,
        plant_type_id:   plantType?.id,
        plant_type_name: plantType?.common_name,
        unique_users:    users.size,
      });
    }

    // Add plant-type-only entries (no variety_id), pick most popular variety as representative
    for (const [ptId, users] of plantTypeUsers.entries()) {
      const plantType = typeMap.get(ptId);
      if (!plantType) continue;
      // Only add if no variety-level entry already exists for this type
      const alreadyHasVariety = pop.some(v => v.plant_type_id === ptId);
      if (!alreadyHasVariety) {
        // Find any variety for this type to serve as label
        const rep = varietiesArr.find(v => v.plant_type_id === ptId);
        if (rep) {
          pop.push({
            variety_id:      rep.id,
            variety_name:    rep.variety_name,
            plant_type_id:   plantType.id,
            plant_type_name: plantType.common_name,
            unique_users:    users.size,
          });
        } else {
          // No variety at all — show plant type name as label
          pop.push({
            variety_id:      ptId,
            variety_name:    plantType.common_name,
            plant_type_id:   plantType.id,
            plant_type_name: plantType.common_name,
            unique_users:    users.size,
          });
        }
      } else {
        // Boost the count for existing variety entries of this type
        pop
          .filter(v => v.plant_type_id === ptId)
          .forEach(v => v.unique_users = Math.max(v.unique_users, users.size));
      }
    }

    pop.sort((a, b) => b.unique_users - a.unique_users);

    const isTomato  = n => n?.toLowerCase().includes('tomato');
    const isPepper  = n => n?.toLowerCase().includes('pepper');

    const tomatoes = pop.filter(v => isTomato(v.plant_type_name)).slice(0, 5);
    const peppers  = pop.filter(v => isPepper(v.plant_type_name)).slice(0, 5);
    const other    = pop.filter(v => !isTomato(v.plant_type_name) && !isPepper(v.plant_type_name)).slice(0, 5);

    return Response.json({ tomatoes, peppers, other, total_varieties: pop.length });
  } catch (error) {
    console.error('[getPopularCrops] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});