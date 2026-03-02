import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fixes variety subcategories by analyzing:
 * 1. The variety_code prefix (TOM_CHERRY_*, TOM_SLICER_*, PEP_HOT_*, etc.)
 * 2. The fruit_shape field for tomatoes
 * 3. The variety_name for obvious keywords
 * 
 * Processes one plant type at a time to stay within API limits.
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
    const plantTypeId = body.plant_type_id; // Optional: process only one plant type

    // Load all subcategories for quick lookup
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.list();
    
    // Build MULTIPLE lookups
    const subcatById = {};
    const subcatByCode = {};  // exact code
    const subcatsByTypeId = {}; // plant_type_id → [subcats]
    
    allSubcats.forEach(sc => {
      subcatById[sc.id] = sc;
      if (sc.subcat_code) {
        subcatByCode[sc.subcat_code] = sc;
      }
      if (sc.plant_type_id) {
        if (!subcatsByTypeId[sc.plant_type_id]) subcatsByTypeId[sc.plant_type_id] = [];
        subcatsByTypeId[sc.plant_type_id].push(sc);
      }
    });

    // Helper: find subcategory by code (tries multiple formats)
    const findSubcat = (code, typeId) => {
      if (!code) return null;
      // Try exact
      let sc = subcatByCode[code];
      if (sc && (!sc.plant_type_id || sc.plant_type_id === typeId)) return sc;
      // Try with PSC_ prefix
      sc = subcatByCode['PSC_' + code];
      if (sc && (!sc.plant_type_id || sc.plant_type_id === typeId)) return sc;
      // Try without PSC_ prefix
      sc = subcatByCode[code.replace(/^PSC_/, '')];
      if (sc && (!sc.plant_type_id || sc.plant_type_id === typeId)) return sc;
      return null;
    };

    // Load varieties that need fixing
    const filter = plantTypeId
      ? { plant_type_id: plantTypeId, plant_subcategory_id: null, status: 'active' }
      : { plant_subcategory_id: null, status: 'active' };

    const toFix = await base44.asServiceRole.entities.Variety.filter(filter, 'variety_name', 9999);
    console.log(`Found ${toFix.length} varieties needing subcategory`);

    // ════════════════════════════════════════════════════════════════
    // MATCHING LOGIC
    // Priority: variety_code prefix → fruit_shape → variety_name pattern
    // ════════════════════════════════════════════════════════════════
    
    const CODE_PREFIX_TO_SUBCAT = {
      // TOMATO
      'TOM_CHERRY': 'TOM_CHERRY',
      'TOM_GRAPE': 'TOM_GRAPE',
      'TOM_PLUM': 'TOM_PLUM',
      'TOM_ROMA': 'TOM_PLUM',
      'TOM_SAUCE': 'TOM_PLUM',
      'TOM_BEEFSTEAK': 'TOM_BEEFSTEAK',
      'TOM_OXHEART': 'TOM_OXHEART',
      'TOM_SLICER': 'TOM_SLICER',
      'TOM_SMALL': 'TOM_CHERRY',
      'TOM_MEDIUM': 'TOM_SLICER',
      'TOM_LARGE': 'TOM_BEEFSTEAK',
      'TOM_HEIRLOOM': 'TOM_SLICER',  // most heirlooms are slicers
      'TOM_SALAD': 'TOM_CHERRY',
      'TOM_CURRANT': 'TOM_CURRANT_SPOON',
      // PEPPER
      'PEP_BELL': 'PSC_PEP_BELL',
      'PEP_SWEET': 'PSC_PEP_BELL',
      'PEP_MILD': 'PSC_PEP_MILD',
      'PEP_MEDIUM': 'PSC_PEP_MEDIUM_HEAT',
      'PEP_HOT': 'PSC_PEP_HOT',
      'PEP_SUPERHOT': 'PSC_PEP_SUPERHOT',
      'PEP_ANNUUM': 'PSC_PEP_ANNUUM',
      'PEP_CHINENSE': 'PSC_PEP_CHINENSE',
      'PEP_BACCATUM': 'PSC_PEP_BACCATUM',
      'PEP_FRUTESCENS': 'PSC_PEP_HOT',
    };

    // Fruit shape → subcat code for tomatoes (when code-based match fails)
    const FRUIT_SHAPE_TO_SUBCAT = {
      'cherry': 'TOM_CHERRY',
      'cherry (round)': 'TOM_CHERRY',
      'grape': 'TOM_GRAPE',
      'plum': 'TOM_PLUM',
      'roma': 'TOM_PLUM',
      'paste': 'TOM_PLUM',
      'beefsteak': 'TOM_BEEFSTEAK',
      'oxheart': 'TOM_OXHEART',
      'heart': 'TOM_OXHEART',
      'slicer': 'TOM_SLICER',
      'slicer (globe/oblate)': 'TOM_SLICER',
      'globe': 'TOM_SLICER',
      'round': 'TOM_SLICER',  // default round = slicer
    };

    // Name patterns for peppers (when code-based match fails)
    const PEPPER_NAME_SUBCATS = [
      [/habanero|scotch bonnet|ghost|reaper|scorpion|7.?pot|bhut jolokia|devil/i, 'PSC_PEP_SUPERHOT'],
      [/cayenne|serrano|thai|tabasco|pequin|chiltep/i, 'PSC_PEP_HOT'],
      [/jalape|banana|cuban|sweet cherry|pimento|pepperoncini|friggitello|jim dandee|NuMex|anaheim|new mexico|ancho|poblano|pasilla|mulato|espanola/i, 'PSC_PEP_MILD'],
      [/bell|sweet pepper|sweet italian|sweet red|marconi|lipstick|carmen/i, 'PSC_PEP_BELL'],
    ];

    let fixed = 0;
    let noMatch = 0;
    const fixLog = [];
    const noMatchSample = [];

    for (const v of toFix) {
      let targetSubcat = null;
      let matchReason = '';

      const code = (v.variety_code || '').toUpperCase();
      const shape = (v.fruit_shape || '').toLowerCase();
      const name = v.variety_name || '';

      // ── Strategy 1: variety_code prefix ──
      if (code) {
        for (const [prefix, subcatCode] of Object.entries(CODE_PREFIX_TO_SUBCAT)) {
          if (code.startsWith(prefix + '_') || code === prefix) {
            const sc = findSubcat(subcatCode, v.plant_type_id);
            if (sc) {
              targetSubcat = sc;
              matchReason = `code_prefix:${prefix}`;
              break;
            }
          }
        }
      }

      // ── Strategy 2: fruit_shape (tomatoes) ──
      if (!targetSubcat && shape) {
        const subcatCode = FRUIT_SHAPE_TO_SUBCAT[shape];
        if (subcatCode) {
          const sc = findSubcat(subcatCode, v.plant_type_id);
          if (sc) {
            targetSubcat = sc;
            matchReason = `fruit_shape:${shape}`;
          }
        }
      }

      // ── Strategy 3: pepper name pattern ──
      if (!targetSubcat && v.plant_type_name === 'Pepper') {
        for (const [pattern, subcatCode] of PEPPER_NAME_SUBCATS) {
          if (pattern.test(name)) {
            const sc = findSubcat(subcatCode, v.plant_type_id);
            if (sc) {
              targetSubcat = sc;
              matchReason = `pepper_name_pattern`;
              break;
            }
          }
        }
      }

      // ── Strategy 4: scoville range for peppers ──
      if (!targetSubcat && v.plant_type_name === 'Pepper') {
        const scoMax = v.scoville_max || v.heat_scoville_max || 0;
        if (scoMax > 200000) {
          targetSubcat = findSubcat('PSC_PEP_SUPERHOT', v.plant_type_id);
          matchReason = 'scoville_superhot';
        } else if (scoMax > 50000) {
          targetSubcat = findSubcat('PSC_PEP_HOT', v.plant_type_id);
          matchReason = 'scoville_hot';
        } else if (scoMax > 5000) {
          targetSubcat = findSubcat('PSC_PEP_MEDIUM_HEAT', v.plant_type_id);
          matchReason = 'scoville_medium';
        } else if (scoMax > 0) {
          targetSubcat = findSubcat('PSC_PEP_MILD', v.plant_type_id);
          matchReason = 'scoville_mild';
        }
      }

      if (!targetSubcat) {
        noMatch++;
        if (noMatchSample.length < 20) {
          noMatchSample.push({ 
            name, code, shape, 
            plantType: v.plant_type_name,
            plantTypeId: v.plant_type_id 
          });
        }
        continue;
      }

      if (!isDryRun) {
        await base44.asServiceRole.entities.Variety.update(v.id, {
          plant_subcategory_id: targetSubcat.id,
          plant_subcategory_ids: [targetSubcat.id]
        });
      }

      fixLog.push({ name, code, assignedSubcat: targetSubcat.name, matchReason });
      fixed++;
    }

    return Response.json({
      success: true,
      dry_run: isDryRun,
      total_missing: toFix.length,
      fixed,
      no_match: noMatch,
      sample_fixes: fixLog.slice(0, 50),
      no_match_sample: noMatchSample,
      message: isDryRun
        ? `DRY RUN: Would assign subcategories to ${fixed}/${toFix.length} varieties. ${noMatch} unmatched. Run with dry_run=false to apply.`
        : `Assigned subcategories to ${fixed} varieties. ${noMatch} could not be matched automatically.`
    });

  } catch (error) {
    console.error('[FixSubcat] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});