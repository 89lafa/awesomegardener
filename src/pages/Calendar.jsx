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
  ShoppingCart,
  List,
  LayoutGrid
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
import { KanbanBoard } from '@/components/tasks/KanbanBoard';

export default function Calendar() {
  const [searchParams] = useSearchParams();
  const syncProcessedRef = React.useRef(null);
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [sortBy, setSortBy] = useState('date');
  const [timelineMonths, setTimelineMonths] = useState(12);
  const [viewMode, setViewMode] = useState('calendar');
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // =================================================================
  // FIX: Mobile tab state
  // On phones (< lg), the sidebar and calendar can't both fit.
  // This toggles which one is visible. Default to 'calendar' so
  // users see their events first (the bug was: only sidebar showed).
  // On desktop (lg+), both panels always show side-by-side.
  // =================================================================
  const [mobileTab, setMobileTab] = useState('calendar');
  
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => setCurrentMonth(m => addMonths(m, 1)),
    onSwipeRight: () => setCurrentMonth(m => addMonths(m, -1)),
  });
  
  useEffect(() => {
    loadData();
  }, []);

useEffect(() => {
    const forceGarden = searchParams.get('forceGarden');
    const forceSeason = searchParams.get('forceSeason');
    if (!forceGarden || !forceSeason) return;
        localStorage.setItem('calendar_active_garden', forceGarden);
    localStorage.setItem('calendar_active_season', forceSeason);
    window.history.replaceState({}, '', window.location.pathname);
    loadData();


  }, [searchParams]);



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
    return startOfYear(new Date(season.year, 0, 1));
  };
  
  const loadData = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      const gardensData = await smartQuery(base44, 'Garden', { 
        archived: false, created_by: userData.email 
      }, '-updated_date');
      setGardens(gardensData);
      setRateLimitError(null);
      const savedGardenId = localStorage.getItem('calendar_active_garden');
      const savedSeasonId = localStorage.getItem('calendar_active_season');
      if (gardensData.length > 0) {
        const garden = savedGardenId 
          ? gardensData.find(g => g.id === savedGardenId) || gardensData[0]
          : gardensData[0];
        setActiveGarden(garden);
        const seasonsData = await smartQuery(base44, 'GardenSeason', { 
          garden_id: garden.id, created_by: userData.email
        }, '-year');
        setSeasons(seasonsData);
        if (seasonsData.length > 0) {
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
  
const loadPlansAndTasks = async (forceFresh = false, overrideSeasonId = null) => {
    const seasonId = overrideSeasonId || activeSeasonId;
    if (!seasonId || !user) return;
    try {
      if (forceFresh) clearCache();
const [plansData, tasksData] = await Promise.all([
  smartQuery(base44, 'CropPlan', { garden_season_id: seasonId, user_owner_email: user.email }),
        smartQuery(base44, 'CropTask', { garden_season_id: seasonId, created_by: user.email }, 'start_date')
      ]);

      setCropPlans(plansData);
      setTasks(tasksData);
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error('Error loading plans/tasks:', error);
    }
  };
  
  const handleDeleteCrop = async (crop) => {
    if (!confirm(`Delete ${crop.label || 'this crop'}?`)) return;
    try {
      const cropTasks = tasks.filter(t => t.crop_plan_id === crop.id);
      for (const task of cropTasks) {
        await base44.entities.CropTask.delete(task.id);
      }
      await base44.entities.CropPlan.delete(crop.id);
      await loadPlansAndTasks(true);
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
        quantity_scheduled: 0, quantity_planted: 0, status: 'planned',
        color_hex: crop.color_hex, planting_method: crop.planting_method,
        date_mode: crop.date_mode, relative_anchor: crop.relative_anchor,
        seed_offset_days: (crop.seed_offset_days || 0) + interval,
        transplant_offset_days: (crop.transplant_offset_days || 0) + interval,
        direct_seed_offset_days: (crop.direct_seed_offset_days || 0) + interval,
        dtm_days: crop.dtm_days, harvest_window_days: crop.harvest_window_days,
        succession_parent_id: isSuccession ? crop.id : null
      });
      await base44.functions.invoke('generateTasksForCrop', { crop_plan_id: newCrop.id });
      await loadPlansAndTasks(true);
      toast.success(isSuccession ? 'Succession planting created' : 'Crop duplicated');
    } catch (error) {
      console.error('Error duplicating crop:', error);
      toast.error('Failed to duplicate crop');
    }
  };

  const handleSyncGrowList = async (growListId, targetSeasonId) => {
    const seasonId = targetSeasonId || activeSeasonId;
    if (!seasonId) { toast.error('Please select a season first'); return; }
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncGrowListToCalendar', {
        grow_list_id: growListId, garden_season_id: seasonId, auto_generate_tasks: true
      });
      if (response.data.success) {

clearCache();
await new Promise(resolve => setTimeout(resolve, 500));
await loadPlansAndTasks(true, seasonId);

        toast.success(`Synced: ${response.data.created} new, ${response.data.updated} updated crops with tasks`);
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
      await loadPlansAndTasks(true);
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
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-8rem)]">
      {rateLimitError && (
        <RateLimitBanner 
          retryInMs={rateLimitError.retryInMs || 5000} 
          onRetry={() => loadData(true)}
          retrying={retrying}
        />
      )}

      {/* =============================================================
          MOBILE TAB BAR — only visible on phones (< lg breakpoint)
          Lets users switch between the calendar view and the crops sidebar.
          Without this, the sidebar fills the entire mobile viewport
          and the actual calendar is completely invisible below the fold.
          ============================================================= */}
      <div className="lg:hidden flex border-b bg-white flex-shrink-0">
        <button
          onClick={() => setMobileTab('calendar')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors",
            mobileTab === 'calendar'
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          {viewMode === 'calendar' ? 'Calendar' : viewMode === 'kanban' ? 'Kanban' : 'Timeline'}
        </button>
        <button
          onClick={() => setMobileTab('crops')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors",
            mobileTab === 'crops'
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <List className="w-4 h-4" />
          My Crops {cropPlans.length > 0 && `(${cropPlans.length})`}
        </button>
      </div>

      {/* Main two-panel layout */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">

        {/* ===================== LEFT SIDEBAR — My Crops =====================
            MOBILE: only visible when mobileTab === 'crops'
            DESKTOP: always visible (except timeline mode hides it)
            =================================================================== */}
        <div className={cn(
          "w-full lg:w-80 border-r bg-white flex flex-col overflow-hidden",
          viewMode === 'timeline' && "lg:hidden",
          mobileTab !== 'crops' ? "hidden lg:flex" : "flex"
        )}>
          <div className="p-4 border-b space-y-2">
            <h2 className="font-semibold text-lg hidden lg:block">My Crops</h2>
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
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" />Add Crop</>
              )}
            </Button>
            <Button
              onClick={async () => {
                if (!activeSeasonId) { toast.error('Please select a season first'); return; }
                if (syncing) return;
                try {
                  const userLists = await base44.entities.GrowList.filter({ created_by: user.email }, '-updated_date');
                  if (userLists.length === 0) { toast.error('No grow lists found. Create one first!'); return; }
                  const matchingLists = userLists.filter(l => l.garden_season_id === activeSeasonId || !l.garden_season_id);
                  if (matchingLists.length === 0) { toast.error('No grow lists for this season.'); return; }
                  if (matchingLists.length === 1) {
                    await handleSyncGrowList(matchingLists[0].id, activeSeasonId);
                  } else {
                    const listNum = prompt(
                      `Select grow list to import:\n\n${matchingLists.map((l, i) => 
                        `${i+1}. ${l.name} (${l.items?.length || 0} items)`
                      ).join('\n')}\n\nEnter number:`
                    );
                    if (listNum) {
                      const list = matchingLists[parseInt(listNum) - 1];
                      if (list) await handleSyncGrowList(list.id, activeSeasonId);
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
              variant="outline" size="sm"
              className="w-full gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
            >
              ✨ AI Build My Calendar
            </Button>
            <Link to={createPageUrl('NeedToBuy')} className="w-full">
              <Button variant="outline" size="sm" className="w-full gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300">
                <ShoppingCart className="w-4 h-4" />Need to Buy
              </Button>
            </Link>
            <Button onClick={() => setShowGuide(true)} variant="outline" size="sm" className="w-full">📖 User Guide</Button>
            <Button
              onClick={async () => {
                if (filteredCrops.length === 0) { toast.error('No crops to generate tasks for'); return; }
                try {
                  toast.loading(`Regenerating tasks for ${filteredCrops.length} crops...`, { id: 'regen-all' });
                  setSyncing(true);
                  let totalCreated = 0;
                  let failedCount = 0;
                  for (let i = 0; i < filteredCrops.length; i++) {
                    const crop = filteredCrops[i];
                    try {
                      const response = await base44.functions.invoke('generateTasksForCrop', { crop_plan_id: crop.id });
                      totalCreated += response.data.tasks_created || 0;
                      if (i < filteredCrops.length - 1) await new Promise(r => setTimeout(r, 800));
                    } catch (error) {
                      console.error(`Failed to generate tasks for ${crop.label}:`, error);
                      failedCount++;
                    }
                  }
                  await new Promise(r => setTimeout(r, 500));
                  await loadPlansAndTasks(true);
                  setSyncing(false);
                  if (failedCount > 0) {
                    toast.warning(`Created ${totalCreated} tasks. ${failedCount} crops failed.`, { id: 'regen-all', duration: 6000 });
                  } else {
                    toast.success(`Created ${totalCreated} tasks across ${filteredCrops.length} crops`, { id: 'regen-all' });
                  }
                } catch (error) {
                  console.error('Error regenerating all tasks:', error);
                  toast.error(`Failed: ${error.message}`, { id: 'regen-all' });
                  setSyncing(false);
                }
              }}
              variant="outline" size="sm"
              className="w-full gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 interactive-button"
              disabled={syncing || filteredCrops.length === 0}
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
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
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: crop.color_hex || '#10b981' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={crop.label || 'Unnamed Crop'}>{crop.label || 'Unnamed Crop'}</p>
                      <p className="text-xs text-gray-500">Qty: {crop.quantity_planted || crop.quantity_scheduled || 0}/{crop.quantity_planned}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedCrop(crop); setShowEditCrop(true); }}>
                          <Edit className="w-4 h-4 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateCrop(crop, true)}>
                          <Copy className="w-4 h-4 mr-2" />Succession Planting
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateCrop(crop, false)}>
                          <Copy className="w-4 h-4 mr-2" />Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          try {
                            toast.loading('Generating tasks...', { id: 'gen-tasks' });
                            const response = await base44.functions.invoke('generateTasksForCrop', { crop_plan_id: crop.id });
                            await new Promise(r => setTimeout(r, 500));
                            await loadPlansAndTasks(true);
                            toast.success(`Created ${response.data.tasks_created || 0} tasks for ${crop.label}`, { id: 'gen-tasks' });
                          } catch (error) {
                            console.error('Error generating tasks:', error);
                            toast.error(`Failed: ${error.message}`, { id: 'gen-tasks' });
                          }
                        }}>
                          <RefreshCw className="w-4 h-4 mr-2" />Regenerate Tasks
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteCrop(crop)}>
                          <Trash2 className="w-4 h-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* ===================== MAIN CALENDAR AREA =====================
            MOBILE: only visible when mobileTab === 'calendar'
            DESKTOP: always visible
            ============================================================= */}
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden",
          mobileTab !== 'calendar' ? "hidden lg:flex" : "flex"
        )}>
          {/* Top Controls */}
          <div className="p-3 lg:p-4 border-b bg-white flex flex-wrap items-center gap-2 lg:gap-3 flex-shrink-0">
            <Select value={activeGarden?.id} onValueChange={async (id) => {
              const garden = gardens.find(g => g.id === id);
              setActiveGarden(garden);
              localStorage.setItem('calendar_active_garden', id);
              const currentUser = await base44.auth.me();
              const seasonsData = await base44.entities.GardenSeason.filter({ garden_id: id, created_by: currentUser.email }, '-year');
              setSeasons(seasonsData);
              if (seasonsData.length > 0) {
                setActiveSeasonId(seasonsData[0].id);
                localStorage.setItem('calendar_active_season', seasonsData[0].id);
              }
            }}>
              <SelectTrigger className="w-36 lg:w-48 text-sm"><SelectValue placeholder="Select garden" /></SelectTrigger>
              <SelectContent>
                {gardens.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            
            <Select value={activeSeasonId} onValueChange={(seasonId) => {
              setActiveSeasonId(seasonId);
              localStorage.setItem('calendar_active_season', seasonId);
            }}>
              <SelectTrigger className="w-32 lg:w-40 text-sm"><SelectValue placeholder="Season" /></SelectTrigger>
              <SelectContent>
                {seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.year} {s.season}</SelectItem>)}
              </SelectContent>
            </Select>
            
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-28 lg:w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="calendar">Calendar</SelectItem>
                <SelectItem value="timeline">Timeline</SelectItem>
                <SelectItem value="kanban">Kanban</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger className="w-28 lg:w-40 text-sm"><SelectValue placeholder="Filter" /></SelectTrigger>
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
          
          {/* View Area */}
          <div className="flex-1 overflow-auto bg-gray-50" {...swipeHandlers}>
            {viewMode === 'calendar' ? (
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
            ) : viewMode === 'kanban' ? (
              <div className="p-4">
                <KanbanBoard 
                  tasks={filteredTasks}
                  cropPlans={cropPlans}
                  onTaskUpdate={() => loadPlansAndTasks(true)}
                />
              </div>
            ) : (
              <TimelineView 
                tasks={filteredTasks}
                crops={cropPlans}
                season={getCurrentSeason()}
                onTaskClick={setSelectedTask}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <AddCropModal open={showAddCrop} onOpenChange={setShowAddCrop} seasonId={activeSeasonId} onSuccess={() => loadPlansAndTasks(true)} />
      {selectedTask && <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} onUpdate={() => loadPlansAndTasks(true)} />}
      <CropEditModal crop={selectedCrop} open={showEditCrop} onOpenChange={setShowEditCrop} onSuccess={() => loadPlansAndTasks(true)} />
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
              t.id === task.id ? { ...t, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : t
            ));
            toast.success(newCompleted ? 'Task completed!' : 'Task reopened');
          } catch (error) {
            toast.error('Failed to update task');
          }
        }}
      />
      <CalendarGuide open={showGuide} onOpenChange={setShowGuide} />
      <BuildCalendarWizard
        open={showAIWizard}
        onOpenChange={setShowAIWizard}
        onComplete={() => { loadPlansAndTasks(true); toast.success('AI crop plans created!'); }}
      />
    </div>
  );
}


