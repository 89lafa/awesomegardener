import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all data sources in parallel
    const [plantInstances, cropPlans, trayCells, myPlants] = await Promise.all([
      base44.asServiceRole.entities.PlantInstance.list('-created_date', 300),
      base44.asServiceRole.entities.CropPlan.list('-created_date', 300),
      base44.asServiceRole.entities.TrayCell.list('-created_date', 500),
      base44.asServiceRole.entities.MyPlant.list('-created_date', 500),
    ]);

    // NAME-BASED grouping: key = `${normalized_plant_type}|${normalized_variety}`
    // This works for all data sources regardless of whether IDs are populated.
    // Map value: { plant_type_name, variety_name, users: Set<email> }
    const groups = new Map();

    const record = (email, plantTypeName, varietyName) => {
      if (!plantTypeName) return;
      const ptNorm  = plantTypeName.trim();
      const varNorm = (varietyName || '').trim() || ptNorm;
      const key     = `${ptNorm.toLowerCase()}|${varNorm.toLowerCase()}`;
      if (!groups.has(key)) {
        groups.set(key, { plant_type_name: ptNorm, variety_name: varNorm, users: new Set() });
      }
      groups.get(key).users.add(email || 'unknown');
    };

    // Process all 4 sources
    for (const p of plantInstances) {
      record(p.created_by, p.plant_type_name || p.display_name, p.variety_name || p.custom_name);
    }
    for (const c of cropPlans) {
      record(c.created_by, c.plant_type_name || c.label, c.variety_name);
    }
    for (const t of trayCells) {
      if (t.status === 'empty') continue;
      record(t.created_by, t.plant_type_name, t.variety_name);
    }
    for (const m of myPlants) {
      record(m.created_by, m.plant_type_name, m.variety_name);
    }

    console.log('[getPopularCrops] groups found:', groups.size,
      '| plantInstances:', plantInstances.length,
      '| cropPlans:', cropPlans.length,
      '| trayCells:', trayCells.length,
      '| myPlants:', myPlants.length
    );

    // Build popularity list
    const pop = Array.from(groups.entries()).map(([, v]) => ({
      variety_id:      null,          // not needed for display
      variety_name:    v.variety_name,
      plant_type_name: v.plant_type_name,
      unique_users:    v.users.size,
    })).sort((a, b) => b.unique_users - a.unique_users);

    const isTomato = n => /tomato/i.test(n);
    const isPepper = n => /pepper/i.test(n);

    // De-dupe display names within each category, keep highest count
    const dedup = (arr) => {
      const seen = new Map();
      for (const item of arr) {
        const k = item.variety_name.toLowerCase();
        if (!seen.has(k) || seen.get(k).unique_users < item.unique_users) {
          seen.set(k, item);
        }
      }
      return Array.from(seen.values()).sort((a, b) => b.unique_users - a.unique_users).slice(0, 5);
    };

    const tomatoes = dedup(pop.filter(v => isTomato(v.plant_type_name)));
    const peppers  = dedup(pop.filter(v => isPepper(v.plant_type_name)));
    const other    = dedup(pop.filter(v => !isTomato(v.plant_type_name) && !isPepper(v.plant_type_name)));

    console.log('[getPopularCrops] results → tomatoes:', tomatoes.length, 'peppers:', peppers.length, 'other:', other.length);

    return Response.json({ tomatoes, peppers, other, total_varieties: pop.length });
  } catch (error) {
    console.error('[getPopularCrops] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});