import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Minus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { toast } from 'sonner';

const TASK_TYPE_LABELS = {
  bed_prep: 'Bed Preparation',
  seed: 'Seeding (Indoors)',
  direct_seed: 'Direct Seeding',
  transplant: 'Transplanting',
  cultivate: 'Cultivation',
  harvest: 'Harvesting'
};

export default function TaskDetailPanel({ task, onClose, onUpdate }) {
  const [completedQty, setCompletedQty] = useState(task.quantity_completed || 0);
  const [updating, setUpdating] = useState(false);

  const handleUpdateQuantity = async (newQty) => {
    if (newQty < 0 || newQty > (task.quantity_target || 0)) return;
    
    // Optimistic UI update
    const previousQty = completedQty;
    setCompletedQty(newQty);
    
    try {
      await base44.entities.CropTask.update(task.id, {
        quantity_completed: newQty,
        is_completed: newQty >= (task.quantity_target || 0)
      });
      toast.success('Progress updated');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
      // Revert on error
      setCompletedQty(previousQty);
      toast.error('Failed to update');
    }
  };

  const handleMarkComplete = async () => {
    // Optimistic UI update
    setCompletedQty(task.quantity_target || 0);
    
    setUpdating(true);
    try {
      await base44.entities.CropTask.update(task.id, {
        is_completed: true,
        completed_at: new Date().toISOString(),
        quantity_completed: task.quantity_target || 0
      });
      toast.success('Task completed');
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error completing task:', error);
      // Revert on error
      setCompletedQty(task.quantity_completed || 0);
      toast.error('Failed to complete task');
      setUpdating(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white border-l shadow-lg z-50 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-lg">Task Details</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <Badge className="mb-2">{TASK_TYPE_LABELS[task.task_type] || task.task_type}</Badge>
          <h2 className="text-xl font-bold">{task.title}</h2>
          <p className="text-sm text-gray-600 mt-2">
            {format(new Date(task.start_date), 'MMM d, yyyy')}
            {task.end_date && task.end_date !== task.start_date && (
              <> - {format(new Date(task.end_date), 'MMM d, yyyy')}</>
            )}
          </p>
        </div>

        {/* Quantity Tracking */}
        {task.quantity_target && task.quantity_target > 1 && (
          <Card className="p-4">
            <Label className="text-sm font-semibold mb-3 block">Quantity Progress</Label>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Completed</span>
              <span className="text-lg font-bold text-emerald-600">
                {completedQty} / {task.quantity_target}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="bg-emerald-600 h-2 rounded-full transition-all"
                style={{ width: `${(completedQty / task.quantity_target) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleUpdateQuantity(completedQty - 1)}
                disabled={completedQty === 0}
                className="touch-manipulation min-h-[44px] min-w-[44px]"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                min="0"
                max={task.quantity_target}
                value={completedQty}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  if (val >= 0 && val <= task.quantity_target) {
                    handleUpdateQuantity(val);
                  }
                }}
                className="text-center touch-manipulation min-h-[44px]"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleUpdateQuantity(completedQty + 1)}
                disabled={completedQty >= task.quantity_target}
                className="touch-manipulation min-h-[44px] min-w-[44px]"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}
        
        {task.how_to_content && (
          <Card className="p-4">
            <ReactMarkdown className="prose prose-sm max-w-none">
              {task.how_to_content}
            </ReactMarkdown>
          </Card>
        )}
        
        {!task.how_to_content && (
          <Card className="p-4">
            <h4 className="font-semibold mb-2">What to do</h4>
            <p className="text-sm text-gray-600">
              Complete the {TASK_TYPE_LABELS[task.task_type]?.toLowerCase() || task.task_type} task for this crop.
            </p>
          </Card>
        )}
        
        {task.notes && (
          <Card className="p-4">
            <h4 className="font-semibold mb-2">Notes</h4>
            <p className="text-sm text-gray-600">{task.notes}</p>
          </Card>
        )}

        {/* Mark Complete Button */}
        {!task.is_completed && (
          <Button
            onClick={handleMarkComplete}
            disabled={updating}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Mark as Complete
          </Button>
        )}
      </div>
    </div>
  );
}