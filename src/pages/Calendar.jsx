import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  RefreshCw,
  Download,
  ShoppingCart
} from 'lucide-react';
import { useSwipe } from '@/components/utils/useTouch';
import { Link } from 'react-router-dom';
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
import { format, addDays, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfYear, getDaysInMonth } from 'date-fns';
import AddCropModal from '@/components/calendar/AddCropModal';
import TaskDetailPanel from '@/components/calendar/TaskDetailPanel';
import CropEditModal from '@/components/calendar/CropEditModal';
import DayTasksPanel from '@/components/calendar/DayTasksPanel';
import CalendarGuide from '@/components/help/CalendarGuide';
import { cn } from '@/lib/utils';
import { smartQuery, clearCache } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import BuildCalendarWizard from '@/components/ai/BuildCalendarWizard';
import { getPlantTypesCached } from '@/components/utils/dataCache';
import { createPageUrl } from '@/utils';

export default function Calendar() {
  const [searchParams] = useSearchParams();
  const syncProcessedRef = React.useRef(false);
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [activeSeasonId, setActiveSeasonId] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [cropPlans, setCropPlans] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAddCrop, setShowAddCrop] = useState(false);
  const [showEditCrop, setShowEditCrop] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDayPanel, setShowDayPanel] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [timelineMonths, setTimelineMonths] = useState(12);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'timeline'
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Swipe support for month navigation
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => setCurrentMonth(m => addMonths(m, 1)),
    onSwipeRight: () => setCurrentMonth(m => addMonths(m, -1)),
  });
  
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const syncGrowListId = searchParams.get('syncGrowList');
    const seasonParam = searchParams.get('season');
    
    if (syncGrowListId && seasonParam && !syncing && !loading && seasons.length > 0 && !syncProcessedRef.current) {
      console.log('[Calendar] Sync params detected:', { syncGrowListId, seasonParam, activeSeasonId });
      syncProcessedRef.current = true;
      
      // Set the season from URL first
      if (seasonParam !== activeSeasonId) {
        console.log('[Calendar] Setting season to:', seasonParam);
        setActiveSeasonId(seasonParam);
        localStorage.setItem('calendar_active_season', seasonParam);
      }
      
      // Execute sync immediately
      (async () => {
        console.log('[Calendar] Executing sync...');
        await handleSyncGrowList(syncGrowListId, seasonParam);
        // Clear URL params after sync completes
        window.history.replaceState({}, '', window.location.pathname);
      })();
    }
  }, [searchParams, loading, seasons, syncing, activeSeasonId]);
  
  useEffect(() => {
    if (activeSeasonId && !loading) {
      loadPlansAndTasks();
      generateMaintenanceTasksIfNeeded();
    }
  }, [activeSeasonId]);
  
  const generateMaintenanceTasksIfNeeded = async () => {
    if (!activeSeasonId) return;
    try {
      await base44.functions.invoke('generateMaintenanceTasks', { garden_season_id: activeSeasonId });
    } catch (error) {
      console.error('Error generating maintenance tasks:', error);
    }
  };

  const getSeasonStartDate = () => {
    if (!seasons.length || !activeSeasonId) return new Date();
    const season = seasons.find(s => s.id === activeSeasonId);
    if (!season) return new Date();
    
    // Start from beginning of the year for the selected season
    return startOfYear(new Date(season.year, 0, 1));
  };
  
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
      
      // Load saved state
      const savedGardenId = localStorage.getItem('calendar_active_garden');
      const savedSeasonId = localStorage.getItem('calendar_active_season');
      
      if (gardensData.length > 0) {
        const garden = savedGardenId 
          ? gardensData.find(g => g.id === savedGardenId) || gardensData[0]
          : gardensData[0];
        setActiveGarden(garden);
        
        const seasonsData = await smartQuery(base44, 'GardenSeason', { 
          garden_id: garden.id,
          created_by: userData.email
        }, '-year');
        setSeasons(seasonsData);
        
        if (seasonsData.length > 0) {
          // Find current year season if possible
          const currentYear = new Date().getFullYear();
          const currentSeason = seasonsData.find(s => s.year === currentYear);
          
          const season = savedSeasonId 
            ? seasonsData.find(s => s.id === savedSeasonId) || (currentSeason || seasonsData[0])
            : (currentSeason || seasonsData[0]);
          setActiveSeasonId(season.id);
          localStorage.setItem('calendar_active_season', season.id);
        }
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
  
  const loadPlansAndTasks = async () => {
    if (!activeSeasonId || !user) return;
    
    try {
      // Batch query - load both plans and tasks together, using user_owner_email for CropPlan
      const [plansData, tasksData] = await Promise.all([
        smartQuery(base44, 'CropPlan', { garden_season_id: activeSeasonId, user_owner_email: user.email }),
        smartQuery(base44, 'CropTask', { garden_season_id: activeSeasonId, created_by: user.email }, 'start_date')
      ]);
      console.log('[Calendar] Loaded', plansData.length, 'plans and', tasksData.length, 'tasks for season', activeSeasonId);
      console.log('[Calendar] Tasks breakdown:', {
        seed: tasksData.filter(t => t.task_type === 'seed').length,
        transplant: tasksData.filter(t => t.task_type === 'transplant').length,
        harvest: tasksData.filter(t => t.task_type === 'harvest').length,
        cultivate: tasksData.filter(t => t.task_type === 'cultivate').length,
      });
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
  
  const handleDuplicateCrop = async (crop, isSuccession = false) => {
    try {
      const interval = isSuccession ? parseInt(prompt('Enter succession interval (days):', '14') || '14') : 0;
      
      const newCrop = await base44.entities.CropPlan.create({
        garden_season_id: crop.garden_season_id,
        plant_type_id: crop.plant_type_id,
        plant_profile_id: crop.plant_profile_id,
        variety_id: crop.variety_id,
        label: isSuccession ? `${crop.label || 'Crop'} (S2)` : `${crop.label || 'Crop'} (Copy)`,
        quantity_planned: crop.quantity_planned || 1,
        quantity_scheduled: 0,
        quantity_planted: 0,
        status: 'planned',
        color_hex: crop.color_hex,
        planting_method: crop.planting_method,
        date_mode: crop.date_mode,
        relative_anchor: crop.relative_anchor,
        seed_offset_days: (crop.seed_offset_days || 0) + interval,
        transplant_offset_days: (crop.transplant_offset_days || 0) + interval,
        direct_seed_offset_days: (crop.direct_seed_offset_days || 0) + interval,
        dtm_days: crop.dtm_days,
        harvest_window_days: crop.harvest_window_days,
        succession_parent_id: isSuccession ? crop.id : null
      });
      
      // Auto-generate tasks with new dates
      await base44.functions.invoke('generateTasksForCrop', { crop_plan_id: newCrop.id });
      
      await loadPlansAndTasks();
      toast.success(isSuccession ? 'Succession planting created' : 'Crop duplicated');
    } catch (error) {
      console.error('Error duplicating crop:', error);
      toast.error('Failed to duplicate crop');
    }
  };

  const handleSyncGrowList = async (growListId, targetSeasonId) => {
    const seasonId = targetSeasonId || activeSeasonId;
    if (!seasonId) {
      toast.error('Please select a season first');
      return;
    }

    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncGrowListToCalendar', {
        grow_list_id: growListId,
        garden_season_id: seasonId,
        auto_generate_tasks: true
      });

      if (response.data.success) {
        // Clear cache to force fresh data load
        clearCache();
        // Force immediate reload with loading state
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadPlansAndTasks();
        toast.success(`Synced: ${response.data.created} new, ${response.data.updated} updated crops with tasks`);
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        toast.error('Sync failed');
      }
    } catch (error) {
      console.error('Error syncing grow list:', error);
      toast.error('Failed to sync grow list');
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateTasks = async (crop) => {
    try {
      await base44.functions.invoke('generateTasksForCrop', { crop_plan_id: crop.id });
      await loadPlansAndTasks();
      toast.success('Tasks generated');
    } catch (error) {
      console.error('Error generating tasks:', error);
      toast.error('Failed to generate tasks');
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
  
  const getCurrentSeason = () => {
    if (!seasons.length || !activeSeasonId) return null;
    return seasons.find(s => s.id === activeSeasonId);
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
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:flex-row">
      {rateLimitError && (
        <RateLimitBanner 
          retryInMs={rateLimitError.retryInMs || 5000} 
          onRetry={() => loadData(true)}
          retrying={retrying}
        />
      )}
      
      {/* Left Sidebar - My Crops - Hidden on mobile when timeline view */}
      <div className={cn(
        "w-full lg:w-80 border-r bg-white flex flex-col",
        viewMode === 'timeline' && "hidden lg:flex"
      )}>
        <div className="p-4 border-b space-y-2">
          <h2 className="font-semibold text-lg">My Crops</h2>
          <Input
            placeholder="Search crops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button 
            onClick={() => setShowAddCrop(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 interactive-button"
            disabled={syncing}
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Crop
              </>
            )}
          </Button>
          <Button
            onClick={async () => {
              if (!activeSeasonId) {
                toast.error('Please select a season first');
                return;
              }
              
              if (syncing) return;
              
              try {
                console.log('[Calendar] Import button clicked, loading grow lists...');
                const userLists = await base44.entities.GrowList.filter({ 
                  created_by: user.email
                }, '-updated_date');
                
                console.log('[Calendar] Found', userLists.length, 'grow lists');
                
                if (userLists.length === 0) {
                  toast.error('No grow lists found. Create one first!');
                  return;
                }

                const matchingLists = userLists.filter(l => 
                  l.garden_season_id === activeSeasonId || !l.garden_season_id
                );

                console.log('[Calendar] Found', matchingLists.length, 'matching lists for season', activeSeasonId);

                if (matchingLists.length === 0) {
                  toast.error(`No grow lists for this season. Create one in Grow Lists page.`);
                  return;
                }

                if (matchingLists.length === 1) {
                  console.log('[Calendar] Auto-importing single list:', matchingLists[0].name);
                  await handleSyncGrowList(matchingLists[0].id, activeSeasonId);
                } else {
                  const listNum = prompt(
                    `Select grow list to import:\n\n${matchingLists.map((l, i) => 
                      `${i+1}. ${l.name} (${l.items?.length || 0} items)`
                    ).join('\n')}\n\nEnter number:`
                  );
                  
                  console.log('[Calendar] User selected:', listNum);
                  
                  if (listNum) {
                    const list = matchingLists[parseInt(listNum) - 1];
                    if (list) {
                      console.log('[Calendar] Importing list:', list.name);
                      await handleSyncGrowList(list.id, activeSeasonId);
                    }
                  }
                }
              } catch (error) {
                console.error('[Calendar] Import error:', error);
                toast.error('Import failed: ' + error.message);
              }
            }}
            variant="outline"
            className="w-full gap-2 interactive-button"
            disabled={syncing || !activeSeasonId}
          >
            <Download className="w-4 h-4" />
            Import from Grow List
          </Button>
          <Button
            onClick={() => setShowAIWizard(true)}
            variant="outline"
            size="sm"
            className="w-full gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
          >
            ✨ AI Build My Calendar
          </Button>
          <Link to={createPageUrl('NeedToBuy')} className="w-full">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
            >
              <ShoppingCart className="w-4 h-4" />
              Need to Buy
            </Button>
          </Link>
          <Button
            onClick={() => setShowGuide(true)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            📖 User Guide
          </Button>
          <Button
            onClick={async () => {
              if (filteredCrops.length === 0) {
                toast.error('No crops to generate tasks for');
                return;
              }
              
              try {
                toast.loading(`Regenerating tasks for ${filteredCrops.length} crops...`, { id: 'regen-all' });
                setSyncing(true);
                let totalCreated = 0;
                let failedCount = 0;

                // Process crops with delays to avoid rate limits
                for (let i = 0; i < filteredCrops.length; i++) {
                  const crop = filteredCrops[i];
                  try {
                    const response = await base44.functions.invoke('generateTasksForCrop', { crop_plan_id: crop.id });
                    totalCreated += response.data.tasks_created || 0;
                    
                    // Add 800ms delay between crops to avoid rate limits
                    if (i < filteredCrops.length - 1) {
                      await new Promise(r => setTimeout(r, 800));
                    }
                  } catch (error) {
                    console.error(`Failed to generate tasks for ${crop.label}:`, error);
                    failedCount++;
                    // Continue with next crop even if one fails
                  }
                }

                await new Promise(r => setTimeout(r, 500));
                await loadPlansAndTasks();
                setSyncing(false);
                
                if (failedCount > 0) {
                  toast.warning(`Created ${totalCreated} tasks. ${failedCount} crops failed (rate limit or missing data)`, { id: 'regen-all', duration: 6000 });
                } else {
                  toast.success(`Created ${totalCreated} tasks across ${filteredCrops.length} crops`, { id: 'regen-all' });
                }
              } catch (error) {
                console.error('Error regenerating all tasks:', error);
                const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
                toast.error(`Failed: ${errorMsg}`, { id: 'regen-all' });
                setSyncing(false);
              }
              }}
              variant="outline"
              size="sm"
              className="w-full gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 interactive-button"
              disabled={syncing || filteredCrops.length === 0}
              >
              {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
              <RefreshCw className="w-4 h-4" />
              )}
              Regenerate All Tasks
              </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {syncing ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading crops...</p>
            </div>
          ) : filteredCrops.length === 0 ? (
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
                    <p className="font-medium text-sm truncate" title={crop.label || 'Unnamed Crop'}>
                      {crop.label || 'Unnamed Crop'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Qty: {crop.quantity_planted || crop.quantity_scheduled || 0}/{crop.quantity_planned}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setSelectedCrop(crop);
                        setShowEditCrop(true);
                      }}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateCrop(crop, true)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Succession Planting
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateCrop(crop, false)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        try {
                          toast.loading('Generating tasks...', { id: 'gen-tasks' });
                          const response = await base44.functions.invoke('generateTasksForCrop', { crop_plan_id: crop.id });
                          console.log('[Calendar] Task generation response:', response.data);
                          
                          await new Promise(r => setTimeout(r, 500));
                          await loadPlansAndTasks();
                          
                          toast.success(`Created ${response.data.tasks_created || 0} tasks for ${crop.label}`, { id: 'gen-tasks' });
                        } catch (error) {
                          console.error('Error generating tasks:', error);
                          const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
                          toast.error(`Failed: ${errorMsg}`, { id: 'gen-tasks' });
                        }
                      }}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate Tasks
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
      
      {/* Main Timeline/Calendar Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Controls */}
        <div className="p-4 border-b bg-white flex items-center gap-3">
          <Select value={activeGarden?.id} onValueChange={async (id) => {
            const garden = gardens.find(g => g.id === id);
            setActiveGarden(garden);
            localStorage.setItem('calendar_active_garden', id);
            const currentUser = await base44.auth.me();
            const seasonsData = await base44.entities.GardenSeason.filter({ 
              garden_id: id,
              created_by: currentUser.email
            }, '-year');
            setSeasons(seasonsData);
            if (seasonsData.length > 0) {
              setActiveSeasonId(seasonsData[0].id);
              localStorage.setItem('calendar_active_season', seasonsData[0].id);
            }
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
          
          <Select value={activeSeasonId} onValueChange={(seasonId) => {
            setActiveSeasonId(seasonId);
            localStorage.setItem('calendar_active_season', seasonId);
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
          

          
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="calendar">Calendar</SelectItem>
              <SelectItem value="timeline">Timeline</SelectItem>
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
        
        {/* Calendar/Timeline View */}
        <div className="flex-1 overflow-auto bg-gray-50 relative">
          {viewMode === 'calendar' ? (
            <div className="p-2 md:p-4">
              <CalendarGridView
                tasks={filteredTasks}
                crops={cropPlans}
                season={getCurrentSeason()}
                onTaskClick={setSelectedTask}
                onDayClick={(date) => {
                  setSelectedDate(date);
                  setShowDayPanel(true);
                }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-hidden pb-4">
              <TimelineView 
                tasks={filteredTasks}
                crops={cropPlans}
                season={getCurrentSeason()}
                onTaskClick={setSelectedTask}
              />
            </div>
          )}
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
          onUpdate={loadPlansAndTasks}
        />
      )}
      
      {/* Edit Crop Modal */}
      <CropEditModal
        crop={selectedCrop}
        open={showEditCrop}
        onOpenChange={setShowEditCrop}
        onSuccess={loadPlansAndTasks}
      />

      <DayTasksPanel
        date={selectedDate}
        tasks={selectedDate ? tasks.filter(t => {
          const taskDate = format(new Date(t.start_date), 'yyyy-MM-dd');
          const clickedDate = format(new Date(selectedDate), 'yyyy-MM-dd');
          return taskDate === clickedDate;
        }) : []}
        open={showDayPanel}
        onOpenChange={setShowDayPanel}
        onToggleComplete={async (task) => {
          try {
            const newCompleted = !task.is_completed;
            await base44.entities.CropTask.update(task.id, { 
              is_completed: newCompleted,
              completed_at: newCompleted ? new Date().toISOString() : null
            });
            setTasks(prev => prev.map(t => 
              t.id === task.id 
                ? { ...t, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
                : t
            ));
            toast.success(newCompleted ? 'Task completed!' : 'Task reopened');
          } catch (error) {
            console.error('Error toggling task:', error);
            toast.error('Failed to update task');
          }
        }}
      />
      
      {/* User Guide */}
      <CalendarGuide
        open={showGuide}
        onOpenChange={setShowGuide}
      />
      
      {/* AI Calendar Builder */}
      <BuildCalendarWizard
        open={showAIWizard}
        onOpenChange={setShowAIWizard}
        onComplete={() => {
          loadPlansAndTasks();
          toast.success('AI crop plans created! Review them in the sidebar.');
        }}
      />
    </div>
  );
}

// Calendar Grid View - Compact full year view like SeedTime
function CalendarGridView({ tasks, crops, season, onTaskClick, onDayClick }) {
  if (!season) {
    return (
      <div className="p-8 text-center text-gray-500">
        Select a season to view calendar
      </div>
    );
  }

  const startDate = startOfYear(new Date(season.year, 0, 1));
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startDate, i));

  return (
    <div className="p-2">
      {/* Calendar Grid - Compact */}
      <div className="space-y-0 border rounded-lg overflow-hidden">
        {months.map((month, monthIdx) => {
          const daysInMonth = getDaysInMonth(month);
          const monthStart = startOfMonth(month);
          const startDayOfWeek = monthStart.getDay();
          
          return (
            <div key={monthIdx} className="border-b last:border-b-0">
              {/* Month Header - Compact */}
              <div className="grid grid-cols-[80px_1fr] bg-gray-50 border-b">
                <div className="px-2 py-1.5 font-semibold text-xs border-r">
                  {format(month, 'MMMM')}
                </div>
                <div className="grid grid-cols-7">
                  {monthIdx === 0 && ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'].map((day, i) => (
                    <div key={i} className="text-center text-[10px] font-medium py-1 border-r last:border-r-0 text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Days Grid - Very Compact */}
              <div className="grid grid-cols-[80px_1fr]">
                <div className="border-r" />
                <div className="grid grid-cols-7">
                  {/* Empty cells */}
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-12 border-r border-b bg-gray-50/50" />
                  ))}
                  
                  {/* Days */}
                  {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
                    const day = dayIdx + 1;
                    const currentDate = new Date(season.year, monthIdx, day);
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
                        className="h-16 border-r border-b relative group cursor-pointer hover:bg-emerald-50/50 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDayClick?.(currentDate);
                        }}
                      >
                        <div className="absolute top-0.5 left-0.5 text-[9px] text-gray-400 font-medium group-hover:text-emerald-600 transition-colors pointer-events-none">{day}</div>
                        {dayTasks.length > 0 && (
                          <div className="absolute inset-0 flex flex-col gap-0.5 p-0.5 pt-3 pointer-events-none">
                            {dayTasks.slice(0, 3).map((task) => {
                              const crop = crops.find(c => c.id === task.crop_plan_id);
                              const taskTypeShort = task.task_type === 'seed' ? 'Start' : 
                                                   task.task_type === 'transplant' ? 'Trans' :
                                                   task.task_type === 'harvest' ? 'Harv' :
                                                   task.task_type === 'direct_seed' ? 'Sow' : 'Task';
                              const progress = task.quantity_target > 0 ? (task.quantity_completed || 0) / task.quantity_target : 1;
                              const isComplete = task.is_completed || progress >= 1;

                              const showPrediction = task.task_type === 'harvest' && !task.is_completed && crop?.dtm_days;

                              return (
                                <div
                                  key={task.id}
                                  className="w-full h-3 rounded flex items-center px-1 overflow-hidden relative"
                                  style={{ backgroundColor: task.color_hex || crop?.color_hex || '#10b981' }}
                                  title={`${crop?.label || 'Crop'}: ${task.title}${task.quantity_target > 1 ? ` (${task.quantity_completed || 0}/${task.quantity_target})` : ''}${showPrediction ? ' • AI Predicted' : ''}`}
                                >
                                  {task.quantity_target > 1 && (
                                    <div 
                                      className="absolute inset-0 bg-white/30"
                                      style={{ width: `${(1 - progress) * 100}%`, right: 0, left: 'auto' }}
                                    />
                                  )}
                                  <span className="text-[9px] text-white font-semibold truncate leading-none relative z-10">
                                   {task.title || `${crop?.label} - ${taskTypeShort}`}
                                   {showPrediction && ' 🔮'}
                                   {isComplete && ' ✓'}
                                  </span>
                                </div>
                              );
                            })}
                            {dayTasks.length > 3 && (
                              <div className="w-full h-3 rounded bg-gray-700 flex items-center justify-center px-1">
                                <span className="text-[9px] text-white font-semibold">
                                  +{dayTasks.length - 3} more
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Fill */}
                  {Array.from({ length: (7 - ((startDayOfWeek + daysInMonth) % 7)) % 7 }).map((_, i) => (
                    <div key={`fill-${i}`} className="h-12 border-r border-b bg-gray-50/50" />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {crops.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No crops planned yet. Click "Add Crop" to start planning.
        </div>
      )}
    </div>
  );
}

// Timeline View - Horizontal bars
function TimelineView({ tasks, crops, season, onTaskClick }) {
  if (!season) {
    return (
      <div className="p-8 text-center text-gray-500">
        Select a season to view timeline
      </div>
    );
  }
  
  const [draggingTask, setDraggingTask] = useState(null);

  const viewStart = startOfYear(new Date(season.year, 0, 1));
  const months = Array.from({ length: 12 }, (_, i) => addMonths(viewStart, i));
  
  const handleTaskDragStart = (e, task) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTask(task);
  };
  
  const handleTaskDrop = async (e, targetDate) => {
    e.preventDefault();
    if (!draggingTask) return;
    
    const oldDate = new Date(draggingTask.start_date);
    const daysDiff = Math.floor((targetDate - oldDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      setDraggingTask(null);
      return;
    }
    
    try {
      const newStartDate = addDays(new Date(draggingTask.start_date), daysDiff);
      const newEndDate = draggingTask.end_date ? addDays(new Date(draggingTask.end_date), daysDiff) : null;
      
      await base44.entities.CropTask.update(draggingTask.id, {
        start_date: newStartDate.toISOString().split('T')[0],
        end_date: newEndDate ? newEndDate.toISOString().split('T')[0] : null
      });
      
      toast.success('Task rescheduled');
      window.location.reload();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to reschedule');
    } finally {
      setDraggingTask(null);
    }
  };
  
  return (
    <div className="min-w-[1400px] md:min-w-[1800px] relative">
      {/* Month Headers - Sticky */}
      <div className="flex sticky top-0 bg-white border-b z-30 shadow-sm">
        <div className="w-32 md:w-40 flex-shrink-0 border-r p-2 font-semibold text-xs md:text-sm bg-white sticky left-0 z-40">
          Crop
        </div>
        {months.map((month, idx) => (
          <div key={idx} className="flex-1 min-w-[150px] md:min-w-[200px] border-r p-2 text-center bg-white">
            <div className="font-semibold text-xs md:text-sm">{format(month, 'MMM yyyy')}</div>
          </div>
        ))}
      </div>
      
      {/* Crop Rows */}
      {crops.map(crop => {
        const cropTasks = tasks.filter(t => t.crop_plan_id === crop.id);
        
        return (
          <div key={crop.id} className="flex border-b hover:bg-gray-50">
            <div className="w-32 md:w-40 flex-shrink-0 border-r p-2 flex items-center gap-2 bg-white sticky left-0 z-10">
                    <div 
                      className="w-2 md:w-3 h-2 md:h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: crop.color_hex || '#10b981' }}
                    />
                    <span className="text-xs md:text-sm truncate" style={{ color: 'var(--text-primary)' }}>{crop.label}</span>
                  </div>
            
            <div 
              className="flex-1 relative" 
              style={{ height: '40px' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const totalWidth = rect.width;
                const totalDays = 365;
                const daysFromStart = Math.floor((x / totalWidth) * totalDays);
                const targetDate = addDays(viewStart, daysFromStart);
                handleTaskDrop(e, targetDate);
              }}
            >
              {cropTasks.map((task, idx) => {
                const taskStart = new Date(task.start_date);
                const taskEnd = task.end_date ? new Date(task.end_date) : taskStart;
                
                const daysSinceStart = Math.floor((taskStart - viewStart) / (1000 * 60 * 60 * 24));
                const duration = Math.floor((taskEnd - taskStart) / (1000 * 60 * 60 * 24)) + 1;
                const leftPercent = (daysSinceStart / 365) * 100;
                const widthPercent = (duration / 365) * 100;
                
                if (leftPercent < -widthPercent || leftPercent > 100) return null;
                
                const taskColor = task.color_hex || crop.color_hex || '#10b981';
                
                const verticalOffset = (idx % 2) * 18;
                
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleTaskDragStart(e, task)}
                    className={cn(
                      "absolute rounded px-2 py-0.5 text-xs text-white cursor-move hover:opacity-90 hover:shadow-lg transition-all",
                      draggingTask?.id === task.id && "opacity-50"
                    )}
                    style={{
                      top: `${2 + verticalOffset}px`,
                      left: `${Math.max(0, leftPercent)}%`,
                      width: `${Math.min(100 - Math.max(0, leftPercent), widthPercent)}%`,
                      backgroundColor: taskColor,
                      minWidth: '80px',
                      height: '16px'
                    }}
                    onClick={() => onTaskClick(task)}
                    title={task.title || 'Task'}
                  >
                    <div className="truncate font-medium leading-none">{task.title || 'Task'}</div>
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