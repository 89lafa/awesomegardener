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
import { format, parseISO, isBefore, isToday, addDays, addMonths, subMonths, startOfMonth, endOfMonth, getDay, getDaysInMonth, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { smartQuery, clearCache } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';

const TASK_TYPE_CONFIG = {
  seed: { icon: Sprout, emoji: '🌱', color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Start Seeds' },
  direct_seed: { icon: Leaf, emoji: '🌾', color: 'bg-green-100 text-green-700 border-green-200', label: 'Direct Sow' },
  transplant: { icon: Shovel, emoji: '🪴', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Transplant' },
  harvest: { icon: CalendarIcon, emoji: '🥕', color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Harvest' },
  cultivate: { icon: Scissors, emoji: '✂️', color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Cultivate' },
  bed_prep: { icon: Shovel, emoji: '🔧', color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Bed Prep' },
  water: { icon: Droplets, emoji: '💧', color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Water' },
  fertilize: { icon: Sprout, emoji: '🌿', color: 'bg-green-100 text-green-700 border-green-200', label: 'Fertilize' },
  mist: { icon: Wind, emoji: '💨', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', label: 'Mist' },
  rotate: { icon: RotateCw, emoji: '🔄', color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Rotate' },
};
const PHASE_LABELS = { seed:'Seeds', direct_seed:'Sow', transplant:'Trans', harvest:'Harv', cultivate:'Cult', bed_prep:'Prep', water:'Water', fertilize:'Fert', rotate:'Rot', mist:'Mist' };

function parseLocalDate(str) { if (!str) return null; const [y,m,d]=str.split('T')[0].split('-').map(Number); return new Date(y,m-1,d); }
function sameDay(a,b) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }

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
      if (error.code === 'RATE_LIMIT') { setRateLimitError(error); setTimeout(() => loadData(true), error.retryInMs || 5000); }
    } finally { setLoading(false); setRetrying(false); }
  };

  const loadSeasons = async () => {
    if (!activeGarden || !user) return;
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

  // ═══════════════════════════════════════════════════════
  // BULK LOADING — the #1 rate-limit fix
  // Old code: Promise.all with per-task API calls (120+ calls)
  // New code: 3 bulk API calls total, enrich in-memory
  // ═══════════════════════════════════════════════════════
  const loadTasksAndCrops = async () => {
    if (!activeSeason) return;
    try {
      const currentUser = await base44.auth.me();
      
      // WAVE 1: Garden data (2 API calls)
      const [cropsData, gardenTasksData] = await Promise.all([
        smartQuery(base44, 'CropPlan', { garden_season_id: activeSeason.id, created_by: currentUser.email }),
        smartQuery(base44, 'CropTask', { garden_season_id: activeSeason.id, created_by: currentUser.email }, 'start_date')
      ]);
      setCropPlans(cropsData);
      setTasks(gardenTasksData.map(t => ({ ...t, source: 'garden', category: 'outdoor', date_field: 'start_date' })));

      // WAVE 2: Indoor data after delay (max 3 API calls)
      setTimeout(async () => {
        try {
          const indoorTasksData = await base44.entities.IndoorCareTask.filter({ created_by: currentUser.email }, 'due_date');
          
          // Load ALL plants in ONE call
          const allPlants = await smartQuery(base44, 'IndoorPlant', { created_by: currentUser.email });
          const plantMap = {};
          allPlants.forEach(p => { plantMap[p.id] = p; });

          // Enrich in-memory — ZERO additional API calls
          const enrichedIndoorTasks = indoorTasksData.map(t => {
            const plant = plantMap[t.indoor_plant_id];
            const plantName = plant?.nickname || 'Plant';
            const typeEmoji = { water:'💧', fertilize:'🌿', rotate:'🔄', mist:'💨' }[t.task_type] || '📝';
            return {
              ...t, source: 'indoor', category: 'indoor', date_field: 'due_date', start_date: t.due_date,
              title: t.title || `${typeEmoji} ${t.task_type?.charAt(0).toUpperCase()}${t.task_type?.slice(1)} ${plantName}`,
              plant_name: plantName
            };
          });

          setTasks(prev => {
            const gardenOnly = prev.filter(t => t.source !== 'indoor');
            return [...gardenOnly, ...enrichedIndoorTasks].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
          });

          // Generate tasks for plants without any
          if (indoorTasksData.length === 0 && allPlants.length > 0) {
            generateIndoorCareTasks(currentUser, allPlants);
          } else {
            const plantsWithTasks = new Set();
            indoorTasksData.filter(t => !t.is_completed).forEach(t => { if (t.indoor_plant_id) plantsWithTasks.add(t.indoor_plant_id); });
            const plantsNeedingTasks = allPlants.filter(p => !plantsWithTasks.has(p.id));
            if (plantsNeedingTasks.length > 0) generateIndoorCareTasks(currentUser, plantsNeedingTasks);
          }
        } catch (error) { console.warn('Indoor tasks failed (non-critical):', error.message); }
      }, 800);

    } catch (error) {
      console.error('Error loading tasks:', error);
      if (error.code === 'RATE_LIMIT') setRateLimitError(error);
    }
  };

  // SEQUENTIAL task generation — never parallel
  const generateIndoorCareTasks = async (currentUser, plants) => {
    console.log(`[Tasks] Generating care for ${plants.length} plants`);
    const now = new Date();
    let created = 0;
    for (const plant of plants) {
      try {
        const name = plant.nickname || 'Plant';
        let nextWater = plant.last_watered_date ? addDays(new Date(plant.last_watered_date), 7) : now;
        if (isBefore(nextWater, now)) nextWater = now;
        for (let i = 0; i < 2; i++) {
          await base44.entities.IndoorCareTask.create({ indoor_plant_id: plant.id, task_type: 'water', title: `💧 Water ${name}`, due_date: format(nextWater, 'yyyy-MM-dd'), is_completed: false });
          created++;
          nextWater = addDays(nextWater, 7);
          await new Promise(r => setTimeout(r, 400));
        }
        let nextRotate = plant.last_rotated_date ? addDays(new Date(plant.last_rotated_date), 14) : addDays(now, 3);
        if (isBefore(nextRotate, now)) nextRotate = addDays(now, 3);
        await base44.entities.IndoorCareTask.create({ indoor_plant_id: plant.id, task_type: 'rotate', title: `🔄 Rotate ${name}`, due_date: format(nextRotate, 'yyyy-MM-dd'), is_completed: false });
        created++;
        await new Promise(r => setTimeout(r, 500));
      } catch (e) { console.warn(`Task gen failed for ${plant.id}:`, e.message); await new Promise(r => setTimeout(r, 1000)); }
    }
    if (created > 0) { toast.success(`Generated ${created} indoor care tasks`); setTimeout(() => loadTasksAndCrops(), 1000); }
  };

  const handleToggleComplete = async (task) => {
    const newCompleted = !task.is_completed;
    setTasks(tasks.map(t => t.id === task.id ? { ...t, is_completed: newCompleted, quantity_completed: newCompleted ? task.quantity_target : 0 } : t));
    try {
      if (task.source === 'indoor') {
        await base44.entities.IndoorCareTask.update(task.id, { is_completed: newCompleted, completed_date: newCompleted ? new Date().toISOString() : null });
        if (newCompleted && task.indoor_plant_id) {
          const updates = {};
          if (task.task_type === 'water') updates.last_watered_date = new Date().toISOString();
          if (task.task_type === 'fertilize') updates.last_fertilized_date = new Date().toISOString();
          if (task.task_type === 'rotate') updates.last_rotated_date = new Date().toISOString();
          if (Object.keys(updates).length > 0) await base44.entities.IndoorPlant.update(task.indoor_plant_id, updates);
        }
      } else {
        await base44.entities.CropTask.update(task.id, { is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null, quantity_completed: newCompleted ? task.quantity_target : 0 });
      }
    } catch (error) { setTasks(tasks.map(t => t.id === task.id ? task : t)); toast.error('Failed to update task'); }
  };

  const getFilteredTasks = () => tasks.filter(task => {
    if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
    if (taskTypeFilter !== 'all' && task.task_type !== taskTypeFilter) return false;
    if (statusFilter === 'completed' && !task.is_completed) return false;
    if (statusFilter === 'open' && task.is_completed) return false;
    return true;
  });

  const groupTasksByDate = (list) => {
    const now = startOfDay(new Date()), in7 = addDays(now, 7), in30 = addDays(now, 30);
    const overdue = [], next7 = [], next30 = [], later = [];
    list.forEach(t => {
      if (!t.start_date || t.is_completed) return;
      const d = startOfDay(parseISO(t.start_date));
      if (isBefore(d, now)) overdue.push(t); else if (isBefore(d, in7)) next7.push(t); else if (isBefore(d, in30)) next30.push(t); else later.push(t);
    });
    return { overdue, next7, next30, later };
  };

  const filteredTasks = getFilteredTasks();
  const { overdue, next7, next30, later } = groupTasksByDate(filteredTasks);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  if (gardens.length === 0) return <div className="h-[calc(100vh-8rem)] flex items-center justify-center"><Card className="max-w-md w-full p-8 text-center"><CalendarIcon className="w-16 h-16 text-emerald-600 mx-auto mb-3" /><h2 className="text-xl font-semibold mb-2">No Gardens Yet</h2></Card></div>;

  const TaskRow = ({ task }) => {
    const crop = cropPlans.find(c => c.id === task.crop_plan_id);
    const typeInfo = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.cultivate;
    const Icon = typeInfo.icon;
    return (
      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
        <Checkbox checked={task.is_completed} onCheckedChange={() => handleToggleComplete(task)} className="flex-shrink-0" />
        <div className={cn("p-2 rounded-lg flex-shrink-0", typeInfo.color)}><Icon className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium text-sm", task.is_completed && "line-through text-gray-500")}>{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-500">{task.start_date ? format(parseISO(task.start_date), 'MMM d') : ''}</p>
            {crop && <><div className="w-2 h-2 rounded-full" style={{ backgroundColor: crop.color_hex || '#10b981' }} /><span className="text-xs text-gray-500">{crop.label}</span></>}
            {task.source === 'indoor' && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">🪴</Badge>}
          </div>
        </div>
        <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
      </div>
    );
  };

  const TaskGroup = ({ title, tasks: g, colorClass }) => g.length === 0 ? null : (
    <div className="space-y-2">
      <h3 className={cn("font-semibold text-sm flex items-center gap-2", colorClass)}>{title}<Badge variant="secondary">{g.length}</Badge></h3>
      <div className="space-y-2">{g.map(t => <TaskRow key={t.id} task={t} />)}</div>
    </div>
  );

  // ═══════ CALENDAR GRID VIEW ═══════
  const MonthCalendarGrid = () => {
    const today = startOfDay(new Date());
    const mY = calendarMonth.getFullYear(), mI = calendarMonth.getMonth();
    const startDow = getDay(new Date(mY, mI, 1)), dim = getDaysInMonth(calendarMonth);
    const selectedDayTasks = selectedCalendarDate ? filteredTasks.filter(t => { if (!t.start_date) return false; const s=parseLocalDate(t.start_date), e=t.end_date?parseLocalDate(t.end_date):s; return s&&selectedCalendarDate>=s&&selectedCalendarDate<=e; }) : [];
    function getWeeks() { const w=[]; let c=new Date(mY,mI,1-startDow); const last=new Date(mY,mI,dim); while(c<=last){ const d=[]; for(let i=0;i<7;i++) d.push(new Date(c.getFullYear(),c.getMonth(),c.getDate()+i)); w.push(d); c=new Date(c.getFullYear(),c.getMonth(),c.getDate()+7); } return w; }
    function getBars(wd) {
      const ws=new Date(wd[0]);ws.setHours(0,0,0,0); const we=new Date(wd[6]);we.setHours(23,59,59,999);
      const b=[]; filteredTasks.forEach(t=>{ if(!t.start_date)return; const s=parseLocalDate(t.start_date),e=t.end_date?parseLocalDate(t.end_date):new Date(s); if(!s)return; s.setHours(0,0,0,0);e.setHours(23,59,59,999); if(s<=we&&e>=ws){ const cr=cropPlans.find(c=>c.id===t.crop_plan_id); b.push({task:t,crop:cr,startCol:s<ws?0:s.getDay(),endCol:e>we?6:e.getDay(),continuesFrom:s<ws,continuesTo:e>we,row:0}); }});
      b.sort((a,c)=>(c.endCol-c.startCol)-(a.endCol-a.startCol)||a.startCol-c.startCol);
      const re=[]; b.forEach(bar=>{ let p=false; for(let r=0;r<re.length;r++){ if(bar.startCol>re[r]){re[r]=bar.endCol;bar.row=r;p=true;break;}} if(!p){bar.row=re.length;re.push(bar.endCol);}});
      return b;
    }
    const weeks=getWeeks(), MX=3, BH=20, BG=2, DH=22;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={()=>setCalendarMonth(m=>subMonths(m,1))}><ChevronLeft className="w-4 h-4"/></Button>
          <h3 className="text-lg font-bold text-gray-800">{format(calendarMonth,'MMMM yyyy')}</h3>
          <Button variant="outline" size="icon" onClick={()=>setCalendarMonth(m=>addMonths(m,1))}><ChevronRight className="w-4 h-4"/></Button>
        </div>
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="text-center text-[11px] font-semibold py-2.5 text-gray-400 border-r last:border-r-0 uppercase tracking-wider">{d}</div>)}
          </div>
          {weeks.map((wd,wi)=>{ const bars=getBars(wd), vb=bars.filter(b=>b.row<MX), hc=bars.filter(b=>b.row>=MX).length, tr=Math.min(bars.length>0?Math.max(...bars.map(b=>b.row))+1:0,MX), rh=DH+tr*(BH+BG)+(hc>0?16:0)+8;
            return(<div key={wi} className="relative border-b last:border-b-0" style={{minHeight:`${Math.max(rh,70)}px`}}>
              <div className="grid grid-cols-7 absolute inset-0">{wd.map((day,di)=>{const isCM=day.getMonth()===mI,isT=sameDay(day,today),isS=selectedCalendarDate&&sameDay(day,selectedCalendarDate);return(<div key={di} className={cn("border-r last:border-r-0 cursor-pointer transition-colors",!isCM&&"bg-gray-50/70",isCM&&"hover:bg-emerald-50/40",isT&&"bg-amber-50/60",isS&&"bg-emerald-50 ring-2 ring-inset ring-emerald-400")} onClick={()=>isCM&&setSelectedCalendarDate(day)}><div className="flex justify-end p-1.5"><span className={cn("text-xs font-medium",isT&&"bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-[11px] font-bold",!isCM&&"text-gray-300",isCM&&!isT&&"text-gray-600")}>{day.getDate()}</span></div></div>);})}</div>
              <div className="relative pointer-events-none" style={{paddingTop:`${DH}px`}}>
                {vb.map(bar=>{const lp=(bar.startCol/7)*100,wp=((bar.endCol-bar.startCol+1)/7)*100,tp=bar.row*(BH+BG),bg=bar.crop?.color_hex||bar.task.color_hex||'#10b981',ic=(TASK_TYPE_CONFIG[bar.task.task_type]||{}).emoji||'📋';let br='4px';if(bar.continuesFrom&&bar.continuesTo)br='0';else if(bar.continuesFrom)br='0 4px 4px 0';else if(bar.continuesTo)br='4px 0 0 4px';const lbl=bar.crop?.label?`${bar.crop.label} - ${PHASE_LABELS[bar.task.task_type]||bar.task.task_type}`:bar.task.title;
                  return(<div key={`${bar.task.id}-${wi}`} className="absolute pointer-events-auto cursor-pointer hover:brightness-110 hover:shadow-md transition-all" style={{left:`calc(${lp}% + 2px)`,width:`calc(${wp}% - 4px)`,top:`${tp}px`,height:`${BH}px`,backgroundColor:bg,borderRadius:br,opacity:bar.task.is_completed?.5:1,zIndex:10}} title={`${bar.crop?.label||''}: ${bar.task.title}`} onClick={e=>{e.stopPropagation();setSelectedCalendarDate(parseLocalDate(bar.task.start_date));}}>
                    <div className="flex items-center h-full px-1.5 gap-0.5 overflow-hidden"><span className="text-[11px] flex-shrink-0">{ic}</span><span className="text-[11px] text-white font-semibold truncate">{lbl}</span>{bar.task.is_completed&&<span className="text-white text-[10px] ml-auto flex-shrink-0 opacity-70">✓</span>}</div></div>);})}
                {hc>0&&<div className="pointer-events-auto text-[10px] text-gray-500 font-semibold pl-2" style={{marginTop:`${tr*(BH+BG)}px`}}>+{hc} more</div>}
              </div>
            </div>);})}
        </div>
        {selectedCalendarDate&&<Card><CardContent className="p-4"><h3 className="font-semibold text-sm mb-3 flex items-center gap-2">📅 {format(selectedCalendarDate,'EEEE, MMMM d, yyyy')}<Badge variant="secondary">{selectedDayTasks.length}</Badge></h3>{selectedDayTasks.length===0?<p className="text-sm text-gray-500 text-center py-4">No tasks</p>:<div className="space-y-2">{selectedDayTasks.map(t=><TaskRow key={t.id} task={t}/>)}</div>}</CardContent></Card>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {rateLimitError && <RateLimitBanner retryInMs={rateLimitError.retryInMs||5000} onRetry={()=>loadData(true)} retrying={retrying}/>}
      <div className="flex flex-col gap-4">
        <div><h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Tasks</h1><p className="text-gray-600 mt-1">Planting schedules and plant care</p></div>
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-36"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Tasks</SelectItem><SelectItem value="outdoor">🌱 Garden</SelectItem><SelectItem value="indoor">🪴 Indoor</SelectItem></SelectContent></Select>
          <Select value={viewMode} onValueChange={setViewMode}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="list">📋 List View</SelectItem><SelectItem value="calendar">📅 Calendar View</SelectItem><SelectItem value="kanban">📊 Kanban Board</SelectItem></SelectContent></Select>
          <Select value={activeGarden?.id} onValueChange={id=>{const g=gardens.find(x=>x.id===id);setActiveGarden(g);localStorage.setItem('tasks_active_garden',id);}}><SelectTrigger className="w-48"><SelectValue placeholder="Select garden"/></SelectTrigger><SelectContent>{gardens.map(g=><SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select>
          <Select value={activeSeason?.id} onValueChange={id=>{const s=seasons.find(x=>x.id===id);setActiveSeason(s);localStorage.setItem('tasks_active_season',id);}}><SelectTrigger className="w-40"><SelectValue placeholder="Season"/></SelectTrigger><SelectContent>{seasons.map(s=><SelectItem key={s.id} value={s.id}>{s.year} {s.season}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select>
        </div>
      </div>
      {viewMode!=='kanban'&&<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{overdue.length}</p><p className="text-sm text-gray-600">Overdue</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{next7.length}</p><p className="text-sm text-gray-600">Next 7 Days</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{next30.length}</p><p className="text-sm text-gray-600">Next 30 Days</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-600">{tasks.filter(t=>t.is_completed).length}</p><p className="text-sm text-gray-600">Completed</p></CardContent></Card>
      </div>}
      {!activeSeason?<Card className="p-8 text-center"><CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3"/><p className="text-gray-600">Select a garden and season</p></Card>
       :tasks.length===0?<Card className="p-8 text-center"><CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3"/><p className="text-gray-600 mb-2">No tasks yet</p><p className="text-sm text-gray-500">Add crops or indoor plants to generate tasks</p></Card>
       :viewMode==='kanban'?<KanbanBoard tasks={filteredTasks} cropPlans={cropPlans} onTaskUpdate={()=>{clearCache();loadTasksAndCrops();}}/>
       :viewMode==='calendar'?<MonthCalendarGrid/>
       :<div className="space-y-6"><TaskGroup title="⚠️ Overdue" tasks={overdue} colorClass="text-red-600"/><TaskGroup title="📅 Next 7 Days" tasks={next7} colorClass="text-amber-600"/><TaskGroup title="🗓️ Next 30 Days" tasks={next30} colorClass="text-emerald-600"/>{later.length>0&&<TaskGroup title="📆 Later" tasks={later} colorClass="text-gray-600"/>}</div>}
    </div>
  );
}
