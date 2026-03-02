import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Re-assigns plant_subcategory_id to varieties that lost theirs during the temperature upsert.
 * 
 * Strategy: Variety codes like TOM_CHERRY_TOMATO, TOM_BEEFSTEAK, etc. encode the subcat.
 * We match variety_code prefixes to known subcategory codes.
 * 
 * Also handles varieties without variety_codes by matching growth_habit / fruit characteristics.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const isDryRun = body.dry_run !== false;

    console.log(`[BulkAssignSubcats] Starting. dry_run=${isDryRun}`);

    // Load ALL subcategories
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.list();
    console.log(`[BulkAssignSubcats] Loaded ${allSubcats.length} subcategories`);

    // Build a lookup: subcat_code → id
    const subcatByCode = {};
    allSubcats.forEach(sc => {
      if (sc.subcat_code) subcatByCode[sc.subcat_code] = sc;
    });

    // Load all varieties that are missing plant_subcategory_id
    const allVarieties = await base44.asServiceRole.entities.Variety.filter(
      { plant_subcategory_id: null, status: 'active' },
      'variety_name',
      9999
    );

    console.log(`[BulkAssignSubcats] Found ${allVarieties.length} varieties missing subcategory`);

    // ── VARIETY CODE → SUBCAT CODE MAPPING ──
    // Each entry: [variety_code_prefix, subcat_code]
    // Order matters — more specific patterns first
    const CODE_SUBCAT_RULES = [
      // TOMATO subcats
      ['TOM_CHERRY', 'PSC_TOM_CHERRY'],
      ['TOM_GRAPE', 'PSC_TOM_GRAPE'],
      ['TOM_PLUM', 'PSC_TOM_PLUM'],
      ['TOM_ROMA', 'PSC_TOM_ROMA'],
      ['TOM_BEEFSTEAK', 'PSC_TOM_BEEFSTEAK'],
      ['TOM_MEDIUM', 'PSC_TOM_MEDIUM'],
      ['TOM_LARGE', 'PSC_TOM_LARGE'],
      ['TOM_HEIRLOOM', 'PSC_TOM_HEIRLOOM'],
      ['TOM_SAUCE', 'PSC_TOM_SAUCE'],
      ['TOM_SALAD', 'PSC_TOM_SALAD'],
      // PEPPER subcats
      ['PEP_SWEET', 'PSC_PEP_SWEET'],
      ['PEP_HOT', 'PSC_PEP_HOT'],
      ['PEP_BELL', 'PSC_PEP_BELL'],
      ['PEP_MILD', 'PSC_PEP_MILD'],
      ['PEP_MEDIUM_HEAT', 'PSC_PEP_MEDIUM_HEAT'],
      ['PEP_HOT', 'PSC_PEP_HOT'],
      ['PEP_SUPERHOT', 'PSC_PEP_SUPERHOT'],
      ['PEP_ANNUUM', 'PSC_PEP_ANNUUM'],
      ['PEP_CHINENSE', 'PSC_PEP_CHINENSE'],
      ['PEP_BACCATUM', 'PSC_PEP_BACCATUM'],
      // SQUASH/ZUCCHINI
      ['ZUC_STANDARD', 'PSC_ZUC_STANDARD'],
      ['ZUC_ROUND', 'PSC_ZUC_ROUND'],
      ['ZUC_SUMMER', 'PSC_ZUC_SUMMER'],
      // CUCUMBER
      ['CUC_SLICING', 'PSC_CUC_SLICING'],
      ['CUC_PICKLING', 'PSC_CUC_PICKLING'],
      ['CUC_BURPLESS', 'PSC_CUC_BURPLESS'],
      // BEAN
      ['BEAN_BUSH', 'PSC_BEAN_BUSH'],
      ['BEAN_POLE', 'PSC_BEAN_POLE'],
      ['BEAN_SNAP', 'PSC_BEAN_SNAP'],
      // LETTUCE
      ['LET_ROMAINE', 'PSC_LET_ROMAINE'],
      ['LET_BUTTERHEAD', 'PSC_LET_BUTTERHEAD'],
      ['LET_LOOSE_LEAF', 'PSC_LET_LOOSE_LEAF'],
      ['LET_ICEBERG', 'PSC_LET_ICEBERG'],
    ];

    // ── VARIETY NAME PATTERN → SUBCAT CODE (for varieties without variety_code) ──
    const NAME_SUBCAT_RULES = [
      // Tomatoes by fruit size/type in name
      [/cherry tomato|cherry tom|cherry type|sweet cherry/i, 'PSC_TOM_CHERRY'],
      [/grape tomato|grape tom/i, 'PSC_TOM_GRAPE'],
      [/plum tomato|plum tom|roma/i, 'PSC_TOM_ROMA'],
      [/beefsteak|beef steak/i, 'PSC_TOM_BEEFSTEAK'],
      [/sauce|paste|san marzano/i, 'PSC_TOM_SAUCE'],
      // Pepper heat levels
      [/bell pepper|sweet pepper|sweet bell/i, 'PSC_PEP_BELL'],
      [/jalapen|poblano|anaheim|banana pepper|sweet italian/i, 'PSC_PEP_MILD'],
      [/serrano|cayenne|thai|tabasco/i, 'PSC_PEP_HOT'],
      [/habanero|scotch bonnet|bhut|ghost pepper|scorpion|carolina reaper|7 pot|7pot/i, 'PSC_PEP_SUPERHOT'],
    ];

    let fixed = 0;
    let noMatch = 0;
    const fixLog = [];
    const noMatchLog = [];

    for (const v of allVarieties) {
      let targetSubcatCode = null;

      // Strategy 1: Match by variety_code prefix
      if (v.variety_code) {
        for (const [prefix, code] of CODE_SUBCAT_RULES) {
          if (v.variety_code.toUpperCase().startsWith(prefix)) {
            targetSubcatCode = code;
            break;
          }
        }
      }

      // Strategy 2: Match by variety name pattern
      if (!targetSubcatCode) {
        for (const [pattern, code] of NAME_SUBCAT_RULES) {
          if (pattern.test(v.variety_name)) {
            targetSubcatCode = code;
            break;
          }
        }
      }

      // Strategy 3: Match by growth_habit for well-known cases
      if (!targetSubcatCode && v.growth_habit) {
        // Tomatoes with growth_habit: determinate → Medium, indeterminate → remains
        // Not enough info to assign without plant type context
      }

      if (!targetSubcatCode) {
        noMatch++;
        noMatchLog.push({ id: v.id, name: v.variety_name, variety_code: v.variety_code, plant_type_id: v.plant_type_id });
        continue;
      }

      const subcat = subcatByCode[targetSubcatCode];
      if (!subcat) {
        noMatch++;
        noMatchLog.push({ id: v.id, name: v.variety_name, reason: `subcat code ${targetSubcatCode} not found in DB` });
        continue;
      }

      // Check plant_type_id matches
      if (subcat.plant_type_id && v.plant_type_id && subcat.plant_type_id !== v.plant_type_id) {
        noMatch++;
        noMatchLog.push({ id: v.id, name: v.variety_name, reason: `subcat plant_type mismatch: subcat=${subcat.plant_type_id} vs variety=${v.plant_type_id}` });
        continue;
      }

      if (!isDryRun) {
        await base44.asServiceRole.entities.Variety.update(v.id, {
          plant_subcategory_id: subcat.id,
          plant_subcategory_ids: [subcat.id]
        });
      }

      fixLog.push({ id: v.id, name: v.variety_name, assignedSubcat: subcat.name, subcatCode: targetSubcatCode });
      fixed++;
    }

    return Response.json({
      success: true,
      dry_run: isDryRun,
      summary: {
        total_missing: allVarieties.length,
        fixed,
        no_match: noMatch
      },
      fixes: fixLog.slice(0, 50),
      no_match_sample: noMatchLog.slice(0, 20),
      message: isDryRun
        ? `DRY RUN: Would assign subcategories to ${fixed} varieties. Run with dry_run=false to apply.`
        : `Assigned subcategories to ${fixed} varieties. ${noMatch} could not be matched.`
    });

  } catch (error) {
    console.error('[BulkAssignSubcats] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});