import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const RACK_PRESETS = [
  { name: '4ft × 2ft (Standard)', width: 4, depth: 2, trayCapacity: 4 },
  { name: '6ft × 2ft (Large)', width: 6, depth: 2, trayCapacity: 6 },
  { name: '8ft × 2ft (Extra Large)', width: 8, depth: 2, trayCapacity: 8 },
];

// Calculate tray capacity: trays are 1ft wide × 2ft deep
// So 2ft depth means 1 row deep, width determines columns
const calculateTrayCapacity = (widthFt) => {
  return Math.floor(widthFt); // 4ft = 4 trays, 6ft = 6 trays, etc
};

export function AddRackDialog({ isOpen, onClose, spaceId, onRackAdded }) {
  const [rackName, setRackName] = useState('');
  const [width, setWidth] = useState(6);
  const [depth, setDepth] = useState(3);
  const [numShelves, setNumShelves] = useState(4);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!rackName.trim()) {
      toast.error('Please enter a rack name');
      return;
    }

    setLoading(true);
    try {
      const rack = await base44.entities.GrowRack.create({
        indoor_space_id: spaceId,
        name: rackName,
        width_ft: parseFloat(width),
        depth_ft: parseFloat(depth),
        height_ft: 6, // Standard height
        num_shelves: parseInt(numShelves),
        x_position: 0,
        y_position: 0,
        notes: notes || null
      });

      // Create shelves
      const capacity = calculateTrayCapacity(width);
      for (let i = 1; i <= numShelves; i++) {
        await base44.entities.GrowShelf.create({
          rack_id: rack.id,
          name: `Shelf ${i}`,
          shelf_number: i,
          width_ft: width,
          depth_ft: depth,
          max_trays: capacity
        });
      }

      toast.success(`Rack "${rackName}" created with ${numShelves} shelves!`);
      onRackAdded?.();
      onClose();
      setRackName('');
      setNotes('');
    } catch (error) {
      console.error('Error creating rack:', error);
      toast.error('Failed to create rack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Grow Rack</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Rack Name</label>
            <Input
              placeholder="e.g., Rack 1, Seed Rack, etc"
              value={rackName}
              onChange={(e) => setRackName(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Notes (optional)</label>
            <Input
              placeholder="Any notes about this rack..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Rack Size (Preset)</label>
            <div className="space-y-2">
              {RACK_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setWidth(preset.width);
                    setDepth(preset.depth);
                  }}
                  className={`w-full p-3 border rounded-lg text-left transition ${
                    width === preset.width && depth === preset.depth
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-gray-300 hover:border-emerald-400'
                  }`}
                >
                  <p className="font-medium text-sm">{preset.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{preset.trayCapacity} trays per shelf</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Width (ft)</label>
              <Input
                type="number"
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
                min="2"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Depth (ft)</label>
              <Input
                type="number"
                value={depth}
                onChange={(e) => setDepth(parseFloat(e.target.value))}
                min="2"
                step="0.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Number of Shelves</label>
            <div className="flex gap-2">
              {[3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => setNumShelves(num)}
                  className={`flex-1 py-2 px-3 rounded-lg border font-medium text-sm transition ${
                    numShelves === num
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-gray-300 hover:border-emerald-400'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-medium mb-1">Tray capacity:</p>
            <p>{calculateTrayCapacity(width)} trays per shelf (1ft wide × 2ft deep each)</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? 'Creating...' : 'Create Rack'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}