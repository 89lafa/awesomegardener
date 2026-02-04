import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminResources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingResource, setEditingResource] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      const allResources = await base44.asServiceRole.entities.Resource.list();
      setResources(allResources);
    } catch (error) {
      console.error('Error loading resources:', error);
      toast.error('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (resourceData) => {
    try {
      if (editingResource?.id) {
        await base44.asServiceRole.entities.Resource.update(editingResource.id, resourceData);
        toast.success('Resource updated!');
      } else {
        await base44.asServiceRole.entities.Resource.create({
          ...resourceData,
          slug: resourceData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        });
        toast.success('Resource created!');
      }
      setShowDialog(false);
      setEditingResource(null);
      await loadResources();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save resource');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this resource?')) return;
    try {
      await base44.asServiceRole.entities.Resource.delete(id);
      toast.success('Resource deleted');
      await loadResources();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete');
    }
  };

  const openEditDialog = (resource = null) => {
    setEditingResource(resource);
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
          <h1 className="text-3xl font-bold text-gray-900">Manage Resources</h1>
          <p className="text-gray-600 mt-1">Create and edit learning guides and articles</p>
        </div>
        <Button onClick={() => openEditDialog()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />
          New Resource
        </Button>
      </div>

      <div className="grid gap-4">
        {resources.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-gray-600 mb-4">No resources yet. Create your first article!</p>
              <Button onClick={() => openEditDialog()} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Create First Resource
              </Button>
            </CardContent>
          </Card>
        ) : (
          resources.map((resource) => (
            <Card key={resource.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">{resource.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{resource.excerpt}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">{resource.category}</span>
                      {!resource.is_published && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Draft</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(resource)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(resource.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ResourceEditDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        resource={editingResource}
        onSave={handleSave}
      />
    </div>
  );
}

function ResourceEditDialog({ open, onOpenChange, resource, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    category: 'learning_guide',
    hero_image_url: '',
    excerpt: '',
    content: '',
    tags: [],
    is_published: true,
    sort_order: 0
  });

  useEffect(() => {
    if (resource) {
      setFormData({
        title: resource.title || '',
        category: resource.category || 'learning_guide',
        hero_image_url: resource.hero_image_url || '',
        excerpt: resource.excerpt || '',
        content: resource.content || '',
        tags: resource.tags || [],
        is_published: resource.is_published !== false,
        sort_order: resource.sort_order || 0
      });
    } else {
      setFormData({
        title: '',
        category: 'learning_guide',
        hero_image_url: '',
        excerpt: '',
        content: '',
        tags: [],
        is_published: true,
        sort_order: 0
      });
    }
  }, [resource, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resource ? 'Edit Resource' : 'New Resource'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Article title"
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData({ ...formData, category: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="learning_guide">Learning Guide</SelectItem>
                <SelectItem value="pest_disease">Pest & Disease</SelectItem>
                <SelectItem value="how_to">How-To</SelectItem>
                <SelectItem value="faq">FAQ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="hero">Hero Image URL</Label>
            <Input
              id="hero"
              value={formData.hero_image_url}
              onChange={(e) => setFormData({ ...formData, hero_image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label htmlFor="excerpt">Excerpt (Card Description)</Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              placeholder="Brief summary shown on cards"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="content">Content (Markdown)</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Full article content in markdown format"
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => onSave(formData)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {resource ? 'Update' : 'Create'} Resource
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