import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Edit, Trash2, ChefHat } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminRecipes() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const all = await base44.asServiceRole.entities.Recipe.list('-created_date');
      setRecipes(all);
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingRecipe?.id) {
        await base44.asServiceRole.entities.Recipe.update(editingRecipe.id, data);
        toast.success('Recipe updated!');
      } else {
        await base44.asServiceRole.entities.Recipe.create(data);
        toast.success('Recipe created!');
      }
      setShowDialog(false);
      setEditingRecipe(null);
      await loadRecipes();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this recipe?')) return;
    try {
      await base44.asServiceRole.entities.Recipe.delete(id);
      toast.success('Deleted');
      await loadRecipes();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete');
    }
  };

  const openEditDialog = (recipe = null) => {
    setEditingRecipe(recipe);
    setShowDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Recipes</h1>
          <p className="text-gray-600 mt-1">Create and edit garden recipes</p>
        </div>
        <Button onClick={() => openEditDialog()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />
          New Recipe
        </Button>
      </div>

      <div className="grid gap-4">
        {recipes.map((recipe) => (
          <Card key={recipe.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <ChefHat className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-semibold text-lg text-gray-900">{recipe.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{recipe.description}</p>
                  <div className="flex gap-2 flex-wrap">
                    {recipe.difficulty && (
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">{recipe.difficulty}</span>
                    )}
                    {recipe.season && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded capitalize">{recipe.season}</span>
                    )}
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                      {recipe.servings} servings
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(recipe)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(recipe.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RecipeEditDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        recipe={editingRecipe}
        onSave={handleSave}
      />
    </div>
  );
}

function RecipeEditDialog({ open, onOpenChange, recipe, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cuisine: '',
    difficulty: 'medium',
    prep_time_minutes: 15,
    cook_time_minutes: 30,
    servings: 4,
    ingredients: [],
    instructions: [],
    photo_url: '',
    season: 'year-round',
    tags: []
  });

  useEffect(() => {
    if (recipe) {
      setFormData(recipe);
    } else {
      setFormData({
        title: '',
        description: '',
        cuisine: '',
        difficulty: 'medium',
        prep_time_minutes: 15,
        cook_time_minutes: 30,
        servings: 4,
        ingredients: [],
        instructions: [],
        photo_url: '',
        season: 'year-round',
        tags: []
      });
    }
  }, [recipe, open]);

  const handleArrayField = (field, value) => {
    const array = value.split('\n').map(v => v.trim()).filter(v => v);
    setFormData({ ...formData, [field]: array });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe ? 'Edit Recipe' : 'New Recipe'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Roasted Tomato Pasta"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Difficulty</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(v) => setFormData({ ...formData, difficulty: v })}
              >
                <SelectTrigger>
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
              <Select
                value={formData.season}
                onValueChange={(v) => setFormData({ ...formData, season: v })}
              >
                <SelectTrigger>
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
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Prep Time (min)</Label>
              <Input
                type="number"
                value={formData.prep_time_minutes}
                onChange={(e) => setFormData({ ...formData, prep_time_minutes: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Cook Time (min)</Label>
              <Input
                type="number"
                value={formData.cook_time_minutes}
                onChange={(e) => setFormData({ ...formData, cook_time_minutes: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Servings</Label>
              <Input
                type="number"
                value={formData.servings}
                onChange={(e) => setFormData({ ...formData, servings: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div>
            <Label>Photo URL</Label>
            <Input
              value={formData.photo_url}
              onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label>Instructions (one per line)</Label>
            <Textarea
              value={formData.instructions?.join('\n') || ''}
              onChange={(e) => handleArrayField('instructions', e.target.value)}
              rows={6}
              placeholder="Preheat oven to 400°F&#10;Chop tomatoes...&#10;Roast for 25 minutes..."
            />
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => onSave(formData)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {recipe ? 'Update' : 'Create'} Recipe
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}