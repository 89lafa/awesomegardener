import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChefHat, Clock, Users, BookmarkPlus, BookmarkCheck, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const [allRecipes, userSaved] = await Promise.all([
        base44.entities.Recipe.filter({}),
        base44.entities.UserRecipeSave.filter({})
      ]);

      setRecipes(allRecipes);
      setSavedRecipes(userSaved);
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = async (recipeId) => {
    try {
      const existingSave = savedRecipes.find(s => s.recipe_id === recipeId);
      
      if (existingSave) {
        await base44.entities.UserRecipeSave.delete(existingSave.id);
        setSavedRecipes(savedRecipes.filter(s => s.id !== existingSave.id));
        toast.success('Removed from saved recipes');
      } else {
        const newSave = await base44.entities.UserRecipeSave.create({
          recipe_id: recipeId,
          made_count: 0
        });
        setSavedRecipes([...savedRecipes, newSave]);
        toast.success('Recipe saved!');
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      toast.error('Failed to save recipe');
    }
  };

  const isSaved = (recipeId) => {
    return savedRecipes.some(s => s.recipe_id === recipeId);
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = difficultyFilter === 'all' || recipe.difficulty === difficultyFilter;
    const matchesSeason = seasonFilter === 'all' || recipe.season === seasonFilter;
    
    return matchesSearch && matchesDifficulty && matchesSeason;
  });

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-emerald-600" />
            Garden Recipes
          </h1>
          <p className="text-gray-600 mt-1">Delicious recipes using your garden harvest</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulty</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={seasonFilter} onValueChange={setSeasonFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Seasons</SelectItem>
            <SelectItem value="spring">Spring</SelectItem>
            <SelectItem value="summer">Summer</SelectItem>
            <SelectItem value="fall">Fall</SelectItem>
            <SelectItem value="winter">Winter</SelectItem>
            <SelectItem value="year-round">Year-Round</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Recipe Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {filteredRecipes.map(recipe => (
          <Card key={recipe.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
            {recipe.photo_url && (
              <div className="h-48 overflow-hidden rounded-t-lg relative">
                <img
                  src={recipe.photo_url}
                  alt={recipe.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSave(recipe.id);
                  }}
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition-colors"
                >
                  {isSaved(recipe.id) ? (
                    <BookmarkCheck className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <BookmarkPlus className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              </div>
            )}
            <CardHeader onClick={() => window.location.href = createPageUrl('RecipeDetail') + '?id=' + recipe.id}>
              <CardTitle className="text-lg">{recipe.title}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge className={getDifficultyColor(recipe.difficulty)}>
                  {recipe.difficulty}
                </Badge>
                {recipe.season && recipe.season !== 'year-round' && (
                  <Badge variant="outline">{recipe.season}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent onClick={() => window.location.href = createPageUrl('RecipeDetail') + '?id=' + recipe.id}>
              <p className="text-sm text-gray-600 line-clamp-2 mb-4">{recipe.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {recipe.servings} servings
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRecipes.length === 0 && (
        <div className="text-center py-12">
          <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No recipes found. Try adjusting your filters.</p>
        </div>
      )}
    </div>
  );
}