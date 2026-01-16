import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function SuggestVarietyButton({ profile, seedLot, isFromCatalog }) {
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [catalogCheck, setCatalogCheck] = useState(null);
  const [checkingCatalog, setCheckingCatalog] = useState(true);

  useEffect(() => {
    checkIfInCatalog();
  }, [profile]);

  const checkIfInCatalog = async () => {
    if (isFromCatalog) {
      setCatalogCheck(true);
      setCheckingCatalog(false);
      return;
    }

    try {
      const existing = await base44.entities.Variety.filter({
        plant_type_id: profile.plant_type_id,
        variety_name: profile.variety_name
      });
      setCatalogCheck(existing.length > 0);
    } catch (error) {
      console.error('Error checking catalog:', error);
      setCatalogCheck(false);
    } finally {
      setCheckingCatalog(false);
    }
  };

  // Don't render if this was added from catalog or already in catalog
  if (checkingCatalog || catalogCheck) {
    return null;
  }

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for suggesting this variety');
      return;
    }

    setSubmitting(true);
    try {
      const user = await base44.auth.me();
      
      // Check if variety already exists in catalog
      const existing = await base44.entities.Variety.filter({
        plant_type_id: profile.plant_type_id,
        variety_name: profile.variety_name
      });

      if (existing.length > 0) {
        toast.error('This variety already exists in the catalog');
        setSubmitting(false);
        return;
      }

      // Create suggestion
      await base44.entities.VarietySuggestion.create({
        plant_type_id: profile.plant_type_id,
        plant_type_name: profile.common_name,
        variety_name: profile.variety_name,
        days_to_maturity: profile.days_to_maturity_seed,
        spacing_recommended: profile.spacing_in_min,
        plant_height_typical: profile.height_in_min && profile.height_in_max 
          ? `${profile.height_in_min}-${profile.height_in_max}"` 
          : null,
        sun_requirement: profile.sun_requirement,
        water_requirement: profile.water_requirement,
        trellis_required: profile.trellis_required,
        container_friendly: profile.container_friendly,
        grower_notes: profile.notes_public || reason,
        submitted_by: user.email,
        seed_lot_id: seedLot.id,
        images: seedLot.lot_images || [],
        status: 'pending'
      });

      toast.success('Variety suggested for review! Thank you for contributing.');
      setShowDialog(false);
      setReason('');
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast.error('Failed to submit suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Lightbulb className="w-4 h-4" />
        Suggest to Catalog
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggest Variety for Plant Catalog</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You're suggesting to add <strong>{profile?.variety_name}</strong> to the public plant catalog.
              {seedLot.lot_images?.length > 0 && ` Your ${seedLot.lot_images.length} photo(s) will be included.`}
            </p>
            <div>
              <Label>Why should this variety be added?</Label>
              <Textarea
                placeholder="Tell us why this variety would be valuable in the catalog..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!reason.trim() || submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Suggestion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}