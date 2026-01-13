import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  vendor: { label: 'Seed Vendor', icon: '🏪', color: 'bg-blue-100 text-blue-800' },
  breeder: { label: 'Breeder', icon: '🧬', color: 'bg-purple-100 text-purple-800' },
  supplier: { label: 'Supplier', icon: '📦', color: 'bg-green-100 text-green-800' },
  trader: { label: 'Trader', icon: '🔄', color: 'bg-orange-100 text-orange-800' },
  other: { label: 'Other', icon: '📋', color: 'bg-gray-100 text-gray-800' }
};

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'vendor',
    url: '',
    description: '',
    notes: '',
    tags: '',
    rating: null,
    contact_email: '',
    contact_phone: '',
    specialties: ''
  });

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      const user = await base44.auth.me();
      const data = await base44.entities.Resource.filter({
        created_by: user.email,
        is_active: true
      }, 'name');
      setResources(data);
    } catch (error) {
      console.error('Error loading resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }

    try {
      const payload = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        specialties: formData.specialties ? formData.specialties.split(',').map(t => t.trim()).filter(Boolean) : [],
        rating: formData.rating ? parseFloat(formData.rating) : null
      };

      if (editingResource) {
        await base44.entities.Resource.update(editingResource.id, payload);
        toast.success('Resource updated!');
      } else {
        await base44.entities.Resource.create(payload);
        toast.success('Resource added!');
      }

      await loadResources();
      setShowDialog(false);
      setEditingResource(null);
      resetForm();
    } catch (error) {
      console.error('Error saving resource:', error);
      toast.error('Failed to save');
    }
  };

  const handleEdit = (resource) => {
    setEditingResource(resource);
    setFormData({
      name: resource.name || '',
      type: resource.type || 'vendor',
      url: resource.url || '',
      description: resource.description || '',
      notes: resource.notes || '',
      tags: resource.tags?.join(', ') || '',
      rating: resource.rating || null,
      contact_email: resource.contact_email || '',
      contact_phone: resource.contact_phone || '',
      specialties: resource.specialties?.join(', ') || ''
    });
    setShowDialog(true);
  };

  const handleDelete = async (resource) => {
    if (!confirm(`Delete ${resource.name}?`)) return;
    
    try {
      await base44.entities.Resource.update(resource.id, { is_active: false });
      await loadResources();
      toast.success('Resource deleted');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'vendor',
      url: '',
      description: '',
      notes: '',
      tags: '',
      rating: null,
      contact_email: '',
      contact_phone: '',
      specialties: ''
    });
  };

  const filteredResources = resources.filter(r => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (searchQuery) {
      const searchStr = `${r.name} ${r.description || ''} ${r.tags?.join(' ') || ''}`.toLowerCase();
      if (!searchStr.includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="text-gray-600 text-sm">Vendors, breeders, suppliers & traders</p>
        </div>
        <Button
          onClick={() => {
            setEditingResource(null);
            resetForm();
            setShowDialog(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Resource
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResources.map(resource => {
          const config = TYPE_CONFIG[resource.type] || TYPE_CONFIG.other;
          
          return (
            <Card key={resource.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{config.icon}</span>
                      <Badge className={config.color}>{config.label}</Badge>
                    </div>
                    <CardTitle className="text-lg">{resource.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(resource)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(resource)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {resource.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{resource.description}</p>
                )}
                {resource.specialties && resource.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {resource.specialties.map((spec, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{spec}</Badge>
                    ))}
                  </div>
                )}
                {resource.url && (
                  <a 
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    Visit Website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {resource.rating && (
                  <div className="text-sm mt-2">
                    {'⭐'.repeat(Math.round(resource.rating))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredResources.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No resources yet</p>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingResource ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Johnny's Seeds"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Website URL</Label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
                className="mt-2"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What they specialize in..."
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Email</Label>
                <Input
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Specialties (comma-separated)</Label>
              <Input
                value={formData.specialties}
                onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                placeholder="e.g., Peppers, Heirlooms, Tomatoes"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g., organic, fast-shipping, rare-seeds"
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Your Rating</Label>
                <Select 
                  value={formData.rating?.toString() || ''} 
                  onValueChange={(v) => setFormData({ ...formData, rating: v ? parseFloat(v) : null })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Not rated" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">⭐⭐⭐⭐⭐ (5)</SelectItem>
                    <SelectItem value="4">⭐⭐⭐⭐ (4)</SelectItem>
                    <SelectItem value="3">⭐⭐⭐ (3)</SelectItem>
                    <SelectItem value="2">⭐⭐ (2)</SelectItem>
                    <SelectItem value="1">⭐ (1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Personal notes..."
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              Save Resource
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}