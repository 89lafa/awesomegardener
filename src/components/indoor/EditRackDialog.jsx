import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Trash2, AlertCircle } from 'lucide-react';

export default function EditRackDialog({ isOpen, onClose, rack, onRackUpdated, onRackDeleted }) {
  const [temperature, setTemperature] = useState('');
  const [humidity, setHumidity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && rack) {
      setTemperature(rack.temperature || '');
      setHumidity(rack.humidity || '');
      setNotes(rack.notes || '');
    }
  }, [isOpen, rack]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await base44.entities.GrowRack.update(rack.id, {
        temperature: temperature ? parseFloat(temperature) : null,
        humidity: humidity ? parseFloat(humidity) : null,
        notes: notes || null
      });

      toast.success('Rack updated successfully');
      onRackUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error updating rack:', error);
      toast.error('Failed to update rack');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Delete all shelves first
      const shelves = await base44.entities.GrowShelf.filter({ rack_id: rack.id });
      for (const shelf of shelves) {
        const trays = await base44.entities.SeedTray.filter({ shelf_id: shelf.id });
        for (const tray of trays) {
          await base44.entities.SeedTray.delete(tray.id);
        }
        await base44.entities.GrowShelf.delete(shelf.id);
      }

      // Delete the rack
      await base44.entities.GrowRack.delete(rack.id);

      toast.success('Rack deleted successfully');
      onRackDeleted?.();
      onClose();
    } catch (error) {
      console.error('Error deleting rack:', error);
      toast.error('Failed to delete rack');
    } finally {
      setLoading(false);
    }
  };

  if (!rack) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {rack.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">{rack.width_ft}ft × {rack.depth_ft}ft • {rack.num_shelves} shelves</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Temperature (°F)</label>
              <Input
                type="number"
                placeholder="e.g., 72"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Humidity (%)</label>
              <Input
                type="number"
                placeholder="e.g., 65"
                value={humidity}
                onChange={(e) => setHumidity(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes (optional)</label>
            <Input
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {!showDeleteConfirm ? (
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="destructive"
              className="w-full gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Rack
            </Button>
          ) : (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-3">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-900">
                  <p className="font-medium">Are you sure?</p>
                  <p className="text-xs mt-1">This will delete the rack and ALL its shelves and trays. This cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {!showDeleteConfirm && (
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
        )}
      </DialogContent>
    </Dialog>
  );
}