import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function EditItemDialog({ open, onOpenChange, item, onSave }) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity || 1);
      setNotes(item.notes || '');
    }
  }, [item]);

  const handleSave = () => {
    onSave({ quantity: parseInt(quantity) || 1, notes });
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">
              {item.variety_name || item.plant_type_name}
            </Label>
            <p className="text-xs text-gray-500 mt-1">
              {item.variety_name && item.plant_type_name}
            </p>
          </div>

          <div>
            <Label htmlFor="edit_quantity">Quantity</Label>
            <Input
              id="edit_quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="edit_notes">Notes</Label>
            <Input
              id="edit_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="mt-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}