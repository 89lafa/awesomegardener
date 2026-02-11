import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results = {
      venus_flytrap: 0,
      pitcher_plant_sarracenia: 0,
      pitcher_plant_nepenthes: 0,
      sundew_tropical: 0,
      sundew_temperate: 0,
      butterwort: 0,
      skipped: 0
    };

    // Get all carnivorous PlantTypes
    const carnivTypes = await base44.asServiceRole.entities.PlantType.filter({
      category: "carnivorous"
    });
    
    const typeCodeMap = {};
    carnivTypes.forEach(pt => {
      typeCodeMap[pt.plant_type_code] = pt.id;
    });

    // Update Venus Flytraps
    if (typeCodeMap['PT_VENUS_FLYTRAP']) {
      const vft = await base44.asServiceRole.entities.Variety.filter({
        plant_type_id: typeCodeMap['PT_VENUS_FLYTRAP']
      });
      
      for (const v of vft) {
        await base44.asServiceRole.entities.Variety.update(v.id, {
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
        results.venus_flytrap++;
      }
    }

    // Update Pitcher Plants (distinguish Sarracenia vs Nepenthes by species field)
    if (typeCodeMap['PT_PITCHER_PLANT']) {
      const pitchers = await base44.asServiceRole.entities.Variety.filter({
        plant_type_id: typeCodeMap['PT_PITCHER_PLANT']
      });
      
      for (const v of pitchers) {
        const isNepenthes = v.species?.toLowerCase().includes('nepenthes');
        
        if (isNepenthes) {
          // Tropical Nepenthes
          await base44.asServiceRole.entities.Variety.update(v.id, {
            water_type_required: "distilled_preferred",
            fertilizer_rule: "foliar_only_dilute",
            dormancy_required: "none",
            soil_type_required: "custom",
            watering_method_preferred: "top",
            soil_dryness_rule: "top_inch_dry",
            humidity_preference: "high",
            light_requirement_indoor: "bright_indirect",
            root_cooling_required: false,
            is_aquatic: false,
            care_difficulty: "moderate",
            care_warnings: [
              "Distilled or RO water strongly recommended — more tolerant than other carnivores but minerals still harmful",
              "Use open airy mix: long-fiber sphagnum + perlite + orchid bark — NOT standard peat mix",
              "Do NOT waterlog — keep moist but never standing water (unlike Sarracenia)",
              "Monthly dilute fertilizer on pitchers is RECOMMENDED — Nepenthes benefit from feeding",
              "No dormancy needed — keep warm year-round (60-85°F)",
              "High humidity (50-80%) helps pitchers form — mist regularly or use humidity tray"
            ]
          });
          results.pitcher_plant_nepenthes++;
        } else {
          // American Sarracenia
          await base44.asServiceRole.entities.Variety.update(v.id, {
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
          results.pitcher_plant_sarracenia++;
        }
      }
    }

    // Update Sundews (distinguish tropical vs temperate by species)
    if (typeCodeMap['PT_SUNDEW']) {
      const sundews = await base44.asServiceRole.entities.Variety.filter({
        plant_type_id: typeCodeMap['PT_SUNDEW']
      });
      
      const temperateSpecies = ['rotundifolia', 'filiformis', 'anglica', 'intermedia', 'linearis'];
      
      for (const v of sundews) {
        const isTemperate = temperateSpecies.some(sp => v.species?.toLowerCase().includes(sp));
        
        if (isTemperate) {
          // Temperate Sundew
          await base44.asServiceRole.entities.Variety.update(v.id, {
            water_type_required: "distilled_only",
            fertilizer_rule: "foliar_only_dilute",
            dormancy_required: "required_cold",
            dormancy_temp_min_f: 35,
            dormancy_temp_max_f: 50,
            dormancy_duration_months_min: 3,
            dormancy_duration_months_max: 4,
            soil_type_required: "carnivorous_mix",
            watering_method_preferred: "tray",
            soil_dryness_rule: "keep_moist",
            light_requirement_indoor: "bright_direct",
            root_cooling_required: false,
            is_aquatic: false,
            care_difficulty: "moderate",
            care_warnings: [
              "Use ONLY distilled, RO, or rainwater — tap water kills carnivorous plants",
              "NEVER use potting soil — sphagnum peat + perlite only",
              "Do NOT fertilize soil — dilute foliar feeding monthly is OK",
              "REQUIRES cold winter dormancy — will form hibernaculum (winter bud)",
              "Keep in tray of distilled water during growing season"
            ]
          });
          results.sundew_temperate++;
        } else {
          // Tropical Sundew (default - capensis, adelae, binata, etc.)
          await base44.asServiceRole.entities.Variety.update(v.id, {
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
          results.sundew_tropical++;
        }
      }
    }

    // Update Butterworts
    if (typeCodeMap['PT_BUTTERWORT']) {
      const butterworts = await base44.asServiceRole.entities.Variety.filter({
        plant_type_id: typeCodeMap['PT_BUTTERWORT']
      });
      
      for (const v of butterworts) {
        await base44.asServiceRole.entities.Variety.update(v.id, {
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
        results.butterwort++;
      }
    }

    return Response.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error updating carnivorous varieties:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});