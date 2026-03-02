/**
 * restoreSubcatsFromCSV
 * Accepts a JSON array of {id, plant_subcategory_id} rows extracted from the CSV export
 * and writes them back to the DB — only for varieties that currently have no subcategory.
 * 
 * This is the most accurate repair strategy because the CSV is the original ground truth.
 * 
 * Payload:
 *   rows: Array<{ id: string, plant_subcategory_id: string }>
 *   dry_run: boolean (default: true)
 *   overwrite_existing: boolean (default: false) — if true, also updates varieties that already have a subcat
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, label = '', maxRetries = 4) {
  let backoff = 2500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); } catch (err) {
      const isRL = (err?.message || '').toLowerCase().includes('rate') || err?.status === 429;
      if (isRL && attempt < maxRetries) {
        console.warn(`[Retry] ${label} — waiting ${backoff}ms`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 25000);
        continue;
      }
      throw err;
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { rows = [], dry_run = true, overwrite_existing = false } = body;

    if (!rows.length) {
      return Response.json({ error: 'No rows provided' }, { status: 400 });
    }

    // Validate subcategory IDs exist in DB
    const allSubcats = await withRetry(
      () => base44.asServiceRole.entities.PlantSubCategory.list(),
      'Load subcats'
    );
    const validSubcatIds = new Set(allSubcats.map(sc => sc.id));

    let fixed = 0, skipped = 0, invalid = 0, noSubcatInCSV = 0;
    const sample = [];
    const BATCH = 8;

    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);

      for (const row of chunk) {
        const { id, plant_subcategory_id } = row;

        if (!id || !plant_subcategory_id || plant_subcategory_id.trim() === '') {
          noSubcatInCSV++;
          continue;
        }

        if (!validSubcatIds.has(plant_subcategory_id)) {
          invalid++;
          console.warn(`[restoreSubcatsFromCSV] Invalid subcat ID ${plant_subcategory_id} for variety ${id}`);
          continue;
        }

        // Fetch current variety
        let variety;
        try {
          const results = await withRetry(
            () => base44.asServiceRole.entities.Variety.filter({ id }),
            `Fetch variety ${id}`
          );
          variety = results[0];
        } catch (err) {
          console.warn(`[restoreSubcatsFromCSV] Could not fetch variety ${id}: ${err.message}`);
          skipped++;
          continue;
        }

        if (!variety) { skipped++; continue; }

        // Skip if already has a subcategory (unless overwrite_existing)
        if (!overwrite_existing && variety.plant_subcategory_id && validSubcatIds.has(variety.plant_subcategory_id)) {
          skipped++;
          continue;
        }

        if (!dry_run) {
          await withRetry(
            () => base44.asServiceRole.entities.Variety.update(id, {
              plant_subcategory_id,
              plant_subcategory_ids: [plant_subcategory_id],
            }),
            `Update ${variety.variety_name}`
          );
        }

        fixed++;
        if (sample.length < 15) {
          const sc = allSubcats.find(s => s.id === plant_subcategory_id);
          sample.push({ name: variety.variety_name, subcat: sc?.name || plant_subcategory_id });
        }
      }

      if (i + BATCH < rows.length) await sleep(1800);
    }

    return Response.json({
      success: true,
      dry_run,
      total_rows: rows.length,
      fixed,
      skipped,
      invalid_subcat_id: invalid,
      no_subcat_in_csv: noSubcatInCSV,
      sample_fixes: sample,
    });
  } catch (err) {
    console.error('[restoreSubcatsFromCSV]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});