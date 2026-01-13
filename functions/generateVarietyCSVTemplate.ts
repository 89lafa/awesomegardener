import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Define exact CSV headers expected by importer
    const headers = [
      // Required
      'variety_name',
      'plant_type_id',
      
      // Identifiers & Codes
      'variety_code',
      'plant_type_code',
      'plant_type_common_name',
      'plant_subcategory_code',
      'plant_subcategory_codes',
      
      // Basic Info
      'description',
      'synonyms',
      
      // Growing Info
      'days_to_maturity',
      'days_to_maturity_min',
      'days_to_maturity_max',
      'spacing_recommended',
      'spacing_min',
      'spacing_max',
      'plant_height_typical',
      'height_min',
      'height_max',
      
      // Timing Ranges
      'start_indoors_weeks_min',
      'start_indoors_weeks_max',
      'transplant_weeks_after_last_frost_min',
      'transplant_weeks_after_last_frost_max',
      'direct_sow_weeks_min',
      'direct_sow_weeks_max',
      
      // Requirements
      'sun_requirement',
      'water_requirement',
      'growth_habit',
      
      // Plant Characteristics
      'flavor_profile',
      'uses',
      'fruit_color',
      'fruit_shape',
      'fruit_size',
      'pod_color',
      'pod_shape',
      'pod_size',
      
      // Peppers
      'scoville_min',
      'scoville_max',
      'heat_scoville_min',
      'heat_scoville_max',
      'species',
      
      // Classification
      'seed_line_type',
      'season_timing',
      'popularity_tier',
      
      // Booleans
      'trellis_required',
      'container_friendly',
      'is_ornamental',
      'is_organic',
      
      // Notes & Attribution
      'grower_notes',
      'disease_resistance',
      'breeder_or_origin',
      'seed_saving_notes',
      'pollination_notes',
      'source_attribution',
      
      // Commercial
      'sources',
      'affiliate_url'
    ];

    // Create CSV with headers + 1 example row
    const exampleRow = {
      variety_name: 'Example Variety',
      plant_type_id: 'Use PlantType ID or plant_type_code',
      variety_code: 'VAR_EXAMPLE_001 (optional)',
      plant_type_code: 'PT_TOMATO (optional)',
      plant_subcategory_code: 'PSC_TOMATO_CHERRY (optional)',
      description: 'Detailed description here',
      days_to_maturity: '70',
      spacing_recommended: '18',
      sun_requirement: 'full_sun',
      water_requirement: 'moderate',
      species: 'lycopersicum (or annuum for peppers)',
      seed_line_type: 'heirloom',
      trellis_required: 'false',
      container_friendly: 'true',
      start_indoors_weeks_min: '6',
      start_indoors_weeks_max: '8',
      transplant_weeks_after_last_frost_min: '0',
      transplant_weeks_after_last_frost_max: '2',
      direct_sow_weeks_min: '0',
      direct_sow_weeks_max: '4'
    };

    const csvLines = [headers.join(',')];
    const exampleValues = headers.map(h => exampleRow[h] || '');
    csvLines.push(exampleValues.join(','));

    const csvContent = csvLines.join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="variety_import_template.csv"'
      }
    });
  } catch (error) {
    console.error('[GenerateTemplate] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message
    }, { status: 500 });
  }
});