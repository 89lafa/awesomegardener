import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const headers = [
      'common_name',
      'scientific_name',
      'plant_type_code',
      'plant_family_id',
      'plant_group_id',
      'description',
      'category',
      'icon',
      'synonyms',
      'is_perennial',
      'typical_spacing_min',
      'typical_spacing_max',
      'typical_sun',
      'typical_water',
      'default_days_to_maturity',
      'default_start_indoors_weeks',
      'default_transplant_weeks',
      'default_direct_sow_weeks_min',
      'default_direct_sow_weeks_max',
      'trellis_common',
      'color',
      'buy_seeds_link',
      'notes'
    ];

    const exampleRow = {
      common_name: 'Example Plant',
      plant_type_code: 'PT_EXAMPLE',
      category: 'vegetable',
      typical_sun: 'full_sun',
      typical_water: 'moderate',
      default_days_to_maturity: '70',
      default_start_indoors_weeks: '6',
      default_transplant_weeks: '2',
      default_direct_sow_weeks_min: '0',
      default_direct_sow_weeks_max: '4',
      trellis_common: 'false',
      is_perennial: 'false'
    };

    const csvLines = [headers.join(',')];
    const exampleValues = headers.map(h => exampleRow[h] || '');
    csvLines.push(exampleValues.join(','));

    return new Response(csvLines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="plant_type_import_template.csv"'
      }
    });
  } catch (error) {
    console.error('[GenerateTemplate] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});