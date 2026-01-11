import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Loader2,
  TreeDeciduous,
  Sprout,
  Droplets,
  Scissors,
  Bug,
  Shovel,
  MoreVertical,
  Trash2,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import AdBanner from '@/components/monetization/AdBanner';

const TASK_TYPES = [
  { value: 'sow', label: 'Sow Seeds', icon: Sprout, color: 'bg-green-100 text-green-700' },
  { value: 'transplant', label: 'Transplant', icon: Shovel, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'water', label: 'Water', icon: Droplets, color: 'bg-blue-100 text-blue-700' },
  { value: 'fertilize', label: 'Fertilize', icon: TreeDeciduous, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'prune', label: 'Prune', icon: Scissors, color: 'bg-purple-100 text-purple-700' },
  { value: 'harvest', label: 'Harvest', icon: CalendarIcon, color: 'bg-orange-100 text-orange-700' },
  { value: 'spray', label: 'Spray/Treat', icon: Bug, color: 'bg-red-100 text-red-700' },
  { value: 'custom', label: 'Custom', icon: CalendarIcon, color: 'bg-gray-100 text-gray-700' },
];

export default function CalendarTasks() {
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [showAddDialog, setShowAddDialog] = useState(searchParams.get('action') === 'new');
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    type: 'custom',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    garden_id: '',
    plant_instance_id: '',
    recurrence: null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const [manualTasks, cropTasks, gardensData, plantsData] = await Promise.all([
        base44.entities.Task.filter({ created_by: user.email }, 'due_date'),
        base44.entities.CropTask.filter({}, 'start_date'),
        base44.entities.Garden.filter({ archived: false, created_by: user.email }),
        base44.entities.PlantInstance.filter({ created_by: user.email })
      ]);
      
      // Convert CropTasks to Task format for display
      const convertedCropTasks = cropTasks.map(ct => ({
        id: ct.id,
        title: ct.title,
        type: ct.task_type,
        due_date: ct.start_date,
        status: ct.is_completed ? 'done' : 'open',
        description: ct.notes || '',
        _isCropTask: true,
        _cropTaskData: ct
      }));
      
      setTasks([...manualTasks, ...convertedCropTasks]);
      setGardens(gardensData);
      setPlants(plantsData);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      if (editingTask) {
        await base44.entities.Task.update(editingTask.id, formData);
        setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...formData } : t));
        toast.success('Task updated!');
      } else {
        const task = await base44.entities.Task.create({
          ...formData,
          status: 'open'
        });
        setTasks([...tasks, task].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)));
        toast.success('Task created!');
      }
      closeDialog();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Failed to save task');
    }
  };

  const handleToggleStatus = async (task) => {
    const newStatus = task.status === 'done' ? 'open' : 'done';
    try {
      if (task._isCropTask) {
        await base44.entities.CropTask.update(task.id, { 
          is_completed: newStatus === 'done',
          completed_at: newStatus === 'done' ? new Date().toISOString() : null
        });
      } else {
        await base44.entities.Task.update(task.id, { 
          status: newStatus,
          completed_at: newStatus === 'done' ? new Date().toISOString() : null
        });
      }
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (task) => {
    try {
      await base44.entities.Task.delete(task.id);
      setTasks(tasks.filter(t => t.id !== task.id));
      toast.success('Task deleted');
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const openEditDialog = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title || '',
      type: task.type || 'custom',
      due_date: task.due_date || format(new Date(), 'yyyy-MM-dd'),
      description: task.description || '',
      garden_id: task.garden_id || '',
      plant_instance_id: task.plant_instance_id || '',
      recurrence: task.recurrence
    });
    setShowAddDialog(true);
  };

  const closeDialog = () => {
    setShowAddDialog(false);
    setEditingTask(null);
    setFormData({
      title: '',
      type: 'custom',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      garden_id: '',
      plant_instance_id: '',
      recurrence: null
    });
  };

  const openAddDialogForDate = (date) => {
    setSelectedDate(date);
    setFormData({
      ...formData,
      due_date: format(date, 'yyyy-MM-dd')
    });
    setShowAddDialog(true);
  };

  const getTasksForDate = (date) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(parseISO(task.due_date), date);
    });
  };

  const getTaskTypeInfo = (type) => {
    return TASK_TYPES.find(t => t.value === type) || TASK_TYPES[7];
  };

  const getDaysInMonthView = () => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  };

  const upcomingTasks = tasks
    .filter(t => t.status === 'open' && t.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 10);

  const overdueTasks = tasks.filter(t => 
    t.status === 'open' && 
    t.due_date && 
    isBefore(parseISO(t.due_date), new Date()) && 
    !isToday(parseISO(t.due_date))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Track planting schedules and garden tasks</p>
        </div>
        <Button 
          onClick={() => setShowAddDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Overdue Warning */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-medium text-red-800 mb-2">
            ⚠️ {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {overdueTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-center justify-between">
                <span className="text-sm text-red-700">{task.title}</span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => handleToggleStatus(task)}
                  className="text-red-600 hover:text-red-700"
                >
                  Mark Done
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-4">
              <CardTitle>Calendar</CardTitle>
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList className="h-8">
                  <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
                  <TabsTrigger value="list" className="text-xs">List</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium w-32 text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'month' ? (
              <div>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonthView().map((day) => {
                    const dayTasks = getTasksForDate(day);
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => openAddDialogForDate(day)}
                        className={cn(
                          "min-h-[80px] p-1 rounded-lg border cursor-pointer transition-colors",
                          isCurrentMonth ? "bg-white" : "bg-gray-50",
                          isToday(day) && "ring-2 ring-emerald-500",
                          "hover:bg-gray-50"
                        )}
                      >
                        <div className={cn(
                          "text-sm font-medium mb-1",
                          !isCurrentMonth && "text-gray-400",
                          isToday(day) && "text-emerald-600"
                        )}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-0.5">
                          {dayTasks.slice(0, 3).map((task) => {
                            const typeInfo = getTaskTypeInfo(task.type);
                            return (
                              <div
                                key={task.id}
                                onClick={(e) => { e.stopPropagation(); openEditDialog(task); }}
                                className={cn(
                                  "text-xs px-1 py-0.5 rounded truncate",
                                  typeInfo.color,
                                  task.status === 'done' && "opacity-50 line-through"
                                )}
                              >
                                {task.title}
                              </div>
                            );
                          })}
                          {dayTasks.length > 3 && (
                            <div className="text-xs text-gray-500 px-1">
                              +{dayTasks.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {tasks.filter(t => t.status === 'open').length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">No open tasks</p>
                  </div>
                ) : (
                  tasks.filter(t => t.status === 'open').map((task) => {
                    const typeInfo = getTaskTypeInfo(task.type);
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                      >
                        <Checkbox
                          checked={task.status === 'done'}
                          onCheckedChange={() => handleToggleStatus(task)}
                        />
                        <div className={cn("p-2 rounded-lg", typeInfo.color)}>
                          <typeInfo.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.title}</p>
                          <p className="text-sm text-gray-500">
                            {task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : 'No date'}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(task)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteTask(task)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingTasks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No upcoming tasks</p>
              ) : (
                <div className="space-y-2">
                  {upcomingTasks.map((task) => {
                    const typeInfo = getTaskTypeInfo(task.type);
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => openEditDialog(task)}
                      >
                        <div className={cn("p-1.5 rounded", typeInfo.color)}>
                          <typeInfo.icon className="w-3 h-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-gray-500">
                            {task.due_date ? format(parseISO(task.due_date), 'MMM d') : ''}
                          </p>
                        </div>
                        <Checkbox
                          checked={false}
                          onCheckedChange={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(task);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <AdBanner placement="side_banner" pageType="calendar" />
        </div>
      </div>

      {/* Add/Edit Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Start tomato seeds"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Task Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Garden (optional)</Label>
              <Select 
                value={formData.garden_id} 
                onValueChange={(v) => setFormData({ ...formData, garden_id: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select garden" />
                </SelectTrigger>
                <SelectContent>
                  {gardens.map((garden) => (
                    <SelectItem key={garden.id} value={garden.id}>{garden.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional notes..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.title.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {editingTask ? 'Save Changes' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}