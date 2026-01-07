import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const rules = await base44.asServiceRole.entities.CompanionRule.list();

    // Count by companion_type
    const typeStats = {
      GOOD: rules.filter(r => r.companion_type === 'GOOD').length,
      BAD: rules.filter(r => r.companion_type === 'BAD').length,
      GOOD_CONDITIONAL: rules.filter(r => r.companion_type === 'GOOD_CONDITIONAL').length,
      other: rules.filter(r => !['GOOD', 'BAD', 'GOOD_CONDITIONAL'].includes(r.companion_type)).length
    };

    // Count by evidence_level
    const evidenceStats = {
      A: rules.filter(r => r.evidence_level === 'A').length,
      B: rules.filter(r => r.evidence_level === 'B').length,
      C: rules.filter(r => r.evidence_level === 'C').length,
      missing: rules.filter(r => !r.evidence_level).length
    };

    // Find duplicates by (plant_type_id, companion_plant_type_id)
    const pairMap = {};
    const duplicates = [];
    
    rules.forEach(rule => {
      const key = `${rule.plant_type_id}::${rule.companion_plant_type_id}`;
      if (pairMap[key]) {
        duplicates.push({
          pair: key,
          ids: [pairMap[key], rule.id]
        });
      } else {
        pairMap[key] = rule.id;
      }
    });

    // Find rows missing notes or source
    const missingData = rules.filter(r => !r.notes || !r.source).map(r => ({
      id: r.id,
      plant_type_id: r.plant_type_id,
      companion_plant_type_id: r.companion_plant_type_id,
      missing_notes: !r.notes,
      missing_source: !r.source
    }));

    return Response.json({
      total_rules: rules.length,
      type_stats: typeStats,
      evidence_stats: evidenceStats,
      duplicates,
      missing_data
    });
  } catch (error) {
    console.error('Error auditing companion rules:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});