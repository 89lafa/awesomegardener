import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChefHat, Clock, Users, BookmarkPlus, BookmarkCheck, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function RecipeDetail() {
  const [recipe, setRecipe] = useState(null);
  const [userSave, setUserSave] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecipe();
  }, []);

  const loadRecipe = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const recipeId = urlParams.get('id');

      if (!recipeId) {
        toast.error('Recipe not found');
        return;
      }

      const [recipes, saves] = await Promise.all([
        base44.entities.Recipe.filter({ id: recipeId }),
        base44.entities.UserRecipeSave.filter({ recipe_id: recipeId })
      ]);

      if (recipes.length === 0) {
        toast.error('Recipe not found');
        return;
      }

      setRecipe(recipes[0]);
      setUserSave(saves.length > 0 ? saves[0] : null);

      // Increment view count
      await base44.entities.Recipe.update(recipeId, {
        views_count: (recipes[0].views_count || 0) + 1
      });
    } catch (error) {
      console.error('Error loading recipe:', error);
      toast.error('Failed to load recipe');
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = async () => {
    try {
      if (userSave) {
        await base44.entities.UserRecipeSave.delete(userSave.id);
        setUserSave(null);
        toast.success('Removed from saved recipes');
      } else {
        const newSave = await base44.entities.UserRecipeSave.create({
          recipe_id: recipe.id,
          made_count: 0
        });
        setUserSave(newSave);
        toast.success('Recipe saved!');
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      toast.error('Failed to save recipe');
    }
  };

  const markAsMade = async () => {
    try {
      if (!userSave) {
        const newSave = await base44.entities.UserRecipeSave.create({
          recipe_id: recipe.id,
          made_count: 1,
          last_made_date: new Date().toISOString()
        });
        setUserSave(newSave);
      } else {
        await base44.entities.UserRecipeSave.update(userSave.id, {
          made_count: (userSave.made_count || 0) + 1,
          last_made_date: new Date().toISOString()
        });
        setUserSave({
          ...userSave,
          made_count: (userSave.made_count || 0) + 1,
          last_made_date: new Date().toISOString()
        });
      }
      toast.success('Marked as made!');
    } catch (error) {
      console.error('Error marking as made:', error);
      toast.error('Failed to update');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="text-center py-12">
        <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Recipe not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      {recipe.photo_url && (
        <div className="h-64 md:h-96 overflow-hidden rounded-lg">
          <img src={recipe.photo_url} alt={recipe.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{recipe.title}</h1>
          <p className="text-gray-600 mt-2">{recipe.description}</p>
          {recipe.author && (
            <p className="text-sm text-gray-500 mt-2">By {recipe.author}</p>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={toggleSave}>
          {userSave ? (
            <BookmarkCheck className="w-5 h-5 text-emerald-600" />
          ) : (
            <BookmarkPlus className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Meta Info */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          <span className="text-sm">
            {recipe.prep_time_minutes && `Prep: ${recipe.prep_time_minutes}m`}
            {recipe.prep_time_minutes && recipe.cook_time_minutes && ' • '}
            {recipe.cook_time_minutes && `Cook: ${recipe.cook_time_minutes}m`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" />
          <span className="text-sm">{recipe.servings} servings</span>
        </div>
        <Badge className={
          recipe.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
          recipe.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }>
          {recipe.difficulty}
        </Badge>
        {recipe.cuisine && <Badge variant="outline">{recipe.cuisine}</Badge>}
        {recipe.season && <Badge variant="outline">{recipe.season}</Badge>}
      </div>

      {userSave && userSave.made_count > 0 && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-6">
            <p className="text-sm text-emerald-800">
              ✓ You've made this recipe {userSave.made_count} time{userSave.made_count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ingredients */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold mb-4">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients?.map((ingredient, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <span>{ingredient.name}</span>
                  {ingredient.variety_id && (
                    <a
                      href={createPageUrl('ViewVariety') + '?id=' + ingredient.variety_id}
                      className="ml-2 text-sm text-emerald-600 hover:underline inline-flex items-center gap-1"
                    >
                      View variety <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {ingredient.notes && (
                    <p className="text-sm text-gray-500 mt-1">{ingredient.notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold mb-4">Instructions</h2>
          <ol className="space-y-4">
            {recipe.instructions?.map((step, idx) => (
              <li key={idx} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                  {idx + 1}
                </div>
                <p className="flex-1 pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={markAsMade} className="bg-emerald-600 hover:bg-emerald-700">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          I Made This!
        </Button>
        {recipe.source_url && (
          <Button variant="outline" onClick={() => window.open(recipe.source_url, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" />
            View Source
          </Button>
        )}
      </div>
    </div>
  );
}