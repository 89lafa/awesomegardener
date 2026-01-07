import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      duplicates: [],
      missingData: []
    };

    // Track existing pairs to prevent duplicates
    const existingPairs = new Set();
    const allRules = await base44.asServiceRole.entities.CompanionRule.list();
    allRules.forEach(rule => {
      if (rule.plant_type_id && rule.companion_plant_type_id) {
        existingPairs.add(`${rule.plant_type_id}|${rule.companion_plant_type_id}`);
      }
    });

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      // Validate required fields
      if (!row.plant_type_id || !row.companion_type) {
        results.errors.push(`Row ${i}: Missing required fields`);
        results.skipped++;
        continue;
      }

      // Validate companion_type
      if (!['GOOD', 'BAD', 'GOOD_CONDITIONAL'].includes(row.companion_type)) {
        results.errors.push(`Row ${i}: Invalid companion_type "${row.companion_type}". Must be GOOD, BAD, or GOOD_CONDITIONAL`);
        results.skipped++;
        continue;
      }

      // Validate evidence_level if provided
      if (row.evidence_level && !['A', 'B', 'C'].includes(row.evidence_level)) {
        results.errors.push(`Row ${i}: Invalid evidence_level "${row.evidence_level}". Must be A, B, or C`);
        results.skipped++;
        continue;
      }

      // Check for missing notes/source
      if (!row.notes || !row.source) {
        results.missingData.push({
          row: i,
          variety: row.variety_name || row.plant_type_id,
          missing: !row.notes && !row.source ? 'notes and source' : !row.notes ? 'notes' : 'source'
        });
      }

      const ruleData = {
        plant_type_id: row.plant_type_id,
        companion_type: row.companion_type,
        companion_plant_type_id: row.companion_plant_type_id || null,
        companion_plant_family: row.companion_plant_family || null,
        notes: row.notes || null,
        source: row.source || null,
        evidence_level: row.evidence_level || null
      };

      try {
        if (row.id && row.id.length > 0) {
          // Update existing record
          await base44.asServiceRole.entities.CompanionRule.update(row.id, ruleData);
          results.updated++;
        } else {
          // Check for duplicates before creating
          const pairKey = `${row.plant_type_id}|${row.companion_plant_type_id}`;
          if (existingPairs.has(pairKey)) {
            results.duplicates.push({
              plant_type_id: row.plant_type_id,
              companion_plant_type_id: row.companion_plant_type_id
            });
            results.skipped++;
            continue;
          }

          // Create new record
          await base44.asServiceRole.entities.CompanionRule.create(ruleData);
          existingPairs.add(pairKey);
          results.inserted++;
        }
      } catch (error) {
        results.errors.push(`Row ${i}: ${error.message}`);
        results.skipped++;
      }
    }

    // Generate audit report
    const auditRules = await base44.asServiceRole.entities.CompanionRule.list();
    const audit = {
      total: auditRules.length,
      by_companion_type: {
        GOOD: auditRules.filter(r => r.companion_type === 'GOOD').length,
        BAD: auditRules.filter(r => r.companion_type === 'BAD').length,
        GOOD_CONDITIONAL: auditRules.filter(r => r.companion_type === 'GOOD_CONDITIONAL').length
      },
      by_evidence_level: {
        A: auditRules.filter(r => r.evidence_level === 'A').length,
        B: auditRules.filter(r => r.evidence_level === 'B').length,
        C: auditRules.filter(r => r.evidence_level === 'C').length,
        null: auditRules.filter(r => !r.evidence_level).length
      },
      missing_notes: auditRules.filter(r => !r.notes).length,
      missing_source: auditRules.filter(r => !r.source).length
    };

    // Check for duplicates in database
    const pairCounts = {};
    auditRules.forEach(rule => {
      if (rule.plant_type_id && rule.companion_plant_type_id) {
        const key = `${rule.plant_type_id}|${rule.companion_plant_type_id}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    });
    const dbDuplicates = Object.entries(pairCounts)
      .filter(([key, count]) => count > 1)
      .map(([key, count]) => ({ pair: key, count }));

    audit.duplicates_in_db = dbDuplicates;

    return Response.json({ 
      success: true,
      results,
      audit
    });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});