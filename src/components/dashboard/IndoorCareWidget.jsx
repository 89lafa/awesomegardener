import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Droplets, Sprout, Wind, RotateCw } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

const TASK_ICONS = {
  water: Droplets,
  fertilize: Sprout,
  mist: Wind,
  rotate: RotateCw,
};

export default function IndoorCareWidget() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodaysTasks();
  }, []);

  const loadTodaysTasks = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const data = await base44.entities.IndoorCareTask.filter({
        due_date: { $gte: today.toISOString(), $lte: endOfToday.toISOString() },
        is_completed: false
      });

      const enriched = await Promise.all(
        data.map(async task => {
          const plant = await base44.entities.IndoorPlant.filter({ id: task.indoor_plant_id }).then(r => r[0]);
          const variety = plant?.variety_id ? await base44.entities.Variety.filter({ id: plant.variety_id }).then(r => r[0]) : null;
          return {
            ...task,
            plant_nickname: plant?.nickname,
            variety_name: variety?.variety_name
          };
        })
      );

      setTasks(enriched);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeQuick = async (taskId, plantId, taskType) => {
    try {
      await base44.entities.IndoorCareTask.update(taskId, {
        is_completed: true,
        completed_date: new Date().toISOString()
      });

      await base44.entities.IndoorPlantLog.create({
        indoor_plant_id: plantId,
        log_type: taskType,
        log_date: new Date().toISOString()
      });

      const updates = {};
      if (taskType === 'water') updates.last_watered_date = new Date().toISOString();
      if (taskType === 'fertilize') updates.last_fertilized_date = new Date().toISOString();
      if (taskType === 'rotate') updates.last_rotated_date = new Date().toISOString();

      if (Object.keys(updates).length > 0) {
        await base44.entities.IndoorPlant.update(plantId, updates);
      }

      toast.success('Task completed!');
      loadTodaysTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            🪴 Indoor Care Today ({tasks.length})
          </CardTitle>
          <Link to={createPageUrl('CalendarTasks')} className="text-sm text-emerald-600 hover:text-emerald-700">
            View All →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-sm">All caught up!</div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.slice(0, 5).map(task => {
              const Icon = TASK_ICONS[task.task_type] || Droplets;
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg">
                  <Checkbox
                    onCheckedChange={() => completeQuick(task.id, task.indoor_plant_id, task.task_type)}
                  />
                  <Icon className="w-4 h-4 text-emerald-600" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {task.plant_nickname || task.variety_name}
                    </div>
                    <div className="text-xs text-gray-600 capitalize">
                      {task.task_type}
                      {task.priority === 'high' && (
                        <span className="text-red-600 ml-2">⚠️ Urgent</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {tasks.length > 5 && (
              <Link
                to={createPageUrl('CalendarTasks') + '?filter=indoor'}
                className="block text-center text-sm text-emerald-600 hover:text-emerald-700 py-2"
              >
                +{tasks.length - 5} more tasks
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}