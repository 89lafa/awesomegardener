import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────
// Helper: encode/decode confused_with inside the lifecycle field
// We use a distinctive marker that will never appear naturally in lifecycle text.
// ─────────────────────────────────────────────
const CONFUSED_MARKER = '\n\n__CONFUSED_WITH__\n';

function encodeLifecycle(lifecycle, confusedWith) {
  const cleanLifecycle = (lifecycle || '').split(CONFUSED_MARKER)[0].trimEnd();
  if (!confusedWith || confusedWith.length === 0) return cleanLifecycle;
  return cleanLifecycle + CONFUSED_MARKER + confusedWith.join('\n');
}

function decodeLifecycle(rawLifecycle) {
  const raw = rawLifecycle || '';
  const parts = raw.split(CONFUSED_MARKER);
  return {
    lifecycle: parts[0] || '',
    confused_with: parts[1] ? parts[1].split('\n').map(s => s.trim()).filter(Boolean) : []
  };
}

// ─────────────────────────────────────────────
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
      const allPests = await base44.entities.PestLibrary.list();
      setPests(allPests);
    } catch (error) {
      console.error('Error loading pests:', error);
      toast.error('Failed to load pests: ' + (error?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (pestData) => {
    try {
      const dataToSave = { ...pestData, is_active: true };
      if (editingPest?.id) {
        await base44.entities.PestLibrary.update(editingPest.id, dataToSave);
        toast.success('Entry updated!');
      } else {
        await base44.entities.PestLibrary.create(dataToSave);
        toast.success('Entry created! It will now appear in the Pest & Disease Library.');
      }
      setShowDialog(false);
      setEditingPest(null);
      await loadPests();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save: ' + (error?.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this pest/disease entry?')) return;
    try {
      await base44.entities.PestLibrary.delete(id);
      toast.success('Deleted');
      await loadPests();
    } catch (error) {
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
          <p className="text-gray-600 mt-1">Add and edit pest/disease entries — {pests.length} entries total</p>
        </div>
        <Button onClick={() => openEditDialog()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />
          New Entry
        </Button>
      </div>

      <div className="grid gap-4">
        {pests.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-gray-600 mb-4">No entries yet.</p>
              <Button onClick={() => openEditDialog()} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" /> Create First Entry
              </Button>
            </CardContent>
          </Card>
        ) : (
          pests.map((pest) => {
            const { confused_with } = decodeLifecycle(pest.lifecycle);
            return (
              <Card key={pest.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {pest.primary_photo_url && (
                        <img
                          src={pest.primary_photo_url}
                          alt={pest.common_name}
                          className="w-16 h-16 object-cover rounded-lg border shrink-0"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg text-gray-900">{pest.common_name}</h3>
                          {pest.is_active && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle className="w-3 h-3" /> Live
                            </span>
                          )}
                          {confused_with.length > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                              ⚠️ confused with: {confused_with.length}
                            </span>
                          )}
                        </div>
                        <p className="text-sm italic text-gray-600">{pest.scientific_name}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">{pest.category}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">{pest.severity_potential ? pest.severity_potential.charAt(0).toUpperCase() + pest.severity_potential.slice(1) : ''} Severity</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(pest)}>
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
            );
          })
        )}
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

// ─────────────────────────────────────────────
// Edit / Create Dialog
// ─────────────────────────────────────────────
function PestEditDialog({ open, onOpenChange, pest, onSave }) {
  const emptyForm = {
    common_name: '',
    scientific_name: '',
    category: 'insect',
    appearance: '',
    symptoms: [],
    // lifecycle is stored as the raw encoded string (lifecycle + confused_with)
    lifecycle: '',
    // confused_with_text is UI-only — NOT sent to the DB directly
    confused_with_text: '',
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
  };

  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (open) {
      if (pest) {
        // Decode lifecycle back into lifecycle text + confused_with items
        const { lifecycle, confused_with } = decodeLifecycle(pest.lifecycle);
        setFormData({
          ...emptyForm,
          ...pest,
          lifecycle,                                    // clean lifecycle text only
          confused_with_text: confused_with.join('\n') // UI-only field
        });
      } else {
        setFormData(emptyForm);
      }
    }
  }, [pest, open]);

  const handleArrayField = (field, value) => {
    const array = value.split('\n').filter(v => v.trim());
    setFormData(prev => ({ ...prev, [field]: array }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, primary_photo_url: file_url }));
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.common_name.trim()) {
      toast.error('Common name is required');
      return;
    }
    setSaving(true);
    try {
      // Parse confused_with_text back into an array
      const confusedWithArray = (formData.confused_with_text || '')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      // Encode confused_with INTO the lifecycle field before saving
      const encodedLifecycle = encodeLifecycle(formData.lifecycle, confusedWithArray);

      // Build final save payload — exclude the UI-only field
      const { confused_with_text, ...rest } = formData;
      const dataToSave = {
        ...rest,
        lifecycle: encodedLifecycle   // ← this is the only field that goes to DB
      };

      await onSave(dataToSave);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pest ? 'Edit Entry' : 'New Pest/Disease Entry'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Common Name *</Label>
              <Input
                value={formData.common_name}
                onChange={(e) => setFormData(prev => ({ ...prev, common_name: e.target.value }))}
                placeholder="e.g. Aphids"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Scientific Name</Label>
              <Input
                value={formData.scientific_name}
                onChange={(e) => setFormData(prev => ({ ...prev, scientific_name: e.target.value }))}
                placeholder="e.g. Aphidoidea"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
              <Select value={formData.severity_potential} onValueChange={(v) => setFormData(prev => ({ ...prev, severity_potential: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Spread Rate</Label>
              <Select value={formData.spread_rate} onValueChange={(v) => setFormData(prev => ({ ...prev, spread_rate: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Not Contagious)</SelectItem>
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
              onChange={(e) => setFormData(prev => ({ ...prev, appearance: e.target.value }))}
              rows={3} className="mt-1"
              placeholder="Describe what this pest/disease looks like..."
            />
          </div>

          <div>
            <Label>Symptoms (one per line)</Label>
            <Textarea
              value={formData.symptoms?.join('\n') || ''}
              onChange={(e) => handleArrayField('symptoms', e.target.value)}
              rows={4} className="mt-1"
              placeholder="Yellowing leaves&#10;Wilting stems&#10;Black spots on fruit"
            />
          </div>

          <div>
            <Label>Lifecycle / Notes</Label>
            <Textarea
              value={formData.lifecycle || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, lifecycle: e.target.value }))}
              rows={2} className="mt-1"
              placeholder="Optional lifecycle or additional notes..."
            />
          </div>

          {/* ✅ Confused With — UI-only field, encoded into lifecycle on save */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div>
              <Label className="text-amber-900 font-semibold text-sm flex items-center gap-1">
                ⚠️ Confused With (one per line)
              </Label>
              <p className="text-xs text-amber-700 mt-1">
                List other problems this is commonly mistaken for. Each line becomes a separate numbered item in the
                "Don't Confuse With" section on the detail page. Be descriptive — explain <em>why</em> it might be confused.
              </p>
            </div>
            <Textarea
              value={formData.confused_with_text || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, confused_with_text: e.target.value }))}
              rows={4}
              className="bg-white"
              placeholder="Early Blight — similar dark spots but with concentric rings and yellow halo&#10;Septoria Leaf Spot — smaller spots, starts lower on the plant&#10;Magnesium deficiency — interveinal yellowing without spots or lesions"
            />
          </div>

          <div>
            <Label>Organic Treatments (one per line)</Label>
            <Textarea
              value={formData.organic_treatments?.join('\n') || ''}
              onChange={(e) => handleArrayField('organic_treatments', e.target.value)}
              rows={4} className="mt-1"
              placeholder="Neem oil spray&#10;Insecticidal soap&#10;Hand-pick and destroy"
            />
          </div>

          <div>
            <Label>Chemical Treatments (one per line)</Label>
            <Textarea
              value={formData.chemical_treatments?.join('\n') || ''}
              onChange={(e) => handleArrayField('chemical_treatments', e.target.value)}
              rows={3} className="mt-1"
              placeholder="Pyrethrin-based spray&#10;Spinosad"
            />
          </div>

          <div>
            <Label>Prevention Tips (one per line)</Label>
            <Textarea
              value={formData.prevention_tips?.join('\n') || ''}
              onChange={(e) => handleArrayField('prevention_tips', e.target.value)}
              rows={4} className="mt-1"
              placeholder="Rotate crops annually&#10;Inspect plants weekly&#10;Maintain good air circulation"
            />
          </div>

          {/* Image */}
          <div>
            <Label>Primary Photo (Hero Image)</Label>
            <div className="mt-1 space-y-3">
              {formData.primary_photo_url && !imageUploading && (
                <div className="flex items-start gap-3">
                  <img
                    src={formData.primary_photo_url}
                    alt="Preview"
                    className="w-40 h-32 object-cover rounded-lg border"
                  />
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Image ready
                    </p>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => setFormData(prev => ({ ...prev, primary_photo_url: '' }))}
                      className="text-red-600 hover:text-red-700 w-fit"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Input
                  type="file" accept="image/*"
                  onChange={handleImageUpload}
                  disabled={imageUploading}
                  className="flex-1"
                />
                {imageUploading && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Uploading...</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                This image will appear as the card thumbnail and hero banner on the detail page.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-2 border-t">
            <Button
              onClick={handleSave}
              disabled={saving || imageUploading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                : pest ? 'Update Entry' : 'Create Entry'
              }
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || imageUploading}
            >
              Cancel
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
