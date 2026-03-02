import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results = {
      varieties_created: [],
      varieties_updated: []
    };

    // Get all carnivorous PlantTypes
    const allPlantTypes = await base44.asServiceRole.entities.PlantType.filter({
      category: "carnivorous"
    });
    
    if (allPlantTypes.length === 0) {
      return Response.json({
        error: 'No carnivorous plant types found. Run initializeCarnivorousPlants first.'
      }, { status: 400 });
    }

    const typeMap = {};
    allPlantTypes.forEach(pt => {
      typeMap[pt.plant_type_code] = pt.id;
    });

    // Define starter varieties for new types
    const starterVarieties = [
      // BLADDERWORT
      {
        plant_type_id: typeMap['PT_BLADDERWORT'],
        variety_name: "Rabbit Ears Bladderwort",
        description: "U. sandersonii - Adorable white-and-purple flowers resembling rabbit faces. Easiest terrestrial bladderwort for beginners.",
        water_type_required: "distilled_only",
        fertilizer_rule: "none_ever",
        dormancy_required: "none",
        soil_type_required: "carnivorous_mix",
        watering_method_preferred: "tray",
        soil_dryness_rule: "keep_moist",
        humidity_preference: "moderate",
        light_requirement_indoor: "bright_indirect",
        root_cooling_required: false,
        is_aquatic: false,
        care_difficulty: "easy",
        care_warnings: [
          "Use ONLY distilled, RO, or rainwater — NO tap water",
          "NEVER use potting soil with fertilizers — use sphagnum peat + perlite only",
          "Do NOT fertilize — bladder traps capture prey underground automatically",
          "Cannot be hand-fed — traps are microscopic and hidden in soil",
          "No dormancy required — grows year-round",
          "Keep soil very wet, almost semi-aquatic — let water rise above soil level occasionally",
          "One of the easiest carnivorous plants for beginners — beautiful flowers as a bonus"
        ]
      },
      {
        plant_type_id: typeMap['PT_BLADDERWORT'],
        variety_name: "Purple Bladderwort",
        description: "U. purpurea - Aquatic species with whorled leaves and purple flowers. Grows floating in acidic water.",
        water_type_required: "distilled_only",
        fertilizer_rule: "none_ever",
        dormancy_required: "none",
        soil_type_required: "aquatic_none",
        light_requirement_indoor: "bright_indirect",
        root_cooling_required: false,
        is_aquatic: true,
        care_difficulty: "moderate",
        care_warnings: [
          "Fully AQUATIC — grows floating in or below water surface, no soil needed",
          "Use ONLY distilled, RO, or rainwater — mineral-free, acidic, peaty water is ideal",
          "Do NOT fertilize — traps catch aquatic microorganisms automatically",
          "Peat layer at bottom of container provides tannins and CO2 the plant needs",
          "Algae is the #1 enemy — keep water nutrient-poor and slightly acidic (pH 5-7)"
        ]
      },
      // COBRA LILY
      {
        plant_type_id: typeMap['PT_COBRA_LILY'],
        variety_name: "Cobra Lily",
        description: "Darlingtonia californica - The iconic cobra-shaped pitcher plant. Native to cold mountain streams. EXPERT ONLY.",
        water_type_required: "distilled_only",
        fertilizer_rule: "none_ever",
        dormancy_required: "required_cold",
        dormancy_temp_min_f: 20,
        dormancy_temp_max_f: 45,
        dormancy_duration_months_min: 3,
        dormancy_duration_months_max: 5,
        soil_type_required: "carnivorous_mix",
        watering_method_preferred: "top",
        soil_dryness_rule: "keep_moist",
        humidity_preference: "high",
        light_requirement_indoor: "bright_direct",
        root_cooling_required: true,
        root_temp_max_f: 60,
        is_aquatic: false,
        care_difficulty: "expert",
        care_warnings: [
          "⚠️ EXPERT ONLY — the most difficult common carnivorous plant to cultivate",
          "ROOTS MUST STAY COOL — root zone temperature must stay BELOW 60°F (15°C) or plant WILL die",
          "Water with COOL or REFRIGERATED distilled/RO water — flush overhead daily to cool roots",
          "Place ICE CUBES (made from distilled water) on soil surface during hot weather",
          "Use ONLY distilled, RO, or rainwater — NO tap water",
          "NEVER fertilize — not even foliar spray (too little leaf surface to absorb safely)",
          "Use very light, airy soil mix: peat + perlite + lava rock — drainage and airflow are critical",
          "REQUIRES cold winter dormancy — can tolerate freezing down to 20°F when fully dormant",
          "Best grown OUTDOORS where night temps drop below 65°F — very difficult as a pure indoor plant",
          "Grows naturally along cold mountain streams — this is nearly impossible to replicate indoors"
        ]
      },
      // WATERWHEEL
      {
        plant_type_id: typeMap['PT_WATERWHEEL'],
        variety_name: "Waterwheel Plant",
        description: "Aldrovanda vesiculosa - The underwater Venus Flytrap. Free-floating aquatic carnivore with snap-traps. Endangered in the wild.",
        water_type_required: "distilled_only",
        fertilizer_rule: "none_ever",
        dormancy_required: "turion_aquatic",
        dormancy_temp_min_f: 35,
        dormancy_temp_max_f: 50,
        dormancy_duration_months_min: 3,
        dormancy_duration_months_max: 5,
        soil_type_required: "aquatic_none",
        humidity_preference: "high",
        light_requirement_indoor: "bright_indirect",
        root_cooling_required: false,
        is_aquatic: true,
        care_difficulty: "advanced",
        care_warnings: [
          "Fully AQUATIC — free-floating, rootless plant that lives entirely submerged in water",
          "NOT a potted plant — grows in shallow containers, tubs, or aquariums (30+ gallons ideal)",
          "Use ONLY distilled, RO, or rainwater — water should be acidic (pH 5-6.8) and tannin-rich",
          "Add 1-3 inches of peat moss and leaf litter to container bottom — releases vital tannins and CO2",
          "NEVER fertilize — gets all nutrients from catching daphnia, mosquito larvae, and microorganisms",
          "Algae is the #1 killer — keep water nutrient-poor; companion plants like salvinia help shade water",
          "Temperate forms require winter dormancy — plant forms turions (winter buds) that sink to bottom",
          "For indoor dormancy: store turions in peat slurry in the refrigerator over winter",
          "Ideal growing temperature: water 73-86°F during active season",
          "Endangered in the wild — always buy from reputable nurseries, never wild-collected"
        ]
      }
    ];

    // Create starter varieties
    for (const variety of starterVarieties) {
      const existing = await base44.asServiceRole.entities.Variety.filter({
        variety_name: variety.variety_name,
        plant_type_id: variety.plant_type_id
      });
      
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Variety.create(variety);
        results.varieties_created.push(variety.variety_name);
      }
    }

    return Response.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error populating carnivorous varieties:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});