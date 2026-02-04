import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { zip_code } = await req.json();

    if (!zip_code) {
      return Response.json({ error: 'Missing zip_code' }, { status: 400 });
    }

    console.log('[DetectZone] Looking up zone and frost dates for:', zip_code);

    // Use AI to determine zone and frost dates based on ZIP
    const prompt = `For US ZIP code ${zip_code}, provide the USDA hardiness zone and typical frost dates.

Return ONLY valid JSON:
{
  "zone": "7a",
  "last_frost_date": "2026-04-15",
  "first_frost_date": "2026-10-15",
  "growing_season_days": 183,
  "location_name": "City, State"
}`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          zone: { type: "string" },
          last_frost_date: { type: "string" },
          first_frost_date: { type: "string" },
          growing_season_days: { type: "number" },
          location_name: { type: "string" }
        }
      }
    });

    console.log('[DetectZone] Result:', response);

    return Response.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('[DetectZone] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});