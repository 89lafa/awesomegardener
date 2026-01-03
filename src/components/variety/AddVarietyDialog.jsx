import React, { useState } from 'react';
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
    synonyms: '',
    days_to_maturity: '',
    spacing_recommended: '',
    plant_height_typical: '',
    sun_requirement: 'full_sun',
    water_requirement: 'moderate',
    trellis_required: false,
    grower_notes: '',
    source_url: '',
    submitter_notes: ''
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isAdminOrEditor = userRole === 'admin' || userRole === 'editor';

  const checkForDuplicates = async (name) => {
    if (!name || name.length < 3) {
      setDuplicateWarning(null);
      return;
    }

    setChecking(true);
    try {
      const existing = await base44.entities.Variety.filter({ 
        plant_type_id: plantType.id,
        variety_name: name 
      });

      if (existing.length > 0) {
        setDuplicateWarning({ type: 'exact', name: existing[0].variety_name });
      } else {
        // Check for close matches (simple normalization)
        const allVarieties = await base44.entities.Variety.filter({ 
          plant_type_id: plantType.id 
        });
        const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const closeMatch = allVarieties.find(v => 
          v.variety_name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized
        );
        
        if (closeMatch) {
          setDuplicateWarning({ type: 'close', name: closeMatch.variety_name });
        } else {
          setDuplicateWarning(null);
        }
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
        await base44.entities.Variety.create({
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
          source_attribution: formData.source_url || 'User Submitted',
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
            <Label htmlFor="synonyms">Synonyms (comma-separated)</Label>
            <Input
              id="synonyms"
              placeholder="e.g., Purple Cherokee, Cherokee"
              value={formData.synonyms}
              onChange={(e) => setFormData({ ...formData, synonyms: e.target.value })}
              className="mt-2"
            />
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