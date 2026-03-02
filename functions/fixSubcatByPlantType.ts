import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Repairs plant_subcategory_id for a single plant type's varieties that have it wiped to null.
 * Uses scoville data for peppers (which have no fruit_shape/code patterns to match).
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
      subcatByCode[code.replace(/^PSC_/, '')] = sc;
      subcatByCode['PSC_' + code] = sc;
    });

    const findSubcat = (code) => {
      if (!code) return null;
      return subcatByCode[code] || subcatByCode[code.toUpperCase()] || null;
    };

    // Load all varieties for this plant type that are missing subcategory
    const toFix = await base44.asServiceRole.entities.Variety.filter(
      { plant_type_id: plantTypeId, plant_subcategory_id: null, status: 'active' },
      'variety_name',
      9999
    );

    console.log(`[fixSubcatByPlantType] ${plantTypeId}: ${toFix.length} varieties missing subcat`);
    console.log('Available subcats:', subcats.map(s => `${s.subcat_code}=${s.name}`).join(', '));

    // ─── Matching rules ────────────────────────────────────────────

    // TOMATO: match by fruit_shape → then variety name
    const TOMATO_SHAPE_RULES = [
      { pattern: /cherry/i,              codes: ['PSC_TOMATO_CHERRY_SMALL', 'TOM_CHERRY', 'PSC_TOM_CHERRY', 'TOMATO_CHERRY'] },
      { pattern: /grape/i,               codes: ['PSC_TOMATO_GRAPE', 'TOM_GRAPE', 'PSC_TOM_GRAPE', 'TOMATO_GRAPE'] },
      { pattern: /plum|roma|paste|sauce/i, codes: ['PSC_TOMATO_PASTE_ROMA', 'TOM_PLUM', 'PSC_TOM_PLUM', 'TOMATO_PLUM', 'TOMATO_PASTE', 'PSC_TOMATO_PASTE'] },
      { pattern: /beefsteak/i,           codes: ['PSC_TOMATO_BEEFSTEAK', 'TOM_BEEFSTEAK', 'PSC_TOM_BEEFSTEAK', 'TOMATO_BEEFSTEAK'] },
      { pattern: /oxheart|heart/i,       codes: ['PSC_TOMATO_OXHEART', 'TOM_OXHEART', 'PSC_TOM_OXHEART', 'TOMATO_OXHEART'] },
      { pattern: /currant|spoon/i,       codes: ['PSC_TOM_CURRANT_SPOON', 'TOMATO_CURRANT', 'TOM_CURRANT_SPOON'] },
      { pattern: /slicer|globe|oblate|round/i, codes: ['PSC_TOMATO_SLICER', 'TOM_SLICER', 'PSC_TOM_SLICER', 'TOMATO_SLICER'] },
      { pattern: /dwarf|micro|compact/i, codes: ['PSC_TOMATO_DWARF_COMPACT', 'PSC_TOM_DWARF', 'TOMATO_DWARF', 'TOMATO_MICRO'] },
      { pattern: /saladette/i,           codes: ['TOMATO_SALADETTE'] },
    ];

    const TOMATO_NAME_RULES = [
      { pattern: /cherry|currant|tumbler|sweet 100|sun gold|sun sugar|gold nugget|juliet|grape/i, codes: ['PSC_TOMATO_CHERRY_SMALL', 'TOM_CHERRY', 'PSC_TOM_CHERRY', 'TOMATO_CHERRY'] },
      { pattern: /\bgrape\b/i, codes: ['PSC_TOMATO_GRAPE', 'TOM_GRAPE', 'PSC_TOM_GRAPE', 'TOMATO_GRAPE'] },
      { pattern: /roma|san marzano|amish paste|jersey devil|plum|paste/i, codes: ['PSC_TOMATO_PASTE_ROMA', 'TOM_PLUM', 'PSC_TOM_PLUM', 'TOMATO_PLUM', 'TOMATO_PASTE', 'PSC_TOMATO_PASTE'] },
      { pattern: /beefsteak|brandywine|mortgage lifter|big boy|big girl|crimson cushion/i, codes: ['PSC_TOMATO_BEEFSTEAK', 'TOM_BEEFSTEAK', 'PSC_TOM_BEEFSTEAK', 'TOMATO_BEEFSTEAK'] },
      { pattern: /oxheart|pineapple|cossack|hungarian/i, codes: ['PSC_TOMATO_OXHEART', 'TOM_OXHEART', 'PSC_TOM_OXHEART', 'TOMATO_OXHEART'] },
      { pattern: /dwarf|micro\s*dwarf|patio|tiny tim|window box/i, codes: ['PSC_TOMATO_DWARF_COMPACT', 'PSC_TOM_DWARF', 'TOMATO_DWARF', 'TOMATO_MICRO'] },
    ];

    // PEPPER: match by scoville
    const PEPPER_SCOVILLE_RULES = [
      { min: 0, max: 0, codes: ['PSC_PEPPER_HEAT_SWEET', 'PSC_PEP_BELL'] },
      { min: 1, max: 2500, codes: ['PSC_PEPPER_HEAT_MILD', 'PSC_PEP_MILD'] },
      { min: 2501, max: 30000, codes: ['PSC_PEPPER_HEAT_MEDIUM', 'PSC_PEPPER_MEDIUM', 'PSC_PEP_MEDIUM_HEAT'] },
      { min: 30001, max: 100000, codes: ['PSC_PEPPER_HEAT_HOT', 'PSC_PEP_HOT'] },
      { min: 100001, max: 300000, codes: ['PSC_PEPPER_HEAT_EXTRA_HOT', 'PSC_PEPPER_EXTRAHOT', 'PSC_PEP_EXTRAHOT'] },
      { min: 300001, max: Infinity, codes: ['PSC_PEPPER_HEAT_SUPERHOT', 'PSC_PEP_SUPERHOT'] },
    ];

    const PEPPER_NAME_RULES = [
      { pattern: /habanero|scotch bonnet|ghost|reaper|scorpion|7.?pot|bhut|carolina\s+reaper|peri\s*peri/i, codes: ['PSC_PEPPER_HEAT_SUPERHOT', 'PSC_PEPPER_HEAT_EXTRA_HOT'] },
      { pattern: /jalapen|serrano|cayenne|thai|tabasco|pequin|bird\s*s?\s*eye/i, codes: ['PSC_PEPPER_HEAT_HOT', 'PSC_PEPPER_HEAT_MEDIUM'] },
      { pattern: /banana|cuban|pepperoncini|friggitello|anaheim|new mexico|ancho|poblano|pasilla|guajillo|aji|wax/i, codes: ['PSC_PEPPER_HEAT_MILD', 'PSC_PEPPER_HEAT_MEDIUM'] },
      { pattern: /bell|sweet\s+pepper|sweet\s+red|sweet\s+green|sweet\s+yellow|sweet\s+orange|lipstick|carnival/i, codes: ['PSC_PEPPER_HEAT_SWEET', 'PSC_PEP_BELL'] },
      { pattern: /cubanelle|italian\s+frying|corno|biscayne/i, codes: ['PSC_PEPPER_HEAT_SWEET', 'PSC_PEPPER_HEAT_MILD'] },
      { pattern: /rocoto|manzano/i, codes: ['PSC_PEPPER_PUBESCENS'] },
      { pattern: /aji.*(amarillo|lemon|crystal|charapita|norteño)/i, codes: ['PSC_PEPPER_BACCATUM', 'PSC_PEPPER_HEAT_HOT'] },
    ];

    // CUCUMBER
    const CUC_NAME_RULES = [
      { pattern: /pickling|kirby|cornichon|gherkin/i, codes: ['PSC_CUC_PICKLING'] },
      { pattern: /burpless|english|european|seedless|thin\s+skin/i, codes: ['PSC_CUC_BURPLESS'] },
      { pattern: /lemon|round|armenian|persian|asian|japanese/i, codes: ['PSC_CUC_SPECIALTY'] },
    ];

    // BEAN
    const BEAN_NAME_RULES = [
      { pattern: /pole|runner|climbing|rattlesnake/i, codes: ['PSC_BEAN_POLE'] },
      { pattern: /lima|butter/i, codes: ['PSC_BEAN_LIMA'] },
      { pattern: /\bsoy\b|soybean|edamame/i, codes: ['PSC_BEAN_SOY'] },
    ];

    const findFirstMatch = (rules, testFn, valueGetter) => {
      for (const rule of rules) {
        if (testFn(rule)) {
          const codes = rule.codes || [rule.code];
          for (const code of codes) {
            const found = findSubcat(code);
            if (found) return { subcat: found, reason: valueGetter(rule) };
          }
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
        const r = findFirstMatch(TOMATO_SHAPE_RULES,
          rule => rule.pattern.test(v.fruit_shape),
          () => `shape:${v.fruit_shape}`
        );
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }
      if (!targetSubcat && v.variety_name) {
        const r = findFirstMatch(TOMATO_NAME_RULES,
          rule => rule.pattern.test(v.variety_name),
          () => `name:${v.variety_name}`
        );
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── PEPPER: scoville ──
      if (!targetSubcat) {
        const sco = Number(v.scoville_max || v.heat_scoville_max || v.scoville_min || v.heat_scoville_min || -1);
        if (sco >= 0) {
          const r = findFirstMatch(PEPPER_SCOVILLE_RULES,
            rule => sco >= rule.min && sco <= rule.max,
            () => `scoville:${sco}`
          );
          if (r) { targetSubcat = r.subcat; reason = r.reason; }
        }
      }
      if (!targetSubcat && v.variety_name) {
        const r = findFirstMatch(PEPPER_NAME_RULES,
          rule => rule.pattern.test(v.variety_name),
          () => `pepper_name:${v.variety_name}`
        );
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── CUCUMBER ──
      if (!targetSubcat && v.variety_name) {
        const r = findFirstMatch(CUC_NAME_RULES,
          rule => rule.pattern.test(v.variety_name),
          () => `cuc_name:${v.variety_name}`
        );
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      // ── BEAN ──
      if (!targetSubcat && v.variety_name) {
        const r = findFirstMatch(BEAN_NAME_RULES,
          rule => rule.pattern.test(v.variety_name),
          () => `bean_name:${v.variety_name}`
        );
        if (r) { targetSubcat = r.subcat; reason = r.reason; }
      }

      if (!targetSubcat) {
        noMatch++;
        if (noMatchLog.length < 20) noMatchLog.push({ name: v.variety_name, code: v.variety_code, shape: v.fruit_shape, sco: v.scoville_max });
        continue;
      }

      if (!isDryRun) {
        try {
          await base44.asServiceRole.entities.Variety.update(v.id, {
            plant_subcategory_id: targetSubcat.id,
            plant_subcategory_ids: [targetSubcat.id]
          });
          await new Promise(r => setTimeout(r, 150));
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