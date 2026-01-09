import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { plant_type_id, matching_mode } = await req.json();
    
    console.log('[Dedupe Dry-Run] Starting with mode:', matching_mode);
    
    // Load varieties
    const query = plant_type_id ? { plant_type_id } : {};
    const allVarieties = await base44.asServiceRole.entities.Variety.filter(query, 'variety_name', 10000);
    
    console.log('[Dedupe Dry-Run] Loaded', allVarieties.length, 'varieties');
    
    // Helper to normalize variety name
    const normalizeVarietyName = (name) => {
      if (!name) return '';
      return name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/\.$/, '');
    };
    
    // Group by matching criteria
    const groups = {};
    
    for (const variety of allVarieties) {
      let key;
      
      if (matching_mode === 'code_first' && variety.variety_code) {
        key = `code:${variety.variety_code}`;
      } else {
        const normalized = normalizeVarietyName(variety.variety_name);
        key = `name:${variety.plant_type_id}:${normalized}`;
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(variety);
    }
    
    // Find duplicate groups (more than 1 variety)
    const duplicateGroups = [];
    
    for (const [key, varieties] of Object.entries(groups)) {
      if (varieties.length > 1) {
        // Determine canonical
        const sorted = [...varieties].sort((a, b) => {
          // 1. Prefer variety_code
          if (a.variety_code && !b.variety_code) return -1;
          if (!a.variety_code && b.variety_code) return 1;
          
          // 2. Count non-null fields
          const countFields = (v) => {
            let count = 0;
            for (const [key, val] of Object.entries(v)) {
              if (val !== null && val !== undefined && val !== '' && key !== 'id' && key !== 'created_date') {
                count++;
              }
            }
            return count;
          };
          const aCount = countFields(a);
          const bCount = countFields(b);
          if (aCount !== bCount) return bCount - aCount;
          
          // 3. Oldest record
          return new Date(a.created_date) - new Date(b.created_date);
        });
        
        const canonical = sorted[0];
        const duplicates = sorted.map((v, idx) => ({
          id: v.id,
          variety_code: v.variety_code,
          variety_name: v.variety_name,
          created_date: v.created_date,
          isCanonical: idx === 0,
          fieldCount: Object.keys(v).filter(k => v[k] !== null && v[k] !== undefined && v[k] !== '').length,
          imageCount: v.images?.length || 0
        }));
        
        // Preview merge
        const mergedImages = [...new Set(varieties.flatMap(v => v.images || []))];
        const mergedSynonyms = [...new Set(varieties.flatMap(v => v.synonyms || []))];
        const mergedSubcatIds = [...new Set(varieties.flatMap(v => v.plant_subcategory_ids || (v.plant_subcategory_id ? [v.plant_subcategory_id] : [])))];
        
        duplicateGroups.push({
          variety_name: canonical.variety_name,
          plant_type_name: canonical.plant_type_name,
          canonical_id: canonical.id,
          duplicates,
          mergePreview: {
            images: mergedImages,
            synonyms: mergedSynonyms,
            plant_subcategory_ids: mergedSubcatIds
          }
        });
      }
    }
    
    console.log('[Dedupe Dry-Run] Found', duplicateGroups.length, 'duplicate groups');
    
    return Response.json({
      success: true,
      duplicateGroups,
      totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.duplicates.length - 1, 0)
    });
    
  } catch (error) {
    console.error('[Dedupe Dry-Run] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});