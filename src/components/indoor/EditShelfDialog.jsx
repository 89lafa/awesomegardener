import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Lightbulb } from 'lucide-react';

export default function EditShelfDialog({ isOpen, onClose, shelf, onShelfUpdated }) {
  const [hasLight, setHasLight] = useState(false);
  const [lightWattage, setLightWattage] = useState('');
  const [lightHours, setLightHours] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && shelf) {
      setHasLight(shelf.has_light || false);
      setLightWattage(shelf.light_wattage || '');
      setLightHours(shelf.light_hours_per_day || '');
      setNotes(shelf.notes || '');
    }
  }, [isOpen, shelf]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await base44.entities.GrowShelf.update(shelf.id, {
        has_light: hasLight,
        light_wattage: hasLight && lightWattage ? parseFloat(lightWattage) : null,
        light_hours_per_day: hasLight && lightHours ? parseFloat(lightHours) : null,
        notes: notes || null
      });

      toast.success('Shelf updated successfully');
      onShelfUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error updating shelf:', error);
      toast.error('Failed to update shelf');
    } finally {
      setLoading(false);
    }
  };

  if (!shelf) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {shelf.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">{shelf.width_ft}ft wide • {shelf.max_trays} max trays</p>
          </div>

          <div className="space-y-3 border rounded-lg p-3 bg-blue-50">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasLight"
                checked={hasLight}
                onChange={(e) => setHasLight(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="hasLight" className="flex items-center gap-2 cursor-pointer">
                <Lightbulb className="w-4 h-4" />
                <span className="text-sm font-medium">Has Grow Light</span>
              </label>
            </div>

            {hasLight && (
              <div className="space-y-3 ml-6">
                <div>
                  <Label htmlFor="wattage">Light Wattage (W)</Label>
                  <Input
                    id="wattage"
                    type="number"
                    placeholder="e.g., 300"
                    value={lightWattage}
                    onChange={(e) => setLightWattage(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="hours">Hours Per Day (optional)</Label>
                  <Input
                    id="hours"
                    type="number"
                    placeholder="e.g., 14"
                    min="0"
                    max="24"
                    value={lightHours}
                    onChange={(e) => setLightHours(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}