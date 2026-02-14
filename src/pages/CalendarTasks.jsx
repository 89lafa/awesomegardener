import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Plus, Calendar as CalendarIcon, Filter, Loader2, CheckCircle2, Circle, Sprout, Shovel, Droplets,
  TreeDeciduous, Scissors, Bug, Leaf, Wind, RotateCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, parseISO, isBefore, addDays, addMonths, subMonths, startOfMonth, endOfMonth, getDay, getDaysInMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';

const TASK_TYPE_CONFIG = {
  seed: { icon: Sprout, emoji: '🌱', color: 'bg-purple-100 text-purple-700 border-purple-200', barColor: '#8b5cf6', label: 'Start Seeds' },
  direct_seed: { icon: Leaf, emoji: '🌾', color: 'bg-green-100 text-green-700 border-green-200', barColor: '#10b981', label: 'Direct Sow' },
  transplant: { icon: Shovel, emoji: '🪴', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', barColor: '#f59e0b', label: 'Transplant' },
  harvest: { icon: CalendarIcon, emoji: '🥕', color: 'bg-orange-100 text-orange-700 border-orange-200', barColor: '#ef4444', label: 'Harvest' },
  cultivate: { icon: Scissors, emoji: '✂️', color: 'bg-blue-100 text-blue-700 border-blue-200', barColor: '#3b82f6', label: 'Cultivate' },
  bed_prep: { icon: Shovel, emoji: '🔧', color: 'bg-gray-100 text-gray-700 border-gray-200', barColor: '#6b7280', label: 'Bed Prep' },
  water: { icon: Droplets, emoji: '💧', color: 'bg-blue-100 text-blue-700 border-blue-200', barColor: '#0ea5e9', label: 'Water' },
  fertilize: { icon: Sprout, emoji: '🌿', color: 'bg-green-100 text-green-700 border-green-200', barColor: '#22c55e', label: 'Fertilize' },
  mist: { icon: Wind, emoji: '💨', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', barColor: '#06b6d4', label: 'Mist' },
  rotate: { icon: RotateCw, emoji: '🔄', color: 'bg-purple-100 text-purple-700 border-purple-200', barColor: '#a855f7', label: 'Rotate' },
};

/* Helper: parse date string safely as local date */
function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarTasks() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [cropPlans, setCropPlans] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskTypeFilter, setTaskTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cropFilter, setCropFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeGarden) loadSeasons(); }, [activeGarden]);
  useEffect(() => { if (activeSeason) loadTasksAndCrops(); }, [activeSeason]);

  const loadData = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      const gardensData = await smartQuery(base44, 'Garden', { archived: false, created_by: userData.email }, '-updated_date');
      setGardens(gardensData);
      setRateLimitError(null);
      if (gardensData.length > 0) {
        const savedGardenId = localStorage.getItem('tasks_active_garden');
        const garden = savedGardenId ? gardensData.find(g => g.id === savedGardenId) || gardensData[0] : gardensData[0];
        setActiveGarden(garden);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      if (error.code === 'RATE_LIMIT') {
        setRateLimitError(error);
        setTimeout(() => loadData(true), error.retryInMs || 5000);
      }
    } finally { setLoading(false); setRetrying(false); }
  };

  const loadSeasons = async () => {
    if (!activeGarden) return;
    try {
      const seasonsData = await base44.entities.GardenSeason.filter({ garden_id: activeGarden.id, created_by: user.email }, '-year');
      setSeasons(seasonsData);
      if (seasonsData.length > 0) {
        const savedSeasonId = localStorage.getItem('tasks_active_season');
        const currentYear = new Date().getFullYear();
        const currentSeason = seasonsData.find(s => s.year === currentYear);
        const season = savedSeasonId ? seasonsData.find(s => s.id === savedSeasonId) || (currentSeason || seasonsData[0]) : (currentSeason || seasonsData[0]);
        setActiveSeason(season);
      }
    } catch (error) { console.error('Error loading seasons:', error); }
  };

  const loadTasksAndCrops = async () => {
    if (!activeSeason) return;
    try {
      const currentUser = await base44.auth.me();
      const [cropsData, gardenTasksData, indoorTasksData] = await Promise.all([
        smartQuery(base44, 'CropPlan', { garden_season_id: activeSeason.id, created_by: currentUser.email }),
        smartQuery(base44, 'CropTask', { garden_season_id: activeSeason.id, created_by: currentUser.email }, 'start_date'),
        base44.entities.IndoorCareTask.filter({ created_by: currentUser.email }, 'due_date')
      ]);

      const enrichedIndoorTasks = await Promise.all(
        indoorTasksData.map(async (t) => {
          if (t.indoor_plant_id) {
            try {
              const plants = await base44.entities.IndoorPlant.filter({ id: t.indoor_plant_id });
              const plant = plants[0];
              if (plant && plant.variety_id) {
                const varieties = await base44.entities.Variety.filter({ id: plant.variety_id });
                const variety = varieties[0];
                return {
                  ...t,
                  title: `${t.task_type === 'water' ? '💧 Water' : t.task_type === 'fertilize' ? '🌱 Fertilize' : t.task_type === 'rotate' ? '🔄 Rotate' : t.task_type === 'mist' ? '💨 Mist' : '📝'} ${plant.nickname || variety?.variety_name || 'Plant'}`,
                  plant_name: plant.nickname || variety?.variety_name
                };
              }
            } catch (error) { console.error('Error enriching indoor task:', error); }
          }
          return { ...t, title: t.title || `${t.task_type} task` };
        })
      );

      const allTasks = [
        ...gardenTasksData.map(t => ({ ...t, source: 'garden', category: 'outdoor', date_field: 'start_date' })),
        ...enrichedIndoorTasks.map(t => ({ ...t, source: 'indoor', category: 'indoor', date_field: 'due_date', start_date: t.due_date }))
      ].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

      setCropPlans(cropsData);
      setTasks(allTasks);

      // Auto-generate indoor care tasks if plants exist but have no pending tasks
      generateIndoorCareTasksIfNeeded(currentUser, indoorTasksData);
    } catch (error) { console.error('Error loading tasks/crops:', error); }
  };

  const generateIndoorCareTasksIfNeeded = async (currentUser, existingIndoorTasks) => {
    try {
      // Load all indoor plants
      const plants = await base44.entities.IndoorPlant.filter({ created_by: currentUser.email });
      if (plants.length === 0) return;

      // Get plant IDs that already have pending (non-completed) tasks
      const plantsWithPendingTasks = new Set();
      existingIndoorTasks.forEach(t => {
        if (!t.is_completed && t.indoor_plant_id) {
          plantsWithPendingTasks.add(t.indoor_plant_id);
        }
      });

      // Find plants that need task generation
      const plantsNeedingTasks = plants.filter(p => !plantsWithPendingTasks.has(p.id));
      if (plantsNeedingTasks.length === 0) return;

      console.log(`[Tasks] Generating care tasks for ${plantsNeedingTasks.length} indoor plants`);
      const now = new Date();
      let tasksCreated = 0;

      for (const plant of plantsNeedingTasks) {
        try {
          // Load variety for care schedule info
          let variety = null;
          if (plant.variety_id) {
            try {
              const varieties = await base44.entities.Variety.filter({ id: plant.variety_id });
              variety = varieties[0];
            } catch (e) { /* ignore */ }
          }

          const plantName = plant.nickname || variety?.variety_name || 'Plant';
          
          // Parse watering frequency (default every 7 days)
          let wateringDays = 7;
          if (variety?.watering_frequency_range) {
            const match = variety.watering_frequency_range.match(/(\d+)/);
            if (match) wateringDays = parseInt(match[1]);
          }

          // Parse fertilizer frequency (default every 30 days)
          let fertilizerDays = 30;
          if (variety?.fertilizer_frequency) {
            const freq = variety.fertilizer_frequency.toLowerCase();
            if (freq.includes('week')) fertilizerDays = 7;
            else if (freq.includes('bi-week') || freq.includes('biweek')) fertilizerDays = 14;
            else if (freq.includes('month')) fertilizerDays = 30;
            else if (freq.includes('quarter')) fertilizerDays = 90;
            else {
              const match = freq.match(/(\d+)/);
              if (match) fertilizerDays = parseInt(match[1]);
            }
          }

          // Calculate next water date
          const lastWatered = plant.last_watered_date ? new Date(plant.last_watered_date) : null;
          const nextWaterDate = lastWatered ? addDays(lastWatered, wateringDays) : now;
          
          // Create water tasks for next 30 days
          let waterDate = new Date(nextWaterDate);
          if (isBefore(waterDate, now)) waterDate = now;
          
          for (let i = 0; i < 4 && waterDate <= addDays(now, 30); i++) {
            await base44.entities.IndoorCareTask.create({
              indoor_plant_id: plant.id,
              task_type: 'water',
              title: `💧 Water ${plantName}`,
              due_date: format(waterDate, 'yyyy-MM-dd'),
              is_completed: false
            });
            tasksCreated++;
            waterDate = addDays(waterDate, wateringDays);
          }

          // Create fertilizer task if needed
          const lastFertilized = plant.last_fertilized_date ? new Date(plant.last_fertilized_date) : null;
          const nextFertDate = lastFertilized ? addDays(lastFertilized, fertilizerDays) : addDays(now, 7);
          if (nextFertDate <= addDays(now, 45)) {
            await base44.entities.IndoorCareTask.create({
              indoor_plant_id: plant.id,
              task_type: 'fertilize',
              title: `🌿 Fertilize ${plantName}`,
              due_date: format(nextFertDate > now ? nextFertDate : addDays(now, 7), 'yyyy-MM-dd'),
              is_completed: false
            });
            tasksCreated++;
          }

          // Create rotate task (every 14 days)
          const lastRotated = plant.last_rotated_date ? new Date(plant.last_rotated_date) : null;
          const nextRotateDate = lastRotated ? addDays(lastRotated, 14) : addDays(now, 3);
          if (nextRotateDate <= addDays(now, 30)) {
            await base44.entities.IndoorCareTask.create({
              indoor_plant_id: plant.id,
              task_type: 'rotate',
              title: `🔄 Rotate ${plantName}`,
              due_date: format(nextRotateDate > now ? nextRotateDate : addDays(now, 3), 'yyyy-MM-dd'),
              is_completed: false
            });
            tasksCreated++;
          }

          // Misting if variety indicates it's beneficial
          if (variety?.misting_beneficial === 'true' || variety?.misting_beneficial === 'Yes') {
            await base44.entities.IndoorCareTask.create({
              indoor_plant_id: plant.id,
              task_type: 'mist',
              title: `💨 Mist ${plantName}`,
              due_date: format(addDays(now, 1), 'yyyy-MM-dd'),
              is_completed: false
            });
            tasksCreated++;
          }

          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 300));
        } catch (plantError) {
          console.error(`Error generating tasks for plant ${plant.id}:`, plantError);
        }
      }

      if (tasksCreated > 0) {
        console.log(`[Tasks] Created ${tasksCreated} indoor care tasks`);
        toast.success(`Generated ${tasksCreated} indoor care tasks for ${plantsNeedingTasks.length} plants`);
        // Reload tasks to show the new ones
        const refreshedIndoorTasks = await base44.entities.IndoorCareTask.filter({ created_by: currentUser.email }, 'due_date');
        const enriched = await Promise.all(
          refreshedIndoorTasks.map(async (t) => {
            if (t.indoor_plant_id) {
              try {
                const ps = await base44.entities.IndoorPlant.filter({ id: t.indoor_plant_id });
                const p = ps[0];
                if (p && p.variety_id) {
                  const vs = await base44.entities.Variety.filter({ id: p.variety_id });
                  const v = vs[0];
                  return { ...t, title: t.title || `${t.task_type} ${p.nickname || v?.variety_name || 'Plant'}`, plant_name: p.nickname || v?.variety_name };
                }
              } catch (e) { /* ignore */ }
            }
            return { ...t, title: t.title || `${t.task_type} task` };
          })
        );
        setTasks(prev => {
          const nonIndoor = prev.filter(t => t.source !== 'indoor');
          const newIndoor = enriched.map(t => ({ ...t, source: 'indoor', category: 'indoor', date_field: 'due_date', start_date: t.due_date }));
          return [...nonIndoor, ...newIndoor].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        });
      }
    } catch (error) {
      console.error('Error generating indoor care tasks:', error);
    }
  };

  const handleToggleComplete = async (task) => {
    const newCompleted = !task.is_completed;
    setTasks(tasks.map(t => t.id === task.id ? { ...t, is_completed: newCompleted, quantity_completed: newCompleted ? task.quantity_target : 0 } : t));
    try {
      if (task.source === 'indoor') {
        await base44.entities.IndoorCareTask.update(task.id, { is_completed: newCompleted, completed_date: newCompleted ? new Date().toISOString() : null });
        if (newCompleted) {
          await base44.entities.IndoorPlantLog.create({ indoor_plant_id: task.indoor_plant_id, log_type: task.task_type, log_date: new Date().toISOString() });
          const updates = {};
          if (task.task_type === 'water') updates.last_watered_date = new Date().toISOString();
          if (task.task_type === 'fertilize') updates.last_fertilized_date = new Date().toISOString();
          if (task.task_type === 'rotate') updates.last_rotated_date = new Date().toISOString();
          if (Object.keys(updates).length > 0) await base44.entities.IndoorPlant.update(task.indoor_plant_id, updates);
        }
      } else {
        await base44.entities.CropTask.update(task.id, { is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null, quantity_completed: newCompleted ? task.quantity_target : 0 });
      }
    } catch (error) {
      console.error('Error toggling task:', error);
      setTasks(tasks.map(t => t.id === task.id ? task : t));
      toast.error('Failed to update task');
    }
  };

  const getFilteredTasks = () => {
    return tasks.filter(task => {
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
      if (taskTypeFilter !== 'all' && task.task_type !== taskTypeFilter) return false;
      if (statusFilter === 'completed' && !task.is_completed) return false;
      if (statusFilter === 'open' && task.is_completed) return false;
      if (cropFilter !== 'all' && task.crop_plan_id !== cropFilter) return false;
      return true;
    });
  };

  const groupTasksByDate = (tasks) => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const in7Days = addDays(now, 7);
    const in30Days = addDays(now, 30);
    const overdue = [], next7 = [], next30 = [], later = [];
    tasks.forEach(task => {
      if (!task.start_date || task.is_completed) return;
      const taskDate = parseISO(task.start_date); taskDate.setHours(0, 0, 0, 0);
      if (isBefore(taskDate, now)) overdue.push(task);
      else if (isBefore(taskDate, in7Days)) next7.push(task);
      else if (isBefore(taskDate, in30Days)) next30.push(task);
      else later.push(task);
    });
    return { overdue, next7, next30, later };
  };

  const filteredTasks = getFilteredTasks();
  const { overdue, next7, next30, later } = groupTasksByDate(filteredTasks);
  const indoorCount = tasks.filter(t => t.source === 'indoor').length;
  const outdoorCount = tasks.filter(t => t.source === 'garden').length;
  const urgentCount = tasks.filter(t => t.priority === 'high' && !t.is_completed).length;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  if (gardens.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center">
          <CalendarIcon className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Gardens Yet</h2>
          <p className="text-gray-600 mb-6">Create a garden to start tracking tasks</p>
        </Card>
      </div>
    );
  }

  /* =========================================
     TASK ROW COMPONENT (shared by list + calendar detail)
     ========================================= */
  const TaskRow = ({ task }) => {
    const crop = cropPlans.find(c => c.id === task.crop_plan_id);
    const typeInfo = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.cultivate;
    const Icon = typeInfo.icon;
    const progress = task.quantity_target > 0 ? (task.quantity_completed || 0) / task.quantity_target : 0;
    return (
      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
        <Checkbox checked={task.is_completed} onCheckedChange={() => handleToggleComplete(task)} className="flex-shrink-0" />
        <div className={cn("p-2 rounded-lg flex-shrink-0", typeInfo.color)}><Icon className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("font-medium text-sm", task.is_completed && "line-through text-gray-500")}>{task.title}</p>
            {task.source === 'indoor' && <Badge className="bg-emerald-100 text-emerald-700 text-xs">🪴 Indoor</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-500">{format(parseISO(task.start_date), 'MMM d, yyyy')}</p>
            {crop && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: crop.color_hex || '#10b981' }} />
                <span className="text-xs text-gray-500">{crop.label}</span>
              </div>
            )}
          </div>
          {task.quantity_target > 1 && (
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
              <span>{task.quantity_completed || 0} / {task.quantity_target}</span>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          )}
        </div>
        <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
      </div>
    );
  };

  const TaskGroup = ({ title, tasks: groupTasks, colorClass }) => {
    if (groupTasks.length === 0) return null;
    return (
      <div className="space-y-2">
        <h3 className={cn("font-semibold text-sm flex items-center gap-2", colorClass)}>
          {title}<Badge variant="secondary">{groupTasks.length}</Badge>
        </h3>
        <div className="space-y-2">
          {groupTasks.map(task => <TaskRow key={task.id} task={task} />)}
        </div>
      </div>
    );
  };

  /* =========================================
     MONTH CALENDAR GRID (for Calendar View mode)
     ========================================= */
  const MonthCalendarGrid = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const startDayOfWeek = getDay(monthStart);
    const daysInMonth = getDaysInMonth(calendarMonth);
    const monthYear = calendarMonth.getFullYear();
    const monthIndex = calendarMonth.getMonth();

    // Get tasks for this month
    const getTasksForDay = (date) => {
      return filteredTasks.filter(task => {
        if (!task.start_date) return false;
        const tStart = parseLocalDate(task.start_date);
        const tEnd = task.end_date ? parseLocalDate(task.end_date) : tStart;
        if (!tStart) return false;
        return date >= tStart && date <= tEnd;
      });
    };

    // Get tasks for selected date (for detail panel below)
    const selectedDayTasks = selectedCalendarDate
      ? filteredTasks.filter(task => {
          if (!task.start_date) return false;
          const tStart = parseLocalDate(task.start_date);
          const tEnd = task.end_date ? parseLocalDate(task.end_date) : tStart;
          if (!tStart) return false;
          return selectedCalendarDate >= tStart && selectedCalendarDate <= tEnd;
        })
      : [];

    // Build weeks for spanning bars
    function getWeeks() {
      const weeks = [];
      const firstSunday = new Date(monthYear, monthIndex, 1 - startDayOfWeek);
      let cursor = new Date(firstSunday);
      const lastDay = new Date(monthYear, monthIndex, daysInMonth);
      
      while (cursor <= lastDay) {
        const days = [];
        for (let d = 0; d < 7; d++) {
          days.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + d));
        }
        weeks.push(days);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      }
      return weeks;
    }

    function getTaskBars(weekDays) {
      const wkStart = new Date(weekDays[0]); wkStart.setHours(0,0,0,0);
      const wkEnd = new Date(weekDays[6]); wkEnd.setHours(23,59,59,999);

      const bars = [];
      filteredTasks.forEach(task => {
        if (!task.start_date) return;
        const tStart = parseLocalDate(task.start_date);
        const tEnd = task.end_date ? parseLocalDate(task.end_date) : new Date(tStart);
        if (!tStart) return;
        tStart.setHours(0,0,0,0);
        tEnd.setHours(23,59,59,999);
        if (tStart <= wkEnd && tEnd >= wkStart) {
          const crop = cropPlans.find(c => c.id === task.crop_plan_id);
          const startCol = tStart < wkStart ? 0 : tStart.getDay();
          const endCol = tEnd > wkEnd ? 6 : tEnd.getDay();
          const continuesFrom = tStart < wkStart;
          const continuesTo = tEnd > wkEnd;
          bars.push({ task, crop, startCol, endCol, continuesFrom, continuesTo, row: 0 });
        }
      });

      bars.sort((a, b) => {
        const aLen = a.endCol - a.startCol;
        const bLen = b.endCol - b.startCol;
        if (bLen !== aLen) return bLen - aLen;
        return a.startCol - b.startCol;
      });

      const rowEnds = [];
      bars.forEach(bar => {
        let placed = false;
        for (let r = 0; r < rowEnds.length; r++) {
          if (bar.startCol > rowEnds[r]) {
            rowEnds[r] = bar.endCol;
            bar.row = r;
            placed = true;
            break;
          }
        }
        if (!placed) {
          bar.row = rowEnds.length;
          rowEnds.push(bar.endCol);
        }
      });
      return bars;
    }

    const weeks = getWeeks();
    const MAX_BARS = 3;
    const BAR_H = 20;
    const BAR_GAP = 2;
    const DAY_NUM_H = 22;

    return (
      <div className="space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => setCalendarMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-bold text-gray-800">{format(calendarMonth, 'MMMM yyyy')}</h3>
          <Button variant="outline" size="icon" onClick={() => setCalendarMonth(m => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[11px] font-semibold py-2 text-gray-500 border-r last:border-r-0 uppercase tracking-wide">{d}</div>
            ))}
          </div>

          {/* Week rows with spanning bars */}
          {weeks.map((weekDays, weekIdx) => {
            const bars = getTaskBars(weekDays);
            const visibleBars = bars.filter(b => b.row < MAX_BARS);
            const hiddenCount = bars.filter(b => b.row >= MAX_BARS).length;
            const totalBarRows = Math.min(bars.length > 0 ? Math.max(...bars.map(b => b.row)) + 1 : 0, MAX_BARS);
            const rowHeight = DAY_NUM_H + totalBarRows * (BAR_H + BAR_GAP) + (hiddenCount > 0 ? 16 : 0) + 8;

            return (
              <div key={weekIdx} className="relative border-b last:border-b-0" style={{ minHeight: `${Math.max(rowHeight, 70)}px` }}>
                {/* Day cells */}
                <div className="grid grid-cols-7 absolute inset-0">
                  {weekDays.map((day, dayIdx) => {
                    const isCurrentMonth = day.getMonth() === monthIndex;
                    const isToday = sameDay(day, today);
                    const isSelected = selectedCalendarDate && sameDay(day, selectedCalendarDate);
                    return (
                      <div
                        key={dayIdx}
                        className={cn(
                          "border-r last:border-r-0 cursor-pointer transition-colors",
                          !isCurrentMonth && "bg-gray-50/70",
                          isCurrentMonth && "hover:bg-emerald-50/40",
                          isToday && "bg-amber-50/60",
                          isSelected && "bg-emerald-50 ring-2 ring-inset ring-emerald-400"
                        )}
                        onClick={() => isCurrentMonth && setSelectedCalendarDate(day)}
                      >
                        <div className="flex justify-end p-1.5">
                          <span className={cn(
                            "text-xs font-medium",
                            isToday && "bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-[11px] font-bold",
                            !isCurrentMonth && "text-gray-300",
                            isCurrentMonth && !isToday && "text-gray-600"
                          )}>
                            {day.getDate()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Spanning task bars */}
                <div className="relative pointer-events-none" style={{ paddingTop: `${DAY_NUM_H}px` }}>
                  {visibleBars.map(bar => {
                    const leftPct = (bar.startCol / 7) * 100;
                    const widthPct = ((bar.endCol - bar.startCol + 1) / 7) * 100;
                    const topPx = bar.row * (BAR_H + BAR_GAP);
                    const crop = bar.crop;
                    const bgColor = crop?.color_hex || bar.task.color_hex || '#10b981';
                    const typeInfo = TASK_TYPE_CONFIG[bar.task.task_type];
                    const icon = typeInfo?.emoji || '📋';
                    let borderRadius = '4px';
                    if (bar.continuesFrom && bar.continuesTo) borderRadius = '0px';
                    else if (bar.continuesFrom) borderRadius = '0 4px 4px 0';
                    else if (bar.continuesTo) borderRadius = '4px 0 0 4px';

                    return (
                      <div
                        key={`${bar.task.id}-w${weekIdx}`}
                        className="absolute pointer-events-auto cursor-pointer hover:brightness-110 hover:shadow-md transition-all"
                        style={{
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          top: `${topPx}px`,
                          height: `${BAR_H}px`,
                          backgroundColor: bgColor,
                          borderRadius,
                          opacity: bar.task.is_completed ? 0.5 : 1,
                          zIndex: 10,
                        }}
                        title={`${crop?.label || ''}: ${bar.task.title}`}
                        onClick={(e) => { e.stopPropagation(); setSelectedCalendarDate(parseLocalDate(bar.task.start_date)); }}
                      >
                        <div className="flex items-center h-full px-1.5 gap-0.5 overflow-hidden">
                          <span className="text-[11px] flex-shrink-0">{icon}</span>
                          <span className="text-[11px] text-white font-semibold truncate">{crop?.label || bar.task.title}</span>
                          {bar.task.is_completed && <span className="text-white text-[10px] ml-auto flex-shrink-0 opacity-70">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                  {hiddenCount > 0 && (
                    <div className="pointer-events-auto text-[10px] text-gray-500 font-semibold pl-2 hover:text-emerald-600 cursor-pointer"
                      style={{ marginTop: `${totalBarRows * (BAR_H + BAR_GAP)}px` }}>
                      +{hiddenCount} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected date task detail */}
        {selectedCalendarDate && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
                📅 Tasks for {format(selectedCalendarDate, 'EEEE, MMMM d, yyyy')}
                <Badge variant="secondary">{selectedDayTasks.length}</Badge>
              </h3>
              {selectedDayTasks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No tasks for this date</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayTasks.map(task => <TaskRow key={task.id} task={task} />)}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {rateLimitError && (
        <RateLimitBanner retryInMs={rateLimitError.retryInMs || 5000} onRetry={() => loadData(true)} retrying={retrying} />
      )}
      
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Planting schedules and plant care</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="outdoor">🌱 Garden</SelectItem>
              <SelectItem value="indoor">🪴 Indoor</SelectItem>
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="list">📋 List View</SelectItem>
              <SelectItem value="calendar">📅 Calendar View</SelectItem>
              <SelectItem value="kanban">📊 Kanban Board</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activeGarden?.id} onValueChange={(id) => {
            const garden = gardens.find(g => g.id === id);
            setActiveGarden(garden);
            localStorage.setItem('tasks_active_garden', id);
          }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select garden" /></SelectTrigger>
            <SelectContent>
              {gardens.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={activeSeason?.id} onValueChange={(id) => {
            const season = seasons.find(s => s.id === id);
            setActiveSeason(season);
            localStorage.setItem('tasks_active_season', id);
          }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Season" /></SelectTrigger>
            <SelectContent>
              {seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.year} {s.season}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards - show for list and calendar views */}
      {viewMode !== 'kanban' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
              <p className="text-sm text-gray-600">Overdue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{next7.length}</p>
              <p className="text-sm text-gray-600">Next 7 Days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{next30.length}</p>
              <p className="text-sm text-gray-600">Next 30 Days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-600">{tasks.filter(t => t.is_completed).length}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!activeSeason ? (
        <Card className="p-8 text-center">
          <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Select a garden and season to view tasks</p>
        </Card>
      ) : tasks.length === 0 ? (
        <Card className="p-8 text-center">
          <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">No tasks yet</p>
          <p className="text-sm text-gray-500">Add crops in Calendar Planner or plants to generate tasks</p>
        </Card>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard tasks={filteredTasks} cropPlans={cropPlans} onTaskUpdate={loadTasksAndCrops} />
      ) : viewMode === 'calendar' ? (
        /* ★ THE ACTUAL CALENDAR VIEW ★ */
        <MonthCalendarGrid />
      ) : (
        /* List View */
        <div className="space-y-6">
          <TaskGroup title="⚠️ Overdue" tasks={overdue} colorClass="text-red-600" />
          <TaskGroup title="📅 Next 7 Days" tasks={next7} colorClass="text-amber-600" />
          <TaskGroup title="🗓️ Next 30 Days" tasks={next30} colorClass="text-emerald-600" />
          {later.length > 0 && <TaskGroup title="📆 Later" tasks={later} colorClass="text-gray-600" />}
        </div>
      )}
    </div>
  );
}
