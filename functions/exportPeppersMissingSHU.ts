import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[Export Peppers Missing SHU] Starting export...');
    
    // Find Pepper PlantType
    const pepperTypes = await base44.asServiceRole.entities.PlantType.filter({ 
      common_name: 'Pepper' 
    });
    
    if (pepperTypes.length === 0) {
      return Response.json({ error: 'Pepper plant type not found' }, { status: 404 });
    }
    
    const pepperTypeId = pepperTypes[0].id;
    
    // Load all active Pepper varieties with missing or 0 SHU
    const allPeppers = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: pepperTypeId,
      status: 'active'
    }, 'variety_name', 10000);
    
    // Filter for missing SHU
    const missingSHU = allPeppers.filter(v => {
      const scovilleMax = v.scoville_max ?? v.heat_scoville_max;
      const scovilleMin = v.scoville_min ?? v.heat_scoville_min;
      
      // Include if both are null/undefined OR both are 0 and name doesn't suggest sweet
      const isMissing = (scovilleMax == null && scovilleMin == null);
      const is0AndNotSweet = (scovilleMax === 0 || scovilleMin === 0) && 
                             !v.variety_name?.toLowerCase().match(/bell|sweet|pimento/);
      
      return isMissing || is0AndNotSweet;
    });
    
    console.log('[Export] Found', missingSHU.length, 'peppers with missing/uncertain SHU');
    
    // Generate CSV
    const headers = [
      'id',
      'variety_code',
      'variety_name',
      'plant_type_id',
      'plant_subcategory_id',
      'plant_subcategory_ids',
      'scoville_min',
      'scoville_max',
      'species',
      'seed_line_type',
      'description'
    ];
    
    const rows = [headers.join(',')];
    
    for (const v of missingSHU) {
      const row = [
        v.id || '',
        v.variety_code || '',
        `"${(v.variety_name || '').replace(/"/g, '""')}"`,
        v.plant_type_id || '',
        v.plant_subcategory_id || '',
        `"${JSON.stringify(v.plant_subcategory_ids || [])}"`,
        v.scoville_min ?? v.heat_scoville_min ?? '',
        v.scoville_max ?? v.heat_scoville_max ?? '',
        v.species || '',
        v.seed_line_type || '',
        `"${(v.description || '').replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    }
    
    const csv = rows.join('\n');
    
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=peppers_missing_shu.csv'
      }
    });
    
  } catch (error) {
    console.error('[Export Peppers Missing SHU] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});