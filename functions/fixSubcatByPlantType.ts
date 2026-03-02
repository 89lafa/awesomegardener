import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Repairs plant_subcategory_id for a single plant type's varieties that have it wiped to null.
 * Covers Tomato, Pepper, Cucumber, Bean, Lettuce, Squash, Basil, Carrot, Onion, Corn,
 * Spinach, Kale, Brassica (Cabbage/Broccoli/Cauliflower/Brussels), Herb, Flower, and more.
 *
 * POST { plant_type_id, dry_run }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const plantTypeId = body.plant_type_id || url.searchParams.get('plant_type_id');
    const isDryRun = body.dry_run !== false && body.dry_run !== 'false';

    if (!plantTypeId) {
      return Response.json({ error: 'plant_type_id is required' }, { status: 400 });
    }

    // Load subcats for this plant type
    const subcats = await base44.asServiceRole.entities.PlantSubCategory.filter({ plant_type_id: plantTypeId });

    // Build lookup map by code (try many formats)
    const subcatByCode = {};
    subcats.forEach(sc => {
      if (!sc.subcat_code) return;
      const code = sc.subcat_code;
      subcatByCode[code] = sc;
      subcatByCode[code.toUpperCase()] = sc;
      // without PSC_ prefix
      const noPsc = code.replace(/^PSC_/, '');
      subcatByCode[noPsc] = sc;
      subcatByCode['PSC_' + noPsc] = sc;
    });

    const findSubcat = (code) => {
      if (!code) return null;
      return subcatByCode[code] || subcatByCode[code.toUpperCase()] || null;
    };

    // Try an ordered list of codes, return the first found
    const tryFindSubcat = (codes) => {
      for (const c of codes) {
        const found = findSubcat(c);
        if (found) return found;
      }
      return null;
    };

    // Load all varieties for this plant type that are missing subcategory
    const toFix = await base44.asServiceRole.entities.Variety.filter(
      { plant_type_id: plantTypeId, plant_subcategory_id: null, status: 'active' },
      'variety_name',
      9999
    );

    console.log(`[fixSubcatByPlantType] ${plantTypeId}: ${toFix.length} varieties missing subcat`);
    console.log('Available subcats:', subcats.map(s => `${s.subcat_code}=${s.name}`).join(', '));

    if (toFix.length === 0) {
      return Response.json({ success: true, dry_run: isDryRun, plant_type_id: plantTypeId, total_missing: 0, fixed: 0, no_match: 0, sample_fixes: [], no_match_sample: [], message: 'Nothing to fix!' });
    }

    // ─── Matching rules per plant type ─────────────────────────────

    // TOMATO
    const TOMATO_SHAPE_RULES = [
      { pattern: /cherry|spoon/i, codes: ['PSC_TOMATO_CHERRY_SMALL', 'TOM_CHERRY', 'PSC_TOM_CHERRY', 'TOMATO_CHERRY'] },
      { pattern: /grape/i, codes: ['PSC_TOMATO_GRAPE', 'TOM_GRAPE', 'PSC_TOM_GRAPE', 'TOMATO_GRAPE'] },
      { pattern: /plum|roma|paste|sauce|oval|elongated|sausage|pepper-shaped|finger/i, codes: ['PSC_TOMATO_PASTE_ROMA', 'TOM_PLUM', 'PSC_TOM_PLUM', 'TOMATO_PLUM', 'TOMATO_PASTE', 'PSC_TOMATO_PASTE'] },
      { pattern: /beefsteak|large/i, codes: ['PSC_TOMATO_BEEFSTEAK', 'TOM_BEEFSTEAK', 'PSC_TOM_BEEFSTEAK', 'TOMATO_BEEFSTEAK'] },
      { pattern: /oxheart|heart|heart.?shaped/i, codes: ['PSC_TOMATO_OXHEART', 'TOM_OXHEART', 'PSC_TOM_OXHEART', 'TOMATO_OXHEART'] },
      { pattern: /currant/i, codes: ['PSC_TOM_CURRANT_SPOON', 'TOMATO_CURRANT', 'TOM_CURRANT_SPOON'] },
      { pattern: /slicer|globe|oblate|round|flat|flattened|ribbed/i, codes: ['PSC_TOMATO_SLICER', 'TOM_SLICER', 'PSC_TOM_SLICER', 'TOMATO_SLICER'] },
      { pattern: /dwarf|micro|compact|tiny/i, codes: ['PSC_TOMATO_DWARF_COMPACT', 'PSC_TOM_DWARF', 'TOMATO_DWARF', 'TOMATO_MICRO'] },
      { pattern: /pear|fig/i, codes: ['PSC_TOMATO_CHERRY_SMALL', 'TOM_CHERRY', 'TOMATO_CHERRY'] },
      { pattern: /fused|segmented/i, codes: ['PSC_TOMATO_SLICER', 'TOM_SLICER', 'TOMATO_SLICER'] },
    ];

    const TOMATO_NAME_RULES = [
      { pattern: /cherry|currant|tumbler|sweet\s*100|sun.?gold|sun.?sugar|gold\s*nugget|juliet|pear|fig|yellow\s*pear|red\s*pear|gold\s*rush/i, codes: ['PSC_TOMATO_CHERRY_SMALL', 'TOM_CHERRY', 'PSC_TOM_CHERRY', 'TOMATO_CHERRY'] },
      { pattern: /\bgrape\b/i, codes: ['PSC_TOMATO_GRAPE', 'TOM_GRAPE', 'PSC_TOM_GRAPE', 'TOMATO_GRAPE'] },
      { pattern: /roma|san\s*marzano|amish\s*paste|jersey\s*devil|plum|paste|opalka|polish\s*linguisa/i, codes: ['PSC_TOMATO_PASTE_ROMA', 'TOM_PLUM', 'PSC_TOM_PLUM', 'TOMATO_PLUM', 'TOMATO_PASTE', 'PSC_TOMATO_PASTE'] },
      { pattern: /beefsteak|brandywine|mortgage\s*lifter|big\s*boy|big\s*girl|crimson\s*cushion|marmande|costoluto|reisetomate|purple\s*calabash/i, codes: ['PSC_TOMATO_BEEFSTEAK', 'TOM_BEEFSTEAK', 'PSC_TOM_BEEFSTEAK', 'TOMATO_BEEFSTEAK'] },
      { pattern: /oxheart|pineapple|cossack|hungarian/i, codes: ['PSC_TOMATO_OXHEART', 'TOM_OXHEART', 'PSC_TOM_OXHEART', 'TOMATO_OXHEART'] },
      { pattern: /dwarf|micro\s*dwarf|patio|tiny\s*tim|window\s*box|lemonella/i, codes: ['PSC_TOMATO_DWARF_COMPACT', 'PSC_TOM_DWARF', 'TOMATO_DWARF', 'TOMATO_MICRO'] },
    ];

    // PEPPER: scoville
    const PEPPER_SCOVILLE_RULES = [
      { min: 0, max: 0, codes: ['PSC_PEPPER_HEAT_SWEET', 'PSC_PEP_BELL'] },
      { min: 1, max: 2500, codes: ['PSC_PEPPER_HEAT_MILD', 'PSC_PEP_MILD'] },
      { min: 2501, max: 30000, codes: ['PSC_PEPPER_HEAT_MEDIUM', 'PSC_PEPPER_MEDIUM', 'PSC_PEP_MEDIUM_HEAT'] },
      { min: 30001, max: 100000, codes: ['PSC_PEPPER_HEAT_HOT', 'PSC_PEP_HOT'] },
      { min: 100001, max: 300000, codes: ['PSC_PEPPER_HEAT_EXTRA_HOT', 'PSC_PEPPER_EXTRAHOT', 'PSC_PEP_EXTRAHOT'] },
      { min: 300001, max: Infinity, codes: ['PSC_PEPPER_HEAT_SUPERHOT', 'PSC_PEP_SUPERHOT'] },
    ];

    const PEPPER_NAME_RULES = [
      { pattern: /habanero|scotch\s*bonnet|ghost|reaper|scorpion|7.?pot|bhut|carolina\s*reaper|peri.?peri|naga|dorset\s*naga|infinity|chocolate\s*7|7\s*pot\s*primo|7\s*pot\s*douglah|dragon\s*breath/i, codes: ['PSC_PEPPER_HEAT_SUPERHOT', 'PSC_PEPPER_HEAT_EXTRA_HOT'] },
      { pattern: /jalapen|serrano|cayenne|thai|tabasco|pequin|bird.?s?.?eye|kumquat|de\s*arbol|chiltepin|piquin/i, codes: ['PSC_PEPPER_HEAT_HOT', 'PSC_PEPPER_HEAT_MEDIUM'] },
      { pattern: /banana|cuban|pepperoncini|friggitello|anaheim|new\s*mexico|ancho|poblano|pasilla|guajillo|aji|wax|hungarian|mirasol|mulato/i, codes: ['PSC_PEPPER_HEAT_MILD', 'PSC_PEPPER_HEAT_MEDIUM'] },
      { pattern: /bell|sweet\s+pepper|sweet\s+red|sweet\s+green|sweet\s+yellow|sweet\s+orange|lipstick|carnival|pimento/i, codes: ['PSC_PEPPER_HEAT_SWEET', 'PSC_PEP_BELL'] },
      { pattern: /cubanelle|italian\s*frying|corno|biscayne|lunchbox/i, codes: ['PSC_PEPPER_HEAT_SWEET', 'PSC_PEPPER_HEAT_MILD'] },
      { pattern: /rocoto|manzano/i, codes: ['PSC_PEPPER_PUBESCENS'] },
      { pattern: /aji.*(amarillo|lemon|crystal|charapita|norteño|fantasy|cristal|jobito)/i, codes: ['PSC_PEPPER_BACCATUM', 'PSC_PEPPER_HEAT_HOT'] },
    ];

    // CUCUMBER
    const CUC_NAME_RULES = [
      { pattern: /pickling|kirby|cornichon|gherkin|national\s*pickling/i, codes: ['PSC_CUC_PICKLING', 'CUC_PICKLING'] },
      { pattern: /burpless|english|european|seedless|thin.?skin|telegraph/i, codes: ['PSC_CUC_BURPLESS', 'CUC_BURPLESS'] },
      { pattern: /lemon|round|armenian|persian|asian|japanese|dosakai|chinese/i, codes: ['PSC_CUC_SPECIALTY', 'CUC_SPECIALTY'] },
      { pattern: /slicing|straight\s*eight|marketmore|spacemaster|long\s*green/i, codes: ['PSC_CUC_SLICING', 'CUC_SLICING'] },
      { pattern: /mini|snack|baby/i, codes: ['PSC_CUC_MINI', 'CUC_MINI'] },
    ];

    // BEAN
    const BEAN_NAME_RULES = [
      { pattern: /pole|runner|climbing|rattlesnake|fortex|decker/i, codes: ['PSC_BEAN_POLE', 'BEAN_POLE'] },
      { pattern: /lima|butter|henderson|fordhook/i, codes: ['PSC_BEAN_LIMA', 'BEAN_LIMA'] },
      { pattern: /\bsoy\b|soybean|edamame/i, codes: ['PSC_BEAN_SOY', 'BEAN_SOY'] },
      { pattern: /wax|yellow\s*wax|pencil\s*wax/i, codes: ['PSC_BEAN_WAX', 'BEAN_WAX', 'PSC_BEAN_BUSH'] },
      { pattern: /purple|royal\s*burgundy/i, codes: ['PSC_BEAN_PURPLE', 'BEAN_PURPLE', 'PSC_BEAN_BUSH'] },
      { pattern: /romano|flat\s*pod|dragon\s*tongue/i, codes: ['PSC_BEAN_ROMANO', 'BEAN_ROMANO', 'PSC_BEAN_BUSH'] },
      { pattern: /shell|horticultural|tongue|cranberry|october|flageolet|calypso/i, codes: ['PSC_BEAN_SHELL', 'BEAN_SHELL'] },
    ];

    const BEAN_HABIT_RULES = [
      { pattern: /bush/i, codes: ['PSC_BEAN_BUSH', 'BEAN_BUSH'] },
      { pattern: /pole|runner|climbing|vining/i, codes: ['PSC_BEAN_POLE', 'BEAN_POLE'] },
    ];

    // LETTUCE
    const LETTUCE_NAME_RULES = [
      { pattern: /butterhead|boston|bibb|butter\s*crunch|limestone|tango\s*butter/i, codes: ['PSC_LET_BUTTERHEAD', 'PSC_LETTUCE_BUTTERHEAD', 'LET_BUTTERHEAD', 'LETTUCE_BUTTERHEAD'] },
      { pattern: /romaine|cos|little\s*gem|paris|rouge\s*d|winter\s*density/i, codes: ['PSC_LET_ROMAINE', 'PSC_LETTUCE_ROMAINE', 'LET_ROMAINE', 'LETTUCE_ROMAINE'] },
      { pattern: /loose.?leaf|oak.?leaf|lolla|sango|salad\s*bowl|deer\s*tongue|red\s*sails|grand\s*rapids|black\s*seeded\s*simpson/i, codes: ['PSC_LET_LOOSELEAF', 'PSC_LETTUCE_LOOSELEAF', 'LET_LOOSELEAF', 'LETTUCE_LOOSELEAF'] },
      { pattern: /crisphead|iceberg|great\s*lake/i, codes: ['PSC_LET_CRISPHEAD', 'PSC_LETTUCE_CRISPHEAD', 'LET_CRISPHEAD', 'LETTUCE_CRISPHEAD'] },
      { pattern: /batavian|summer\s*crisp/i, codes: ['PSC_LET_BATAVIAN', 'PSC_LETTUCE_BATAVIAN', 'LET_BATAVIAN', 'LETTUCE_BATAVIAN'] },
      { pattern: /stem|celtuce|asparagus/i, codes: ['PSC_LET_STEM', 'PSC_LETTUCE_STEM', 'LET_STEM', 'LETTUCE_STEM'] },
    ];

    // SQUASH / ZUCCHINI / PUMPKIN
    const SQUASH_NAME_RULES = [
      { pattern: /zucchini|courgette|cocozelle/i, codes: ['PSC_SQUASH_ZUCCHINI', 'SQUASH_ZUCCHINI', 'PSC_ZUCCHINI'] },
      { pattern: /acorn/i, codes: ['PSC_SQUASH_ACORN', 'SQUASH_ACORN', 'PSC_WINTER_SQUASH_ACORN'] },
      { pattern: /butternut/i, codes: ['PSC_SQUASH_BUTTERNUT', 'SQUASH_BUTTERNUT', 'PSC_WINTER_SQUASH_BUTTERNUT'] },
      { pattern: /spaghetti/i, codes: ['PSC_SQUASH_SPAGHETTI', 'SQUASH_SPAGHETTI', 'PSC_WINTER_SQUASH_SPAGHETTI'] },
      { pattern: /delicata|sweet\s*dumpling|carnival/i, codes: ['PSC_SQUASH_DELICATA', 'SQUASH_DELICATA', 'PSC_WINTER_SQUASH_DELICATA'] },
      { pattern: /kabocha|japanese/i, codes: ['PSC_SQUASH_KABOCHA', 'SQUASH_KABOCHA'] },
      { pattern: /hubbard|blue\s*hubbard/i, codes: ['PSC_SQUASH_HUBBARD', 'SQUASH_HUBBARD'] },
      { pattern: /pattypan|scallop/i, codes: ['PSC_SQUASH_PATTYPAN', 'SQUASH_PATTYPAN', 'PSC_SUMMER_SQUASH_PATTYPAN'] },
      { pattern: /crookneck|straightneck|yellow/i, codes: ['PSC_SQUASH_YELLOW', 'SQUASH_YELLOW', 'PSC_SUMMER_SQUASH_YELLOW'] },
      { pattern: /pumpkin|jack\s*o|howden|sugar\s*pie|cinderella|rouge\s*vif|jarrahdale/i, codes: ['PSC_SQUASH_PUMPKIN', 'SQUASH_PUMPKIN', 'PSC_PUMPKIN'] },
    ];

    // CARROT
    const CARROT_NAME_RULES = [
      { pattern: /danvers|chantenay|amsterdam|atlas|oxheart|oxhear/i, codes: ['PSC_CARROT_DANVERS', 'CARROT_DANVERS', 'PSC_CAR_DANVERS'] },
      { pattern: /nantes|bolero|nelson|touchon|red\s*core/i, codes: ['PSC_CARROT_NANTES', 'CARROT_NANTES', 'PSC_CAR_NANTES'] },
      { pattern: /imperator|tendersweet|apache/i, codes: ['PSC_CARROT_IMPERATOR', 'CARROT_IMPERATOR', 'PSC_CAR_IMPERATOR'] },
      { pattern: /miniature|thumbelina|paris\s*market|round|ball/i, codes: ['PSC_CARROT_MINIATURE', 'CARROT_MINIATURE', 'PSC_CAR_MINI'] },
      { pattern: /purple|rainbow|multicolou?r|cosmic\s*purple|dragon/i, codes: ['PSC_CARROT_COLORED', 'CARROT_COLORED', 'PSC_CAR_COLORED', 'PSC_CARROT_SPECIALTY'] },
    ];

    // ONION
    const ONION_NAME_RULES = [
      { pattern: /sweet\s+onion|walla\s*walla|vidalia|candy|maui/i, codes: ['PSC_ONION_SWEET', 'ONION_SWEET', 'PSC_ONI_SWEET'] },
      { pattern: /red\s+onion|red\s+wing|redwing|mars|burgundy/i, codes: ['PSC_ONION_RED', 'ONION_RED', 'PSC_ONI_RED'] },
      { pattern: /yellow\s+onion|stuttgarter|copra|cortland|gladalan/i, codes: ['PSC_ONION_YELLOW', 'ONION_YELLOW', 'PSC_ONI_YELLOW'] },
      { pattern: /white\s+onion|crystal\s*wax|white\s*portugal/i, codes: ['PSC_ONION_WHITE', 'ONION_WHITE', 'PSC_ONI_WHITE'] },
      { pattern: /shallot/i, codes: ['PSC_ONION_SHALLOT', 'ONION_SHALLOT', 'PSC_ONI_SHALLOT'] },
      { pattern: /bunching|scallion|green\s*onion|spring\s*onion|evergreen|parade/i, codes: ['PSC_ONION_BUNCHING', 'ONION_BUNCHING', 'PSC_ONI_BUNCHING'] },
    ];

    // CORN
    const CORN_NAME_RULES = [
      { pattern: /sweet\s+corn|sugar|sh2|shrunken|supersweet|bicolor|tricolor|peaches\s*&?\s*cream|silver\s*queen/i, codes: ['PSC_CORN_SWEET', 'CORN_SWEET', 'PSC_SWEET_CORN'] },
      { pattern: /popcorn|pop\s*corn|strawberry\s*popcorn/i, codes: ['PSC_CORN_POPCORN', 'CORN_POPCORN'] },
      { pattern: /ornamental|decorative|indian|calico|painted\s*mountain|rainbow/i, codes: ['PSC_CORN_ORNAMENTAL', 'CORN_ORNAMENTAL'] },
      { pattern: /flour|dent|field|flint|hickory\s*king/i, codes: ['PSC_CORN_FLOUR', 'CORN_FIELD', 'CORN_FLOUR'] },
    ];

    // SPINACH
    const SPINACH_NAME_RULES = [
      { pattern: /savoy|bloomsdale|tyee|melody|winter\s*giant/i, codes: ['PSC_SPINACH_SAVOY', 'SPINACH_SAVOY'] },
      { pattern: /smooth|flat.?leaf|space|olympia/i, codes: ['PSC_SPINACH_SMOOTH', 'SPINACH_SMOOTH', 'SPINACH_FLAT'] },
      { pattern: /baby|regiment|corvair/i, codes: ['PSC_SPINACH_BABY', 'SPINACH_BABY'] },
      { pattern: /semi.?savoy/i, codes: ['PSC_SPINACH_SEMI_SAVOY', 'SPINACH_SEMI_SAVOY'] },
    ];

    // KALE
    const KALE_NAME_RULES = [
      { pattern: /curly|scotch|dwarf\s*blue|darkibor|starbor/i, codes: ['PSC_KALE_CURLY', 'KALE_CURLY'] },
      { pattern: /lacinato|tuscan|dinosaur|cavolo\s*nero|black\s*palm|palm\s*tree/i, codes: ['PSC_KALE_LACINATO', 'KALE_LACINATO'] },
      { pattern: /red\s*russian|siberian|wild\s*garden|premier/i, codes: ['PSC_KALE_RED_RUSSIAN', 'KALE_RED_RUSSIAN', 'KALE_FLAT'] },
      { pattern: /portuguese|jersey\s*walking|tree\s*kale|walking/i, codes: ['PSC_KALE_TREE', 'KALE_TREE', 'KALE_PORTUGUESE'] },
      { pattern: /ornamental|flowering|nagoya/i, codes: ['PSC_KALE_ORNAMENTAL', 'KALE_ORNAMENTAL'] },
    ];

    // CABBAGE
    const CABBAGE_NAME_RULES = [
      { pattern: /red\s*cabbage|mammoth\s*red/i, codes: ['PSC_CABBAGE_RED', 'CABBAGE_RED'] },
      { pattern: /savoy|alcosa|promasa/i, codes: ['PSC_CABBAGE_SAVOY', 'CABBAGE_SAVOY'] },
      { pattern: /napa|chinese|michihili|hakurei/i, codes: ['PSC_CABBAGE_NAPA', 'CABBAGE_NAPA', 'CABBAGE_CHINESE'] },
      { pattern: /bok\s*choy|pak\s*choi|tatsoi/i, codes: ['PSC_CABBAGE_BOK_CHOY', 'CABBAGE_BOK_CHOY'] },
      { pattern: /green|golden\s*acre|stonehead|derby\s*day|jersey\s*wakefield/i, codes: ['PSC_CABBAGE_GREEN', 'CABBAGE_GREEN'] },
    ];

    // BROCCOLI
    const BROCCOLI_NAME_RULES = [
      { pattern: /sprouting|purple\s*sprouting|early\s*purple|white\s*sprouting/i, codes: ['PSC_BROCCOLI_SPROUTING', 'BROCCOLI_SPROUTING'] },
      { pattern: /raab|rabe|broccoli\s*raab|rapini/i, codes: ['PSC_BROCCOLI_RAAB', 'BROCCOLI_RAAB'] },
      { pattern: /romanesco|roman/i, codes: ['PSC_BROCCOLI_ROMANESCO', 'BROCCOLI_ROMANESCO'] },
      { pattern: /broccolini|asparation/i, codes: ['PSC_BROCCOLI_BROCCOLINI', 'BROCCOLI_BROCCOLINI'] },
    ];

    // PEA
    const PEA_NAME_RULES = [
      { pattern: /snap\s*pea|sugar\s*snap/i, codes: ['PSC_PEA_SNAP', 'PEA_SNAP'] },
      { pattern: /snow\s*pea|mangetout|chinese\s*snow/i, codes: ['PSC_PEA_SNOW', 'PEA_SNOW'] },
      { pattern: /shelling|english|garden\s*pea|telephone|lincoln|alaska/i, codes: ['PSC_PEA_SHELLING', 'PEA_SHELLING', 'PEA_GARDEN'] },
      { pattern: /purple|blue|flowering/i, codes: ['PSC_PEA_PURPLE', 'PEA_SPECIALTY'] },
    ];

    // RADISH
    const RADISH_NAME_RULES = [
      { pattern: /daikon|japanese\s*white|chinese\s*white|april\s*cross/i, codes: ['PSC_RADISH_DAIKON', 'RADISH_DAIKON'] },
      { pattern: /watermelon|beauty\s*heart|roseheart/i, codes: ['PSC_RADISH_WATERMELON', 'RADISH_WATERMELON'] },
      { pattern: /french\s*breakfast|white\s*icicle|icicle/i, codes: ['PSC_RADISH_FRENCH', 'RADISH_FRENCH'] },
      { pattern: /easter\s*egg|rainbow/i, codes: ['PSC_RADISH_EASTER_EGG', 'RADISH_EASTER_EGG', 'RADISH_SPECIALTY'] },
      { pattern: /rat.?tail|seed\s*pod/i, codes: ['PSC_RADISH_RAT_TAIL', 'RADISH_SPECIALTY'] },
    ];

    // BASIL
    const BASIL_NAME_RULES = [
      { pattern: /sweet\s*basil|genovese|italian|napoletano|large\s*leaf/i, codes: ['PSC_BASIL_SWEET', 'BASIL_SWEET', 'PSC_BAS_SWEET'] },
      { pattern: /thai\s*basil|holy\s*basil|lemon\s*basil|lime\s*basil|cinnamon\s*basil|anise\s*basil/i, codes: ['PSC_BASIL_SPECIALTY', 'BASIL_SPECIALTY', 'PSC_BAS_SPECIALTY'] },
      { pattern: /purple\s*basil|red\s*basil|dark\s*opal|amethyst/i, codes: ['PSC_BASIL_PURPLE', 'BASIL_PURPLE', 'PSC_BAS_PURPLE'] },
      { pattern: /dwarf|spicy\s*globe|compact|globe|fine\s*leaf|bush/i, codes: ['PSC_BASIL_DWARF', 'BASIL_DWARF', 'PSC_BAS_DWARF', 'PSC_BASIL_COMPACT'] },
    ];

    // HERB GENERIC
    const HERB_NAME_RULES = [
      { pattern: /spearmint|peppermint|chocolate\s*mint|apple\s*mint|corsican/i, codes: ['PSC_MINT_SPEARMINT', 'MINT_SPEARMINT', 'HERB_MINT'] },
      { pattern: /english\s*thyme|french\s*thyme|silver\s*thyme|lemon\s*thyme/i, codes: ['PSC_THYME_COMMON', 'THYME_COMMON', 'HERB_THYME'] },
      { pattern: /italian\s*parsley|flat.?leaf\s*parsley|curly\s*parsley/i, codes: ['PSC_PARSLEY_FLAT', 'PSC_PARSLEY_CURLY', 'PARSLEY_FLAT', 'HERB_PARSLEY'] },
      { pattern: /common\s*sage|garden\s*sage|culinary\s*sage/i, codes: ['PSC_SAGE_COMMON', 'SAGE_COMMON', 'HERB_SAGE'] },
      { pattern: /common\s*rosemary|upright\s*rosemary|trailing\s*rosemary/i, codes: ['PSC_ROSEMARY_COMMON', 'ROSEMARY_COMMON', 'HERB_ROSEMARY'] },
    ];

    // FLOWER generic patterns
    const FLOWER_NAME_RULES = [
      { pattern: /annual|cosmos|zinnia|marigold|calendula|nasturtium|sunflower|bachelor/i, codes: ['PSC_FLOWER_ANNUAL', 'FLOWER_ANNUAL'] },
      { pattern: /perennial|coneflower|echinacea|lavender|salvia|rudbeckia|black.?eyed/i, codes: ['PSC_FLOWER_PERENNIAL', 'FLOWER_PERENNIAL'] },
      { pattern: /bulb|tulip|daffodil|crocus|hyacinth|allium|dahlia|gladiolus/i, codes: ['PSC_FLOWER_BULB', 'FLOWER_BULB'] },
      { pattern: /edible\s*flower|violas|viola|pansy|borage|nasturtium/i, codes: ['PSC_FLOWER_EDIBLE', 'FLOWER_EDIBLE'] },
      { pattern: /cutting|dried|strawflower|statice|amaranth|celosia|gomphrena/i, codes: ['PSC_FLOWER_CUTTING', 'FLOWER_CUTTING'] },
      { pattern: /mix|mixture|blend|collection|assorted/i, codes: ['PSC_FLOWER_MIX', 'FLOWER_MIX', 'FLOWER_ANNUAL'] },
    ];

    const FLOWER_HABIT_RULES = [
      { pattern: /annual/i, codes: ['PSC_FLOWER_ANNUAL', 'FLOWER_ANNUAL'] },
      { pattern: /perennial/i, codes: ['PSC_FLOWER_PERENNIAL', 'FLOWER_PERENNIAL'] },
    ];

    // ─── matchVariety: try all rule sets in order ──────────────────

    const matchByRules = (nameRules, habitRules, v) => {
      // 1. by variety name
      for (const rule of (nameRules || [])) {
        if (rule.pattern.test(v.variety_name || '')) {
          const sc = tryFindSubcat(rule.codes);
          if (sc) return { subcat: sc, reason: `name_match:${v.variety_name}` };
        }
      }
      // 2. by growth_habit
      for (const rule of (habitRules || [])) {
        if (rule.pattern.test(v.growth_habit || '')) {
          const sc = tryFindSubcat(rule.codes);
          if (sc) return { subcat: sc, reason: `habit:${v.growth_habit}` };
        }
      }
      return null;
    };

    let fixed = 0, noMatch = 0;
    const fixLog = [], noMatchLog = [];

    for (const v of toFix) {
      let targetSubcat = null;
      let reason = '';

      // ── TOMATO ──
      if (!targetSubcat && v.fruit_shape) {
        for (const rule of TOMATO_SHAPE_RULES) {
          if (rule.pattern.test(v.fruit_shape)) {
            const sc = tryFindSubcat(rule.codes);
            if (sc) { targetSubcat = sc; reason = `shape:${v.fruit_shape}`; break; }
          }
        }
      }
      if (!targetSubcat) {
        for (const rule of TOMATO_NAME_RULES) {
          if (rule.pattern.test(v.variety_name || '')) {
            const sc = tryFindSubcat(rule.codes);
            if (sc) { targetSubcat = sc; reason = `tomato_name:${v.variety_name}`; break; }
          }
        }
      }

      // ── PEPPER: scoville ──
      if (!targetSubcat) {
        const sco = Number(v.scoville_max || v.heat_scoville_max || v.scoville_min || v.heat_scoville_min || -1);
        if (sco >= 0) {
          for (const rule of PEPPER_SCOVILLE_RULES) {
            if (sco >= rule.min && sco <= rule.max) {
              const sc = tryFindSubcat(rule.codes);
              if (sc) { targetSubcat = sc; reason = `scoville:${sco}`; break; }
            }
          }
        }
      }
      if (!targetSubcat) {
        for (const rule of PEPPER_NAME_RULES) {
          if (rule.pattern.test(v.variety_name || '')) {
            const sc = tryFindSubcat(rule.codes);
            if (sc) { targetSubcat = sc; reason = `pepper_name:${v.variety_name}`; break; }
          }
        }
      }

      // ── CUCUMBER ──
      if (!targetSubcat) {
        const r = matchByRules(CUC_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── BEAN ──
      if (!targetSubcat) {
        const r = matchByRules(BEAN_NAME_RULES, BEAN_HABIT_RULES, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── LETTUCE ──
      if (!targetSubcat) {
        const r = matchByRules(LETTUCE_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── SQUASH / PUMPKIN ──
      if (!targetSubcat) {
        const r = matchByRules(SQUASH_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── CARROT ──
      if (!targetSubcat) {
        const r = matchByRules(CARROT_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── ONION ──
      if (!targetSubcat) {
        const r = matchByRules(ONION_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── CORN ──
      if (!targetSubcat) {
        const r = matchByRules(CORN_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── SPINACH ──
      if (!targetSubcat) {
        const r = matchByRules(SPINACH_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── KALE ──
      if (!targetSubcat) {
        const r = matchByRules(KALE_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── CABBAGE ──
      if (!targetSubcat) {
        const r = matchByRules(CABBAGE_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── BROCCOLI ──
      if (!targetSubcat) {
        const r = matchByRules(BROCCOLI_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── PEA ──
      if (!targetSubcat) {
        const r = matchByRules(PEA_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── RADISH ──
      if (!targetSubcat) {
        const r = matchByRules(RADISH_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── BASIL ──
      if (!targetSubcat) {
        const r = matchByRules(BASIL_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── HERB ──
      if (!targetSubcat) {
        const r = matchByRules(HERB_NAME_RULES, null, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── FLOWER ──
      if (!targetSubcat) {
        const r = matchByRules(FLOWER_NAME_RULES, FLOWER_HABIT_RULES, v);
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── LAST RESORT: if only ONE subcat exists for this plant type, assign it ──
      if (!targetSubcat && subcats.length === 1) {
        targetSubcat = subcats[0];
        reason = `only_one_subcat`;
      }

      if (!targetSubcat) {
        noMatch++;
        if (noMatchLog.length < 30) noMatchLog.push({ name: v.variety_name, code: v.variety_code, shape: v.fruit_shape, habit: v.growth_habit, sco: v.scoville_max });
        continue;
      }

      if (!isDryRun) {
        try {
          await base44.asServiceRole.entities.Variety.update(v.id, {
            plant_subcategory_id: targetSubcat.id,
            plant_subcategory_ids: [targetSubcat.id]
          });
          await new Promise(r => setTimeout(r, 120));
        } catch (err) {
          console.warn(`Failed to update ${v.id}:`, err.message);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }

      fixLog.push({ name: v.variety_name, assignedSubcat: targetSubcat.name, reason });
      fixed++;
    }

    return Response.json({
      success: true,
      dry_run: isDryRun,
      plant_type_id: plantTypeId,
      total_missing: toFix.length,
      fixed,
      no_match: noMatch,
      sample_fixes: fixLog.slice(0, 30),
      no_match_sample: noMatchLog,
      message: isDryRun
        ? `DRY RUN: Would fix ${fixed}/${toFix.length}. ${noMatch} unmatched.`
        : `Fixed ${fixed}/${toFix.length} varieties. ${noMatch} still unmatched.`
    });

  } catch (error) {
    console.error('[fixSubcatByPlantType] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});