import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { Loader2, LayoutList, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

export default function CalendarTasksKanban() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban'); // kanban or list

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const taskList = await base44.entities.CropTask.filter({
        created_by: userData.email
      }, '-start_date');

      setTasks(taskList);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600">Organize and track your garden tasks</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <Button
            onClick={() => setView('kanban')}
            variant={view === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            className="gap-2"
          >
            <LayoutGrid className="w-4 h-4" />
            Kanban
          </Button>
          <Button
            onClick={() => setView('list')}
            variant={view === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="gap-2"
          >
            <LayoutList className="w-4 h-4" />
            List
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No tasks yet</p>
        </div>
      ) : (
        <>
          {view === 'kanban' && (
            <KanbanBoard tasks={tasks} onTaskUpdate={loadTasks} />
          )}

          {view === 'list' && (
            <div className="space-y-2">
              {tasks.map(task => (
                <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    </div>
                    <span className="text-xs font-medium px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                      {task.task_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}