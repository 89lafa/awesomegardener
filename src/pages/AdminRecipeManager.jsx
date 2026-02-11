import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Plus, Edit, Trash2, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminRecipeManager() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ingredients_list: '',
    instructions: '',
    prep_time_minutes: '',
    cook_time_minutes: '',
    servings: '',
    difficulty: 'medium',
    season: 'year-round',
    ai_generated: false,
    garden_specific: false
  });

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const data = await base44.entities.Recipe.filter({}, '-created_date');
      setRecipes(data);
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingRecipe(null);
    setFormData({
      title: '',
      description: '',
      ingredients_list: '',
      instructions: '',
      prep_time_minutes: '',
      cook_time_minutes: '',
      servings: '',
      difficulty: 'medium',
      season: 'year-round',
      ai_generated: false,
      garden_specific: false
    });
    setShowModal(true);
  };

  const openEditModal = (recipe) => {
    setEditingRecipe(recipe);
    setFormData({
      title: recipe.title || '',
      description: recipe.description || '',
      ingredients_list: Array.isArray(recipe.ingredients_list) 
        ? recipe.ingredients_list.join('\n') 
        : recipe.ingredients_list || '',
      instructions: Array.isArray(recipe.instructions) 
        ? recipe.instructions.join('\n') 
        : recipe.instructions || '',
      prep_time_minutes: recipe.prep_time_minutes || '',
      cook_time_minutes: recipe.cook_time_minutes || '',
      servings: recipe.servings || '',
      difficulty: recipe.difficulty || 'medium',
      season: recipe.season || 'year-round',
      ai_generated: recipe.ai_generated || false,
      garden_specific: recipe.garden_specific || false
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.ingredients_list || !formData.instructions) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const recipeData = {
        ...formData,
        ingredients_list: formData.ingredients_list.split('\n').filter(Boolean),
        instructions: formData.instructions.split('\n').filter(Boolean),
        prep_time_minutes: formData.prep_time_minutes ? parseInt(formData.prep_time_minutes) : null,
        cook_time_minutes: formData.cook_time_minutes ? parseInt(formData.cook_time_minutes) : null,
        servings: formData.servings ? parseInt(formData.servings) : null
      };

      if (editingRecipe) {
        await base44.entities.Recipe.update(editingRecipe.id, recipeData);
        toast.success('Recipe updated!');
      } else {
        await base44.entities.Recipe.create(recipeData);
        toast.success('Recipe created!');
      }

      setShowModal(false);
      loadRecipes();
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Failed to save recipe');
    }
  };

  const handleDelete = async (recipeId) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await base44.entities.Recipe.delete(recipeId);
      toast.success('Recipe deleted');
      loadRecipes();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error('Failed to delete recipe');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.location.href = createPageUrl('AdminHub')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ChefHat className="w-8 h-8 text-emerald-600" />
              Manage Recipes
            </h1>
            <p className="text-gray-600 mt-1">Add and manage recipes for the community</p>
          </div>
        </div>
        <Button onClick={openCreateModal} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Recipe
        </Button>
      </div>

      {recipes.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No recipes yet. Add your first recipe!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map(recipe => (
            <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{recipe.title}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(recipe)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(recipe.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge>{recipe.difficulty}</Badge>
                  {recipe.ai_generated && (
                    <Badge className="bg-purple-100 text-purple-800">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI
                    </Badge>
                  )}
                  {recipe.garden_specific && (
                    <Badge className="bg-green-100 text-green-800">🌱 Garden</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 line-clamp-2">{recipe.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                  <span>⏱️ {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)}min</span>
                  <span>🍽️ {recipe.servings} servings</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecipe ? 'Edit Recipe' : 'Add New Recipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Recipe name"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the recipe"
                rows={2}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Difficulty</Label>
                <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Season</Label>
                <Select value={formData.season} onValueChange={(v) => setFormData({ ...formData, season: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spring">Spring</SelectItem>
                    <SelectItem value="summer">Summer</SelectItem>
                    <SelectItem value="fall">Fall</SelectItem>
                    <SelectItem value="winter">Winter</SelectItem>
                    <SelectItem value="year-round">Year-Round</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Servings</Label>
                <Input
                  type="number"
                  value={formData.servings}
                  onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
                  placeholder="4"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prep Time (minutes)</Label>
                <Input
                  type="number"
                  value={formData.prep_time_minutes}
                  onChange={(e) => setFormData({ ...formData, prep_time_minutes: e.target.value })}
                  placeholder="15"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Cook Time (minutes)</Label>
                <Input
                  type="number"
                  value={formData.cook_time_minutes}
                  onChange={(e) => setFormData({ ...formData, cook_time_minutes: e.target.value })}
                  placeholder="30"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Ingredients * (one per line)</Label>
              <Textarea
                value={formData.ingredients_list}
                onChange={(e) => setFormData({ ...formData, ingredients_list: e.target.value })}
                placeholder="2 cups fresh tomatoes, diced&#10;1 tbsp olive oil&#10;Salt and pepper to taste"
                rows={6}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Instructions * (one step per line)</Label>
              <Textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Heat oil in a large skillet over medium heat&#10;Add tomatoes and cook for 5 minutes&#10;Season with salt and pepper"
                rows={8}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              {editingRecipe ? 'Update' : 'Create'} Recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}