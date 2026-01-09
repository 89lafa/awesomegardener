import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Find Pepper plant type
    const plantTypes = await base44.asServiceRole.entities.PlantType.list();
    const pepperType = plantTypes.find(pt => 
      pt.common_name?.toLowerCase() === 'pepper' || 
      pt.common_name?.toLowerCase() === 'peppers'
    );

    if (!pepperType) {
      return Response.json({ error: 'Pepper plant type not found' }, { status: 404 });
    }

    // Load all active pepper varieties
    const varieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: pepperType.id,
      status: 'active'
    }, 'variety_name');

    // Filter varieties missing SHU or with SHU=0 (and not confidently sweet)
    const missing = varieties.filter(v => {
      const shuMax = v.scoville_max ?? v.heat_scoville_max ?? v.traits?.scoville_max ?? null;
      
      if (shuMax === null || shuMax === undefined) return true;
      
      if (shuMax === 0) {
        const nameLower = (v.variety_name || '').toLowerCase();
        const isSweet = nameLower.includes('bell') || 
                        nameLower.includes('sweet') || 
                        nameLower.includes('pimento');
        return !isSweet; // Include if NOT confidently sweet
      }
      
      return false;
    });

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
      'seed_line_type'
    ];

    const rows = missing.map(v => [
      v.id || '',
      v.variety_code || '',
      v.variety_name || '',
      v.plant_type_id || '',
      v.plant_subcategory_id || '',
      Array.isArray(v.plant_subcategory_ids) ? v.plant_subcategory_ids.join(';') : '',
      v.scoville_min ?? v.heat_scoville_min ?? '',
      v.scoville_max ?? v.heat_scoville_max ?? '',
      v.species || '',
      v.seed_line_type || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape cells containing commas or quotes
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
    ].join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=peppers_missing_shu_${new Date().toISOString().split('T')[0]}.csv`
      }
    });
  } catch (error) {
    console.error('[ExportPeppersSHU] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});