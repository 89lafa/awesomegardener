export function getEffectiveSubcategoryIds(variety) {
  if (!variety) return [];
  const ids = new Set();
  
  if (variety.plant_subcategory_ids) {
    if (Array.isArray(variety.plant_subcategory_ids)) {
      variety.plant_subcategory_ids.forEach(id => ids.add(id));
    } else if (typeof variety.plant_subcategory_ids === 'string') {
      try {
        JSON.parse(variety.plant_subcategory_ids).forEach(id => ids.add(id));
      } catch (e) {
        ids.add(variety.plant_subcategory_ids);
      }
    }
  }
  
  if (variety.plant_subcategory_id) ids.add(variety.plant_subcategory_id);
  return Array.from(ids).filter(Boolean);
}

export function getVarietyColor(variety) {
  return variety?.color || variety?.fruit_color || variety?.pod_color || null;
}

export function getVarietyShape(variety) {
  return variety?.shape || variety?.fruit_shape || variety?.pod_shape || null;
}

export function getVarietySize(variety) {
  return variety?.size || variety?.fruit_size || variety?.pod_size || null;
}

export function getVarietyScoville(variety) {
  return {
    min: variety?.scoville_min ?? variety?.heat_scoville_min ?? null,
    max: variety?.scoville_max ?? variety?.heat_scoville_max ?? null
  };
}