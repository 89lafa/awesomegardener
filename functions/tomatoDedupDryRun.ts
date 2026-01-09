import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Find Tomato plant type
    const plantTypes = await base44.asServiceRole.entities.PlantType.list();
    const tomatoType = plantTypes.find(pt => 
      pt.common_name?.toLowerCase() === 'tomato' || 
      pt.common_name?.toLowerCase() === 'tomatoes'
    );

    if (!tomatoType) {
      return Response.json({ error: 'Tomato plant type not found' }, { status: 404 });
    }

    const varieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: tomatoType.id,
      status: 'active'
    });

    console.log('[TomatoDedup] Found', varieties.length, 'active tomato varieties');

    const normalizeVarietyName = (name) => {
      if (!name) return '';
      return name
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\(organic\)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Group by variety_code first, then normalized name
    const groups = [];
    const processed = new Set();

    // Pass 1: Group by variety_code
    for (const v of varieties) {
      if (processed.has(v.id) || !v.variety_code) continue;
      
      const codeGroup = varieties.filter(other => 
        other.variety_code === v.variety_code && 
        other.plant_type_id === v.plant_type_id
      );
      
      if (codeGroup.length > 1) {
        groups.push({
          key: `code:${v.variety_code}`,
          varieties: codeGroup.map(x => x.id),
          sample: codeGroup[0].variety_name,
          count: codeGroup.length
        });
        codeGroup.forEach(x => processed.add(x.id));
      }
    }

    // Pass 2: Group by normalized name
    for (const v of varieties) {
      if (processed.has(v.id)) continue;
      
      const normalized = normalizeVarietyName(v.variety_name);
      if (!normalized) continue;
      
      const nameGroup = varieties.filter(other => 
        !processed.has(other.id) &&
        normalizeVarietyName(other.variety_name) === normalized &&
        other.plant_type_id === v.plant_type_id
      );
      
      if (nameGroup.length > 1) {
        groups.push({
          key: `name:${normalized}`,
          varieties: nameGroup.map(x => x.id),
          sample: nameGroup[0].variety_name,
          count: nameGroup.length
        });
        nameGroup.forEach(x => processed.add(x.id));
      }
    }

    console.log('[TomatoDedup] Found', groups.length, 'duplicate groups');

    return Response.json({
      success: true,
      duplicate_groups: groups.length,
      total_duplicates: groups.reduce((sum, g) => sum + g.count - 1, 0),
      groups: groups.slice(0, 20) // Preview first 20
    });
  } catch (error) {
    console.error('[TomatoDedup] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});