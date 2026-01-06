import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { csvData, dryRun = false } = await req.json();

    if (!csvData) {
      return Response.json({ error: 'csvData required' }, { status: 400 });
    }

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return Response.json({ error: 'CSV must have header + data rows' }, { status: 400 });
    }

    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    const plantAIdx = header.indexOf('plant_a');
    const plantBIdx = header.indexOf('plant_b');
    const relationshipIdx = header.indexOf('relationship');
    const whyIdx = header.indexOf('why');
    const evidenceIdx = header.indexOf('evidence_level');

    if (plantAIdx === -1 || plantBIdx === -1 || relationshipIdx === -1) {
      return Response.json({ error: 'CSV must have: plant_a, plant_b, relationship' }, { status: 400 });
    }

    const plantTypes = await base44.asServiceRole.entities.PlantType.list('common_name', 500);
    const plantMap = {};
    plantTypes.forEach(pt => {
      plantMap[pt.common_name.toLowerCase().trim()] = pt.id;
    });

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: [],
      preview: []
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map(p => p.trim());
      const plantAName = parts[plantAIdx]?.toLowerCase().trim();
      const plantBName = parts[plantBIdx]?.toLowerCase().trim();
      const relationship = parts[relationshipIdx]?.toLowerCase().trim();
      const why = parts[whyIdx] || '';
      const evidence = parts[evidenceIdx] || 'C';

      if (!plantAName || !plantBName || !relationship) {
        results.failed.push({ row: i + 1, reason: 'Missing required fields' });
        continue;
      }

      const plantAId = plantMap[plantAName];
      const plantBId = plantMap[plantBName];

      if (!plantAId) {
        results.failed.push({ row: i + 1, reason: `Unknown plant: ${plantAName}` });
        continue;
      }

      if (!plantBId) {
        results.failed.push({ row: i + 1, reason: `Unknown plant: ${plantBName}` });
        continue;
      }

      if (plantAId === plantBId) {
        results.failed.push({ row: i + 1, reason: 'Plant A and B cannot be the same' });
        continue;
      }

      // Map relationship
      let companionType = 'GOOD';
      if (relationship === 'bad') {
        companionType = 'BAD';
      } else if (relationship === 'caution' || relationship === 'conditional' || relationship === 'good conditional') {
        companionType = 'GOOD_CONDITIONAL';
      } else if (relationship === 'unknown') {
        companionType = 'GOOD_CONDITIONAL';
      }

      // Canonical ordering: lower ID first
      let finalPlantA = plantAId;
      let finalPlantB = plantBId;
      if (plantAId > plantBId) {
        finalPlantA = plantBId;
        finalPlantB = plantAId;
      }

      const notes = evidence ? `Evidence: ${evidence.toUpperCase()} — ${why}` : why;

      const ruleData = {
        plant_type_id: finalPlantA,
        companion_plant_type_id: finalPlantB,
        companion_type: companionType,
        notes,
        evidence_level: evidence.toUpperCase(),
        source: 'CSV Import'
      };

      results.preview.push(ruleData);

      if (!dryRun) {
        // Check if exists
        const existing = await base44.asServiceRole.entities.CompanionRule.filter({
          plant_type_id: finalPlantA,
          companion_plant_type_id: finalPlantB
        });

        if (existing.length > 0) {
          await base44.asServiceRole.entities.CompanionRule.update(existing[0].id, ruleData);
          results.updated++;
        } else {
          await base44.asServiceRole.entities.CompanionRule.create(ruleData);
          results.created++;
        }
      }
    }

    return Response.json({
      success: true,
      dryRun,
      ...results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});