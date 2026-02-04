import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { photo_url } = await req.json();

    if (!photo_url) {
      return Response.json({ error: 'Missing photo_url' }, { status: 400 });
    }

    console.log('[IdentifyPlant] Analyzing photo for user:', user.email);

    const startTime = Date.now();

    const systemPrompt = `You are a plant identification expert. Analyze this photo and identify the plant type and suggest possible varieties.

Return ONLY valid JSON in this exact format:
{
  "plant_type": "Tomato",
  "confidence": 92,
  "reasoning": "Identified by compound leaves, yellow flowers, and red fruit characteristics",
  "possible_varieties": [
    {
      "variety_name": "Brandywine",
      "confidence": 85,
      "matching_features": ["large pink fruit", "potato leaf type", "indeterminate growth"]
    },
    {
      "variety_name": "Cherokee Purple",
      "confidence": 78,
      "matching_features": ["dark purple fruit", "irregular shape", "heirloom characteristics"]
    }
  ]
}`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: 'Analyze this plant photo and identify the plant type. Suggest 3-5 possible variety matches based on visible characteristics. Return in the exact JSON format specified.',
      file_urls: [photo_url],
      response_json_schema: {
        type: "object",
        properties: {
          plant_type: { type: "string" },
          confidence: { type: "number" },
          reasoning: { type: "string" },
          possible_varieties: {
            type: "array",
            items: {
              type: "object",
              properties: {
                variety_name: { type: "string" },
                confidence: { type: "number" },
                matching_features: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          }
        }
      }
    });

    const responseTime = Date.now() - startTime;

    // Look up plant type in database
    const plantTypes = await base44.entities.PlantType.filter({
      common_name: response.plant_type
    });
    const plantTypeId = plantTypes[0]?.id || null;

    // Look up varieties and get IDs
    const varietyMatches = [];
    for (const varMatch of response.possible_varieties || []) {
      const varieties = await base44.entities.Variety.filter({
        variety_name: varMatch.variety_name
      });
      
      if (varieties.length > 0) {
        varietyMatches.push({
          variety_id: varieties[0].id,
          variety_name: varMatch.variety_name,
          match_confidence: varMatch.confidence,
          matching_characteristics: varMatch.matching_features
        });
      }
    }

    // Save identification
    const identification = await base44.entities.PlantIdentification.create({
      photo_url,
      photo_date: new Date().toISOString(),
      identified_plant_type_id: plantTypeId,
      identified_plant_type_name: response.plant_type,
      confidence_level: response.confidence,
      reasoning: response.reasoning,
      variety_matches: varietyMatches,
      model_used: 'claude-sonnet-4',
      response_time_ms: responseTime,
      created_by: user.email
    });

    console.log('[IdentifyPlant] Identification complete:', identification.id);

    return Response.json({
      success: true,
      identification_id: identification.id,
      result: {
        ...response,
        variety_matches: varietyMatches
      }
    });
  } catch (error) {
    console.error('[IdentifyPlant] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});