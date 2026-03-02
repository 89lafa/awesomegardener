import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Restores plant_subcategory_id for varieties that lost it.
 * Uses variety_code prefix patterns to match to existing subcategories.
 * This handles the specific case where the temp upsert wiped the subcat.
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

    // Load subcategories keyed by code
    const allSubcats = await base44.asServiceRole.entities.PlantSubCategory.list();
    const subcatByCode = {};
    allSubcats.forEach(sc => {
      if (sc.subcat_code) {
        subcatByCode[sc.subcat_code] = sc;
        // Also add without PSC_ prefix
        const bare = sc.subcat_code.replace(/^PSC_/, '');
        subcatByCode[bare] = sc;
      }
    });

    // Load all varieties that have variety_code but missing plant_subcategory_id
    // The variety_code follows pattern: TOM_CHERRY_TOMATO, TOM_BEEFSTEAK_*, PEP_HOT_*, etc.
    const missing = await base44.asServiceRole.entities.Variety.filter(
      { plant_subcategory_id: null, status: 'active' },
      'variety_name',
      9999
    );

    console.log(`Found ${missing.length} varieties without subcategory`);

    // Map: variety_code segment → subcat_code
    // The key insight: variety codes like TOM_CHERRY_TOMATO → subcat TOM_CHERRY
    // PEP_HOT_HABANERO → subcat PEP_HOT or PSC_PEP_HOT, etc.
    const SEGMENT_RULES = [
      // Tomato
      { test: (v) => v.variety_code?.startsWith('TOM_CHERRY'), subcat: 'TOM_CHERRY' },
      { test: (v) => v.variety_code?.startsWith('TOM_GRAPE'), subcat: 'TOM_GRAPE' },
      { test: (v) => v.variety_code?.startsWith('TOM_PLUM'), subcat: 'TOM_PLUM' },
      { test: (v) => v.variety_code?.startsWith('TOM_ROMA'), subcat: 'TOM_PLUM' },
      { test: (v) => v.variety_code?.startsWith('TOM_BEEFSTEAK'), subcat: 'TOM_BEEFSTEAK' },
      { test: (v) => v.variety_code?.startsWith('TOM_OXHEART'), subcat: 'TOM_OXHEART' },
      { test: (v) => v.variety_code?.match(/^TOM_/) && v.fruit_size === 'small', subcat: 'TOM_CHERRY' },
      { test: (v) => v.variety_code?.match(/^TOM_/) && v.fruit_shape?.includes('slicer'), subcat: 'TOM_SLICER' },
      { test: (v) => v.variety_code?.match(/^TOM_/) && v.fruit_shape?.includes('beefsteak'), subcat: 'TOM_BEEFSTEAK' },
      { test: (v) => v.variety_code?.match(/^TOM_/) && v.fruit_shape?.includes('cherry'), subcat: 'TOM_CHERRY' },
      { test: (v) => v.variety_code?.match(/^TOM_/) && v.fruit_shape?.includes('grape'), subcat: 'TOM_GRAPE' },
      { test: (v) => v.variety_code?.match(/^TOM_/) && v.fruit_shape?.includes('plum'), subcat: 'TOM_PLUM' },
      // Pepper  
      { test: (v) => v.variety_code?.startsWith('PEP_SWEET') || v.variety_code?.startsWith('PEP_BELL'), subcat: 'PSC_PEP_BELL' },
      { test: (v) => v.variety_code?.startsWith('PEP_SUPERHOT'), subcat: 'PSC_PEP_SUPERHOT' },
      { test: (v) => v.variety_code?.startsWith('PEP_HOT'), subcat: 'PSC_PEP_HOT' },
      { test: (v) => v.variety_code?.startsWith('PEP_MILD'), subcat: 'PSC_PEP_MILD' },
      { test: (v) => v.variety_code?.startsWith('PEP_MEDIUM'), subcat: 'PSC_PEP_MEDIUM_HEAT' },
      { test: (v) => v.variety_code?.startsWith('PEP_ANNUUM'), subcat: 'PSC_PEP_ANNUUM' },
      { test: (v) => v.variety_code?.startsWith('PEP_CHINENSE'), subcat: 'PSC_PEP_CHINENSE' },
      { test: (v) => v.variety_code?.startsWith('PEP_BACCATUM'), subcat: 'PSC_PEP_BACCATUM' },
      // Name-based for tomatoes without variety_code
      { test: (v) => !v.variety_code && v.plant_type_name === 'Tomato' && /cherry/i.test(v.variety_name), subcat: 'TOM_CHERRY' },
      { test: (v) => !v.variety_code && v.plant_type_name === 'Tomato' && /grape/i.test(v.variety_name), subcat: 'TOM_GRAPE' },
      { test: (v) => !v.variety_code && v.plant_type_name === 'Tomato' && /plum|roma/i.test(v.variety_name), subcat: 'TOM_PLUM' },
      { test: (v) => !v.variety_code && v.plant_type_name === 'Tomato' && /beefsteak/i.test(v.variety_name), subcat: 'TOM_BEEFSTEAK' },
      // Name-based for peppers without variety_code
      { test: (v) => !v.variety_code && v.plant_type_name === 'Pepper' && /habanero|scotch bonnet|ghost|reaper|scorpion/i.test(v.variety_name), subcat: 'PSC_PEP_SUPERHOT' },
      { test: (v) => !v.variety_code && v.plant_type_name === 'Pepper' && /jalap|banana|cuban|anaheim|new mexico/i.test(v.variety_name), subcat: 'PSC_PEP_MILD' },
      { test: (v) => !v.variety_code && v.plant_type_name === 'Pepper' && /bell/i.test(v.variety_name), subcat: 'PSC_PEP_BELL' },
    ];

    let fixed = 0;
    let noMatch = 0;
    const fixLog = [];

    for (const v of missing) {
      let match = null;

      for (const rule of SEGMENT_RULES) {
        if (rule.test(v)) {
          const sc = subcatByCode[rule.subcat];
          if (sc && (!sc.plant_type_id || sc.plant_type_id === v.plant_type_id)) {
            match = sc;
            break;
          }
        }
      }

      if (!match) {
        noMatch++;
        continue;
      }

      if (!isDryRun) {
        await base44.asServiceRole.entities.Variety.update(v.id, {
          plant_subcategory_id: match.id,
          plant_subcategory_ids: [match.id]
        });
      }

      fixLog.push({ name: v.variety_name, code: v.variety_code, assignedSubcat: match.name });
      fixed++;
    }

    return Response.json({
      success: true,
      dry_run: isDryRun,
      total_missing: missing.length,
      fixed,
      no_match: noMatch,
      sample_fixes: fixLog.slice(0, 50),
      message: isDryRun
        ? `DRY RUN: Would fix ${fixed}/${missing.length} varieties. Run with dry_run=false.`
        : `Fixed ${fixed} varieties. ${noMatch} could not be matched automatically.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});