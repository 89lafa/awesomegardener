import React from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

const TASK_HELP_CONTENT = {
  bed_prep: {
    what: "Prepare your garden bed for planting by clearing debris, loosening soil, and adding amendments.",
    how: "1. Remove weeds and debris\n2. Loosen soil with a fork or tiller to 6-8 inches deep\n3. Add compost or aged manure (2-3 inches)\n4. Mix amendments thoroughly\n5. Rake smooth and level"
  },
  seed: {
    what: "Start seeds indoors in containers to give plants a head start before transplanting outside.",
    how: "1. Fill seed trays with seed starting mix\n2. Plant seeds at recommended depth (usually 2x seed size)\n3. Water gently and keep moist\n4. Place in warm location (70-75°F)\n5. Provide light once seedlings emerge\n6. Keep soil consistently moist but not soggy"
  },
  direct_seed: {
    what: "Sow seeds directly into prepared garden beds where they will grow to maturity.",
    how: "1. Ensure soil temperature is appropriate for crop\n2. Create furrows at recommended depth\n3. Sow seeds at proper spacing\n4. Cover with soil and firm gently\n5. Water thoroughly\n6. Keep soil moist until germination\n7. Thin seedlings to proper spacing"
  },
  transplant: {
    what: "Move seedlings from indoor containers to the garden once they're strong enough and weather permits.",
    how: "1. Harden off seedlings 7-10 days before transplanting\n2. Choose a cloudy day or transplant in evening\n3. Water seedlings well before transplanting\n4. Dig holes at proper spacing\n5. Remove seedling gently from container\n6. Plant at same depth as in container\n7. Firm soil around roots and water well"
  },
  cultivate: {
    what: "Maintain plants through weeding, watering, and monitoring for pests and diseases.",
    how: "1. Water deeply and consistently (1 inch per week)\n2. Mulch around plants to retain moisture\n3. Remove weeds regularly\n4. Check for pests and diseases\n5. Provide support/trellising if needed\n6. Side-dress with compost mid-season if needed"
  },
  harvest: {
    what: "Pick crops at peak ripeness for best flavor and to encourage continued production.",
    how: "1. Harvest in morning after dew dries\n2. Use clean, sharp tools\n3. Handle produce gently to avoid bruising\n4. Pick regularly to encourage more production\n5. Remove overripe or damaged fruits\n6. Store properly based on crop type"
  }
};

export default function TaskDetailPanel({ task, onClose, onRefresh }) {
  if (!task) return null;

  const helpContent = TASK_HELP_CONTENT[task.task_type];

  const handleToggleComplete = async () => {
    try {
      await base44.entities.CropTask.update(task.id, {
        is_completed: !task.is_completed,
        completed_at: !task.is_completed ? new Date().toISOString() : null
      });

      toast.success(task.is_completed ? 'Task marked incomplete' : 'Task completed!');
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <button
              onClick={handleToggleComplete}
              className="flex-shrink-0"
            >
              {task.is_completed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <Circle className="w-6 h-6 text-gray-400" />
              )}
            </button>
            <span>{task.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Task Details</h3>
            <div className="text-sm space-y-1">
              <p><span className="text-gray-600">Start:</span> {format(new Date(task.start_date), 'MMM d, yyyy')}</p>
              {task.end_date && (
                <p><span className="text-gray-600">End:</span> {format(new Date(task.end_date), 'MMM d, yyyy')}</p>
              )}
              {task.is_completed && task.completed_at && (
                <p><span className="text-gray-600">Completed:</span> {format(new Date(task.completed_at), 'MMM d, yyyy')}</p>
              )}
            </div>
          </div>

          {helpContent && (
            <>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">What to do</h3>
                <p className="text-sm text-gray-700">{helpContent.what}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">How to do it</h3>
                <div className="text-sm text-gray-700 whitespace-pre-line">
                  {helpContent.how}
                </div>
              </div>
            </>
          )}

          {task.notes && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-sm text-gray-700">{task.notes}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}