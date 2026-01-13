import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image_url, plant_common_name } = await req.json();

    if (!image_url) {
      return Response.json({ error: 'Image URL required' }, { status: 400 });
    }

    console.log('[IdentifyDisease] Analyzing image for', plant_common_name || 'unknown plant');

    const analysisPrompt = `You are a plant disease and pest expert. Analyze this plant photo and identify potential issues.

Plant type: ${plant_common_name || 'unknown'}

Identify:
1. Visible diseases (fungal, bacterial, viral)
2. Pest damage or presence
3. Nutrient deficiencies
4. Environmental stress

For each issue found, provide:
- Name of the disease/pest/issue
- Confidence level (high, medium, low)
- Description of symptoms visible
- Recommended actions

If the plant looks healthy, say so clearly.

IMPORTANT: This is advisory only. Gardeners should verify diagnoses.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      file_urls: [image_url],
      response_json_schema: {
        type: "object",
        properties: {
          is_healthy: { type: "boolean" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string" },
                confidence: { type: "string" },
                symptoms: { type: "string" },
                recommendations: { type: "array", items: { type: "string" } }
              }
            }
          },
          general_notes: { type: "string" }
        }
      }
    });

    return Response.json({
      success: true,
      ...response
    });
  } catch (error) {
    console.error('[IdentifyDisease] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});