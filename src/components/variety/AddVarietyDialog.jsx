import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AddVarietyDialog({ plantType, open, onOpenChange, onSuccess, userRole }) {
  const [formData, setFormData] = useState({
    variety_name: '',
    plant_subcategory_ids: [],
    description: '',
    synonyms: '',
    days_to_maturity: '',
    spacing_recommended: '',
    plant_height_typical: '',
    sun_requirement: 'full_sun',
    water_requirement: 'moderate',
    trellis_required: false,
    grower_notes: '',
    source_url: '',
    submitter_notes: '',
    heat_scoville_min: '',
    heat_scoville_max: '',
    images: []
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subCategories, setSubCategories] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const isAdminOrEditor = userRole === 'admin' || userRole === 'editor';

  useEffect(() => {
    if (open && plantType) {
      loadSubCategories();
    }
  }, [open, plantType]);

  const loadSubCategories = async () => {
    try {
      const subcats = await base44.entities.PlantSubCategory.filter({ 
        plant_type_id: plantType.id,
        is_active: true 
      }, 'sort_order');
      setSubCategories(subcats);
    } catch (error) {
      console.error('Error loading subcategories:', error);
    }
  };

  const normalizeVarietyName = (name) => {
    if (!name) return '';
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\.$/, '');
  };

  const checkForDuplicates = async (name) => {
    if (!name || name.length < 3) {
      setDuplicateWarning(null);
      return;
    }

    setChecking(true);
    try {
      const allVarieties = await base44.entities.Variety.filter({ 
        plant_type_id: plantType.id,
        status: 'active'
      });
      
      const normalized = normalizeVarietyName(name);
      
      // Check for exact normalized match
      const exactMatch = allVarieties.find(v => 
        normalizeVarietyName(v.variety_name) === normalized
      );
      
      if (exactMatch) {
        setDuplicateWarning({ type: 'exact', name: exactMatch.variety_name, id: exactMatch.id });
      } else {
        setDuplicateWarning(null);
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleNameChange = (value) => {
    setFormData({ ...formData, variety_name: value });
    checkForDuplicates(value);
  };

  const handleSubmit = async () => {
    if (!formData.variety_name.trim()) {
      toast.error('Variety name is required');
      return;
    }

    if (duplicateWarning?.type === 'exact') {
      toast.error('This variety already exists');
      return;
    }

    setSubmitting(true);
    try {
      if (isAdminOrEditor) {
        // Direct creation
        const primarySubcatId = formData.plant_subcategory_ids.length > 0 ? formData.plant_subcategory_ids[0] : null;
        
        const newVariety = await base44.entities.Variety.create({
          plant_type_id: plantType.id,
          plant_type_name: plantType.common_name,
          variety_name: formData.variety_name,
          description: formData.description || null,
          synonyms: formData.synonyms ? formData.synonyms.split(',').map(s => s.trim()) : [],
          plant_subcategory_id: primarySubcatId,
          plant_subcategory_ids: formData.plant_subcategory_ids,
          days_to_maturity: formData.days_to_maturity ? parseInt(formData.days_to_maturity) : null,
          spacing_recommended: formData.spacing_recommended ? parseInt(formData.spacing_recommended) : null,
          plant_height_typical: formData.plant_height_typical || null,
          sun_requirement: formData.sun_requirement,
          water_requirement: formData.water_requirement,
          trellis_required: formData.trellis_required,
          grower_notes: formData.grower_notes || null,
          source_attribution: formData.source_url || 'User Submitted',
          heat_scoville_min: formData.heat_scoville_min ? parseInt(formData.heat_scoville_min) : null,
          heat_scoville_max: formData.heat_scoville_max ? parseInt(formData.heat_scoville_max) : null,
          images: formData.images,
          status: 'active',
          is_custom: true
        });
        
        toast.success('Variety added!');
      } else {
        // Create suggestion for review
        await base44.entities.VarietySuggestion.create({
          plant_type_id: plantType.id,
          plant_type_name: plantType.common_name,
          variety_name: formData.variety_name,
          synonyms: formData.synonyms ? formData.synonyms.split(',').map(s => s.trim()) : [],
          days_to_maturity: formData.days_to_maturity ? parseInt(formData.days_to_maturity) : null,
          spacing_recommended: formData.spacing_recommended ? parseInt(formData.spacing_recommended) : null,
          plant_height_typical: formData.plant_height_typical || null,
          sun_requirement: formData.sun_requirement,
          water_requirement: formData.water_requirement,
          trellis_required: formData.trellis_required,
          grower_notes: formData.grower_notes || null,
          source_url: formData.source_url || null,
          submitter_notes: formData.submitter_notes || null,
          duplicate_warning: duplicateWarning?.type === 'close',
          status: 'pending'
        });
        toast.success('Variety suggestion submitted for review!');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting variety:', error);
      toast.error('Failed to submit variety');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isAdminOrEditor ? 'Add Variety' : 'Suggest Variety'} - {plantType.common_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="varietyName">Variety Name *</Label>
            <Input
              id="varietyName"
              placeholder="e.g., Cherokee Purple"
              value={formData.variety_name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="mt-2"
            />
            {checking && <p className="text-xs text-gray-500 mt-1">Checking for duplicates...</p>}
            {duplicateWarning && (
              <Alert className="mt-2" variant={duplicateWarning.type === 'exact' ? 'destructive' : 'default'}>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {duplicateWarning.type === 'exact' 
                    ? `This variety already exists: "${duplicateWarning.name}"`
                    : `Similar variety found: "${duplicateWarning.name}". You can still submit if different.`
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of this variety..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-2"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="synonyms">Synonyms (comma-separated)</Label>
            <Input
              id="synonyms"
              placeholder="e.g., Purple Cherokee, Cherokee"
              value={formData.synonyms}
              onChange={(e) => setFormData({ ...formData, synonyms: e.target.value })}
              className="mt-2"
            />
          </div>

          {subCategories.length > 0 && (
            <div>
              <Label>Sub-Categories (multi-select)</Label>
              <div className="mt-2 p-3 border rounded-lg max-h-48 overflow-y-auto space-y-3">
                {(() => {
                  const grouped = {};
                  subCategories.forEach(s => {
                    const dim = s.dimension || 'Other';
                    if (!grouped[dim]) grouped[dim] = [];
                    grouped[dim].push(s);
                  });
                  
                  return Object.entries(grouped).map(([dimension, subcats]) => (
                    <div key={dimension} className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase">{dimension}</p>
                      <div className="flex flex-wrap gap-2">
                        {subcats.map(subcat => {
                          const isSelected = (formData.plant_subcategory_ids || []).includes(subcat.id);
                          return (
                            <Button
                              key={subcat.id}
                              type="button"
                              size="sm"
                              variant={isSelected ? 'default' : 'outline'}
                              onClick={() => {
                                const currentIds = formData.plant_subcategory_ids || [];
                                const newIds = isSelected 
                                  ? currentIds.filter(id => id !== subcat.id)
                                  : [...currentIds, subcat.id];
                                setFormData({ ...formData, plant_subcategory_ids: newIds });
                              }}
                              className={isSelected ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                            >
                              {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                              {subcat.name}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          <div>
            <Label>Images</Label>
            <div className="mt-2 space-y-2">
              {formData.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.images.map((url, idx) => (
                    <div key={idx} className="relative w-20 h-20">
                      <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover rounded border" />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                        onClick={() => {
                          const newImages = formData.images.filter((_, i) => i !== idx);
                          setFormData({ ...formData, images: newImages });
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingImage}
                onClick={() => document.getElementById('variety-image-upload').click()}
              >
                {uploadingImage ? 'Uploading...' : '+ Add Image'}
              </Button>
              <input
                id="variety-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingImage(true);
                  try {
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    setFormData({ ...formData, images: [...formData.images, file_url] });
                    toast.success('Image uploaded');
                  } catch (error) {
                    console.error('Error uploading image:', error);
                    toast.error('Failed to upload image');
                  } finally {
                    setUploadingImage(false);
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dtm">Days to Maturity</Label>
              <Input
                id="dtm"
                type="number"
                placeholder="e.g., 75"
                value={formData.days_to_maturity}
                onChange={(e) => setFormData({ ...formData, days_to_maturity: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="spacing">Spacing (inches)</Label>
              <Input
                id="spacing"
                type="number"
                placeholder="e.g., 24"
                value={formData.spacing_recommended}
                onChange={(e) => setFormData({ ...formData, spacing_recommended: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="height">Typical Height</Label>
            <Input
              id="height"
              placeholder="e.g., 4-6 feet"
              value={formData.plant_height_typical}
              onChange={(e) => setFormData({ ...formData, plant_height_typical: e.target.value })}
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sun Requirement</Label>
              <Select 
                value={formData.sun_requirement} 
                onValueChange={(v) => setFormData({ ...formData, sun_requirement: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_sun">Full Sun</SelectItem>
                  <SelectItem value="partial_sun">Partial Sun</SelectItem>
                  <SelectItem value="partial_shade">Partial Shade</SelectItem>
                  <SelectItem value="full_shade">Full Shade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Water Requirement</Label>
              <Select 
                value={formData.water_requirement} 
                onValueChange={(v) => setFormData({ ...formData, water_requirement: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="trellis"
              checked={formData.trellis_required}
              onCheckedChange={(checked) => setFormData({ ...formData, trellis_required: checked })}
            />
            <Label htmlFor="trellis" className="font-normal">Requires Trellis</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="scoville_min">Scoville Min (peppers)</Label>
              <Input
                id="scoville_min"
                type="number"
                placeholder="e.g., 1000"
                value={formData.heat_scoville_min}
                onChange={(e) => setFormData({ ...formData, heat_scoville_min: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="scoville_max">Scoville Max</Label>
              <Input
                id="scoville_max"
                type="number"
                placeholder="e.g., 5000"
                value={formData.heat_scoville_max}
                onChange={(e) => setFormData({ ...formData, heat_scoville_max: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Growing Notes</Label>
            <Textarea
              id="notes"
              placeholder="Tips, observations, characteristics..."
              value={formData.grower_notes}
              onChange={(e) => setFormData({ ...formData, grower_notes: e.target.value })}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="source">Source URL (optional)</Label>
            <Input
              id="source"
              placeholder="https://..."
              value={formData.source_url}
              onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
              className="mt-2"
            />
          </div>

          {!isAdminOrEditor && (
            <div>
              <Label htmlFor="submitterNotes">Why should this variety be added?</Label>
              <Textarea
                id="submitterNotes"
                placeholder="Help reviewers understand why this variety is valuable..."
                value={formData.submitter_notes}
                onChange={(e) => setFormData({ ...formData, submitter_notes: e.target.value })}
                className="mt-2"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit}
            disabled={submitting || !formData.variety_name.trim() || duplicateWarning?.type === 'exact'}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? 'Submitting...' : (isAdminOrEditor ? 'Add Variety' : 'Submit for Review')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}