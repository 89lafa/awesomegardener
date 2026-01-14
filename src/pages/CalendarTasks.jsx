import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Plus, 
  Calendar as CalendarIcon,
  Filter,
  Loader2,
  CheckCircle2,
  Circle,
  Sprout,
  Shovel,
  Droplets,
  TreeDeciduous,
  Scissors,
  Bug,
  Leaf
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format, parseISO, isBefore, isAfter, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import DayTasksPanel from '@/components/calendar/DayTasksPanel';
import { format as formatDate, getDaysInMonth, startOfMonth } from 'date-fns';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';

const TASK_TYPE_CONFIG = {
  seed: { icon: Sprout, color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Start Seeds' },
  direct_seed: { icon: Leaf, color: 'bg-green-100 text-green-700 border-green-200', label: 'Direct Sow' },
  transplant: { icon: Shovel, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Transplant' },
  harvest: { icon: CalendarIcon, color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Harvest' },
  cultivate: { icon: Scissors, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Cultivate' },
  bed_prep: { icon: Shovel, color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Bed Prep' }
};

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
  const [cropFilter, setCropFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGarden) {
      loadSeasons();
    }
  }, [activeGarden]);

  useEffect(() => {
    if (activeSeason) {
      loadTasksAndCrops();
    }
  }, [activeSeason]);

  const loadData = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const gardensData = await smartQuery(base44, 'Garden', { 
        archived: false, 
        created_by: userData.email 
      }, '-updated_date');
      setGardens(gardensData);
      setRateLimitError(null);

      if (gardensData.length > 0) {
        const savedGardenId = localStorage.getItem('tasks_active_garden');
        const garden = savedGardenId 
          ? gardensData.find(g => g.id === savedGardenId) || gardensData[0]
          : gardensData[0];
        setActiveGarden(garden);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      if (error.code === 'RATE_LIMIT') {
        setRateLimitError(error);
        setTimeout(() => loadData(true), error.retryInMs || 5000);
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  const loadSeasons = async () => {
    if (!activeGarden) return;

    try {
      const seasonsData = await base44.entities.GardenSeason.filter({ 
        garden_id: activeGarden.id 
      }, '-year');
      setSeasons(seasonsData);

      if (seasonsData.length > 0) {
        const savedSeasonId = localStorage.getItem('tasks_active_season');
        const currentYear = new Date().getFullYear();
        const currentSeason = seasonsData.find(s => s.year === currentYear);

        const season = savedSeasonId 
          ? seasonsData.find(s => s.id === savedSeasonId) || (currentSeason || seasonsData[0])
          : (currentSeason || seasonsData[0]);
        setActiveSeason(season);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
    }
  };

  const loadTasksAndCrops = async () => {
    if (!activeSeason) return;

    try {
      const [cropsData, tasksData] = await Promise.all([
        smartQuery(base44, 'CropPlan', { garden_season_id: activeSeason.id }),
        smartQuery(base44, 'CropTask', { garden_season_id: activeSeason.id }, 'start_date')
      ]);

      setCropPlans(cropsData);
      setTasks(tasksData);
      console.log('[Tasks] Loaded', cropsData.length, 'crops and', tasksData.length, 'tasks for season', activeSeason.year, activeSeason.season);
    } catch (error) {
      console.error('Error loading tasks/crops:', error);
    }
  };

  const handleToggleComplete = async (task) => {
    try {
      const newCompleted = !task.is_completed;
      await base44.entities.CropTask.update(task.id, { 
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
        quantity_completed: newCompleted ? task.quantity_target : 0
      });

      setTasks(tasks.map(t => t.id === task.id ? { 
        ...t, 
        is_completed: newCompleted,
        quantity_completed: newCompleted ? task.quantity_target : 0
      } : t));
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const getFilteredTasks = () => {
    return tasks.filter(task => {
      if (taskTypeFilter !== 'all' && task.task_type !== taskTypeFilter) return false;
      if (statusFilter === 'completed' && !task.is_completed) return false;
      if (statusFilter === 'open' && task.is_completed) return false;
      if (cropFilter !== 'all' && task.crop_plan_id !== cropFilter) return false;
      return true;
    });
  };

  const groupTasksByDate = (tasks) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const in7Days = addDays(now, 7);
    const in30Days = addDays(now, 30);

    const overdue = [];
    const next7 = [];
    const next30 = [];
    const later = [];

    tasks.forEach(task => {
      if (!task.start_date) return;
      
      const taskDate = parseISO(task.start_date);
      taskDate.setHours(0, 0, 0, 0);

      if (task.is_completed) return; // Skip completed

      if (isBefore(taskDate, now)) {
        overdue.push(task);
      } else if (isBefore(taskDate, in7Days)) {
        next7.push(task);
      } else if (isBefore(taskDate, in30Days)) {
        next30.push(task);
      } else {
        later.push(task);
      }
    });

    return { overdue, next7, next30, later };
  };

  const filteredTasks = getFilteredTasks();
  const { overdue, next7, next30, later } = groupTasksByDate(filteredTasks);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
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

  const TaskGroup = ({ title, tasks: groupTasks, colorClass }) => {
    if (groupTasks.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className={cn("font-semibold text-sm flex items-center gap-2", colorClass)}>
          {title}
          <Badge variant="secondary">{groupTasks.length}</Badge>
        </h3>
        <div className="space-y-2">
          {groupTasks.map(task => {
            const crop = cropPlans.find(c => c.id === task.crop_plan_id);
            const typeInfo = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.cultivate;
            const Icon = typeInfo.icon;
            const progress = task.quantity_target > 0 ? (task.quantity_completed || 0) / task.quantity_target : 0;

            return (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow"
              >
                <Checkbox
                  checked={task.is_completed}
                  onCheckedChange={() => handleToggleComplete(task)}
                  className="flex-shrink-0"
                />
                <div className={cn("p-2 rounded-lg flex-shrink-0", typeInfo.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-medium text-sm", task.is_completed && "line-through text-gray-500")}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">
                      {format(parseISO(task.start_date), 'MMM d, yyyy')}
                    </p>
                    {crop && (
                      <div className="flex items-center gap-1">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: crop.color_hex || '#10b981' }}
                        />
                        <span className="text-xs text-gray-500">{crop.label}</span>
                      </div>
                    )}
                  </div>
                  {task.quantity_target > 1 && (
                    <div className="mt-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>{task.quantity_completed || 0} / {task.quantity_target}</span>
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                          <div 
                            className="h-full bg-emerald-600 transition-all"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {rateLimitError && (
        <RateLimitBanner 
          retryInMs={rateLimitError.retryInMs || 5000} 
          onRetry={() => loadData(true)}
          retrying={retrying}
        />
      )}
      
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Planting schedules and garden maintenance</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">List View</SelectItem>
              <SelectItem value="calendar">Calendar View</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activeGarden?.id} onValueChange={(id) => {
            const garden = gardens.find(g => g.id === id);
            setActiveGarden(garden);
            localStorage.setItem('tasks_active_garden', id);
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select garden" />
            </SelectTrigger>
            <SelectContent>
              {gardens.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={activeSeason?.id} onValueChange={(id) => {
            const season = seasons.find(s => s.id === id);
            setActiveSeason(season);
            localStorage.setItem('tasks_active_season', id);
          }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.year} {s.season}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Task Types</SelectItem>
              <SelectItem value="seed">Start Seeds</SelectItem>
              <SelectItem value="direct_seed">Direct Sow</SelectItem>
              <SelectItem value="transplant">Transplant</SelectItem>
              <SelectItem value="harvest">Harvest</SelectItem>
              <SelectItem value="cultivate">Maintenance</SelectItem>
              <SelectItem value="bed_prep">Bed Prep</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {cropPlans.length > 0 && (
            <Select value={cropFilter} onValueChange={setCropFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Crops" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Crops</SelectItem>
                {cropPlans.map(crop => (
                  <SelectItem key={crop.id} value={crop.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: crop.color_hex || '#10b981' }}
                      />
                      {crop.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!activeSeason ? (
        <Card className="p-8 text-center">
          <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Select a garden and season to view tasks</p>
        </Card>
      ) : tasks.length === 0 ? (
        <Card className="p-8 text-center">
          <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">No tasks for this season yet</p>
          <p className="text-sm text-gray-500">Add crops in Calendar Planner to generate tasks</p>
        </Card>
      ) : viewMode === 'calendar' ? (
        <CalendarView 
          tasks={filteredTasks}
          crops={cropPlans}
          season={activeSeason}
          onTaskClick={(task) => {
            handleToggleComplete(task);
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Summary */}
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
                <p className="text-2xl font-bold text-gray-600">
                  {tasks.filter(t => t.is_completed).length}
                </p>
                <p className="text-sm text-gray-600">Completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Task Groups */}
          <div className="space-y-6">
            <TaskGroup 
              title="⚠️ Overdue" 
              tasks={overdue} 
              colorClass="text-red-600" 
            />
            <TaskGroup 
              title="📅 Next 7 Days" 
              tasks={next7} 
              colorClass="text-amber-600" 
            />
            <TaskGroup 
              title="🗓️ Next 30 Days" 
              tasks={next30} 
              colorClass="text-emerald-600" 
            />
            {later.length > 0 && (
              <TaskGroup 
                title="📆 Later" 
                tasks={later} 
                colorClass="text-gray-600" 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Calendar View for Tasks
function CalendarView({ tasks, crops, season, onTaskClick }) {
  if (!season) return <div className="text-center text-gray-500 p-8">Select a season to view calendar</div>;

  const seasonYear = typeof season === 'string' ? parseInt(season.split('-')[0]) : season?.year;
  if (!seasonYear) return <div className="text-center text-gray-500 p-8">Invalid season</div>;

  const startDate = new Date(seasonYear, 0, 1);
  const months = Array.from({ length: 12 }, (_, i) => new Date(seasonYear, i, 1));

  return (
    <div className="space-y-0 border rounded-lg overflow-hidden bg-white">
      {months.map((month, monthIdx) => {
        const daysInMonth = getDaysInMonth(month);
        const monthStart = startOfMonth(month);
        const startDayOfWeek = monthStart.getDay();

        return (
          <div key={monthIdx} className="border-b last:border-b-0">
            {/* Month Header */}
            <div className="grid grid-cols-[100px_1fr] bg-gray-50 border-b">
              <div className="px-3 py-2 font-semibold text-sm border-r">
                {formatDate(month, 'MMMM')}
              </div>
              {monthIdx === 0 && (
                <div className="grid grid-cols-7">
                  {['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'].map((day, i) => (
                    <div key={i} className="text-center text-xs font-medium py-2 border-r last:border-r-0 text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-[100px_1fr]">
              <div className="border-r" />
              <div className="grid grid-cols-7">
                {/* Empty cells before month starts */}
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 border-r border-b bg-gray-50/50" />
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
                  const day = dayIdx + 1;
                  const currentDate = new Date(seasonYear, monthIdx, day);
                  currentDate.setHours(0, 0, 0, 0);

                  const dayTasks = tasks.filter(task => {
                    if (!task.start_date) return false;
                    const taskStart = new Date(task.start_date);
                    taskStart.setHours(0, 0, 0, 0);
                    const taskEnd = task.end_date ? new Date(task.end_date) : taskStart;
                    taskEnd.setHours(0, 0, 0, 0);
                    return currentDate >= taskStart && currentDate <= taskEnd;
                  });

                  return (
                    <div
                      key={day}
                      className="h-20 border-r border-b relative hover:bg-blue-50/30 p-1"
                    >
                      <div className="text-xs text-gray-400 font-medium mb-1">{day}</div>
                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 3).map((task) => {
                          const crop = crops.find(c => c.id === task.crop_plan_id);
                          const typeConfig = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.cultivate;

                          return (
                            <div
                              key={task.id}
                              className="text-[10px] px-1 py-0.5 rounded cursor-pointer truncate"
                              style={{ backgroundColor: task.color_hex || crop?.color_hex || '#10b981', color: 'white' }}
                              onClick={() => onTaskClick(task)}
                              title={`${crop?.label || 'Crop'}: ${task.title}`}
                            >
                              {crop?.label} - {typeConfig.label}
                            </div>
                          );
                        })}
                        {dayTasks.length > 3 && (
                          <div className="text-[9px] text-gray-500">+{dayTasks.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Fill remaining cells */}
                {Array.from({ length: (7 - ((startDayOfWeek + daysInMonth) % 7)) % 7 }).map((_, i) => (
                  <div key={`fill-${i}`} className="h-20 border-r border-b bg-gray-50/50" />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}