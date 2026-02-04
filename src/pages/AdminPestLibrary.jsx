import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPestLibrary() {
  const [pests, setPests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPest, setEditingPest] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    loadPests();
  }, []);

  const loadPests = async () => {
    try {
      const allPests = await base44.asServiceRole.entities.PestLibrary.list();
      setPests(allPests);
    } catch (error) {
      console.error('Error loading pests:', error);
      toast.error('Failed to load pests');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (pestData) => {
    try {
      if (editingPest?.id) {
        await base44.asServiceRole.entities.PestLibrary.update(editingPest.id, pestData);
        toast.success('Pest entry updated!');
      } else {
        await base44.asServiceRole.entities.PestLibrary.create(pestData);
        toast.success('Pest entry created!');
      }
      setShowDialog(false);
      setEditingPest(null);
      await loadPests();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this pest/disease entry?')) return;
    try {
      await base44.asServiceRole.entities.PestLibrary.delete(id);
      toast.success('Deleted');
      await loadPests();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete');
    }
  };

  const openEditDialog = (pest = null) => {
    setEditingPest(pest);
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
          <h1 className="text-3xl font-bold text-gray-900">Manage Pest & Disease Library</h1>
          <p className="text-gray-600 mt-1">Add and edit pest/disease entries</p>
        </div>
        <Button onClick={() => openEditDialog()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />
          New Entry
        </Button>
      </div>

      <div className="grid gap-4">
        {pests.map((pest) => (
          <Card key={pest.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">{pest.common_name}</h3>
                  <p className="text-sm italic text-gray-600">{pest.scientific_name}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">{pest.category}</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">{pest.severity_potential}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(pest)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(pest.id)}
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

      <PestEditDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        pest={editingPest}
        onSave={handleSave}
      />
    </div>
  );
}

function PestEditDialog({ open, onOpenChange, pest, onSave }) {
  const [formData, setFormData] = useState({
    common_name: '',
    scientific_name: '',
    category: 'insect',
    appearance: '',
    symptoms: [],
    lifecycle: '',
    affects_plant_types: ['all'],
    seasonal_occurrence: 'year-round',
    severity_potential: 'medium',
    spread_rate: 'moderate',
    organic_treatments: [],
    chemical_treatments: [],
    prevention_tips: [],
    photos: [],
    primary_photo_url: '',
    is_active: true
  });

  useEffect(() => {
    if (pest) {
      setFormData(pest);
    } else {
      setFormData({
        common_name: '',
        scientific_name: '',
        category: 'insect',
        appearance: '',
        symptoms: [],
        lifecycle: '',
        affects_plant_types: ['all'],
        seasonal_occurrence: 'year-round',
        severity_potential: 'medium',
        spread_rate: 'moderate',
        organic_treatments: [],
        chemical_treatments: [],
        prevention_tips: [],
        photos: [],
        primary_photo_url: '',
        is_active: true
      });
    }
  }, [pest, open]);

  const handleArrayField = (field, value) => {
    const array = value.split('\n').filter(v => v.trim());
    setFormData({ ...formData, [field]: array });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pest ? 'Edit Entry' : 'New Pest/Disease Entry'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Common Name</Label>
              <Input
                value={formData.common_name}
                onChange={(e) => setFormData({ ...formData, common_name: e.target.value })}
                placeholder="Aphids"
              />
            </div>
            <div>
              <Label>Scientific Name</Label>
              <Input
                value={formData.scientific_name}
                onChange={(e) => setFormData({ ...formData, scientific_name: e.target.value })}
                placeholder="Aphidoidea"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insect">Insect</SelectItem>
                  <SelectItem value="disease">Disease</SelectItem>
                  <SelectItem value="fungus">Fungus</SelectItem>
                  <SelectItem value="bacteria">Bacteria</SelectItem>
                  <SelectItem value="virus">Virus</SelectItem>
                  <SelectItem value="deficiency">Deficiency</SelectItem>
                  <SelectItem value="environmental">Environmental</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select
                value={formData.severity_potential}
                onValueChange={(v) => setFormData({ ...formData, severity_potential: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Spread Rate</Label>
              <Select
                value={formData.spread_rate}
                onValueChange={(v) => setFormData({ ...formData, spread_rate: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow">Slow</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Appearance Description</Label>
            <Textarea
              value={formData.appearance}
              onChange={(e) => setFormData({ ...formData, appearance: e.target.value })}
              rows={3}
            />
          </div>

          <div>
            <Label>Symptoms (one per line)</Label>
            <Textarea
              value={formData.symptoms?.join('\n') || ''}
              onChange={(e) => handleArrayField('symptoms', e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label>Organic Treatments (one per line)</Label>
            <Textarea
              value={formData.organic_treatments?.join('\n') || ''}
              onChange={(e) => handleArrayField('organic_treatments', e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label>Chemical Treatments (one per line)</Label>
            <Textarea
              value={formData.chemical_treatments?.join('\n') || ''}
              onChange={(e) => handleArrayField('chemical_treatments', e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label>Prevention Tips (one per line)</Label>
            <Textarea
              value={formData.prevention_tips?.join('\n') || ''}
              onChange={(e) => handleArrayField('prevention_tips', e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label>Primary Photo URL</Label>
            <Input
              value={formData.primary_photo_url}
              onChange={(e) => setFormData({ ...formData, primary_photo_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => onSave(formData)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {pest ? 'Update' : 'Create'} Entry
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}