import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DANGER ZONE: Deletes ALL varieties for a given plant_type_id.
 * Admin-only. Requires confirmation_text = "DELETE ALL" to proceed.
 *
 * POST { plant_type_id, confirmation_text, dry_run }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { plant_type_id, confirmation_text, dry_run } = body;

    if (!plant_type_id) {
      return Response.json({ error: 'plant_type_id is required' }, { status: 400 });
    }

    const isDryRun = dry_run === true || dry_run === 'true';

    if (!isDryRun && confirmation_text !== 'DELETE ALL') {
      return Response.json({ error: 'confirmation_text must be "DELETE ALL" to proceed' }, { status: 400 });
    }

    // Load all varieties for this plant type
    const varieties = await base44.asServiceRole.entities.Variety.filter(
      { plant_type_id },
      'variety_name',
      9999
    );

    console.log(`[deleteAllVarietiesForPlantType] ${plant_type_id}: found ${varieties.length} varieties. dry_run=${isDryRun}`);

    if (isDryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        plant_type_id,
        would_delete: varieties.length,
        sample: varieties.slice(0, 10).map(v => v.variety_name),
        message: `DRY RUN: Would delete ${varieties.length} varieties.`
      });
    }

    // Delete in batches with delay to avoid rate limits
    let deleted = 0;
    let errors = [];

    for (const v of varieties) {
      try {
        await base44.asServiceRole.entities.Variety.delete(v.id);
        deleted++;
        await new Promise(r => setTimeout(r, 80));
      } catch (err) {
        console.warn(`Failed to delete ${v.id} (${v.variety_name}):`, err.message);
        errors.push(v.variety_name);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return Response.json({
      success: true,
      dry_run: false,
      plant_type_id,
      total: varieties.length,
      deleted,
      errors: errors.slice(0, 20),
      message: `Deleted ${deleted}/${varieties.length} varieties.`
    });

  } catch (error) {
    console.error('[deleteAllVarietiesForPlantType] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});