import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  GripVertical, CheckCircle2, Clock, AlertTriangle, CalendarDays, 
  Sprout, Shovel, Leaf, Scissors, Droplets, Wind, RotateCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, parseISO, isBefore, addDays, isToday, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

const TASK_TYPE_CONFIG = {
  seed: { emoji: '🌱', label: 'Start Seeds', color: '#8b5cf6' },
  direct_seed: { emoji: '🌾', label: 'Direct Sow', color: '#10b981' },
  transplant: { emoji: '🪴', label: 'Transplant', color: '#f59e0b' },
  harvest: { emoji: '🥕', label: 'Harvest', color: '#ef4444' },
  cultivate: { emoji: '✂️', label: 'Cultivate', color: '#3b82f6' },
  bed_prep: { emoji: '🔧', label: 'Bed Prep', color: '#6b7280' },
  water: { emoji: '💧', label: 'Water', color: '#0ea5e9' },
  fertilize: { emoji: '🌿', label: 'Fertilize', color: '#22c55e' },
  mist: { emoji: '💨', label: 'Mist', color: '#06b6d4' },
  rotate: { emoji: '🔄', label: 'Rotate', color: '#a855f7' },
};

const COLUMNS = [
  { id: 'overdue', title: 'Overdue', icon: AlertTriangle, headerBg: 'bg-red-500', headerText: 'text-white', cardBorder: 'border-l-red-400', dotColor: 'bg-red-400', emptyText: 'No overdue tasks 🎉' },
  { id: 'today', title: 'Today', icon: Clock, headerBg: 'bg-amber-500', headerText: 'text-white', cardBorder: 'border-l-amber-400', dotColor: 'bg-amber-400', emptyText: 'Nothing due today' },
  { id: 'this_week', title: 'This Week', icon: CalendarDays, headerBg: 'bg-emerald-500', headerText: 'text-white', cardBorder: 'border-l-emerald-400', dotColor: 'bg-emerald-400', emptyText: 'Clear week ahead' },
  { id: 'upcoming', title: 'Upcoming', icon: Sprout, headerBg: 'bg-blue-500', headerText: 'text-white', cardBorder: 'border-l-blue-400', dotColor: 'bg-blue-400', emptyText: 'No upcoming tasks' },
  { id: 'done', title: 'Done', icon: CheckCircle2, headerBg: 'bg-gray-400', headerText: 'text-white', cardBorder: 'border-l-gray-300', dotColor: 'bg-gray-400', emptyText: 'Complete tasks to see them here' },
];

const MAX_VISIBLE_CARDS = 8;

function categorizeTask(task) {
  if (task.is_completed) return 'done';
  if (!task.start_date) return 'upcoming';
  
  const now = startOfDay(new Date());
  const taskDate = startOfDay(parseISO(task.start_date));
  
  if (isBefore(taskDate, now)) return 'overdue';
  if (isToday(taskDate)) return 'today';
  if (isBefore(taskDate, addDays(now, 7))) return 'this_week';
  return 'upcoming';
}

