import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const CONTAINER_TYPES = [
  { type: 'cup_3.5in', label: '3.5" Cup', gallons: 0.5 },
  { type: 'cup_4in', label: '4" Cup', gallons: 0.75 },
  { type: 'pot_1gal', label: '1 Gallon Pot', gallons: 1 },
  { type: 'pot_3gal', label: '3 Gallon Pot', gallons: 3 },
  { type: 'grow_bag_5gal', label: '5 Gallon Grow Bag', gallons: 5 },
  { type: 'grow_bag_10gal', label: '10 Gallon Grow Bag', gallons: 10 },
];

export default function AddContainerDialog({ open, onOpenChange, spaceId, onSuccess }) {
  const isOpen = open;
  const onClose = () => onOpenChange(false);
  const onContainerAdded = onSuccess;
  const [containerName, setContainerName] = useState('');
  const [containerType, setContainerType] = useState('cup_3.5in');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const selectedType = CONTAINER_TYPES.find(t => t.type === containerType);

  const handleCreate = async () => {
    if (!containerName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setLoading(true);
    try {
      for (let i = 0; i < quantity; i++) {
        await base44.entities.IndoorContainer.create({
          indoor_space_id: spaceId,
          name: `${containerName}${quantity > 1 ? ` ${i + 1}` : ''}`,
          container_type: containerType,
          size_inches: containerType.includes('cup') ? (containerType === 'cup_3.5in' ? 3.5 : 4) : 8,
          volume_gallons: selectedType?.gallons || 1,
          status: 'empty',
          x_position: 0,
          y_position: 0
        });
      }

      toast.success(`Created ${quantity} container(s)!`);
      onContainerAdded?.();
      onClose();
      setContainerName('');
      setQuantity(1);
    } catch (error) {
      console.error('Error creating container:', error);
      toast.error('Failed to create container');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Container</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Container Name</label>
            <Input
              placeholder="e.g., Tomato Cups, Pepper Pots"
              value={containerName}
              onChange={(e) => setContainerName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Container Type</label>
            <div className="space-y-2">
              {CONTAINER_TYPES.map(ct => (
                <button
                  key={ct.type}
                  onClick={() => setContainerType(ct.type)}
                  className={`w-full p-3 border rounded-lg text-left transition ${
                    containerType === ct.type
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-gray-300 hover:border-emerald-400'
                  }`}
                >
                  <p className="font-medium text-sm">{ct.label}</p>
                  <p className="text-xs text-gray-600">{ct.gallons} gal</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Quantity</label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              min="1"
              max="100"
            />
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
              {loading ? 'Creating...' : `Create ${quantity > 1 ? `${quantity} Containers` : 'Container'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}