/* ================================================================
   PHASE ICONS - shared between both views
   ================================================================ */
const PHASE_ICONS = {
  seed: '🌱', direct_seed: '🌾', transplant: '🪴',
  bed_prep: '🔧', cultivate: '✂️', harvest: '🥕'
};

const PHASE_LABELS = {
  seed: 'Start Seeds', direct_seed: 'Direct Sow', transplant: 'Transplant',
  bed_prep: 'Bed Prep', cultivate: 'Cultivate', harvest: 'Harvest'
};

function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}


/* ================================================================
   CALENDAR GRID VIEW
   ================================================================ */
function CalendarGridView({ tasks, crops, season, onTaskClick, onDayClick }) {
  if (!season) {
    return <div className="p-8 text-center text-gray-500">Select a season to view calendar</div>;
  }

  const year = season.year;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const BAR_HEIGHT = 20;
  const BAR_GAP = 2;
  const DAY_NUM_HEIGHT = 18;
  const MAX_BARS = 3;

  function getWeeksForMonth(monthIndex) {
    const firstOfMonth = new Date(year, monthIndex, 1);
    const lastOfMonth = new Date(year, monthIndex + 1, 0);
    const weeks = [];
    const firstSunday = new Date(year, monthIndex, 1 - firstOfMonth.getDay());
    let weekStart = new Date(firstSunday);
    while (weekStart <= lastOfMonth) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        days.push(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + d));
      }
      weeks.push(days);
      weekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
    }
    return weeks;
  }

  function getTaskBars(weekDays) {
    const wkStart = new Date(weekDays[0]);
    const wkEnd = new Date(weekDays[6]);
    wkStart.setHours(0,0,0,0);
    wkEnd.setHours(23,59,59,999);

    const overlapping = [];
    tasks.forEach(task => {
      if (!task.start_date) return;
      const tStart = parseLocalDate(task.start_date);
      const tEnd = task.end_date ? parseLocalDate(task.end_date) : new Date(tStart);
      if (!tStart) return;
      tStart.setHours(0,0,0,0);
      tEnd.setHours(23,59,59,999);
      if (tStart <= wkEnd && tEnd >= wkStart) {
        const crop = crops.find(c => c.id === task.crop_plan_id);
        const startCol = tStart < wkStart ? 0 : tStart.getDay();
        const endCol = tEnd > wkEnd ? 6 : tEnd.getDay();
        const continuesFrom = tStart < wkStart;
        const continuesTo = tEnd > wkEnd;
        overlapping.push({ task, crop, startCol, endCol, continuesFrom, continuesTo, row: 0 });
      }
    });

    overlapping.sort((a, b) => {
      const aLen = a.endCol - a.startCol;
      const bLen = b.endCol - b.startCol;
      if (bLen !== aLen) return bLen - aLen;
      return a.startCol - b.startCol;
    });

    const rowEnds = [];
    overlapping.forEach(bar => {
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

    return overlapping;
  }

  return (
    <div className="p-2 md:p-4">
      <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[11px] font-semibold py-2 text-gray-500 border-r last:border-r-0 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {Array.from({ length: 12 }, (_, monthIdx) => {
          const weeks = getWeeksForMonth(monthIdx);
          return (
            <div key={monthIdx}>
              <div className="bg-gray-100 border-b border-t px-4 py-1.5 font-bold text-sm text-gray-700 sticky top-0 z-20">
                {format(new Date(year, monthIdx, 1), 'MMMM yyyy')}
              </div>
              
              {weeks.map((weekDays, weekIdx) => {
                const bars = getTaskBars(weekDays);
                const visibleBars = bars.filter(b => b.row < MAX_BARS);
                const hiddenCount = bars.filter(b => b.row >= MAX_BARS).length;
                const totalBarRows = Math.min(bars.length > 0 ? Math.max(...bars.map(b => b.row)) + 1 : 0, MAX_BARS);
                const rowHeight = DAY_NUM_HEIGHT + totalBarRows * (BAR_HEIGHT + BAR_GAP) + (hiddenCount > 0 ? 16 : 0) + 6;

                return (
                  <div key={weekIdx} className="relative border-b last:border-b-0" style={{ minHeight: `${Math.max(rowHeight, 52)}px` }}>
                    <div className="grid grid-cols-7 absolute inset-0">
                      {weekDays.map((day, dayIdx) => {
                        const isCurrentMonth = day.getMonth() === monthIdx;
                        const isToday = sameDay(day, today);
                        return (
                          <div
                            key={dayIdx}
                            className={cn(
                              "border-r last:border-r-0 cursor-pointer transition-colors",
                              !isCurrentMonth && "bg-gray-50/70",
                              isCurrentMonth && "hover:bg-emerald-50/40",
                              isToday && "bg-amber-50/60"
                            )}
                            onClick={() => isCurrentMonth && onDayClick?.(day)}
                          >
                            <div className="flex justify-end p-1">
                              <span className={cn(
                                "text-[11px] font-medium leading-none",
                                isToday && "bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold",
                                !isCurrentMonth && "text-gray-300",
                                isCurrentMonth && !isToday && "text-gray-500"
                              )}>
                                {day.getDate()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="relative pointer-events-none" style={{ paddingTop: `${DAY_NUM_HEIGHT}px` }}>
                      {visibleBars.map((bar) => {
                        const leftPct = (bar.startCol / 7) * 100;
                        const widthPct = ((bar.endCol - bar.startCol + 1) / 7) * 100;
                        const topPx = bar.row * (BAR_HEIGHT + BAR_GAP);
                        const bgColor = bar.crop?.color_hex || bar.task.color_hex || '#10b981';
                        const icon = PHASE_ICONS[bar.task.task_type] || '📋';

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
                              height: `${BAR_HEIGHT}px`,
                              backgroundColor: bgColor,
                              borderRadius,
                              zIndex: 10,
                            }}
                            onClick={(e) => { e.stopPropagation(); onTaskClick(bar.task); }}
                            title={`${bar.crop?.label || 'Crop'}: ${bar.task.title}\n${bar.task.start_date}${bar.task.end_date ? ' → ' + bar.task.end_date : ''}`}
                          >
                            <div className="flex items-center h-full px-1.5 gap-0.5 overflow-hidden">
                              <span className="text-[11px] flex-shrink-0 leading-none">{icon}</span>
                              <span className="text-[11px] text-white font-semibold truncate leading-none">
                                {bar.crop?.label ? `${bar.crop.label} - ${PHASE_LABELS[bar.task.task_type] || bar.task.task_type}` : bar.task.title}
                              </span>
                              {bar.task.is_completed && (
                                <span className="text-white text-[10px] ml-auto flex-shrink-0 opacity-80">✓</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {hiddenCount > 0 && (
                        <div
                          className="pointer-events-auto cursor-pointer text-[10px] text-gray-500 font-semibold pl-2 hover:text-emerald-600"
                          style={{ marginTop: `${totalBarRows * (BAR_HEIGHT + BAR_GAP)}px` }}
                        >
                          +{hiddenCount} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      
      {crops.length === 0 && (
        <div className="p-8 text-center text-gray-500">No crops planned yet. Click "Add Crop" to start planning.</div>
      )}
    </div>
  );
}


/* ================================================================
   TIMELINE VIEW
   ================================================================ */
function TimelineView({ tasks, crops, season, onTaskClick }) {
  if (!season) {
    return <div className="p-8 text-center text-gray-500">Select a season to view timeline</div>;
  }

  const year = season.year;
  const viewStart = new Date(year, 0, 1);
  const totalDays = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = Math.round((today - viewStart) / (1000 * 60 * 60 * 24));

  const DAY_WIDTH = 5;
  const SIDEBAR_W = 200;
  const ROW_H = 50;
  const BAR_H = 26;
  const HEADER_H = 44;
  const timelineWidth = totalDays * DAY_WIDTH;
  const totalWidth = SIDEBAR_W + timelineWidth;

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year, i, 1);
    const days = new Date(year, i + 1, 0).getDate();
    const offset = Math.round((d - viewStart) / (1000 * 60 * 60 * 24));
    return { date: d, days, offset, width: days * DAY_WIDTH };
  });

  return (
    <div className="p-2 md:p-4">
      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
          <div style={{ width: `${totalWidth}px`, position: 'relative' }}>
            
            <div className="flex sticky top-0 z-30 border-b" style={{ height: `${HEADER_H}px` }}>
              <div
                className="flex-shrink-0 border-r bg-gray-50 font-bold text-sm flex items-center px-3 sticky left-0 z-40"
                style={{ width: `${SIDEBAR_W}px`, minWidth: `${SIDEBAR_W}px` }}
              >
                Crop
              </div>
              <div className="flex" style={{ width: `${timelineWidth}px` }}>
                {months.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "border-r text-center flex items-center justify-center text-xs font-semibold",
                      i % 2 === 0 ? "bg-gray-50" : "bg-white"
                    )}
                    style={{ width: `${m.width}px`, minWidth: `${m.width}px` }}
                  >
                    {format(m.date, 'MMM')}
                  </div>
                ))}
              </div>
            </div>

            {crops.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No crops planned yet.</div>
            ) : (
              crops.map((crop, idx) => {
                const cropTasks = tasks
                  .filter(t => t.crop_plan_id === crop.id)
                  .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

                return (
                  <div key={crop.id} className={cn("flex border-b relative hover:z-[35]", idx % 2 === 0 ? "bg-white" : "bg-gray-50/50")} style={{ height: `${ROW_H}px` }}>
                    <div
                      className={cn(
                        "flex-shrink-0 border-r flex items-center gap-2 px-3 sticky left-0 z-10",
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      )}
                      style={{ width: `${SIDEBAR_W}px`, minWidth: `${SIDEBAR_W}px` }}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: crop.color_hex || '#10b981' }} />
                      <span className="text-sm truncate font-medium">{crop.label}</span>
                    </div>

                    <div className="relative" style={{ width: `${timelineWidth}px`, minWidth: `${timelineWidth}px` }}>
                      {months.map((m, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-gray-100" style={{ left: `${m.offset * DAY_WIDTH}px` }} />
                      ))}

                      {cropTasks.map(task => {
                        const tStart = parseLocalDate(task.start_date);
                        const tEnd = task.end_date ? parseLocalDate(task.end_date) : new Date(tStart);
                        if (!tStart) return null;
                        
                        const startOff = Math.max(0, Math.round((tStart - viewStart) / (1000*60*60*24)));
                        const endOff = Math.min(totalDays, Math.round((tEnd - viewStart) / (1000*60*60*24)) + 1);
                        const barW = Math.max(BAR_H, (endOff - startOff) * DAY_WIDTH);
                        
                        if (startOff >= totalDays || endOff <= 0) return null;

                        const icon = PHASE_ICONS[task.task_type] || '📋';
                        const bgColor = crop.color_hex || task.color_hex || '#10b981';

                        return (
                          <div
                            key={task.id}
                            className="absolute cursor-pointer hover:brightness-110 hover:shadow-lg transition-all group"
                            style={{
                              left: `${startOff * DAY_WIDTH}px`,
                              width: `${barW}px`,
                              top: `${(ROW_H - BAR_H) / 2}px`,
                              height: `${BAR_H}px`,
                              backgroundColor: bgColor,
                              borderRadius: '5px',
                              opacity: task.is_completed ? 0.5 : 1,
                              zIndex: 5,
                            }}
                            onClick={() => onTaskClick(task)}
                            title={`${crop.label}: ${task.title}\n${task.start_date}${task.end_date ? ' → ' + task.end_date : ''}`}
                          >
                            <div className="flex items-center h-full px-1.5 gap-1 overflow-hidden">
                              <span className="text-xs flex-shrink-0">{icon}</span>
                              {barW > 50 && (
                                <span className="text-[11px] text-white font-semibold truncate">
                                  {barW > 120 ? `${crop.label} - ${PHASE_LABELS[task.task_type] || task.task_type}` : PHASE_LABELS[task.task_type] || task.title}
                                </span>
                              )}
                              {task.is_completed && barW > 30 && (
                                <span className="text-white text-[10px] ml-auto opacity-70 flex-shrink-0">✓</span>
                              )}
                            </div>
                            <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-[100] shadow-lg pointer-events-none">
                              {crop.label}: {task.title}
                              <br />
                              {task.start_date}{task.end_date ? ` → ${task.end_date}` : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            {todayOffset >= 0 && todayOffset < totalDays && (
              <div
                className="absolute pointer-events-none z-20"
                style={{
                  left: `${SIDEBAR_W + todayOffset * DAY_WIDTH}px`,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  backgroundColor: '#ef4444',
                }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-b font-bold whitespace-nowrap">
                  Today
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
