import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { photo_url, variety_id, plant_type_id, crop_plan_id, plant_context } = await req.json();

    if (!photo_url) {
      return Response.json({ error: 'Missing photo_url' }, { status: 400 });
    }

    console.log('[DiagnosePlant] Analyzing photo for user:', user.email);

    const startTime = Date.now();

    // Build context for better diagnosis
    let contextInfo = '';
    if (plant_context?.variety_name) {
      contextInfo += `Plant: ${plant_context.variety_name}\n`;
    }
    if (plant_context?.plant_age_weeks) {
      contextInfo += `Age: ${plant_context.plant_age_weeks} weeks\n`;
    }
    if (plant_context?.zone) {
      contextInfo += `Zone: ${plant_context.zone}\n`;
    }

    const systemPrompt = `You are an expert plant pathologist analyzing plant health issues.

${contextInfo}

Analyze the photo and identify any disease, pest, deficiency, or environmental problem. Return ONLY valid JSON in this exact format:
{
  "issue_type": "disease|pest|deficiency|environmental|unknown",
  "issue_name": "Common name of the problem",
  "scientific_name": "Scientific name if applicable, or empty string",
  "confidence_level": 85,
  "severity": "low|medium|high|critical",
  "symptoms_observed": ["symptom 1", "symptom 2", "symptom 3"],
  "diagnosis_description": "Detailed explanation of what's happening",
  "organic_treatments": ["organic treatment 1", "organic treatment 2"],
  "chemical_treatments": ["chemical treatment 1", "chemical treatment 2"],
  "prevention_tips": ["prevention tip 1", "prevention tip 2"]
}`;

    // Use Core.InvokeLLM with image
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: 'Analyze this plant photo for health issues. Identify any diseases, pests, deficiencies, or problems. Return diagnosis in the exact JSON format specified.',
      file_urls: [photo_url],
      response_json_schema: {
        type: "object",
        properties: {
          issue_type: { type: "string" },
          issue_name: { type: "string" },
          scientific_name: { type: "string" },
          confidence_level: { type: "number" },
          severity: { type: "string" },
          symptoms_observed: { type: "array", items: { type: "string" } },
          diagnosis_description: { type: "string" },
          organic_treatments: { type: "array", items: { type: "string" } },
          chemical_treatments: { type: "array", items: { type: "string" } },
          prevention_tips: { type: "array", items: { type: "string" } }
        }
      }
    });

    const responseTime = Date.now() - startTime;

    // Save diagnosis to database
    const diagnosis = await base44.entities.PlantDiagnosis.create({
      crop_plan_id: crop_plan_id || null,
      variety_id: variety_id || null,
      plant_type_id: plant_type_id || null,
      photo_url,
      photo_date: new Date().toISOString(),
      issue_type: response.issue_type || 'unknown',
      issue_name: response.issue_name || 'Unknown Issue',
      scientific_name: response.scientific_name || '',
      confidence_level: response.confidence_level || 0,
      severity: response.severity || 'medium',
      symptoms_observed: response.symptoms_observed || [],
      diagnosis_description: response.diagnosis_description || '',
      organic_treatments: response.organic_treatments || [],
      chemical_treatments: response.chemical_treatments || [],
      prevention_tips: response.prevention_tips || [],
      model_used: 'claude-sonnet-4',
      response_time_ms: responseTime,
      created_by: user.email
    });

    console.log('[DiagnosePlant] Diagnosis complete:', diagnosis.id);

    return Response.json({
      success: true,
      diagnosis_id: diagnosis.id,
      diagnosis: response
    });
  } catch (error) {
    console.error('[DiagnosePlant] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});