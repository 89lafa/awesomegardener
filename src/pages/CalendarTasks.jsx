import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Plus, Calendar as CalendarIcon, Filter, Loader2, CheckCircle2, Circle, Sprout, Shovel, Droplets,
  TreeDeciduous, Scissors, Bug, Leaf, Wind, RotateCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, parseISO, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';

const TASK_TYPE_CONFIG = {
  seed: { icon: Sprout, color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Start Seeds' },
  direct_seed: { icon: Leaf, color: 'bg-green-100 text-green-700 border-green-200', label: 'Direct Sow' },
  transplant: { icon: Shovel, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Transplant' },
  harvest: { icon: CalendarIcon, color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Harvest' },
  cultivate: { icon: Scissors, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Cultivate' },
  bed_prep: { icon: Shovel, color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Bed Prep' },
  water: { icon: Droplets, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Water' },
  fertilize: { icon: Sprout, color: 'bg-green-100 text-green-700 border-green-200', label: 'Fertilize' },
  mist: { icon: Wind, color: 'bg-cyan-100 text-cyan-700 border-cyan-200', label: 'Mist' },
  rotate: { icon: RotateCw, color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Rotate' },
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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cropFilter, setCropFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
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
        garden_id: activeGarden.id,
        created_by: user.email
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
      const currentUser = await base44.auth.me();
      
      const [cropsData, gardenTasksData, indoorTasksData] = await Promise.all([
        smartQuery(base44, 'CropPlan', { 
          garden_season_id: activeSeason.id,
          created_by: currentUser.email
        }),
        smartQuery(base44, 'CropTask', { 
          garden_season_id: activeSeason.id,
          created_by: currentUser.email
        }, 'start_date'),
        base44.entities.IndoorCareTask.filter({
          created_by: currentUser.email
        }, 'due_date')
      ]);

      // Enrich indoor tasks with plant names
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
            } catch (error) {
              console.error('Error enriching indoor task:', error);
            }
          }
          return { ...t, title: t.title || `${t.task_type} task` };
        })
      );

      const allTasks = [
        ...gardenTasksData.map(t => ({
          ...t,
          source: 'garden',
          category: 'outdoor',
          date_field: 'start_date'
        })),
        ...enrichedIndoorTasks.map(t => ({
          ...t,
          source: 'indoor',
          category: 'indoor',
          date_field: 'due_date',
          start_date: t.due_date
        }))
      ].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

      setCropPlans(cropsData);
      setTasks(allTasks);
    } catch (error) {
      console.error('Error loading tasks/crops:', error);
    }
  };

  const handleToggleComplete = async (task) => {
    const newCompleted = !task.is_completed;
    
    setTasks(tasks.map(t => t.id === task.id ? { 
      ...t, 
      is_completed: newCompleted,
      quantity_completed: newCompleted ? task.quantity_target : 0
    } : t));
    
    try {
      if (task.source === 'indoor') {
        await base44.entities.IndoorCareTask.update(task.id, { 
          is_completed: newCompleted,
          completed_date: newCompleted ? new Date().toISOString() : null
        });

        if (newCompleted) {
          await base44.entities.IndoorPlantLog.create({
            indoor_plant_id: task.indoor_plant_id,
            log_type: task.task_type,
            log_date: new Date().toISOString()
          });

          const updates = {};
          if (task.task_type === 'water') updates.last_watered_date = new Date().toISOString();
          if (task.task_type === 'fertilize') updates.last_fertilized_date = new Date().toISOString();
          if (task.task_type === 'rotate') updates.last_rotated_date = new Date().toISOString();

          if (Object.keys(updates).length > 0) {
            await base44.entities.IndoorPlant.update(task.indoor_plant_id, updates);
          }
        }
      } else {
        await base44.entities.CropTask.update(task.id, { 
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          quantity_completed: newCompleted ? task.quantity_target : 0
        });
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

      if (task.is_completed) return;

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

  const indoorCount = tasks.filter(t => t.source === 'indoor').length;
  const outdoorCount = tasks.filter(t => t.source === 'garden').length;
  const urgentCount = tasks.filter(t => t.priority === 'high' && !t.is_completed).length;

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
              <div key={task.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                <Checkbox checked={task.is_completed} onCheckedChange={() => handleToggleComplete(task)} className="flex-shrink-0" />
                <div className={cn("p-2 rounded-lg flex-shrink-0", typeInfo.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("font-medium text-sm", task.is_completed && "line-through text-gray-500")}>
                      {task.title}
                    </p>
                    {task.source === 'indoor' && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs">🪴 Indoor</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">
                      {format(parseISO(task.start_date), 'MMM d, yyyy')}
                    </p>
                    {crop && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: crop.color_hex || '#10b981' }} />
                        <span className="text-xs text-gray-500">{crop.label}</span>
                      </div>
                    )}
                  </div>
                  {task.quantity_target > 1 && (
                    <div className="mt-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>{task.quantity_completed || 0} / {task.quantity_target}</span>
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress * 100}%` }} />
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
          <p className="text-gray-600 mt-1">Planting schedules and plant care</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="outdoor">🌱 Garden</SelectItem>
              <SelectItem value="indoor">🪴 Indoor</SelectItem>
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
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
        </div>
      </div>

      {viewMode === 'list' && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center bg-blue-50">
              <div className="text-3xl font-bold text-blue-700">{outdoorCount}</div>
              <div className="text-sm text-blue-600">🌱 Garden Tasks</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-emerald-50">
              <div className="text-3xl font-bold text-emerald-700">{indoorCount}</div>
              <div className="text-sm text-emerald-600">🪴 Indoor Tasks</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center bg-red-50">
              <div className="text-3xl font-bold text-red-700">{urgentCount}</div>
              <div className="text-sm text-red-600">⚠️ Urgent</div>
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
        <KanbanBoard tasks={filteredTasks} onTaskUpdate={loadTasksAndCrops} />
      ) : (
        <div className="space-y-6">
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

          <div className="space-y-6">
            <TaskGroup title="⚠️ Overdue" tasks={overdue} colorClass="text-red-600" />
            <TaskGroup title="📅 Next 7 Days" tasks={next7} colorClass="text-amber-600" />
            <TaskGroup title="🗓️ Next 30 Days" tasks={next30} colorClass="text-emerald-600" />
            {later.length > 0 && <TaskGroup title="📆 Later" tasks={later} colorClass="text-gray-600" />}
          </div>
        </div>
      )}
    </div>
  );
}