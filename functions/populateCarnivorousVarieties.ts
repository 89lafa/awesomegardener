import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Carnivorous variety care profiles
const CARE_PROFILES = {
  'PT_VENUS_FLYTRAP': {
    water_type_required: 'distilled_only',
    fertilizer_rule: 'foliar_only_dilute',
    dormancy_required: 'required_cold',
    dormancy_temp_min_f: 35,
    dormancy_temp_max_f: 50,
    dormancy_duration_months_min: 3,
    dormancy_duration_months_max: 5,
    soil_type_required: 'carnivorous_mix',
    watering_method_preferred: 'tray',
    soil_dryness_rule: 'keep_moist',
    humidity_preference: 'medium',
    light_requirement_indoor: 'bright_direct',
    root_cooling_required: false,
    is_aquatic: false,
    care_difficulty: 'moderate',
    care_warnings: [
      "Use ONLY distilled, reverse-osmosis, or rainwater — tap water minerals will kill this plant",
      "NEVER use potting soil or Miracle-Gro — use sphagnum peat + perlite only",
      "Do NOT fertilize the soil — dilute foliar spray (1/4 strength) monthly is OK for indoor plants",
      "REQUIRES 3-5 months cold dormancy (35-50°F) — skip this and the plant dies within 1-2 years",
      "Do not trigger traps for fun — each trap can only snap shut 5-7 times before it dies",
      "Keep pot in a tray of 1-2 inches of distilled water at all times during growing season"
    ]
  },
  'PT_PITCHER_PLANT_SARRACENIA': {
    water_type_required: 'distilled_only',
    fertilizer_rule: 'foliar_only_dilute',
    dormancy_required: 'required_cold',
    dormancy_temp_min_f: 35,
    dormancy_temp_max_f: 50,
    dormancy_duration_months_min: 3,
    dormancy_duration_months_max: 5,
    soil_type_required: 'carnivorous_mix',
    watering_method_preferred: 'tray',
    soil_dryness_rule: 'keep_moist',
    light_requirement_indoor: 'bright_direct',
    root_cooling_required: false,
    is_aquatic: false,
    care_difficulty: 'moderate',
    care_warnings: [
      "Use ONLY distilled, reverse-osmosis, or rainwater — minerals are lethal",
      "NEVER use potting soil — sphagnum peat + perlite/sand only",
      "Do NOT fertilize soil — dilute foliar MaxSea spray monthly is OK for indoor plants",
      "REQUIRES 3-5 months cold dormancy (35-50°F) — essential for long-term survival",
      "Browning pitcher tops in fall are NORMAL dormancy — do not panic or over-water"
    ]
  },
  'PT_PITCHER_PLANT_NEPENTHES': {
    water_type_required: 'distilled_preferred',
    fertilizer_rule: 'foliar_only_dilute',
    dormancy_required: 'none',
    soil_type_required: 'custom',
    watering_method_preferred: 'top',
    soil_dryness_rule: 'top_inch_dry',
    humidity_preference: 'high',
    light_requirement_indoor: 'bright_indirect',
    root_cooling_required: false,
    is_aquatic: false,
    care_difficulty: 'moderate',
    care_warnings: [
      "Distilled or RO water strongly recommended — more tolerant than other carnivores but minerals still harmful",
      "Use open airy mix: long-fiber sphagnum + perlite + orchid bark — NOT standard peat mix",
      "Do NOT waterlog — keep moist but never standing water (unlike Sarracenia)",
      "Monthly dilute fertilizer on pitchers is RECOMMENDED — Nepenthes benefit from feeding",
      "No dormancy needed — keep warm year-round (60-85°F)",
      "High humidity (50-80%) helps pitchers form — mist regularly or use humidity tray"
    ]
  },
  'PT_SUNDEW_TROPICAL': {
    water_type_required: 'distilled_only',
    fertilizer_rule: 'foliar_only_dilute',
    dormancy_required: 'none',
    soil_type_required: 'carnivorous_mix',
    watering_method_preferred: 'tray',
    soil_dryness_rule: 'keep_moist',
    light_requirement_indoor: 'bright_direct',
    root_cooling_required: false,
    is_aquatic: false,
    care_difficulty: 'easy',
    care_warnings: [
      "Use ONLY distilled, RO, or rainwater — tap water kills sundews",
      "NEVER use potting soil — sphagnum peat + perlite only",
      "Do NOT fertilize soil — dilute foliar feeding monthly is OK",
      "No dormancy required — grow year-round under consistent conditions",
      "Cape Sundew (D. capensis) is the easiest beginner carnivorous plant"
    ]
  },
  'PT_SUNDEW_TEMPERATE': {
    water_type_required: 'distilled_only',
    fertilizer_rule: 'foliar_only_dilute',
    dormancy_required: 'required_cold',
    dormancy_temp_min_f: 35,
    dormancy_temp_max_f: 50,
    dormancy_duration_months_min: 3,
    dormancy_duration_months_max: 4,
    soil_type_required: 'carnivorous_mix',
    watering_method_preferred: 'tray',
    soil_dryness_rule: 'keep_moist',
    light_requirement_indoor: 'bright_direct',
    root_cooling_required: false,
    is_aquatic: false,
    care_difficulty: 'moderate',
    care_warnings: [
      "Use ONLY distilled, RO, or rainwater — tap water kills carnivorous plants",
      "NEVER use potting soil — sphagnum peat + perlite only",
      "Do NOT fertilize soil — dilute foliar feeding monthly is OK",
      "REQUIRES cold winter dormancy — will form hibernaculum (winter bud)",
      "Keep in tray of distilled water during growing season"
    ]
  },
  'PT_BUTTERWORT': {
    water_type_required: 'distilled_preferred',
    fertilizer_rule: 'foliar_only_dilute',
    dormancy_required: 'succulent_phase',
    soil_type_required: 'custom',
    watering_method_preferred: 'top',
    soil_dryness_rule: 'top_inch_dry',
    humidity_preference: 'medium',
    light_requirement_indoor: 'bright_indirect',
    root_cooling_required: false,
    is_aquatic: false,
    care_difficulty: 'easy',
    care_warnings: [
      "Distilled or RO water recommended — Mexican species are somewhat tolerant but pure water is safest",
      "Use mineral mix: perlite + vermiculite + sand — NOT pure peat (unlike other carnivores)",
      "Do NOT fertilize soil — light monthly foliar feeding is OK",
      "Forms thick succulent winter leaves — reduce watering significantly when this happens",
      "Excellent natural fungus gnat control — sticky leaves catch gnats automatically",
      "Do NOT sit in standing water like Venus Flytraps — keep moist but well-drained"
    ]
  },
  'PT_BLADDERWORT': {
    water_type_required: 'distilled_only',
    fertilizer_rule: 'none_ever',
    dormancy_required: 'none',
    soil_type_required: 'carnivorous_mix',
    watering_method_preferred: 'tray',
    soil_dryness_rule: 'keep_moist',
    humidity_preference: 'medium',
    light_requirement_indoor: 'bright_indirect',
    root_cooling_required: false,
    is_aquatic: false,
    care_difficulty: 'easy',
    care_warnings: [
      "Use ONLY distilled, RO, or rainwater — NO tap water",
      "NEVER use potting soil or soil with added fertilizers — use sphagnum peat + perlite only",
      "Do NOT fertilize — traps catch prey underground (soil mites, fungus gnat larvae) automatically",
      "Cannot be hand-fed — bladder traps are microscopic and hidden underground",
      "No dormancy required for tropical species — grow year-round",
      "Keep soil very wet, almost semi-aquatic — let water rise above soil level occasionally",
      "One of the easiest carnivorous plants for beginners — beautiful flowers as a bonus"
    ]
  },
  'PT_COBRA_LILY': {
    water_type_required: 'distilled_only',
    fertilizer_rule: 'none_ever',
    dormancy_required: 'required_cold',
    dormancy_temp_min_f: 20,
    dormancy_temp_max_f: 45,
    dormancy_duration_months_min: 3,
    dormancy_duration_months_max: 5,
    soil_type_required: 'carnivorous_mix',
    watering_method_preferred: 'top',
    soil_dryness_rule: 'keep_moist',
    humidity_preference: 'high',
    light_requirement_indoor: 'bright_direct',
    root_cooling_required: true,
    root_temp_max_f: 60,
    is_aquatic: false,
    care_difficulty: 'expert',
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
  'PT_WATERWHEEL': {
    water_type_required: 'distilled_only',
    fertilizer_rule: 'none_ever',
    dormancy_required: 'turion_aquatic',
    dormancy_temp_min_f: 35,
    dormancy_temp_max_f: 50,
    dormancy_duration_months_min: 3,
    dormancy_duration_months_max: 5,
    soil_type_required: 'aquatic_none',
    watering_method_preferred: 'tray',
    humidity_preference: 'high',
    light_requirement_indoor: 'bright_indirect',
    root_cooling_required: false,
    is_aquatic: true,
    care_difficulty: 'advanced',
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
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { dry_run = true } = await req.json().catch(() => ({}));
    const log = [];
    
    log.push(`Mode: ${dry_run ? 'DRY RUN' : 'LIVE UPDATE'}`);
    log.push('Populating carnivorous variety care data...');

    // Get all carnivorous PlantTypes
    const carnivorousTypes = await base44.asServiceRole.entities.PlantType.filter({ category: 'carnivorous' });
    log.push(`Found ${carnivorousTypes.length} carnivorous plant types`);

    let updated = 0;
    for (const plantType of carnivorousTypes) {
      const varieties = await base44.asServiceRole.entities.Variety.filter({ plant_type_id: plantType.id });
      log.push(`${plantType.common_name} (${plantType.plant_type_code}): ${varieties.length} varieties`);

      for (const variety of varieties) {
        let profile = null;

        // Determine profile based on plant type and species
        if (plantType.plant_type_code === 'PT_VENUS_FLYTRAP') {
          profile = CARE_PROFILES['PT_VENUS_FLYTRAP'];
        } else if (plantType.plant_type_code === 'PT_PITCHER_PLANT') {
          // Check species for Nepenthes vs Sarracenia
          if (variety.species && variety.species.toLowerCase().includes('nepenthes')) {
            profile = CARE_PROFILES['PT_PITCHER_PLANT_NEPENTHES'];
          } else {
            profile = CARE_PROFILES['PT_PITCHER_PLANT_SARRACENIA'];
          }
        } else if (plantType.plant_type_code === 'PT_SUNDEW') {
          // Check for temperate vs tropical
          const temperateSundews = ['rotundifolia', 'filiformis', 'anglica', 'intermedia'];
          const isTemperate = variety.species && temperateSundews.some(s => variety.species.toLowerCase().includes(s));
          profile = isTemperate ? CARE_PROFILES['PT_SUNDEW_TEMPERATE'] : CARE_PROFILES['PT_SUNDEW_TROPICAL'];
        } else if (plantType.plant_type_code === 'PT_BUTTERWORT') {
          profile = CARE_PROFILES['PT_BUTTERWORT'];
        } else if (plantType.plant_type_code === 'PT_BLADDERWORT') {
          profile = CARE_PROFILES['PT_BLADDERWORT'];
        } else if (plantType.plant_type_code === 'PT_COBRA_LILY') {
          profile = CARE_PROFILES['PT_COBRA_LILY'];
        } else if (plantType.plant_type_code === 'PT_WATERWHEEL') {
          profile = CARE_PROFILES['PT_WATERWHEEL'];
        }

        if (profile && !dry_run) {
          await base44.asServiceRole.entities.Variety.update(variety.id, profile);
          updated++;
        }
      }
    }

    log.push(`${dry_run ? 'Would update' : 'Updated'} ${dry_run ? varieties.length : updated} varieties`);

    return Response.json({ success: true, log, updated, dry_run });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});