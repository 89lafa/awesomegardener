import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[NormalizeSpaces] Starting...');

    const allSpaces = await base44.asServiceRole.entities.GardenSpace.list();
    console.log('[NormalizeSpaces] Loaded', allSpaces.length, 'spaces');

    // Group by garden_id
    const byGarden = {};
    for (const space of allSpaces) {
      if (!byGarden[space.garden_id]) {
        byGarden[space.garden_id] = [];
      }
      byGarden[space.garden_id].push(space);
    }

    let spacesRenamed = 0;
    let duplicatesFound = 0;

    for (const [gardenId, spaces] of Object.entries(byGarden)) {
      // Group by name within garden
      const nameGroups = {};
      for (const space of spaces) {
        const name = space.name || 'Unnamed';
        if (!nameGroups[name]) nameGroups[name] = [];
        nameGroups[name].push(space);
      }

      // Process duplicates
      for (const [name, group] of Object.entries(nameGroups)) {
        if (group.length > 1) {
          duplicatesFound += group.length - 1;
          console.log(`[NormalizeSpaces] Found ${group.length} spaces named "${name}" in garden ${gardenId}`);

          // Rename duplicates sequentially
          for (let i = 1; i < group.length; i++) {
            const newName = `${name} ${i + 1}`;
            await base44.asServiceRole.entities.GardenSpace.update(group[i].id, {
              name: newName
            });
            spacesRenamed++;
            console.log(`[NormalizeSpaces] Renamed "${name}" → "${newName}"`);
          }
        }
      }
    }

    console.log('[NormalizeSpaces] Complete:', { spacesRenamed, duplicatesFound });

    return Response.json({
      success: true,
      summary: {
        spaces_renamed: spacesRenamed,
        duplicates_found: duplicatesFound
      }
    });
  } catch (error) {
    console.error('[NormalizeSpaces] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});