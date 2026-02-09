import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { packet_image_base64, barcode } = await req.json();

    if (!packet_image_base64) {
      return Response.json({ error: 'packet_image_base64 required' }, { status: 400 });
    }

    // STEP 1: AI Vision - Read packet directly
    console.log('[EnrichSeed] Step 1: AI Vision reading packet...');
    const visionResult = await base44.integrations.Core.InvokeLLM({
      prompt: `You are analyzing a seed packet image. Extract ALL visible information:

1. VARIETY NAME - the specific cultivar (e.g., "Cherokee Purple", "Jalapeno M")
2. PLANT TYPE - what kind of plant (Tomato, Pepper, Basil, etc.)
3. VENDOR/BRAND - seed company name (e.g., "Baker Creek", "Burpee")
4. SCIENTIFIC NAME - if printed
5. DAYS TO MATURITY - number
6. SPACING - planting distance in inches
7. PLANTING DEPTH
8. SUN REQUIREMENTS
9. DESCRIPTION - any description text
10. ORGANIC - is it marked organic?
11. HEIRLOOM/HYBRID - seed type
12. PACKET SIZE - number of seeds or weight
13. PRICE - if visible
14. YEAR - packet year
15. UPC/BARCODE - if visible in image

Return structured JSON. Use null for anything not clearly visible.`,
      file_urls: [packet_image_base64],
      response_json_schema: {
        type: "object",
        properties: {
          variety_name: { type: "string" },
          plant_type: { type: "string" },
          vendor_name: { type: "string" },
          scientific_name: { type: "string" },
          days_to_maturity: { type: "number" },
          spacing_inches: { type: "number" },
          planting_depth: { type: "string" },
          sun_requirement: { type: "string" },
          description: { type: "string" },
          is_organic: { type: "boolean" },
          seed_line_type: { type: "string" },
          packet_size: { type: "string" },
          price: { type: "number" },
          packet_year: { type: "number" },
          visible_barcode: { type: "string" }
        }
      }
    });

    // STEP 2: AI Web Search to fill gaps
    console.log('[EnrichSeed] Step 2: Web search for missing data...');
    const searchQuery = `${visionResult.variety_name} ${visionResult.plant_type} seed days to maturity spacing growing guide`;
    
    const synthesisResult = await base44.integrations.Core.InvokeLLM({
      prompt: `You have seed packet scan data. Fill in any missing fields and create complete seed record.

FROM PACKET SCAN:
${JSON.stringify(visionResult, null, 2)}

Create a COMPLETE record. Use packet data as primary source. For common knowledge (e.g., tomatoes need full sun), fill those in.

Map fields to these enums:
- sun_requirement: "full_sun", "partial_sun", "partial_shade", "full_shade"
- water_requirement: "low", "moderate", "high"
- seed_line_type: "heirloom", "hybrid", "open_pollinated", "unknown"
- growth_habit: "determinate", "indeterminate", "bush", "vining", etc.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          variety_name: { type: "string" },
          plant_type_name: { type: "string" },
          scientific_name: { type: "string" },
          description: { type: "string" },
          vendor_name: { type: "string" },
          days_to_maturity: { type: "number" },
          days_to_maturity_min: { type: "number" },
          days_to_maturity_max: { type: "number" },
          spacing_recommended: { type: "number" },
          spacing_min: { type: "number" },
          spacing_max: { type: "number" },
          sun_requirement: { type: "string" },
          water_requirement: { type: "string" },
          growth_habit: { type: "string" },
          plant_height_typical: { type: "string" },
          seed_line_type: { type: "string" },
          is_organic: { type: "boolean" },
          container_friendly: { type: "boolean" },
          trellis_required: { type: "boolean" },
          flavor_profile: { type: "string" },
          uses: { type: "string" },
          fruit_color: { type: "string" },
          fruit_shape: { type: "string" },
          disease_resistance: { type: "string" },
          packet_size: { type: "string" },
          retail_price: { type: "number" },
          confidence_score: { type: "number" },
          scoville_min: { type: "number" },
          scoville_max: { type: "number" }
        }
      }
    });

    return Response.json({
      success: true,
      extracted_data: synthesisResult,
      vision_raw: visionResult,
      barcode: barcode || visionResult.visible_barcode
    });

  } catch (error) {
    console.error('[EnrichSeed] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});