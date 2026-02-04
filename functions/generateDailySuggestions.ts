import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[GenerateSuggestions] Generating suggestions for:', user.email);

    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long' });

    // Get user context
    const [growLists, cropPlans, gardens] = await Promise.all([
      base44.entities.GrowList.filter({ created_by: user.email, status: 'active' }),
      base44.entities.CropPlan.filter({ created_by: user.email }),
      base44.entities.Garden.filter({ created_by: user.email })
    ]);

    // Build context
    const plantsInGrowList = growLists.flatMap(list => 
      (list.items || []).map(item => item.variety_name || item.plant_type_name)
    ).slice(0, 10);

    const activeCrops = cropPlans
      .filter(crop => crop.status !== 'completed')
      .map(crop => ({
        label: crop.label,
        status: crop.status,
        planting_method: crop.planting_method
      }))
      .slice(0, 10);

    const context = {
      zone: user.usda_zone || '7a',
      currentMonth,
      plantsInGrowList,
      activeCrops,
      gardenCount: gardens.length
    };

    const aiPrompt = `Based on this gardening context, suggest 5-8 helpful proactive actions for this gardener:

USER CONTEXT:
- Zone: ${context.zone}
- Current Month: ${context.currentMonth}
- Plants in Grow Lists: ${plantsInGrowList.join(', ') || 'None'}
- Active Crops: ${activeCrops.length} crops planned
- Gardens: ${context.gardenCount}

Return ONLY a JSON array of suggestions. Each suggestion should be timely, actionable, and specific:
[{
  "type": "seasonal|companion|task|problem|optimization|harvest|weather",
  "title": "Short action title (under 50 chars)",
  "description": "Why this matters (under 100 chars)",
  "priority": "low|medium|high|urgent",
  "action": "add_to_grow_list|create_task|view_variety|add_companion|view_pest_library",
  "expiresInDays": 7
}]

Focus on seasonal timing, common problems for this month, and optimization opportunities.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string" },
                action: { type: "string" },
                expiresInDays: { type: "number" }
              }
            }
          }
        }
      }
    });

    const suggestions = response.suggestions || [];

    // Clear old active suggestions
    const oldSuggestions = await base44.entities.AISuggestion.filter({
      created_by: user.email,
      status: 'active'
    });
    for (const old of oldSuggestions) {
      await base44.entities.AISuggestion.update(old.id, { status: 'dismissed' });
    }

    // Create new suggestions
    const created = [];
    for (const suggestion of suggestions) {
      const expiresDate = new Date();
      expiresDate.setDate(expiresDate.getDate() + (suggestion.expiresInDays || 7));

      const newSuggestion = await base44.entities.AISuggestion.create({
        suggestion_type: suggestion.type,
        title: suggestion.title,
        description: suggestion.description,
        priority: suggestion.priority,
        suggested_action: suggestion.action,
        action_data: {},
        expires_date: expiresDate.toISOString(),
        status: 'active',
        generated_by_model: 'claude-sonnet-4',
        confidence: 85,
        created_by: user.email
      });

      created.push(newSuggestion);
    }

    console.log('[GenerateSuggestions] Created', created.length, 'suggestions');

    return Response.json({
      success: true,
      suggestions_created: created.length,
      suggestions: created
    });
  } catch (error) {
    console.error('[GenerateSuggestions] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});