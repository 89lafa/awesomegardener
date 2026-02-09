import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { variety_name, plant_type_name } = await req.json();

    if (!variety_name || !plant_type_name) {
      return Response.json({ error: 'variety_name and plant_type_name required' }, { status: 400 });
    }

    // STEP 1: Exact match on variety_name
    let matches = await base44.asServiceRole.entities.Variety.filter({
      variety_name: variety_name,
      status: 'active'
    });

    if (matches.length === 1) {
      return Response.json({
        match: matches[0],
        confidence: 'exact',
        action: 'link_barcode'
      });
    }

    // STEP 2: Find PlantType by name
    const plantTypes = await base44.asServiceRole.entities.PlantType.filter({
      common_name: plant_type_name
    });

    if (plantTypes.length === 0) {
      return Response.json({
        match: null,
        confidence: 'none',
        action: 'create_new',
        message: 'Plant type not found - will create new'
      });
    }

    const plantTypeId = plantTypes[0].id;

    // STEP 3: Fuzzy match - normalize and search
    const normalized = variety_name
      .replace(/^(organic\s+)/i, '')
      .replace(/\s+(seeds?|packet)$/i, '')
      .trim();

    const sameType = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: plantTypeId,
      status: 'active'
    });

    const fuzzyMatches = sameType.filter(v => {
      const vName = (v.variety_name || '').toLowerCase();
      const search = normalized.toLowerCase();
      return vName.includes(search) || search.includes(vName);
    });

    if (fuzzyMatches.length === 1) {
      return Response.json({
        match: fuzzyMatches[0],
        confidence: 'fuzzy',
        action: 'link_barcode'
      });
    }

    if (fuzzyMatches.length > 1) {
      return Response.json({
        matches: fuzzyMatches,
        confidence: 'multiple',
        action: 'user_choose'
      });
    }

    // STEP 4: No match - new variety
    return Response.json({
      match: null,
      plant_type_id: plantTypeId,
      confidence: 'none',
      action: 'create_new'
    });

  } catch (error) {
    console.error('[FindVariety] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});