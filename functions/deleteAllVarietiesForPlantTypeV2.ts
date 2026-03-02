/**
 * deleteAllVarietiesForPlantTypeV2
 * Deletes ALL Variety records for a given plant_type_id.
 * Admin only. Requires confirmation token.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, label = '', maxRetries = 4) {
  let backoff = 2000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); } catch (err) {
      const isRL = (err?.message || '').toLowerCase().includes('rate') || err?.status === 429;
      if (isRL && attempt < maxRetries) { await sleep(backoff); backoff = Math.min(backoff * 2, 20000); continue; }
      throw err;
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { plant_type_id, confirm_token, dry_run = true } = await req.json().catch(() => ({}));

    if (!plant_type_id) return Response.json({ error: 'plant_type_id required' }, { status: 400 });
    if (!dry_run && confirm_token !== `DELETE_${plant_type_id}`) {
      return Response.json({ error: 'Invalid confirm_token. Must be DELETE_<plant_type_id>' }, { status: 400 });
    }

    // Load all varieties for this plant type
    const varieties = await withRetry(
      () => base44.asServiceRole.entities.Variety.filter({ plant_type_id }, 'variety_name', 5000),
      'Load varieties'
    );

    if (dry_run) {
      return Response.json({
        success: true,
        dry_run: true,
        would_delete: varieties.length,
        sample: varieties.slice(0, 10).map(v => ({ id: v.id, name: v.variety_name })),
        confirm_token_needed: `DELETE_${plant_type_id}`,
      });
    }

    let deleted = 0;
    const errors = [];
    const BATCH = 5;

    for (let i = 0; i < varieties.length; i += BATCH) {
      const chunk = varieties.slice(i, i + BATCH);
      for (const v of chunk) {
        try {
          await withRetry(
            () => base44.asServiceRole.entities.Variety.delete(v.id),
            `Delete ${v.variety_name}`
          );
          deleted++;
        } catch (err) {
          errors.push({ id: v.id, name: v.variety_name, error: err.message });
        }
      }
      if (i + BATCH < varieties.length) await sleep(1500);
    }

    return Response.json({
      success: true,
      plant_type_id,
      deleted,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[deleteAllVarietiesForPlantTypeV2]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});