import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's planted crops and harvest logs
    const [plantInstances, harvestLogs] = await Promise.all([
      base44.entities.PlantInstance.filter({ created_by: user.email }),
      base44.entities.HarvestLog.filter({ created_by: user.email }, '-harvest_date', 20)
    ]);

    // Extract variety IDs
    const varietyIds = [...new Set([
      ...plantInstances.map(p => p.variety_id).filter(Boolean),
      ...harvestLogs.map(h => h.variety_id).filter(Boolean)
    ])];

    if (varietyIds.length === 0) {
      return Response.json({ 
        error: 'No crops found',
        message: 'Start planting crops or logging harvests to get personalized recipes!' 
      }, { status: 400 });
    }

    // Get variety names
    const varieties = await base44.asServiceRole.entities.Variety.filter({ 
      id: { $in: varietyIds } 
    });

    const ingredients = varieties.map(v => v.variety_name).filter(Boolean);

    // Generate recipes using AI
    const prompt = `You are a creative chef. Generate 3 delicious, practical recipes using these homegrown ingredients: ${ingredients.join(', ')}.

For each recipe, provide:
- title: Creative, appealing name
- description: 2 sentence description highlighting the fresh ingredients
- ingredients_list: Detailed ingredients list (array of strings)
- instructions: Step-by-step cooking instructions (array of strings)
- prep_time_minutes: Preparation time
- cook_time_minutes: Cooking time
- servings: Number of servings
- difficulty: easy, medium, or hard
- season: spring, summer, fall, winter, or year-round
- main_ingredients: Array of primary ingredients from user's garden

Make recipes creative, seasonal, and highlight the fresh garden produce.`;

    const aiResult = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          recipes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                ingredients_list: { type: "array", items: { type: "string" } },
                instructions: { type: "array", items: { type: "string" } },
                prep_time_minutes: { type: "number" },
                cook_time_minutes: { type: "number" },
                servings: { type: "number" },
                difficulty: { type: "string" },
                season: { type: "string" },
                main_ingredients: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    });

    // Create recipes in database with ai_generated and garden_specific flags
    const createdRecipes = [];
    for (const recipe of aiResult.recipes) {
      const created = await base44.asServiceRole.entities.Recipe.create({
        ...recipe,
        ai_generated: true,
        garden_specific: true,
        user_email: user.email,
        generated_date: new Date().toISOString()
      });
      createdRecipes.push(created);
    }

    return Response.json({ 
      success: true,
      recipes: createdRecipes,
      ingredients_used: ingredients
    });
  } catch (error) {
    console.error('Error generating recipes:', error);
    return Response.json({ 
      error: 'Failed to generate recipes',
      details: error.message 
    }, { status: 500 });
  }
});