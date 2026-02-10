import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical } from 'lucide-react';
import { format } from 'date-fns';

const COLUMNS = [
  { id: 'pending', title: 'To Do', color: 'bg-gray-100', textColor: 'text-gray-700' },
  { id: 'today', title: 'Today', color: 'bg-yellow-100', textColor: 'text-yellow-700' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100', textColor: 'text-blue-700' },
  { id: 'completed', title: 'Done', color: 'bg-green-100', textColor: 'text-green-700' }
];

export function KanbanBoard({ tasks, onTaskUpdate }) {
  const [draggedTask, setDraggedTask] = useState(null);

  const groupedTasks = COLUMNS.reduce((acc, col) => {
    if (col.id === 'today') {
      const today = new Date().toISOString().split('T')[0];
      acc[col.id] = tasks.filter(t =>
        !t.is_completed &&
        t.start_date?.split('T')[0] === today
      );
    } else if (col.id === 'pending') {
      acc[col.id] = tasks.filter(t => !t.is_completed && !t.status);
    } else if (col.id === 'in_progress') {
      const today = new Date().toISOString().split('T')[0];
      acc[col.id] = tasks.filter(t => 
        !t.is_completed && 
        t.start_date?.split('T')[0] < today
      );
    } else if (col.id === 'completed') {
      acc[col.id] = tasks.filter(t => t.is_completed);
    }
    return acc;
  }, {});

  const handleDrop = async (taskId, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'today') {
      updates.start_date = new Date().toISOString().split('T')[0];
      updates.status = 'pending';
    }

    await base44.entities.CropTask.update(taskId, updates);
    onTaskUpdate?.();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(column => (
        <div
          key={column.id}
          className={`${column.color} rounded-lg p-4 min-h-[500px] flex flex-col`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${column.textColor}`}>{column.title}</h3>
            <span className="text-sm font-medium text-gray-600">
              {groupedTasks[column.id]?.length || 0}
            </span>
          </div>

          <div className="space-y-2 flex-1">
            {(groupedTasks[column.id] || []).map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={() => setDraggedTask(task)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedTask) {
                    handleDrop(draggedTask.id, column.id === 'today' ? 'pending' : column.id);
                    setDraggedTask(null);
                  }
                }}
                className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-move"
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 line-clamp-2">{task.title}</p>
                    {task.start_date && (
                      <p className="text-xs text-gray-500 mt-2">
                        {format(new Date(task.start_date), 'MMM d')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {(groupedTasks[column.id] || []).length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No tasks
              </div>
            )}
          </div>

          <Button variant="outline" className="w-full mt-auto gap-2" size="sm">
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      ))}
    </div>
  );
}