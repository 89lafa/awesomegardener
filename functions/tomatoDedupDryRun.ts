import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[Tomato Dedup] Starting dry run...');
    
    // Find Tomato PlantType
    const tomatoTypes = await base44.asServiceRole.entities.PlantType.filter({ 
      common_name: 'Tomato' 
    });
    
    if (tomatoTypes.length === 0) {
      return Response.json({ error: 'Tomato plant type not found' }, { status: 404 });
    }
    
    const tomatoTypeId = tomatoTypes[0].id;
    
    // Load all active Tomato varieties
    const allTomatoes = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: tomatoTypeId,
      status: 'active'
    }, 'variety_name', 10000);
    
    console.log('[Tomato Dedup] Found', allTomatoes.length, 'active Tomato varieties');
    
    // Normalize variety name
    const normalizeVarietyName = (name) => {
      if (!name) return '';
      return name
        .trim()
        .toLowerCase()
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/\(organic\)/gi, '')
        .replace(/\(heirloom\)/gi, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    // Group by variety_code
    const codeGroups = {};
    for (const v of allTomatoes) {
      if (v.variety_code) {
        if (!codeGroups[v.variety_code]) {
          codeGroups[v.variety_code] = [];
        }
        codeGroups[v.variety_code].push(v);
      }
    }
    
    // Group by normalized name
    const nameGroups = {};
    for (const v of allTomatoes) {
      const normalized = normalizeVarietyName(v.variety_name);
      if (normalized) {
        if (!nameGroups[normalized]) {
          nameGroups[normalized] = [];
        }
        nameGroups[normalized].push(v);
      }
    }
    
    // Find duplicates
    const duplicateGroups = [];
    
    // From code groups
    for (const [code, group] of Object.entries(codeGroups)) {
      if (group.length > 1) {
        duplicateGroups.push({
          key: `code:${code}`,
          type: 'variety_code',
          value: code,
          count: group.length,
          varieties: group.map(v => ({
            id: v.id,
            variety_name: v.variety_name,
            variety_code: v.variety_code,
            created_date: v.created_date,
            completeness: calculateCompleteness(v)
          }))
        });
      }
    }
    
    // From name groups (exclude already found by code)
    const processedIds = new Set(duplicateGroups.flatMap(g => g.varieties.map(v => v.id)));
    for (const [normalized, group] of Object.entries(nameGroups)) {
      if (group.length > 1) {
        const unprocessed = group.filter(v => !processedIds.has(v.id));
        if (unprocessed.length > 1) {
          duplicateGroups.push({
            key: `name:${normalized}`,
            type: 'normalized_name',
            value: normalized,
            count: unprocessed.length,
            varieties: unprocessed.map(v => ({
              id: v.id,
              variety_name: v.variety_name,
              variety_code: v.variety_code,
              created_date: v.created_date,
              completeness: calculateCompleteness(v)
            }))
          });
        }
      }
    }
    
    console.log('[Tomato Dedup] Found', duplicateGroups.length, 'duplicate groups');
    
    return Response.json({
      success: true,
      summary: {
        totalVarieties: allTomatoes.length,
        duplicateGroupsFound: duplicateGroups.length,
        totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0)
      },
      duplicateGroups: duplicateGroups.slice(0, 50) // First 50 groups
    });
    
  } catch (error) {
    console.error('[Tomato Dedup Dry Run] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});

function calculateCompleteness(variety) {
  const fields = [
    'description', 'days_to_maturity', 'spacing_recommended', 'plant_height_typical',
    'sun_requirement', 'water_requirement', 'growth_habit', 'seed_line_type',
    'flavor_profile', 'uses', 'fruit_color', 'fruit_shape', 'fruit_size',
    'disease_resistance', 'breeder_or_origin', 'grower_notes'
  ];
  
  let score = 0;
  for (const field of fields) {
    if (variety[field] != null && variety[field] !== '') {
      score++;
    }
  }
  
  // Bonus points for arrays
  if (variety.synonyms?.length > 0) score++;
  if (variety.images?.length > 0) score += 2;
  if (variety.sources?.length > 0) score++;
  
  return score;
}