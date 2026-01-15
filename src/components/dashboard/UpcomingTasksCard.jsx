import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ArrowRight, Calendar, Plus } from 'lucide-react';
import { format, isToday, isTomorrow, isBefore } from 'date-fns';

export default function UpcomingTasksCard({ tasks, onTaskComplete, loading }) {
  const markTaskDone = async (task) => {
    try {
      await base44.entities.Task.update(task.id, {
        status: 'done',
        completed_at: new Date().toISOString()
      });
      if (onTaskComplete) onTaskComplete(task.id);
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const getTaskDateLabel = (date) => {
    if (!date) return 'No date';
    const d = new Date(date);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isBefore(d, new Date())) return 'Overdue';
    return format(d, 'MMM d');
  };

  const getTaskDateColor = (date) => {
    if (!date) return 'text-gray-500';
    const d = new Date(date);
    if (isBefore(d, new Date()) && !isToday(d)) return 'text-red-600 bg-red-50 border-red-200';
    if (isToday(d)) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (isTomorrow(d)) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-gray-600';
  };

  if (loading) return null;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-600" />
          Upcoming Tasks
        </CardTitle>
        <div className="flex gap-2">
          <Link to={createPageUrl('CalendarTasks') + '?action=new'}>
            <Button variant="ghost" size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </Link>
          <Link to={createPageUrl('CalendarTasks')}>
            <Button variant="ghost" size="sm" className="gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">All caught up!</p>
            <p className="text-sm text-gray-400">No pending tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 6).map((task) => (
              <div 
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <button
                  onClick={() => markTaskDone(task)}
                  className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors flex-shrink-0 group-hover:scale-110"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">{task.title}</p>
                  {task.plant_display_name && (
                    <p className="text-xs text-gray-500 truncate">{task.plant_display_name}</p>
                  )}
                </div>
                <Badge variant="outline" className={`${getTaskDateColor(task.due_date)} text-xs flex-shrink-0`}>
                  {getTaskDateLabel(task.due_date)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}