export function KanbanBoard({ tasks, cropPlans = [], onTaskUpdate }) {
  const [columns, setColumns] = useState({});
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [expandedColumns, setExpandedColumns] = useState({});
  const [updating, setUpdating] = useState(new Set());
  const dragCounter = useRef({});

  // Build crop lookup
  const cropMap = {};
  cropPlans.forEach(c => { cropMap[c.id] = c; });

  // Categorize tasks into columns
  useEffect(() => {
    const cols = { overdue: [], today: [], this_week: [], upcoming: [], done: [] };
    tasks.forEach(task => {
      const cat = categorizeTask(task);
      cols[cat].push(task);
    });
    // Sort: overdue by date asc, others by date asc, done by completed_at desc
    cols.overdue.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    cols.today.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    cols.this_week.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    cols.upcoming.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    cols.done.sort((a, b) => new Date(b.completed_at || b.start_date) - new Date(a.completed_at || a.start_date));
    setColumns(cols);
  }, [tasks]);

  const handleDragStart = (e, task, sourceColumn) => {
    setDraggedTask({ task, sourceColumn });
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image slightly transparent
    if (e.currentTarget) {
      e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
    }
  };

  const handleDragEnter = (e, columnId) => {
    e.preventDefault();
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) + 1;
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e, columnId) => {
    dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) - 1;
    if (dragCounter.current[columnId] <= 0) {
      dragCounter.current[columnId] = 0;
      if (dragOverColumn === columnId) {
        setDragOverColumn(null);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetColumn) => {
    e.preventDefault();
    dragCounter.current = {};
    setDragOverColumn(null);
    
    if (!draggedTask) return;
    const { task, sourceColumn } = draggedTask;
    setDraggedTask(null);
    
    if (sourceColumn === targetColumn) return;

    // Calculate new state
    const updates = {};
    const now = new Date();

    if (targetColumn === 'done') {
      updates.is_completed = true;
      updates.completed_at = now.toISOString();
      if (task.quantity_target) updates.quantity_completed = task.quantity_target;
    } else {
      // Reopening or rescheduling
      if (task.is_completed) {
        updates.is_completed = false;
        updates.completed_at = null;
        if (task.quantity_target) updates.quantity_completed = 0;
      }
      
      // Reschedule based on target column
      if (targetColumn === 'today') {
        updates.start_date = format(now, 'yyyy-MM-dd');
      } else if (targetColumn === 'this_week') {
        updates.start_date = format(addDays(now, 3), 'yyyy-MM-dd');
      } else if (targetColumn === 'upcoming') {
        updates.start_date = format(addDays(now, 10), 'yyyy-MM-dd');
      } else if (targetColumn === 'overdue') {
        // Don't actually schedule in the past - just move to today
        updates.start_date = format(now, 'yyyy-MM-dd');
      }

      // Adjust end_date if task has duration
      if (updates.start_date && task.end_date && task.start_date) {
        const duration = Math.round((new Date(task.end_date) - new Date(task.start_date)) / (1000*60*60*24));
        if (duration > 0) {
          updates.end_date = format(addDays(new Date(updates.start_date), duration), 'yyyy-MM-dd');
        }
      }
    }

    // Optimistic UI update
    setColumns(prev => {
      const next = { ...prev };
      next[sourceColumn] = prev[sourceColumn].filter(t => t.id !== task.id);
      const updatedTask = { ...task, ...updates };
      next[targetColumn] = [updatedTask, ...(prev[targetColumn] || [])];
      return next;
    });

    // Mark as updating
    setUpdating(prev => new Set([...prev, task.id]));

    try {
      if (task.source === 'indoor') {
        const indoorUpdates = {};
        if (updates.is_completed !== undefined) {
          indoorUpdates.is_completed = updates.is_completed;
          indoorUpdates.completed_date = updates.is_completed ? now.toISOString() : null;
        }
        if (updates.start_date) indoorUpdates.due_date = updates.start_date;
        await base44.entities.IndoorCareTask.update(task.id, indoorUpdates);

        // If completing an indoor task, also log it and update plant
        if (updates.is_completed && task.indoor_plant_id) {
          try {
            await base44.entities.IndoorPlantLog.create({
              indoor_plant_id: task.indoor_plant_id,
              log_type: task.task_type,
              log_date: now.toISOString()
            });
            const plantUpdates = {};
            if (task.task_type === 'water') plantUpdates.last_watered_date = now.toISOString();
            if (task.task_type === 'fertilize') plantUpdates.last_fertilized_date = now.toISOString();
            if (task.task_type === 'rotate') plantUpdates.last_rotated_date = now.toISOString();
            if (Object.keys(plantUpdates).length > 0) {
              await base44.entities.IndoorPlant.update(task.indoor_plant_id, plantUpdates);
            }
          } catch (err) {
            console.error('Error updating indoor plant:', err);
          }
        }
      } else {
        const cropUpdates = {};
        if (updates.is_completed !== undefined) {
          cropUpdates.is_completed = updates.is_completed;
          cropUpdates.completed_at = updates.completed_at;
        }
        if (updates.quantity_completed !== undefined) cropUpdates.quantity_completed = updates.quantity_completed;
        if (updates.start_date) cropUpdates.start_date = updates.start_date;
        if (updates.end_date) cropUpdates.end_date = updates.end_date;
        await base44.entities.CropTask.update(task.id, cropUpdates);
      }
      
      const action = targetColumn === 'done' ? 'completed' : 'rescheduled';
      toast.success(`Task ${action}!`);
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      // Revert
      if (onTaskUpdate) onTaskUpdate();
    } finally {
      setUpdating(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const toggleExpand = (colId) => {
    setExpandedColumns(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
      {COLUMNS.map(col => {
        const colTasks = columns[col.id] || [];
        const isExpanded = expandedColumns[col.id];
        const visibleTasks = isExpanded ? colTasks : colTasks.slice(0, MAX_VISIBLE_CARDS);
        const hiddenCount = colTasks.length - visibleTasks.length;
        const isDropTarget = dragOverColumn === col.id;
        const ColIcon = col.icon;

        return (
          <div
            key={col.id}
            className={cn(
              "flex-1 min-w-[260px] max-w-[320px] flex flex-col rounded-xl transition-all duration-200",
              isDropTarget ? "ring-2 ring-emerald-400 ring-offset-2 bg-emerald-50/50 scale-[1.01]" : "bg-gray-50/80"
            )}
            onDragEnter={(e) => handleDragEnter(e, col.id)}
            onDragLeave={(e) => handleDragLeave(e, col.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column Header */}
            <div className={cn("rounded-t-xl px-4 py-3 flex items-center gap-2", col.headerBg)}>
              <ColIcon className={cn("w-4 h-4", col.headerText)} />
              <span className={cn("font-bold text-sm", col.headerText)}>{col.title}</span>
              <span className={cn("ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white/25", col.headerText)}>
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
              {colTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <div className="text-2xl mb-2">{col.id === 'done' ? '🏆' : col.id === 'overdue' ? '🎉' : '📭'}</div>
                  {col.emptyText}
                </div>
              ) : (
                <>
                  {visibleTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      crop={cropMap[task.crop_plan_id]}
                      columnId={col.id}
                      cardBorder={col.cardBorder}
                      onDragStart={handleDragStart}
                      isDragging={draggedTask?.task?.id === task.id}
                      isUpdating={updating.has(task.id)}
                    />
                  ))}
                  
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => toggleExpand(col.id)}
                      className="w-full py-2 text-xs text-gray-500 hover:text-emerald-600 font-medium flex items-center justify-center gap-1 hover:bg-white rounded-lg transition-colors"
                    >
                      <ChevronDown className="w-3 h-3" />
                      Show {hiddenCount} more
                    </button>
                  )}
                  
                  {isExpanded && colTasks.length > MAX_VISIBLE_CARDS && (
                    <button
                      onClick={() => toggleExpand(col.id)}
                      className="w-full py-2 text-xs text-gray-500 hover:text-emerald-600 font-medium flex items-center justify-center gap-1 hover:bg-white rounded-lg transition-colors"
                    >
                      <ChevronUp className="w-3 h-3" />
                      Show less
                    </button>
                  )}
                </>
              )}

              {/* Drop zone indicator */}
              {isDropTarget && (
                <div className="border-2 border-dashed border-emerald-400 rounded-lg py-4 text-center text-emerald-600 text-xs font-medium bg-emerald-50/50">
                  {col.id === 'done' ? '✓ Drop to complete' : '📅 Drop to reschedule'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, crop, columnId, cardBorder, onDragStart, isDragging, isUpdating }) {
  const typeConfig = TASK_TYPE_CONFIG[task.task_type] || { emoji: '📋', label: task.task_type, color: '#6b7280' };
  const cropColor = crop?.color_hex || task.color_hex || '#10b981';
  const progress = task.quantity_target > 1 ? (task.quantity_completed || 0) / task.quantity_target : null;
  
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task, columnId)}
      className={cn(
        "bg-white rounded-lg border shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group",
        `border-l-[4px] ${cardBorder}`,
        isDragging && "opacity-40 scale-95",
        isUpdating && "animate-pulse",
        task.is_completed && "opacity-60"
      )}
    >
      <div className="p-3">
        {/* Header: Drag handle + type badge */}
        <div className="flex items-start gap-2 mb-2">
          <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{typeConfig.emoji}</span>
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ backgroundColor: typeConfig.color + '20', color: typeConfig.color }}
              >
                {typeConfig.label}
              </span>
              {task.source === 'indoor' && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  🪴 Indoor
                </span>
              )}
            </div>
            <p className={cn(
              "text-sm font-semibold text-gray-800 leading-tight",
              task.is_completed && "line-through text-gray-400"
            )}>
              {task.title || 'Untitled Task'}
            </p>
          </div>
        </div>

        {/* Crop info */}
        {crop && (
          <div className="flex items-center gap-1.5 mb-2 ml-6">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cropColor }} />
            <span className="text-xs text-gray-500 truncate">{crop.label}</span>
          </div>
        )}

        {/* Plant name for indoor tasks */}
        {task.plant_name && !crop && (
          <div className="flex items-center gap-1.5 mb-2 ml-6">
            <span className="text-xs text-gray-500">🪴 {task.plant_name}</span>
          </div>
        )}

        {/* Date + progress */}
        <div className="flex items-center justify-between ml-6">
          <span className="text-[11px] text-gray-400">
            {task.start_date ? format(parseISO(task.start_date), 'MMM d') : 'No date'}
            {task.end_date && task.end_date !== task.start_date && (
              <> → {format(parseISO(task.end_date), 'MMM d')}</>
            )}
          </span>
          
          {task.quantity_target > 1 && (
            <span className="text-[11px] text-gray-400">
              {task.quantity_completed || 0}/{task.quantity_target}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progress !== null && (
          <div className="mt-2 ml-6">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (progress || 0) * 100)}%`, backgroundColor: cropColor }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanBoard;
