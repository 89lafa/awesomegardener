import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TASK_COLORS = {
  bed_prep: '#8B5CF6',
  seed: '#3B82F6',
  direct_seed: '#10B981',
  transplant: '#F59E0B',
  cultivate: '#6B7280',
  harvest: '#EF4444'
};

const TASK_LABELS = {
  bed_prep: 'Bed Preparation',
  seed: 'Seeding',
  direct_seed: 'Direct Seed',
  transplant: 'Transplanting',
  cultivate: 'Cultivate',
  harvest: 'Harvesting'
};

export default function CalendarTimeline({
  cropTasks,
  cropPlans,
  timelineRange,
  taskFilter,
  selectedCrop,
  onTaskClick,
  onRefresh,
  activeSeason
}) {
  const [draggingTask, setDraggingTask] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const timelineRef = useRef(null);

  const today = new Date();
  const startDate = startOfMonth(addMonths(today, -3));
  const endDate = endOfMonth(addMonths(today, timelineRange - 3));
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const months = [];
  let currentMonth = startOfMonth(startDate);
  while (currentMonth <= endDate) {
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: currentMonth, end: monthEnd > endDate ? endDate : monthEnd }).length;
    months.push({ date: currentMonth, days: daysInMonth });
    currentMonth = addMonths(currentMonth, 1);
  }

  const filteredTasks = cropTasks.filter(task => {
    if (taskFilter !== 'all' && task.task_type !== taskFilter) return false;
    if (selectedCrop && task.crop_plan_id !== selectedCrop.id) return false;
    return true;
  });

  const handleDragStart = (e, task) => {
    setDraggingTask(task);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset(e.clientX - rect.left);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dayIndex) => {
    e.preventDefault();
    if (!draggingTask) return;

    const newStartDate = days[dayIndex];
    const oldStartDate = new Date(draggingTask.start_date);
    const daysDiff = Math.round((newStartDate - oldStartDate) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      setDraggingTask(null);
      return;
    }

    try {
      // Update this task
      const newEndDate = draggingTask.end_date
        ? new Date(new Date(draggingTask.end_date).getTime() + daysDiff * 24 * 60 * 60 * 1000)
        : null;

      await base44.entities.CropTask.update(draggingTask.id, {
        start_date: newStartDate.toISOString().split('T')[0],
        end_date: newEndDate ? newEndDate.toISOString().split('T')[0] : null
      });

      // If this is a primary task (seed/transplant/direct_seed), shift dependent tasks
      if (['seed', 'transplant', 'direct_seed'].includes(draggingTask.task_type)) {
        const allTasks = await base44.entities.CropTask.filter({
          crop_plan_id: draggingTask.crop_plan_id
        });

        for (const task of allTasks) {
          if (task.id === draggingTask.id) continue;

          const taskStart = new Date(task.start_date);
          taskStart.setDate(taskStart.getDate() + daysDiff);

          const taskEnd = task.end_date ? new Date(task.end_date) : null;
          if (taskEnd) taskEnd.setDate(taskEnd.getDate() + daysDiff);

          await base44.entities.CropTask.update(task.id, {
            start_date: taskStart.toISOString().split('T')[0],
            end_date: taskEnd ? taskEnd.toISOString().split('T')[0] : null
          });
        }
      }

      toast.success('Task updated');
      onRefresh();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    } finally {
      setDraggingTask(null);
    }
  };

  const getTaskPosition = (task) => {
    const startDate = new Date(task.start_date);
    const startIndex = days.findIndex(d => isSameDay(d, startDate));
    if (startIndex === -1) return null;

    const endDate = task.end_date ? new Date(task.end_date) : startDate;
    const endIndex = days.findIndex(d => isSameDay(d, endDate));
    const width = Math.max(1, endIndex >= 0 ? endIndex - startIndex + 1 : 1);

    return { left: startIndex, width };
  };

  const cropPlanMap = {};
  cropPlans.forEach(p => { cropPlanMap[p.id] = p; });

  // Group tasks by crop plan for row rendering
  const taskRows = {};
  filteredTasks.forEach(task => {
    if (!taskRows[task.crop_plan_id]) taskRows[task.crop_plan_id] = [];
    taskRows[task.crop_plan_id].push(task);
  });

  return (
    <div className="border rounded-lg bg-white overflow-x-auto" ref={timelineRef}>
      {/* Month Headers */}
      <div className="flex border-b bg-gray-50 sticky top-0 z-10">
        {months.map((month, i) => (
          <div
            key={i}
            className="border-r last:border-r-0 px-2 py-2 text-center font-semibold text-sm"
            style={{ minWidth: `${month.days * 32}px` }}
          >
            {format(month.date, 'MMMM yyyy')}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <div className="flex border-b">
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={i}
              className={cn(
                "w-8 h-8 flex items-center justify-center text-xs border-r last:border-r-0 relative",
                isToday && "bg-emerald-100"
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, i)}
            >
              {format(day, 'd')}
              {isToday && (
                <div
                  id="today-marker"
                  className="absolute inset-0 border-2 border-emerald-600 pointer-events-none"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Task Rows */}
      {Object.entries(taskRows).length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No tasks to display</p>
          <p className="text-sm mt-1">Add a crop to start planning</p>
        </div>
      ) : (
        <div className="relative">
          {Object.entries(taskRows).map(([cropPlanId, tasks], rowIndex) => {
            const crop = cropPlanMap[cropPlanId];
            return (
              <div
                key={cropPlanId}
                className="h-16 border-b last:border-b-0 relative"
                style={{ paddingTop: '4px', paddingBottom: '4px' }}
              >
                {tasks.map((task) => {
                  const pos = getTaskPosition(task);
                  if (!pos) return null;

                  const color = TASK_COLORS[task.task_type] || crop?.color_hex || '#10b981';

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={() => onTaskClick(task)}
                      className="absolute h-10 rounded px-2 text-white text-xs flex items-center cursor-move hover:opacity-90 transition-opacity shadow-sm"
                      style={{
                        left: `${pos.left * 32}px`,
                        width: `${pos.width * 32}px`,
                        backgroundColor: color,
                        top: '4px'
                      }}
                    >
                      <span className="truncate font-medium">
                        {TASK_LABELS[task.task_type] || task.task_type}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}