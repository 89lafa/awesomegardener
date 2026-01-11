import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'Missing file_url' }, { status: 400 });
    }

    console.log('[ImportPlantTypes] Fetching CSV from:', file_url);

    // Fetch CSV file
    const response = await fetch(file_url);
    const csvText = await response.text();

    // Parse CSV
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return Response.json({ error: 'Empty CSV file' }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index]?.trim() || '';
      });
      data.push(obj);
    }

    console.log('[ImportPlantTypes] Parsed', data.length, 'rows');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of data) {
      if (!row.common_name || row.common_name.length < 2) {
        skipped++;
        continue;
      }

      const plantTypeData = {
        plant_type_code: row.plant_type_code || null,
        common_name: row.common_name,
        scientific_name: row.scientific_name || null,
        description: row.description || null,
        is_perennial: row.is_perennial === 'true' || row.is_perennial === '1',
        category: row.category || 'vegetable',
        icon: row.icon || null,
        typical_spacing_min: row.typical_spacing_min ? parseFloat(row.typical_spacing_min) : null,
        typical_spacing_max: row.typical_spacing_max ? parseFloat(row.typical_spacing_max) : null,
        typical_sun: row.typical_sun || null,
        typical_water: row.typical_water || null,
        trellis_common: row.trellis_common === 'true' || row.trellis_common === '1',
        default_days_to_maturity: row.default_days_to_maturity ? parseFloat(row.default_days_to_maturity) : null,
        default_start_indoors_weeks: row.default_start_indoors_weeks ? parseFloat(row.default_start_indoors_weeks) : null,
        default_transplant_weeks: row.default_transplant_weeks ? parseFloat(row.default_transplant_weeks) : null,
        color: row.color || null
      };

      // Check if exists by plant_type_code or common_name
      const existing = await base44.asServiceRole.entities.PlantType.filter({
        $or: [
          { plant_type_code: row.plant_type_code },
          { common_name: row.common_name }
        ]
      });

      if (existing.length > 0) {
        await base44.asServiceRole.entities.PlantType.update(existing[0].id, plantTypeData);
        updated++;
      } else {
        await base44.asServiceRole.entities.PlantType.create(plantTypeData);
        created++;
      }
    }

    console.log('[ImportPlantTypes] Import complete:', { created, updated, skipped });

    return Response.json({
      success: true,
      created,
      updated,
      skipped,
      total: data.length
    });
  } catch (error) {
    console.error('[ImportPlantTypes] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});