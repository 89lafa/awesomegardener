import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

export default function SuggestVarietyFromStash({ open, onOpenChange, seedLot, profile }) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    reason: '',
    source_url: ''
  });

  const handleSubmit = async () => {
    if (!formData.reason.trim()) {
      toast.error('Please provide a reason for this suggestion');
      return;
    }

    setSubmitting(true);
    try {
      // Check if variety already exists
      const existing = await base44.entities.Variety.filter({
        plant_type_id: profile.plant_type_id,
        variety_name: profile.variety_name
      });

      if (existing.length > 0) {
        toast.error('This variety already exists in the catalog');
        setSubmitting(false);
        return;
      }

      // Create variety suggestion
      await base44.entities.VarietySuggestion.create({
        plant_type_id: profile.plant_type_id,
        variety_name: profile.variety_name,
        days_to_maturity: profile.days_to_maturity_seed,
        spacing_recommended: profile.spacing_in_min,
        sun_requirement: profile.sun_requirement,
        water_requirement: profile.water_requirement,
        trellis_required: profile.trellis_required || false,
        container_friendly: profile.container_friendly || false,
        grower_notes: profile.notes_public,
        heat_scoville_min: profile.heat_scoville_min,
        heat_scoville_max: profile.heat_scoville_max,
        source_url: formData.source_url,
        reason: formData.reason,
        status: 'pending',
        attached_images: seedLot.lot_images || []
      });

      toast.success('Variety suggestion submitted for review!');
      onOpenChange(false);
      setFormData({ reason: '', source_url: '' });
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast.error('Failed to submit suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-emerald-600" />
            Suggest to Plant Catalog
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-sm text-emerald-900">
              <strong>{profile?.variety_name}</strong> ({profile?.common_name})
            </p>
            {seedLot?.lot_images?.length > 0 && (
              <p className="text-xs text-emerald-700 mt-1">
                📸 {seedLot.lot_images.length} photo(s) will be attached
              </p>
            )}
          </div>

          <div>
            <Label>Why suggest this variety? *</Label>
            <Textarea
              placeholder="e.g., Great flavor, disease resistant, unique characteristics..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="mt-2"
              rows={3}
            />
          </div>

          <div>
            <Label>Source URL (optional)</Label>
            <Input
              type="url"
              placeholder="https://..."
              value={formData.source_url}
              onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">Link to seed vendor or additional info</p>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p>✓ Variety attributes from your stash will be included</p>
            <p>✓ Photos will be attached if available</p>
            <p>✓ An admin will review your suggestion</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.reason.trim() || submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              'Submit Suggestion'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}