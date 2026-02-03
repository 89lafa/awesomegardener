import { base44 } from '@/api/base44Client';

// Cache for plant types to avoid repeated fetches
const plantTypeCache = new Map();
const plantProfileCache = new Map();

/**
 * Get full display name for a variety with its plant type
 * e.g., "Music - Garlic", "Cherokee Purple - Tomato"
 */
export async function getVarietyDisplayName(variety) {
  if (!variety) return '';
  
  const varietyName = variety.variety_name || variety.name || 'Unknown';
  
  // If we have plant_type_name directly on the variety
  if (variety.plant_type_name) {
    return `${varietyName} - ${variety.plant_type_name}`;
  }
  
  // Try to get plant type from plant_type_id
  if (variety.plant_type_id) {
    let plantType = plantTypeCache.get(variety.plant_type_id);
    if (!plantType) {
      try {
        const types = await base44.entities.PlantType.filter({ id: variety.plant_type_id });
        plantType = types[0];
        if (plantType) {
          plantTypeCache.set(variety.plant_type_id, plantType);
        }
      } catch (error) {
        console.error('Error fetching plant type:', error);
      }
    }
    
    if (plantType?.common_name) {
      return `${varietyName} - ${plantType.common_name}`;
    }
  }
  
  // Try to get from plant_profile_id
  if (variety.plant_profile_id) {
    let profile = plantProfileCache.get(variety.plant_profile_id);
    if (!profile) {
      try {
        const profiles = await base44.entities.PlantProfile.filter({ id: variety.plant_profile_id });
        profile = profiles[0];
        if (profile) {
          plantProfileCache.set(variety.plant_profile_id, profile);
        }
      } catch (error) {
        console.error('Error fetching plant profile:', error);
      }
    }
    
    if (profile?.plant_type_id) {
      let plantType = plantTypeCache.get(profile.plant_type_id);
      if (!plantType) {
        try {
          const types = await base44.entities.PlantType.filter({ id: profile.plant_type_id });
          plantType = types[0];
          if (plantType) {
            plantTypeCache.set(profile.plant_type_id, plantType);
          }
        } catch (error) {
          console.error('Error fetching plant type from profile:', error);
        }
      }
      
      if (plantType?.common_name) {
        return `${varietyName} - ${plantType.common_name}`;
      }
    }
  }
  
  // Fallback to just variety name
  return varietyName;
}

/**
 * Batch get display names for multiple varieties
 */
export async function getVarietyDisplayNames(varieties) {
  if (!varieties || varieties.length === 0) return {};
  
  const displayNames = {};
  
  // Collect all unique plant type IDs and profile IDs
  const plantTypeIds = new Set();
  const plantProfileIds = new Set();
  
  varieties.forEach(v => {
    if (v.plant_type_id) plantTypeIds.add(v.plant_type_id);
    if (v.plant_profile_id) plantProfileIds.add(v.plant_profile_id);
  });
  
  // Batch fetch plant types
  if (plantTypeIds.size > 0) {
    try {
      const types = await base44.entities.PlantType.list();
      types.forEach(type => {
        if (plantTypeIds.has(type.id)) {
          plantTypeCache.set(type.id, type);
        }
      });
    } catch (error) {
      console.error('Error batch fetching plant types:', error);
    }
  }
  
  // Batch fetch plant profiles
  if (plantProfileIds.size > 0) {
    try {
      const profiles = await base44.entities.PlantProfile.list();
      profiles.forEach(profile => {
        if (plantProfileIds.has(profile.id)) {
          plantProfileCache.set(profile.id, profile);
          if (profile.plant_type_id) {
            plantTypeIds.add(profile.plant_type_id);
          }
        }
      });
    } catch (error) {
      console.error('Error batch fetching plant profiles:', error);
    }
  }
  
  // Build display names
  for (const variety of varieties) {
    displayNames[variety.id] = await getVarietyDisplayName(variety);
  }
  
  return displayNames;
}

/**
 * Clear the cache (useful after data updates)
 */
export function clearVarietyCache() {
  plantTypeCache.clear();
  plantProfileCache.clear();
}