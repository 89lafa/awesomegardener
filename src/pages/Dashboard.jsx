import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, Sprout, Calendar, Package, ListChecks, Sun, Moon,
  MessageSquare, TrendingUp, AlertTriangle, ArrowRight, Cloud,
  Leaf, Bug, Scissors, Droplets, Flame, Trophy, Star, Zap,
  ChevronRight, Timer, Target
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO, isToday, isBefore, startOfDay, addDays } from 'date-fns';
import QuickCheckInWidget from '@/components/dashboard/QuickCheckInWidget';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import RecipeSuggestionsWidget from '@/components/dashboard/RecipeSuggestionsWidget';
import TipOfDayWidget from '@/components/dashboard/TipOfDayWidget';
import StreakWidget from '@/components/gamification/StreakWidget';
import LatestBadgeWidget from '@/components/gamification/LatestBadgeWidget';
import LevelProgressWidget from '@/components/gamification/LevelProgressWidget';
import LeaderboardRankWidget from '@/components/gamification/LeaderboardRankWidget';
import ChallengeProgressWidget from '@/components/gamification/ChallengeProgressWidget';
import IndoorCareWidget from '@/components/dashboard/IndoorCareWidget';
import { smartQuery } from '@/components/utils/smartQuery';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════
   ANIMATED COUNTER — Numbers that count up
   ═══════════════════════════════════════════ */
function AnimatedCounter({ value, duration = 800 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const end = parseInt(value) || 0;
    if (end === 0) { setCount(0); return; }
    let start = 0;
    const step = Math.max(1, Math.ceil(end / 30));
    const interval = Math.max(duration / 30, 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(start);
    }, interval);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span ref={ref}>{count}</span>;
}

/* ═══════════════════════════════════════════
   MINI PROGRESS RING — Circular progress
   ═══════════════════════════════════════════ */
function ProgressRing({ progress, size = 44, stroke = 4, color = '#10b981' }) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke="currentColor" strokeWidth={stroke} className="text-gray-200 dark:text-gray-700" />
      <circle cx={size/2} cy={size/2} r={radius} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   STAT CARD — Hero metric cards
   ═══════════════════════════════════════════ */
function StatCard({ icon: Icon, emoji, title, value, subtitle, color, gradient, page, delay = 0 }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  
  return (
    <div 
      onClick={() => page && navigate(createPageUrl(page))}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all duration-500 group",
        "hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
      style={{ 
        background: gradient || 'var(--card-bg, white)',
        border: '1px solid var(--border-color, #e5e7eb)'
      }}
    >
      {/* Decorative gradient blob */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 group-hover:opacity-30 transition-opacity"
        style={{ background: color || '#10b981', filter: 'blur(20px)' }} />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: color || '#10b981' }}>
            {title}
          </p>
          <p className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            <AnimatedCounter value={value} />
          </p>
          {subtitle && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
          )}
        </div>
        <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: `${color || '#10b981'}15` }}>
          {emoji || (Icon && <Icon className="w-6 h-6" style={{ color: color || '#10b981' }} />)}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   WEATHER CARD — Beautiful weather widget
   ═══════════════════════════════════════════ */
