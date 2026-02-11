import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results = {
      created: [],
      skipped: []
    };

    // Get all carnivorous PlantTypes
    const carnivTypes = await base44.asServiceRole.entities.PlantType.filter({
      category: "carnivorous"
    });
    
    const typeMap = {};
    carnivTypes.forEach(pt => {
      typeMap[pt.plant_type_code] = pt;
    });

    // Define default varieties for each carnivorous type
    const defaultVarieties = [];

    // VENUS FLYTRAP
    if (typeMap['PT_VENUS_FLYTRAP']) {
      defaultVarieties.push({
        plant_type_id: typeMap['PT_VENUS_FLYTRAP'].id,
        plant_type_name: typeMap['PT_VENUS_FLYTRAP'].common_name,
        variety_name: "Venus Flytrap (Standard)",
        description: "Classic Dionaea muscipula - the most iconic carnivorous plant. Snap-traps catch insects with lightning speed.",
        water_type_required: "distilled_only",
        fertilizer_rule: "foliar_only_dilute",
        dormancy_required: "required_cold",
        dormancy_temp_min_f: 35,
        dormancy_temp_max_f: 50,
        dormancy_duration_months_min: 3,
        dormancy_duration_months_max: 5,
        soil_type_required: "carnivorous_mix",
        watering_method_preferred: "tray",
        soil_dryness_rule: "keep_moist",
        humidity_preference: "moderate",
        light_requirement_indoor: "bright_direct",
        root_cooling_required: false,
        is_aquatic: false,
        care_difficulty: "moderate",
        care_warnings: [
          "Use ONLY distilled, reverse-osmosis, or rainwater — tap water minerals will kill this plant",
          "NEVER use potting soil or Miracle-Gro — use sphagnum peat + perlite only",
          "Do NOT fertilize the soil — dilute foliar spray (1/4 strength) monthly is OK for indoor plants",
          "REQUIRES 3-5 months cold dormancy (35-50°F) — skip this and the plant dies within 1-2 years",
          "Do not trigger traps for fun — each trap can only snap shut 5-7 times before it dies",
          "Keep pot in a tray of 1-2 inches of distilled water at all times during growing season"
        ]
      });
    }

    // PITCHER PLANT - Sarracenia
    if (typeMap['PT_PITCHER_PLANT']) {
      defaultVarieties.push({
        plant_type_id: typeMap['PT_PITCHER_PLANT'].id,
        plant_type_name: typeMap['PT_PITCHER_PLANT'].common_name,
        variety_name: "Pitcher Plant (Sarracenia)",
        description: "American pitcher plant - tall tubular traps fill with digestive fluid. Requires cold dormancy.",
        species: "Sarracenia",
        water_type_required: "distilled_only",
        fertilizer_rule: "foliar_only_dilute",
        dormancy_required: "required_cold",
        dormancy_temp_min_f: 35,
        dormancy_temp_max_f: 50,
        dormancy_duration_months_min: 3,
        dormancy_duration_months_max: 5,
        soil_type_required: "carnivorous_mix",
        watering_method_preferred: "tray",
        soil_dryness_rule: "keep_moist",
        light_requirement_indoor: "bright_direct",
        root_cooling_required: false,
        is_aquatic: false,
        care_difficulty: "moderate",
        care_warnings: [
          "Use ONLY distilled, reverse-osmosis, or rainwater — minerals are lethal",
          "NEVER use potting soil — sphagnum peat + perlite/sand only",
          "Do NOT fertilize soil — dilute foliar MaxSea spray monthly is OK for indoor plants",
          "REQUIRES 3-5 months cold dormancy (35-50°F) — essential for long-term survival",
          "Browning pitcher tops in fall are NORMAL dormancy — do not panic or over-water"
        ]
      });
    }

    // SUNDEW - Tropical
    if (typeMap['PT_SUNDEW']) {
      defaultVarieties.push({
        plant_type_id: typeMap['PT_SUNDEW'].id,
        plant_type_name: typeMap['PT_SUNDEW'].common_name,
        variety_name: "Cape Sundew",
        description: "Drosera capensis - the easiest beginner carnivorous plant. Sticky dew-covered leaves trap small insects.",
        species: "capensis",
        water_type_required: "distilled_only",
        fertilizer_rule: "foliar_only_dilute",
        dormancy_required: "none",
        soil_type_required: "carnivorous_mix",
        watering_method_preferred: "tray",
        soil_dryness_rule: "keep_moist",
        light_requirement_indoor: "bright_direct",
        root_cooling_required: false,
        is_aquatic: false,
        care_difficulty: "easy",
        care_warnings: [
          "Use ONLY distilled, RO, or rainwater — tap water kills sundews",
          "NEVER use potting soil — sphagnum peat + perlite only",
          "Do NOT fertilize soil — dilute foliar feeding monthly is OK",
          "No dormancy required — grow year-round under consistent conditions",
          "Cape Sundew (D. capensis) is the easiest beginner carnivorous plant"
        ]
      });
    }

    // BUTTERWORT
    if (typeMap['PT_BUTTERWORT']) {
      defaultVarieties.push({
        plant_type_id: typeMap['PT_BUTTERWORT'].id,
        plant_type_name: typeMap['PT_BUTTERWORT'].common_name,
        variety_name: "Mexican Butterwort",
        description: "Pinguicula spp. - sticky leaves catch fungus gnats. Forms succulent winter rosettes. Easy beginner plant.",
        water_type_required: "distilled_preferred",
        fertilizer_rule: "foliar_only_dilute",
        dormancy_required: "succulent_phase",
        soil_type_required: "custom",
        watering_method_preferred: "top",
        soil_dryness_rule: "top_inch_dry",
        humidity_preference: "moderate",
        light_requirement_indoor: "bright_indirect",
        root_cooling_required: false,
        is_aquatic: false,
        care_difficulty: "easy",
        care_warnings: [
          "Distilled or RO water recommended — Mexican species are somewhat tolerant but pure water is safest",
          "Use mineral mix: perlite + vermiculite + sand — NOT pure peat (unlike other carnivores)",
          "Do NOT fertilize soil — light monthly foliar feeding is OK",
          "Forms thick succulent winter leaves — reduce watering significantly when this happens",
          "Excellent natural fungus gnat control — sticky leaves catch gnats automatically",
          "Do NOT sit in standing water like Venus Flytraps — keep moist but well-drained"
        ]
      });
    }

    // Create varieties if they don't exist
    for (const v of defaultVarieties) {
      const existing = await base44.asServiceRole.entities.Variety.filter({
        plant_type_id: v.plant_type_id,
        variety_name: v.variety_name
      });
      
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Variety.create(v);
        results.created.push(v.variety_name);
      } else {
        results.skipped.push(v.variety_name);
      }
    }

    return Response.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error creating default carnivorous varieties:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});