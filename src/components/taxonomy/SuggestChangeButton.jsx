import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Edit, Loader2 } from 'lucide-react';
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
import { toast } from 'sonner';

export default function SuggestChangeButton({ 
  objectType, 
  targetId = null,
  currentData = {},
  onSuccess,
  variant = 'outline',
  size = 'sm',
  label = 'Suggest Change'
}) {
  const [open, setOpen] = useState(false);
  const [changeType, setChangeType] = useState(targetId ? 'UPDATE' : 'CREATE');
  const [proposedData, setProposedData] = useState(targetId ? currentData : {});
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rationale.trim()) {
      toast.error('Please explain why this change is needed');
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.TaxonomyChangeSuggestion.create({
        object_type: objectType,
        change_type: changeType,
        target_id: targetId,
        proposed_payload: proposedData,
        rationale: rationale,
        status: 'PENDING'
      });

      toast.success('Suggestion submitted for review!');
      setOpen(false);
      setRationale('');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast.error('Failed to submit suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setProposedData(prev => ({ ...prev, [field]: value }));
  };

  const renderFields = () => {
    const fields = [];
    
    // Common fields based on object type
    if (objectType === 'PlantType') {
      fields.push(
        <div key="common_name">
          <Label>Common Name *</Label>
          <Input
            value={proposedData.common_name || ''}
            onChange={(e) => handleFieldChange('common_name', e.target.value)}
            className="mt-2"
          />
        </div>,
        <div key="scientific_name">
          <Label>Scientific Name</Label>
          <Input
            value={proposedData.scientific_name || ''}
            onChange={(e) => handleFieldChange('scientific_name', e.target.value)}
            className="mt-2"
          />
        </div>
      );
    } else if (objectType === 'Variety') {
      fields.push(
        <div key="variety_name">
          <Label>Variety Name *</Label>
          <Input
            value={proposedData.variety_name || ''}
            onChange={(e) => handleFieldChange('variety_name', e.target.value)}
            className="mt-2"
          />
        </div>,
        <div key="days_to_maturity">
          <Label>Days to Maturity</Label>
          <Input
            type="number"
            value={proposedData.days_to_maturity || ''}
            onChange={(e) => handleFieldChange('days_to_maturity', parseInt(e.target.value))}
            className="mt-2"
          />
        </div>
      );
    } else if (objectType === 'FacetGroup') {
      fields.push(
        <div key="key">
          <Label>Key (slug) *</Label>
          <Input
            value={proposedData.key || ''}
            onChange={(e) => handleFieldChange('key', e.target.value)}
            className="mt-2"
          />
        </div>,
        <div key="name">
          <Label>Name *</Label>
          <Input
            value={proposedData.name || ''}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            className="mt-2"
          />
        </div>
      );
    }

    return fields;
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Edit className="w-4 h-4 mr-2" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggest Change: {objectType}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {targetId && (
              <div>
                <Label>Change Type</Label>
                <Select value={changeType} onValueChange={setChangeType}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPDATE">Update</SelectItem>
                    <SelectItem value="DELETE">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {changeType !== 'DELETE' && renderFields()}

            <div>
              <Label htmlFor="rationale">Why is this change needed? *</Label>
              <Textarea
                id="rationale"
                placeholder="Explain the reason for this change..."
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              Your suggestion will be reviewed by an editor before being applied.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !rationale.trim()}
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
    </>
  );
}