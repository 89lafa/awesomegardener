Deno.serve(async (req) => {
  try {

    // IndoorPlant template with all fields
    const headers = [
      'id',
      'variety_id',
      'nickname',
      'acquisition_date',
      'acquisition_source',
      'acquired_from',
      'purchase_price',
      'indoor_space_id',
      'tier_id',
      'grid_position_x',
      'grid_position_y',
      'pot_type',
      'pot_size_inches',
      'pot_color',
      'soil_type',
      'has_drainage',
      'watering_frequency_days',
      'last_watered_date',
      'fertilizing_frequency_weeks',
      'last_fertilized_date',
      'health_status',
      'current_height_inches',
      'current_width_inches',
      'primary_photo_url',
      'is_active'
    ];

    const exampleRow = [
      '',
      '6959abc123def456789',
      'Monstera Monica',
      '2024-01-15',
      'purchased',
      'Plant Shop Downtown',
      '29.99',
      '',
      '',
      '0',
      '0',
      'ceramic',
      '8',
      'white',
      'potting_soil_general',
      'true',
      '7',
      '2024-01-15',
      '2',
      '2024-01-15',
      'healthy',
      '12',
      '8',
      '',
      'true'
    ];

    const csvContent = [
      headers.join(','),
      exampleRow.join(','),
      headers.map(() => '').join(',')
    ].join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="indoor_plant_template.csv"'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});