function WeatherWidget({ weather, loading }) {
  if (loading) {
    return (
      <div className="rounded-2xl p-5 flex items-center justify-center" 
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', minHeight: 130 }}>
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
      </div>
    );
  }
  if (!weather) {
    return (
      <div className="rounded-2xl p-5 flex flex-col items-center justify-center text-center"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', minHeight: 130 }}>
        <Cloud className="w-8 h-8 mb-2 text-gray-400" />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set ZIP in Settings for weather</p>
      </div>
    );
  }

  const getWeatherGradient = (temp) => {
    if (temp <= 32) return 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)';
    if (temp <= 50) return 'linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)';
    if (temp <= 75) return 'linear-gradient(135deg, #059669 0%, #34d399 100%)';
    if (temp <= 90) return 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)';
    return 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)';
  };

  return (
    <div className="rounded-2xl p-5 text-white relative overflow-hidden"
      style={{ background: getWeatherGradient(weather.current_temp), minHeight: 130 }}>
      <div className="absolute top-0 right-0 text-6xl opacity-20 leading-none pr-3 pt-1">
        {weather.conditions_icon || '🌤️'}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Today's Weather</p>
      <p className="text-4xl font-extrabold">{weather.current_temp}°F</p>
      <p className="text-sm opacity-90 mt-1">{weather.conditions}</p>
      <div className="flex gap-4 mt-2 text-xs opacity-80">
        <span>↑ {weather.high_temp}°</span>
        <span>↓ {weather.low_temp}°</span>
        {weather.precipitation_chance > 20 && <span>💧 {weather.precipitation_chance}%</span>}
      </div>
      {weather.frost_warning && (
        <div className="absolute bottom-3 right-3 bg-yellow-400/30 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Frost Risk!
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   UPCOMING TASKS WIDGET
   ═══════════════════════════════════════════ */
function UpcomingTasksWidget({ tasks, onNavigate }) {
  const today = startOfDay(new Date());
  const upcoming = tasks
    .filter(t => !t.is_completed && t.start_date)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5);

  const TASK_ICONS = { seed: '🌱', transplant: '🪴', harvest: '🥕', water: '💧', cultivate: '✂️', direct_seed: '🌾', bed_prep: '🔧' };

  return (
    <div className="glass-card-no-padding h-full">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Timer className="w-4 h-4 text-emerald-500" /> Upcoming Tasks
          </h3>
          <button onClick={() => onNavigate('CalendarTasks')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 flex items-center gap-0.5">
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {upcoming.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>All caught up!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map(task => {
              const taskDate = parseISO(task.start_date);
              const isOverdue = isBefore(taskDate, today);
              const isTaskToday = isToday(taskDate);
              const daysAway = differenceInDays(taskDate, today);
              return (
                <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20">
                  <span className="text-lg flex-shrink-0">{TASK_ICONS[task.task_type] || '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {format(taskDate, 'MMM d')}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-full",
                    isOverdue ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                    isTaskToday ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                    daysAway <= 7 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  )}>
                    {isOverdue ? 'Overdue' : isTaskToday ? 'Today' : daysAway <= 7 ? `${daysAway}d` : format(taskDate, 'MMM d')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   QUICK ACTION PILL
   ═══════════════════════════════════════════ */
function QuickAction({ emoji, label, page }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(createPageUrl(page))}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105 hover:shadow-md"
      style={{ 
        background: 'var(--card-bg)', 
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)'
      }}
    >
      <span className="text-base">{emoji}</span>
      {label}
      <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-40" />
    </button>
  );
}

/* ═══════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    gardens: 0, seedLots: 0, activeCrops: 0, tasks: 0,
    indoorSpaces: 0, indoorPlants: 0, tradesPending: 0,
    overdueTasks: 0
  });
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [popularCrops, setPopularCrops] = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const weatherLoadedRef = useRef(false);
  const achievementsCheckedRef = useRef(false);
  
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    // Try session cache first
    const cached = sessionStorage.getItem('dashboard_state');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - (parsed.timestamp || 0) < 120000) {
          setStats(parsed.stats || {});
          setPopularCrops(parsed.popularCrops);
          setWeather(parsed.weather);
          setUpcomingTasks(parsed.upcomingTasks || []);
          setUser(parsed.user);
          setLoading(false);
          setWeatherLoading(false);
          return;
        }
      } catch (e) { /* ignore */ }
    }
    loadDashboard();
    setTimeout(loadWeather, 1500);
    setTimeout(checkAchievements, 3000);
  }, []);

  const checkAchievements = async () => {
    if (achievementsCheckedRef.current) return;
    achievementsCheckedRef.current = true;
    try {
      const response = await base44.functions.invoke('checkAchievements', {});
      if (response?.data?.newlyUnlocked?.length > 0) {
        response.data.newlyUnlocked.forEach(ach => {
          toast.success(`🏆 Achievement Unlocked: ${ach.title} (+${ach.points} pts)`);
        });
      }
    } catch (error) { console.warn('Achievement check failed (non-critical):', error.message); }
  };

  function getWeatherIcon(code) {
    const c = parseInt(code) || 0;
    if (c >= 200 && c < 300) return '⛈️';
    if (c >= 300 && c < 600) return '🌧️';
    if (c >= 600 && c < 700) return '❄️';
    if (c >= 700 && c < 800) return '🌫️';
    if (c === 800) return '☀️';
    if (c > 800) return '⛅';
    return '🌤️';
  }

  const loadWeather = async () => {
    if (weatherLoadedRef.current) return;
    weatherLoadedRef.current = true;
    try {
      const u = await base44.auth.me();
      const zip = u?.location_zip;
      if (!zip) { setWeatherLoading(false); return; }
      const today = new Date().toISOString().split('T')[0];
      const cached = await base44.entities.WeatherCache.filter({ zip_code: zip, date: today }).then(r => r[0]);
      if (cached && new Date(cached.expires_at) > new Date()) { setWeather(cached); setWeatherLoading(false); return; }
      const response = await fetch(`https://wttr.in/${zip}?format=j1`);
      const data = await response.json();
      const current = data.current_condition?.[0];
      const forecast = data.weather?.[0];
      const weatherData = {
        zip_code: zip, date: today,
        high_temp: parseInt(forecast?.maxtempF), low_temp: parseInt(forecast?.mintempF),
        current_temp: parseInt(current?.temp_F), conditions: current?.weatherDesc?.[0]?.value || 'Unknown',
        conditions_icon: getWeatherIcon(current?.weatherCode),
        precipitation_chance: parseInt(forecast?.hourly?.[0]?.chanceofrain) || 0,
        wind_speed_mph: parseInt(current?.windspeedMiles) || 0,
        humidity_percent: parseInt(current?.humidity) || 0,
        frost_warning: parseInt(forecast?.mintempF) <= 32,
        heat_warning: parseInt(forecast?.maxtempF) >= 95
      };
      if (cached) await base44.entities.WeatherCache.update(cached.id, weatherData);
      else await base44.entities.WeatherCache.create(weatherData);
      setWeather(weatherData);
    } catch (err) { console.warn('Weather failed (non-critical):', err.message); }
    finally { setWeatherLoading(false); }
  };

  /* ═══════════════════════════════════════
     WAVE-BASED LOADING — Prevents rate limits
     ═══════════════════════════════════════ */
  const loadDashboard = async () => {
    setLoading(true);
    try {
      // WAVE 1: Core (2 API calls)
      const userData = await base44.auth.me();
      setUser(userData);
      const [gardens, seedLots] = await Promise.all([
        smartQuery(base44, 'Garden', { created_by: userData.email, archived: false }),
        smartQuery(base44, 'SeedLot', { created_by: userData.email })
      ]);
      const newStats = { ...stats, gardens: gardens.length, seedLots: seedLots.length };
      setStats(newStats);
      setLoading(false);

      // WAVE 2: Crops + Tasks (staggered, 1 call each)
      setTimeout(async () => {
        try {
          const crops = await smartQuery(base44, 'CropPlan', { created_by: userData.email, status: 'active' });
          setStats(prev => ({ ...prev, activeCrops: crops.length }));
        } catch (e) { /* non-critical */ }
      }, 800);

      setTimeout(async () => {
        try {
          const tasks = await smartQuery(base44, 'CropTask', { created_by: userData.email, is_completed: false });
          const now = startOfDay(new Date());
          const overdueTasks = tasks.filter(t => t.start_date && isBefore(parseISO(t.start_date), now)).length;
          setStats(prev => ({ ...prev, tasks: tasks.length, overdueTasks }));
          setUpcomingTasks(tasks.slice(0, 10));
        } catch (e) { /* non-critical */ }
      }, 1200);

      // WAVE 3: Indoor + Trades (staggered)
      setTimeout(async () => {
        try {
          const plants = await smartQuery(base44, 'IndoorPlant', { created_by: userData.email });
          setStats(prev => ({ ...prev, indoorPlants: plants.length }));
        } catch (e) { /* non-critical */ }
      }, 1800);

      setTimeout(async () => {
        try {
          const trades = await smartQuery(base44, 'SeedTrade', { recipient_id: userData.id, status: 'pending' });
          setStats(prev => ({ ...prev, tradesPending: trades.length }));
        } catch (e) { /* non-critical */ }
      }, 2200);

      // WAVE 4: Popular crops
      setTimeout(async () => {
        try {
          const res = await base44.functions.invoke('getPopularCrops', {});
          setPopularCrops(res.data);
          sessionStorage.setItem('dashboard_state', JSON.stringify({
            stats: newStats, popularCrops: res.data, weather, upcomingTasks: [], user: userData, timestamp: Date.now()
          }));
        } catch (e) { /* non-critical */ }
      }, 3000);
    } catch (error) {
      console.error('Dashboard load error:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading your garden...</p>
      </div>
    );
  }

  const daysToFrost = user?.last_frost_date 
    ? differenceInDays(new Date(user.last_frost_date), new Date())
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ═══ HERO HEADER ═══ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {greeting}, {user?.nickname || user?.full_name?.split(' ')[0] || 'Gardener'}! 
            <span className="ml-2">{new Date().getHours() < 12 ? '🌅' : new Date().getHours() < 17 ? '☀️' : '🌙'}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </span>
            {user?.zone && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                🌍 Zone {user.zone}
              </span>
            )}
            {daysToFrost !== null && daysToFrost > 0 && daysToFrost < 90 && (
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full",
                daysToFrost <= 14 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                daysToFrost <= 30 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              )}>
                ❄️ {daysToFrost} days to last frost
              </span>
            )}
            {stats.overdueTasks > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse">
                ⚠️ {stats.overdueTasks} overdue
              </span>
            )}
          </div>
        </div>

        {/* Mascot — desktop only */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          <div className="rounded-2xl px-5 py-3 shadow-lg" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {stats.overdueTasks > 0 
                ? `You have ${stats.overdueTasks} overdue tasks! Let's catch up! 💪`
                : stats.activeCrops > 0 
                  ? `${stats.activeCrops} crops growing strong! 🌱` 
                  : `Ready to start planning? Let's go! 🚀`}
            </p>
          </div>
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69574c64117f491d092417ec/40f1c1296_SirSproutington.png"
            alt="Sir Sproutington"
            className="w-20 h-20 object-contain flex-shrink-0"
          />
        </div>
      </div>

      {/* ═══ GAMIFICATION ROW ═══ */}
      <div className="grid md:grid-cols-3 gap-4">
        <LevelProgressWidget loadDelay={0} />
        <StreakWidget loadDelay={400} />
        <LatestBadgeWidget loadDelay={800} />
      </div>

      {/* ═══ HERO STATS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          emoji="🌱" title="Active Crops" value={stats.activeCrops}
          subtitle={stats.activeCrops > 0 ? "Growing now" : "Add crops to start"}
          color="#10b981" page="Calendar" delay={0}
        />
        <StatCard
          emoji="📋" title="Open Tasks" value={stats.tasks}
          subtitle={stats.overdueTasks > 0 ? `${stats.overdueTasks} overdue!` : "You're on track"}
          color={stats.overdueTasks > 0 ? "#ef4444" : "#3b82f6"} page="CalendarTasks" delay={100}
        />
        <StatCard
          emoji="🌰" title="Seed Lots" value={stats.seedLots}
          subtitle="In your stash"
          color="#f59e0b" page="SeedStash" delay={200}
        />
        <StatCard
          emoji="🪴" title="Indoor Plants" value={stats.indoorPlants}
          subtitle="Under your care"
          color="#8b5cf6" page="MyIndoorPlants" delay={300}
        />
        <div className="col-span-2 lg:col-span-1">
          <WeatherWidget weather={weather} loading={weatherLoading} />
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left column — Tasks + Actions */}
        <div className="lg:col-span-2 space-y-4">
          <UpcomingTasksWidget tasks={upcomingTasks} onNavigate={(page) => navigate(createPageUrl(page))} />
          
          {/* Quick Actions */}
          <div className="glass-card-no-padding">
            <div className="p-5">
              <h3 className="font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Zap className="w-4 h-4 text-amber-500" /> Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction emoji="📅" label="Plan Crops" page="Calendar" />
                <QuickAction emoji="🌱" label="Manage Seeds" page="SeedStash" />
                <QuickAction emoji="✓" label="View Tasks" page="CalendarTasks" />
                <QuickAction emoji="🪴" label="Indoor Plants" page="MyIndoorPlants" />
                <QuickAction emoji="🌾" label="Seed Trading" page="SeedTrading" />
                <QuickAction emoji="🏡" label="Community" page="Community" />
              </div>
            </div>
          </div>
        </div>

        {/* Right column — Gamification + Care */}
        <div className="space-y-4">
          <LeaderboardRankWidget loadDelay={1200} />
          <ChallengeProgressWidget loadDelay={1600} />
          <IndoorCareWidget loadDelay={2000} compact />
        </div>
      </div>

      {/* ═══ SECONDARY ROW ═══ */}
      <div className="grid md:grid-cols-3 gap-4">
        <QuickCheckInWidget loadDelay={2400} compact />
        <ActivityFeed limit={3} loadDelay={2800} compact />
        
        {/* AI Tools Card */}
        <div className="glass-card-no-padding">
          <div className="p-5">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              ✨ AI Tools
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Get AI-powered planting advice, disease identification, and crop planning
            </p>
            <Button 
              onClick={() => navigate(createPageUrl('AIAssistants'))} 
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25"
            >
              <Sprout className="w-4 h-4 mr-2" />
              Explore AI Tools
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ POPULAR CROPS ═══ */}
      {popularCrops && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Flame className="w-5 h-5 text-orange-500" /> What Others Are Growing
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {['tomatoes', 'peppers', 'other'].map(cropType => (
              <div key={cropType} className="glass-card-no-padding">
                <div className="p-5">
                  <h3 className="text-base flex items-center gap-2 mb-4 font-bold" style={{ color: 'var(--text-primary)' }}>
                    {cropType === 'tomatoes' ? '🍅 Top Tomatoes' : cropType === 'peppers' ? '🌶️ Top Peppers' : '🥬 Top Other'}
                  </h3>
                  <div className="space-y-1.5">
                    {popularCrops[cropType]?.length > 0 ? (
                      popularCrops[cropType].map((crop, idx) => (
                        <a href={`/ViewVariety?id=${crop.variety_id}`} key={crop.variety_id}
                          className="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20">
                          <span className="text-xs font-bold w-5 text-center" style={{ color: 'var(--text-muted)' }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                          </span>
                          <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{crop.variety_name}</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {crop.unique_users} growers
                          </span>
                        </a>
                      ))
                    ) : (
                      <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Not enough data yet</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TIP OF THE DAY ═══ */}
      <TipOfDayWidget loadDelay={3200} />

      {/* ═══ NEW USER CTA ═══ */}
      {stats.gardens === 0 && (
        <div className="relative overflow-hidden rounded-2xl p-8 text-center"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)' }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="relative">
            <Sprout className="w-16 h-16 text-white mx-auto mb-4 opacity-90" />
            <h3 className="text-2xl font-bold text-white mb-2">Welcome to AwesomeGardener!</h3>
            <p className="text-emerald-100 mb-6 max-w-md mx-auto">
              Create your first garden to start planning crops, tracking seeds, and managing your growing space.
            </p>
            <Button onClick={() => navigate(createPageUrl('Gardens'))} size="lg"
              className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold shadow-xl">
              Create Your First Garden
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
