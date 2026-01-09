import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SQUASH_UMBRELLA_ID = '69594ee83e086041528f2b15';
const SUMMER_SQUASH_ID = '69594a9f1243f13d1245edfd';
const WINTER_SQUASH_ID = '69594a9f1243f13d1245edfe';
const PUMPKIN_ID = '69594a9f1243f13d1245edff';
const ZUCCHINI_ID = '69575e5ecdbb16ee56fa7508';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dry_run = true } = await req.json();

    console.log('[Squash Migration] Starting', dry_run ? 'DRY RUN' : 'LIVE MIGRATION');

    // Find all varieties under Squash umbrella
    const umbrellaVarieties = await base44.asServiceRole.entities.Variety.filter({
      plant_type_id: SQUASH_UMBRELLA_ID,
      status: 'active'
    });

    console.log('[Squash Migration] Found', umbrellaVarieties.length, 'varieties under Squash umbrella');

    const migrations = {
      zucchini: [],
      pumpkin: [],
      winter: [],
      summer: []
    };

    for (const variety of umbrellaVarieties) {
      const name = (variety.variety_name || '').toLowerCase();
      const description = (variety.description || '').toLowerCase();
      const combined = name + ' ' + description;

      let targetTypeId = null;
      let targetTypeName = null;
      let reason = '';

      // A) Zucchini
      const zucchiniKeywords = ['zucchini', 'courgette', 'cousa'];
      if (zucchiniKeywords.some(kw => combined.includes(kw))) {
        targetTypeId = ZUCCHINI_ID;
        targetTypeName = 'Zucchini';
        reason = 'Matched zucchini keyword';
        migrations.zucchini.push({ name: variety.variety_name, reason });
      }
      
      // B) Pumpkin
      else if (
        combined.includes('pumpkin') ||
        combined.includes('jack-o') ||
        combined.includes('lantern') ||
        combined.includes('pie pumpkin') ||
        combined.includes('sugar pumpkin') ||
        combined.includes('kakai') ||
        combined.includes('hulless') ||
        combined.includes('pepitas')
      ) {
        targetTypeId = PUMPKIN_ID;
        targetTypeName = 'Pumpkin';
        reason = 'Matched pumpkin keyword';
        migrations.pumpkin.push({ name: variety.variety_name, reason });
      }
      
      // C) Winter Squash
      else if (
        combined.includes('butternut') ||
        combined.includes('acorn') ||
        combined.includes('kabocha') ||
        combined.includes('delicata') ||
        combined.includes('spaghetti squash') ||
        combined.includes('hubbard') ||
        combined.includes('buttercup') ||
        combined.includes('banana squash') ||
        combined.includes('maxima') ||
        combined.includes('moschata squash') ||
        combined.includes('storage') ||
        combined.includes('winter squash')
      ) {
        targetTypeId = WINTER_SQUASH_ID;
        targetTypeName = 'Winter Squash';
        reason = 'Matched winter squash keyword';
        migrations.winter.push({ name: variety.variety_name, reason });
      }
      
      // D) Default to Summer Squash
      else {
        targetTypeId = SUMMER_SQUASH_ID;
        targetTypeName = 'Summer Squash';
        reason = 'Default (no specific match)';
        migrations.summer.push({ name: variety.variety_name, reason });
      }

      // Execute migration if not dry run
      if (!dry_run && targetTypeId) {
        console.log('[Squash Migration] Migrating', variety.variety_name, 'to', targetTypeName);
        await base44.asServiceRole.entities.Variety.update(variety.id, {
          plant_type_id: targetTypeId,
          plant_type_name: targetTypeName
        });
      }
    }

    // After migration, normalize subcategories
    let normalizeResult = null;
    if (!dry_run && umbrellaVarieties.length > 0) {
      console.log('[Squash Migration] Running normalization...');
      try {
        const normalizeResponse = await base44.asServiceRole.functions.invoke('normalizeVarietySubcategories', {});
        normalizeResult = normalizeResponse.data;
      } catch (error) {
        console.error('[Squash Migration] Normalization error:', error);
      }
    }

    const summary = {
      total: umbrellaVarieties.length,
      zucchini: migrations.zucchini.length,
      pumpkin: migrations.pumpkin.length,
      winter: migrations.winter.length,
      summer: migrations.summer.length
    };

    return Response.json({
      success: true,
      dry_run,
      summary,
      migrations,
      normalizeResult,
      message: dry_run 
        ? `Dry run: ${summary.total} varieties would be migrated` 
        : `Migrated ${summary.total} varieties and normalized subcategories`
    });
  } catch (error) {
    console.error('[Squash Migration] Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});