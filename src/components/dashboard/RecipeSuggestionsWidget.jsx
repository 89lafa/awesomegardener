import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Loader2, ArrowRight } from 'lucide-react';

export default function RecipeSuggestionsWidget({ loadDelay = 0 }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuggestions();
    }, loadDelay);
    return () => clearTimeout(timer);
  }, [loadDelay]);

  const loadSuggestions = async () => {
    try {
      // Get recent harvests (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentHarvests = await base44.entities.HarvestLog.filter({
        harvest_date: { $gte: sevenDaysAgo.toISOString().split('T')[0] }
      });

      if (recentHarvests.length === 0) {
        setLoading(false);
        return;
      }

      // Get available ingredient plant types
      const availableIngredients = new Set(
        recentHarvests.map(h => h.plant_type_id).filter(Boolean)
      );

      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Find recipes
      const allRecipes = await base44.entities.Recipe.filter({});
      
      const matches = allRecipes.map(recipe => {
        const recipeIngredients = new Set(
          recipe.ingredients?.map(i => i.plant_type_id).filter(Boolean) || []
        );
        
        if (recipeIngredients.size === 0) return null;
        
        const matchCount = [...recipeIngredients].filter(i => 
          availableIngredients.has(i)
        ).length;
        
        const matchPercentage = (matchCount / recipeIngredients.size) * 100;
        
        return {
          recipe,
          matchPercentage,
          matchCount,
          totalIngredients: recipeIngredients.size
        };
      })
      .filter(m => m && m.matchPercentage >= 60)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);

      setSuggestions(matches.slice(0, 3));
    } catch (error) {
      console.warn('Recipe widget failed (non-critical)');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ChefHat className="w-5 h-5 text-emerald-600" />
            You Can Make
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ChefHat className="w-5 h-5 text-emerald-600" />
            You Can Make
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ChefHat className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Log some harvests to see recipe suggestions!</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.location.href = createPageUrl('HarvestLog')}
            >
              Log Harvest
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ChefHat className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            You Can Make
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = createPageUrl('Recipes')}
          >
            View All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map(({ recipe, matchPercentage }) => (
            <div
              key={recipe.id}
              className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition"
              onClick={() => window.location.href = createPageUrl('RecipeDetail') + '?id=' + recipe.id}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">{recipe.title}</h4>
                <Badge className={
                  matchPercentage === 100 ? 'bg-green-100 text-green-800' :
                  matchPercentage >= 80 ? 'bg-emerald-100 text-emerald-800' :
                  'bg-yellow-100 text-yellow-800'
                }>
                  {Math.round(matchPercentage)}%
                </Badge>
              </div>
              <Progress value={matchPercentage} className="h-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {matchPercentage === 100 ? 'You have all ingredients!' : 'Using your garden harvest'}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}