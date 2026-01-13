import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await req.json();

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('[ExtractSeed] Fetching URL:', url);

    // Fetch page content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AwesomeGardener/1.0)'
      }
    });

    if (!response.ok) {
      return Response.json({ 
        success: false,
        error: 'Failed to fetch URL' 
      }, { status: 400 });
    }

    const html = await response.text();
    const domain = new URL(url).hostname.replace('www.', '');

    // Extract data using AI
    const extractionPrompt = `You are analyzing a seed vendor product page. Extract the following information from the HTML:

HTML Content:
${html.substring(0, 20000)}

Extract:
- variety_name (the specific variety name)
- common_name (e.g., Tomato, Pepper, Bean)
- description (product description)
- days_to_maturity (DTM)
- spacing_recommended (in inches if available)
- sun_requirement (full_sun, partial_sun, partial_shade, full_shade)
- water_requirement (low, moderate, high)
- growth_habit (determinate, indeterminate, bush, vining)
- heat_scoville_min and heat_scoville_max (for peppers)
- trellis_required (boolean)
- container_friendly (boolean)
- seed_line_type (heirloom, hybrid, open_pollinated)
- price (if available)

Return only the data that is clearly stated on the page. Use null for missing data.`;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: extractionPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          variety_name: { type: "string" },
          common_name: { type: "string" },
          description: { type: "string" },
          days_to_maturity: { type: "number" },
          spacing_recommended: { type: "number" },
          sun_requirement: { type: "string" },
          water_requirement: { type: "string" },
          growth_habit: { type: "string" },
          heat_scoville_min: { type: "number" },
          heat_scoville_max: { type: "number" },
          trellis_required: { type: "boolean" },
          container_friendly: { type: "boolean" },
          seed_line_type: { type: "string" },
          price: { type: "number" }
        }
      }
    });

    console.log('[ExtractSeed] Extracted data:', llmResponse);

    return Response.json({
      success: true,
      data: {
        ...llmResponse,
        source_url: url,
        source_domain: domain,
        source_vendor_name: domain.split('.')[0]
      }
    });
  } catch (error) {
    console.error('[ExtractSeed] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});