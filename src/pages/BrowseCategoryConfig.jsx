import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function BrowseCategoryConfig() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [plantTypes, setPlantTypes] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({
    category_code: '',
    name: '',
    icon: '',
    plant_type_ids: [],
    info_banner: '',
    sort_order: 0
  });

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);
      
      const [categoriesData, typesData] = await Promise.all([
        base44.entities.BrowseCategory.filter({ is_active: true }, 'sort_order'),
        base44.entities.PlantType.list('common_name')
      ]);
      
      setCategories(categoriesData);
      setPlantTypes(typesData);
    } catch (error) {
      console.error('Error loading:', error);
      window.location.href = '/Dashboard';
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (category) => {
    try {
      await base44.entities.BrowseCategory.update(category.id, {
        name: category.name,
        icon: category.icon,
        plant_type_ids: category.plant_type_ids,
        info_banner: category.info_banner,
        sort_order: category.sort_order
      });
      toast.success('Category updated');
      setEditingCategory(null);
      await checkAdminAndLoad();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save category');
    }
  };

  const handleCreate = async () => {
    if (!newCategory.category_code || !newCategory.name) {
      toast.error('Code and name are required');
      return;
    }
    
    try {
      await base44.entities.BrowseCategory.create({
        ...newCategory,
        is_browse_only: true,
        is_active: true
      });
      toast.success('Category created');
      setShowNewDialog(false);
      setNewCategory({
        category_code: '',
        name: '',
        icon: '',
        plant_type_ids: [],
        info_banner: '',
        sort_order: 0
      });
      await checkAdminAndLoad();
    } catch (error) {
      console.error('Error creating:', error);
      toast.error('Failed to create category');
    }
  };

  const handleDelete = async (category) => {
    if (!confirm(`Delete "${category.name}"?`)) return;
    
    try {
      await base44.entities.BrowseCategory.update(category.id, { is_active: false });
      toast.success('Category deleted');
      await checkAdminAndLoad();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete category');
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
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Browse Category Manager</h1>
          <p className="text-gray-600">Configure umbrella categories for Plant Catalog</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={async () => {
              if (!confirm('Clean invalid IDs from all categories?')) return;
              try {
                const result = await base44.functions.invoke('cleanupBrowseCategoryIds');
                toast.success(`Cleaned ${result.data.total_cleaned} invalid IDs`);
                await checkAdminAndLoad();
              } catch (error) {
                toast.error('Failed to cleanup: ' + error.message);
              }
            }}
            variant="outline"
            className="gap-2"
          >
            🧹 Clean Invalid IDs
          </Button>
          <Button onClick={() => setShowNewDialog(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4" />
            New Category
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {categories.map(category => (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{category.icon}</span>
                  <span>{category.name}</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingCategory(category.id === editingCategory?.id ? null : category)}
                  >
                    {editingCategory?.id === category.id ? 'Cancel' : 'Edit'}
                  </Button>
                  <Button 
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(category)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingCategory?.id === category.id ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Icon (emoji)</Label>
                      <Input
                        value={editingCategory.icon}
                        onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Plant Types (select multiple)</Label>
                    <div className="mt-2 p-3 border rounded-lg max-h-64 overflow-y-auto space-y-2">
                      {plantTypes.map(pt => (
                        <label key={pt.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={editingCategory.plant_type_ids.includes(pt.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...editingCategory.plant_type_ids, pt.id]
                                : editingCategory.plant_type_ids.filter(id => id !== pt.id);
                              setEditingCategory({ ...editingCategory, plant_type_ids: ids });
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-xl">{pt.icon}</span>
                          <span className="text-sm">{pt.common_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label>Info Banner</Label>
                    <Textarea
                      value={editingCategory.info_banner}
                      onChange={(e) => setEditingCategory({ ...editingCategory, info_banner: e.target.value })}
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label>Sort Order</Label>
                    <Input
                      type="number"
                      value={editingCategory.sort_order}
                      onChange={(e) => setEditingCategory({ ...editingCategory, sort_order: parseInt(e.target.value) || 0 })}
                      className="mt-2"
                    />
                  </div>
                  
                  <Button onClick={() => handleSave(editingCategory)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                    {category.info_banner}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Includes {category.plant_type_ids?.filter(id => plantTypes.find(p => p.id === id)).length || 0} plant types:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(category.plant_type_ids || []).map(id => {
                        const pt = plantTypes.find(p => p.id === id);
                        return pt ? (
                          <span key={id} className="px-2 py-1 bg-gray-100 rounded text-xs">
                            {pt.icon} {pt.common_name}
                          </span>
                        ) : (
                          <span key={id} className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs">
                            ⚠️ Invalid ID: {id}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Category Dialog */}
      {showNewDialog && (
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Browse Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category Code (unique identifier) *</Label>
                <Input
                  placeholder="e.g., HERBS, NIGHTSHADES"
                  value={newCategory.category_code}
                  onChange={(e) => setNewCategory({ ...newCategory, category_code: e.target.value.toUpperCase() })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Display Name *</Label>
                <Input
                  placeholder="e.g., Herbs, Nightshade Vegetables"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Icon (emoji)</Label>
                <Input
                  placeholder="🌿"
                  value={newCategory.icon}
                  onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Info Banner</Label>
                <Textarea
                  placeholder="Description shown on category page"
                  value={newCategory.info_banner}
                  onChange={(e) => setNewCategory({ ...newCategory, info_banner: e.target.value })}
                  className="mt-2"
                  rows={3}
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={newCategory.sort_order}
                  onChange={(e) => setNewCategory({ ...newCategory, sort_order: parseInt(e.target.value) || 0 })}
                  className="mt-2"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowNewDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!newCategory.category_code || !newCategory.name}
              >
                Create Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}