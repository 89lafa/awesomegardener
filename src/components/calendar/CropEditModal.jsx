import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CropEditModal({ crop, open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    label: crop?.label || '',
    color_hex: crop?.color_hex || '#10b981'
  });

  const handleSave = async () => {
    if (!crop) return;
    
    setLoading(true);
    try {
      await base44.entities.CropPlan.update(crop.id, formData);
      
      // Update associated tasks' color
      const tasks = await base44.entities.CropTask.filter({ crop_plan_id: crop.id });
      for (const task of tasks) {
        await base44.entities.CropTask.update(task.id, { color_hex: formData.color_hex });
      }
      
      toast.success('Crop updated');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error updating crop:', error);
      toast.error('Failed to update crop');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Crop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Label</Label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2">
              {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'].map(color => (
                <button
                  key={color}
                  onClick={() => setFormData({ ...formData, color_hex: color })}
                  className={`w-8 h-8 rounded border-2 ${formData.color_hex === color ? 'border-gray-900' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}