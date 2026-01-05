import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Plus, 
  Calendar as CalendarIcon,
  Filter,
  Settings,
  Loader2,
  ChevronDown,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import AddCropModal from '@/components/calendar/AddCropModal';
import TaskDetailPanel from '@/components/calendar/TaskDetailPanel';
import { cn } from '@/lib/utils';

export default function Calendar() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [activeSeasonId, setActiveSeasonId] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [cropPlans, setCropPlans] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCrop, setShowAddCrop] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [timelineMonths, setTimelineMonths] = useState(18);
  const [viewStart, setViewStart] = useState(new Date());
  
  useEffect(() => {
    loadData();
  }, []);
  
  useEffect(() => {
    if (activeSeasonId) {
      loadPlansAndTasks();
    }
  }, [activeSeasonId]);
  
  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      const gardensData = await base44.entities.Garden.filter({ 
        archived: false, 
        created_by: userData.email 
      }, '-updated_date');
      setGardens(gardensData);
      
      if (gardensData.length > 0) {
        const garden = gardensData[0];
        setActiveGarden(garden);
        
        const seasonsData = await base44.entities.GardenSeason.filter({ 
          garden_id: garden.id 
        }, '-year');
        setSeasons(seasonsData);
        
        if (seasonsData.length > 0) {
          setActiveSeasonId(seasonsData[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadPlansAndTasks = async () => {
    try {
      const [plansData, tasksData] = await Promise.all([
        base44.entities.CropPlan.filter({ garden_season_id: activeSeasonId }),
        base44.entities.CropTask.filter({ garden_season_id: activeSeasonId })
      ]);
      setCropPlans(plansData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading plans/tasks:', error);
    }
  };
  
  const handleDeleteCrop = async (crop) => {
    if (!confirm(`Delete ${crop.label || 'this crop'}?`)) return;
    try {
      // Delete all tasks
      const cropTasks = tasks.filter(t => t.crop_plan_id === crop.id);
      for (const task of cropTasks) {
        await base44.entities.CropTask.delete(task.id);
      }
      // Delete plan
      await base44.entities.CropPlan.delete(crop.id);
      await loadPlansAndTasks();
      toast.success('Crop deleted');
    } catch (error) {
      console.error('Error deleting crop:', error);
      toast.error('Failed to delete crop');
    }
  };
  
  const handleDuplicateCrop = async (crop) => {
    try {
      const newCrop = await base44.entities.CropPlan.create({
        garden_season_id: crop.garden_season_id,
        plant_type_id: crop.plant_type_id,
        plant_profile_id: crop.plant_profile_id,
        variety_id: crop.variety_id,
        label: `${crop.label || 'Crop'} (Copy)`,
        color_hex: crop.color_hex,
        planting_method: crop.planting_method,
        date_mode: crop.date_mode,
        relative_anchor: crop.relative_anchor,
        seed_offset_days: crop.seed_offset_days,
        transplant_offset_days: crop.transplant_offset_days,
        direct_seed_offset_days: crop.direct_seed_offset_days,
        dtm_days: crop.dtm_days,
        harvest_window_days: crop.harvest_window_days
      });
      
      // Duplicate tasks
      const cropTasks = tasks.filter(t => t.crop_plan_id === crop.id);
      for (const task of cropTasks) {
        await base44.entities.CropTask.create({
          garden_season_id: task.garden_season_id,
          crop_plan_id: newCrop.id,
          task_type: task.task_type,
          title: task.title,
          start_date: task.start_date,
          end_date: task.end_date,
          color_hex: task.color_hex,
          how_to_content: task.how_to_content
        });
      }
      
      await loadPlansAndTasks();
      toast.success('Crop duplicated');
    } catch (error) {
      console.error('Error duplicating crop:', error);
      toast.error('Failed to duplicate crop');
    }
  };
  
  const filteredCrops = cropPlans.filter(crop => {
    if (searchQuery) {
      const label = crop.label?.toLowerCase() || '';
      if (!label.includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });
  
  const filteredTasks = tasks.filter(task => {
    if (taskFilter !== 'all' && task.task_type !== taskFilter) return false;
    return true;
  });
  
  const goToToday = () => {
    setViewStart(new Date());
  };
  
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
          <p className="text-gray-600 mb-6">Create a garden first to start planning crops</p>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Left Sidebar - My Crops */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg mb-3">My Crops</h2>
          <Input
            placeholder="Search crops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3"
          />
          <Button 
            onClick={() => setShowAddCrop(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Crop
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {filteredCrops.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No crops planned yet</p>
          ) : (
            <div className="space-y-1">
              {filteredCrops.map(crop => (
                <div
                  key={crop.id}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50",
                    selectedCrop?.id === crop.id && "bg-emerald-50 border border-emerald-200"
                  )}
                  onClick={() => setSelectedCrop(crop)}
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: crop.color_hex || '#10b981' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{crop.label || 'Unnamed Crop'}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDuplicateCrop(crop)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteCrop(crop)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Main Timeline Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Controls */}
        <div className="p-4 border-b bg-white flex items-center gap-3">
          <Select value={activeGarden?.id} onValueChange={(id) => {
            const garden = gardens.find(g => g.id === id);
            setActiveGarden(garden);
            // Load seasons for new garden
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
          
          <Select value={activeSeasonId} onValueChange={setActiveSeasonId}>
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
          
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          
          <Select value={timelineMonths.toString()} onValueChange={(v) => setTimelineMonths(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="18">18 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={taskFilter} onValueChange={setTaskFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter tasks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="bed_prep">Bed Prep</SelectItem>
              <SelectItem value="seed">Seeding</SelectItem>
              <SelectItem value="direct_seed">Direct Seed</SelectItem>
              <SelectItem value="transplant">Transplant</SelectItem>
              <SelectItem value="cultivate">Cultivate</SelectItem>
              <SelectItem value="harvest">Harvest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Timeline */}
        <div className="flex-1 overflow-auto bg-gray-50">
          <TimelineView 
            tasks={filteredTasks}
            crops={cropPlans}
            viewStart={viewStart}
            monthCount={timelineMonths}
            onTaskClick={setSelectedTask}
          />
        </div>
      </div>
      
      {/* Add Crop Modal */}
      <AddCropModal
        open={showAddCrop}
        onOpenChange={setShowAddCrop}
        seasonId={activeSeasonId}
        onSuccess={loadPlansAndTasks}
      />
      
      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

function TimelineView({ tasks, crops, viewStart, monthCount, onTaskClick }) {
  const months = [];
  for (let i = 0; i < monthCount; i++) {
    const month = addDays(startOfMonth(viewStart), i * 30);
    months.push(month);
  }
  
  return (
    <div className="min-w-max">
      {/* Month Headers */}
      <div className="flex sticky top-0 bg-white border-b z-10">
        <div className="w-40 flex-shrink-0 border-r p-2 font-semibold text-sm">
          Crop
        </div>
        {months.map((month, idx) => (
          <div key={idx} className="flex-1 min-w-[200px] border-r p-2 text-center">
            <div className="font-semibold">{format(month, 'MMM yyyy')}</div>
          </div>
        ))}
      </div>
      
      {/* Crop Rows */}
      {crops.map(crop => {
        const cropTasks = tasks.filter(t => t.crop_plan_id === crop.id);
        
        return (
          <div key={crop.id} className="flex border-b hover:bg-gray-50">
            <div className="w-40 flex-shrink-0 border-r p-2 flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: crop.color_hex || '#10b981' }}
              />
              <span className="text-sm truncate">{crop.label}</span>
            </div>
            
            <div className="flex-1 relative" style={{ height: '80px' }}>
              {cropTasks.map(task => {
                const taskStart = new Date(task.start_date);
                const taskEnd = task.end_date ? new Date(task.end_date) : taskStart;
                
                // Calculate position
                const daysSinceStart = Math.floor((taskStart - viewStart) / (1000 * 60 * 60 * 24));
                const duration = Math.floor((taskEnd - taskStart) / (1000 * 60 * 60 * 24)) + 1;
                const leftPercent = (daysSinceStart / (monthCount * 30)) * 100;
                const widthPercent = (duration / (monthCount * 30)) * 100;
                
                if (leftPercent < -widthPercent || leftPercent > 100) return null;
                
                return (
                  <div
                    key={task.id}
                    className="absolute top-2 rounded px-2 py-1 text-xs text-white cursor-pointer hover:opacity-90 transition-opacity"
                    style={{
                      left: `${Math.max(0, leftPercent)}%`,
                      width: `${Math.min(100 - Math.max(0, leftPercent), widthPercent)}%`,
                      backgroundColor: task.color_hex || crop.color_hex || '#10b981'
                    }}
                    onClick={() => onTaskClick(task)}
                  >
                    <div className="truncate font-medium">{task.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      {crops.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No crops planned yet. Click "Add Crop" to start planning.
        </div>
      )}
    </div>
  );
}