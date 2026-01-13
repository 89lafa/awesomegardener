import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const TASK_TYPES = {
  seed: { label: 'Start Seeds Indoors', icon: '🌱', color: 'bg-green-100 text-green-800' },
  direct_seed: { label: 'Direct Sow', icon: '🌾', color: 'bg-amber-100 text-amber-800' },
  transplant: { label: 'Transplant', icon: '🪴', color: 'bg-blue-100 text-blue-800' },
  harvest: { label: 'Harvest', icon: '✂️', color: 'bg-purple-100 text-purple-800' },
  cultivate: { label: 'Cultivate', icon: '🔨', color: 'bg-gray-100 text-gray-800' },
  bed_prep: { label: 'Bed Prep', icon: '🏗️', color: 'bg-orange-100 text-orange-800' }
};

export default function DayTasksPanel({ date, tasks, open, onOpenChange, onToggleComplete }) {
  if (!tasks || tasks.length === 0) return null;

  // Group tasks by type
  const groupedTasks = tasks.reduce((acc, task) => {
    const type = task.task_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(task);
    return acc;
  }, {});

  const completedTasks = tasks.filter(t => t.is_completed);
  const pendingTasks = tasks.filter(t => !t.is_completed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-600" />
            Tasks for {format(new Date(date), 'MMMM d, yyyy')}
          </DialogTitle>
          <p className="text-sm text-gray-600">
            {pendingTasks.length} pending, {completedTasks.length} completed
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pending Tasks - Grouped by Type */}
          {pendingTasks.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3">Pending Tasks</h3>
              {Object.entries(groupedTasks).map(([taskType, groupTasks]) => {
                const config = TASK_TYPES[taskType] || { label: taskType, icon: '📋', color: 'bg-gray-100' };
                const pendingInGroup = groupTasks.filter(t => !t.is_completed);
                
                if (pendingInGroup.length === 0) return null;

                return (
                  <div key={taskType} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{config.icon}</span>
                      <h4 className="font-medium text-sm">{config.label}</h4>
                      <Badge variant="outline" className="text-xs">{pendingInGroup.length}</Badge>
                    </div>
                    <div className="ml-6 space-y-2">
                      {pendingInGroup.map(task => (
                        <label 
                          key={task.id}
                          className="flex items-start gap-3 p-3 bg-white border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={task.is_completed}
                            onCheckedChange={() => onToggleComplete?.(task)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900">
                              {task.title}
                            </p>
                            {task.quantity_target > 1 && (
                              <p className="text-xs text-gray-500 mt-1">
                                Quantity: {task.quantity_completed || 0} / {task.quantity_target}
                              </p>
                            )}
                          </div>
                          <div style={{ backgroundColor: task.color_hex }} className="w-3 h-3 rounded-full flex-shrink-0 mt-1" />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-sm text-gray-600">Completed ({completedTasks.length})</h3>
                </div>
                <div className="space-y-2">
                  {completedTasks.map(task => (
                    <label 
                      key={task.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 border rounded-lg cursor-pointer"
                    >
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => onToggleComplete?.(task)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600 line-through">
                          {task.title}
                        </p>
                        {task.completed_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Completed {format(new Date(task.completed_at), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {tasks.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No tasks for this day
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}