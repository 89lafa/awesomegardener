import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Valid values for validation
const VALID_COMPANION_TYPES = ['GOOD', 'BAD', 'GOOD_CONDITIONAL'];
const VALID_EVIDENCE_LEVELS = ['A', 'B', 'C'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { csvData, dryRun } = await req.json();

    if (!csvData) {
      return Response.json({ error: 'No CSV data provided' }, { status: 400 });
    }

    // Parse CSV
    const lines = csvData.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    // Fetch all plant types for lookup
    const plantTypes = await base44.asServiceRole.entities.PlantType.list();
    const plantTypeMap = {};
    plantTypes.forEach(pt => {
      plantTypeMap[pt.common_name.toLowerCase()] = pt.id;
    });

    const preview = [];
    const failed = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      try {
        // Find plant type IDs
        const plantAId = plantTypeMap[row.plant_a?.toLowerCase()];
        const plantBId = plantTypeMap[row.plant_b?.toLowerCase()];

        if (!plantAId || !plantBId) {
          failed.push({
            row: i + 1,
            reason: `Plant not found: ${!plantAId ? row.plant_a : row.plant_b}`
          });
          continue;
        }

        // Map relationship to companion_type
        let companionType;
        const rel = row.relationship?.toLowerCase();
        if (rel === 'good') companionType = 'GOOD';
        else if (rel === 'bad') companionType = 'BAD';
        else if (rel === 'good conditional' || rel === 'good/conditional') companionType = 'GOOD_CONDITIONAL';
        else {
          failed.push({
            row: i + 1,
            reason: `Invalid relationship: ${row.relationship}`
          });
          continue;
        }

        // Validate evidence level
        const evidenceLevel = (row.evidence_level || 'C').toUpperCase();
        if (!VALID_EVIDENCE_LEVELS.includes(evidenceLevel)) {
          failed.push({
            row: i + 1,
            reason: `Invalid evidence level: ${row.evidence_level}`
          });
          continue;
        }

        // Canonical ordering (always store A < B alphabetically)
        let plantA = plantAId;
        let plantB = plantBId;
        if (plantA > plantB) {
          [plantA, plantB] = [plantB, plantA];
        }

        const ruleData = {
          plant_type_id: plantA,
          companion_plant_type_id: plantB,
          companion_type: companionType,
          notes: row.why || '',
          evidence_level: evidenceLevel,
          source: row.source || ''
        };

        preview.push(ruleData);

        if (!dryRun) {
          // Check if rule exists (by ID if provided, else by pair)
          let existing = null;
          if (row.id) {
            const existingRules = await base44.asServiceRole.entities.CompanionRule.filter({ id: row.id });
            existing = existingRules[0];
          } else {
            const existingRules = await base44.asServiceRole.entities.CompanionRule.filter({
              plant_type_id: plantA,
              companion_plant_type_id: plantB
            });
            existing = existingRules[0];
          }

          if (existing) {
            await base44.asServiceRole.entities.CompanionRule.update(existing.id, ruleData);
            updated++;
          } else {
            await base44.asServiceRole.entities.CompanionRule.create(ruleData);
            created++;
          }
        }
      } catch (error) {
        failed.push({
          row: i + 1,
          reason: error.message
        });
      }
    }

    return Response.json({
      success: true,
      preview: dryRun ? preview : undefined,
      created: dryRun ? preview.length : created,
      updated,
      skipped,
      failed
    });
  } catch (error) {
    console.error('Error importing companion rules:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});