import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const headers = [
      'subcat_code',
      'plant_type_id',
      'name',
      'dimension',
      'scientific_name',
      'synonyms',
      'description',
      'icon',
      'color',
      'sort_order',
      'is_active'
    ];

    const exampleRow = {
      subcat_code: 'PSC_TOMATO_CHERRY',
      plant_type_id: 'Use PlantType ID or code',
      name: 'Cherry Tomato',
      dimension: 'FruitSize',
      is_active: 'true',
      sort_order: '0'
    };

    const csvLines = [headers.join(',')];
    const exampleValues = headers.map(h => exampleRow[h] || '');
    csvLines.push(exampleValues.join(','));

    return new Response(csvLines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="subcategory_import_template.csv"'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});