import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Runs the fixSubcatFromVarietyCode logic but ONE PLANT TYPE AT A TIME,
 * using the admin service role to bypass RLS.
 * 
 * POST with { "plant_type_id": "...", "dry_run": false }
 * or GET with ?plant_type_id=...&dry_run=false
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const isDryRun = (body.dry_run ?? url.searchParams.get('dry_run') ?? 'true') !== false && (body.dry_run ?? url.searchParams.get('dry_run') ?? 'true') !== 'false';
    const plantTypeId = body.plant_type_id || url.searchParams.get('plant_type_id');

    if (!plantTypeId) {
      return Response.json({ error: 'plant_type_id is required' }, { status: 400 });
    }

    // Load subcategories for this plant type only
    const subcats = await base44.asServiceRole.entities.PlantSubCategory.filter({ plant_type_id: plantTypeId });
    const subcatByCode = {};
    subcats.forEach(sc => {
      if (sc.subcat_code) {
        subcatByCode[sc.subcat_code] = sc;
        subcatByCode[sc.subcat_code.replace(/^PSC_/, '')] = sc;
      }
    });

    const findSubcat = (code) => {
      return subcatByCode[code] || subcatByCode['PSC_' + code] || subcatByCode[code?.replace(/^PSC_/, '')] || null;
    };

    // Load only varieties for this plant type that are missing subcategory
    const toFix = await base44.asServiceRole.entities.Variety.filter(
      { plant_type_id: plantTypeId, plant_subcategory_id: null, status: 'active' },
      'variety_name',
      9999
    );

    console.log(`Plant type ${plantTypeId}: ${toFix.length} varieties missing subcategory. Available subcats:`, subcats.map(s => s.subcat_code).join(', '));

    // Rules specific to how our variety codes are structured
    // ALSO handles VAR_PEP_* codes and VAR_PEPPER_* codes (old format)
    const CODE_RULES = [
      // Tomato codes follow: TOM_CHERRY_*, TOM_BEEFSTEAK_*, etc.
      { pattern: /^TOM_CHERRY/i, code: 'TOM_CHERRY' },
      { pattern: /^TOM_GRAPE/i, code: 'TOM_GRAPE' },
      { pattern: /^TOM_PLUM|^TOM_ROMA|^TOM_SAUCE/i, code: 'TOM_PLUM' },
      { pattern: /^TOM_BEEFSTEAK/i, code: 'TOM_BEEFSTEAK' },
      { pattern: /^TOM_OXHEART/i, code: 'TOM_OXHEART' },
      { pattern: /^TOM_CURRANT/i, code: 'TOM_CURRANT_SPOON' },
      // Pepper codes: PEP_HOT_*, PEP_BELL_*, etc.
      { pattern: /^PEP_BELL|^PEP_SWEET/i, code: 'PSC_PEP_BELL' },
      { pattern: /^PEP_SUPERHOT/i, code: 'PSC_PEP_SUPERHOT' },
      { pattern: /^PEP_HOT/i, code: 'PSC_PEP_HOT' },
      { pattern: /^PEP_MILD/i, code: 'PSC_PEP_MILD' },
      { pattern: /^PEP_MEDIUM/i, code: 'PSC_PEP_MEDIUM_HEAT' },
      { pattern: /^PEP_ANNUUM/i, code: 'PSC_PEP_ANNUUM' },
      { pattern: /^PEP_CHINENSE/i, code: 'PSC_PEP_CHINENSE' },
      { pattern: /^PEP_BACCATUM/i, code: 'PSC_PEP_BACCATUM' },
      // Cucumber
      { pattern: /^CUC_SLICING/i, code: 'PSC_CUC_SLICING' },
      { pattern: /^CUC_PICKLING/i, code: 'PSC_CUC_PICKLING' },
      { pattern: /^CUC_BURPLESS/i, code: 'PSC_CUC_BURPLESS' },
      // Bean
      { pattern: /^BEAN_BUSH/i, code: 'PSC_BEAN_BUSH' },
      { pattern: /^BEAN_POLE/i, code: 'PSC_BEAN_POLE' },
    ];

    const FRUIT_SHAPE_RULES = [
      { pattern: /cherry/i, code: 'TOM_CHERRY' },
      { pattern: /grape/i, code: 'TOM_GRAPE' },
      { pattern: /plum|roma|paste/i, code: 'TOM_PLUM' },
      { pattern: /beefsteak/i, code: 'TOM_BEEFSTEAK' },
      { pattern: /oxheart|heart/i, code: 'TOM_OXHEART' },
      { pattern: /slicer|globe|oblate|round/i, code: 'TOM_SLICER' },
    ];

    const NAME_RULES = [
      // Tomato by name
      { pattern: /cherry|currant|spoon/i, code: 'TOM_CHERRY' },
      { pattern: /grape/i, code: 'TOM_GRAPE' },
      { pattern: /plum|roma|san marzano|amish paste|jersey devil/i, code: 'TOM_PLUM' },
      { pattern: /beefsteak|brandywine|mortgage lifter|big boy|big girl/i, code: 'TOM_BEEFSTEAK' },
      { pattern: /oxheart|pineapple|cossack/i, code: 'TOM_OXHEART' },
      // Pepper by name
      { pattern: /habanero|scotch bonnet|ghost|reaper|scorpion|7.?pot|bhut/i, code: 'PSC_PEP_SUPERHOT' },
      { pattern: /jalapen|serrano|cayenne|thai|tabasco|pequin/i, code: 'PSC_PEP_HOT' },
      { pattern: /banana|cuban|pepperoncini|friggitello|anaheim|new mexico|ancho|poblano|pasilla|sweet cherry pepper/i, code: 'PSC_PEP_MILD' },
      { pattern: /bell pepper|sweet pepper|sweet red|sweet green|sweet yellow|sweet orange/i, code: 'PSC_PEP_BELL' },
    ];

    let fixed = 0, noMatch = 0;
    const fixLog = [], noMatchLog = [];

    for (const v of toFix) {
      let targetSubcat = null;
      let reason = '';

      // 1. variety_code prefix
      if (v.variety_code) {
        for (const rule of CODE_RULES) {
          if (rule.pattern.test(v.variety_code)) {
            targetSubcat = findSubcat(rule.code);
            if (targetSubcat) { reason = `code:${v.variety_code}`; break; }
          }
        }
      }

      // 2. fruit_shape
      if (!targetSubcat && v.fruit_shape) {
        for (const rule of FRUIT_SHAPE_RULES) {
          if (rule.pattern.test(v.fruit_shape)) {
            targetSubcat = findSubcat(rule.code);
            if (targetSubcat) { reason = `shape:${v.fruit_shape}`; break; }
          }
        }
      }

      // 3. variety name
      if (!targetSubcat && v.variety_name) {
        for (const rule of NAME_RULES) {
          if (rule.pattern.test(v.variety_name)) {
            targetSubcat = findSubcat(rule.code);
            if (targetSubcat) { reason = `name:${v.variety_name}`; break; }
          }
        }
      }

      // 4. Scoville for peppers
      if (!targetSubcat && (v.scoville_max || v.heat_scoville_max)) {
        const sco = v.scoville_max || v.heat_scoville_max || 0;
        if (sco > 200000) targetSubcat = findSubcat('PSC_PEP_SUPERHOT');
        else if (sco > 50000) targetSubcat = findSubcat('PSC_PEP_HOT');
        else if (sco > 5000) targetSubcat = findSubcat('PSC_PEP_MEDIUM_HEAT');
        else if (sco > 0) targetSubcat = findSubcat('PSC_PEP_MILD');
        if (targetSubcat) reason = `scoville:${sco}`;
      }

      if (!targetSubcat) {
        noMatch++;
        if (noMatchLog.length < 20) noMatchLog.push({ name: v.variety_name, code: v.variety_code, shape: v.fruit_shape });
        continue;
      }

      if (!isDryRun) {
        try {
          await base44.asServiceRole.entities.Variety.update(v.id, {
            plant_subcategory_id: targetSubcat.id,
            plant_subcategory_ids: [targetSubcat.id]
          });
          // 200ms throttle to avoid rate limits
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.warn(`Failed to update variety ${v.id}:`, err.message);
          // Throttle on error
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
    console.error('[FixSubcatByType] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});