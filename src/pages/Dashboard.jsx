import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Sprout, 
  Calendar, 
  Package, 
  ListChecks,
  MessageSquare,
  TrendingUp,
  CloudRain,
  AlertTriangle,
  ArrowRight,
  Cloud,
  Wind,
  Droplets
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import QuickCheckInWidget from '@/components/dashboard/QuickCheckInWidget';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import RecipeSuggestionsWidget from '@/components/dashboard/RecipeSuggestionsWidget';
import TipOfDayWidget from '@/components/dashboard/TipOfDayWidget';
import StreakWidget from '@/components/gamification/StreakWidget';
import LatestBadgeWidget from '@/components/gamification/LatestBadgeWidget';
import LevelProgressWidget from '@/components/gamification/LevelProgressWidget';
import LeaderboardRankWidget from '@/components/gamification/LeaderboardRankWidget';
import ChallengeProgressWidget from '@/components/gamification/ChallengeProgressWidget';

const QuickAccessCard = ({ icon: Icon, title, count, color, page }) => {
  const navigate = useNavigate();
  const colorMap = {
    'bg-emerald-500': '#10b981',
    'bg-blue-500': '#3b82f6',
    'bg-amber-500': '#f59e0b',
    'bg-green-600': '#059669',
    'bg-purple-500': '#8b5cf6',
    'bg-pink-500': '#ec4899'
  };
  
  const iconColor = colorMap[color] || '#10b981';
  
  return (
    <div 
      className="glass-card cursor-pointer"
      onClick={() => navigate(createPageUrl(page))}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</p>
          <p className="text-2xl md:text-3xl font-bold" style={{ color: iconColor }}>{count}</p>
        </div>
        <div style={{ 
          padding: '8px md:12px', 
          borderRadius: '12px',
          color: iconColor
        }}>
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
      </div>
    </div>
  );
};

const WeatherCard = ({ weather, weatherLoading }) => {
  if (weatherLoading) {
    return (
      <div className="glass-card flex items-center justify-center min-h-[120px]">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="glass-card flex flex-col items-center justify-center min-h-[120px] text-center">
        <Cloud className="w-8 h-8 mb-2 text-gray-400" />
        <p className="text-xs text-gray-400">Set ZIP in Settings</p>
      </div>
    );
  }

  return (
    <div className="glass-card min-h-[120px] flex flex-col justify-between">
      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Today</p>
      <div>
        <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{weather.current_temp}°</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{weather.conditions}</p>
      </div>
      <div className="flex gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>H: {weather.high_temp}°</span>
        <span>L: {weather.low_temp}°</span>
      </div>
      {weather.frost_warning && (
        <div className="flex items-center gap-1 text-xs rounded px-2 py-1 bg-yellow-400/20 text-yellow-400">
          <AlertTriangle className="w-3 h-3" />
          <span>Frost risk!</span>
        </div>
      )}
    </div>
  );
};

function getWeatherIcon(code) {
  const codeNum = parseInt(code) || 0;
  if (codeNum >= 200 && codeNum < 300) return '⛈️';
  if (codeNum >= 300 && codeNum < 600) return '🌧️';
  if (codeNum >= 600 && codeNum < 700) return '❄️';
  if (codeNum >= 700 && codeNum < 800) return '🌫️';
  if (codeNum === 800) return '☀️';
  if (codeNum > 800) return '⛅';
  return '🌤️';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    gardens: 0,
    seedLots: 0,
    activeCrops: 0,
    tasks: 0,
    indoorSpaces: 0,
    tradesPending: 0
  });
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [popularCrops, setPopularCrops] = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');
  
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);



  useEffect(() => {
    loadDashboard();
    loadWeather();
    checkAchievements();
  }, []);

  const checkAchievements = async () => {
    try {
      const response = await base44.functions.invoke('checkAchievements', {});
      if (response.data.newlyUnlocked?.length > 0) {
        response.data.newlyUnlocked.forEach(ach => {
          toast.success(`🏆 Achievement Unlocked: ${ach.title} (+${ach.points} pts)`);
        });
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  };

  const loadWeather = async () => {
    try {
      const user = await base44.auth.me();
      
      // User entity stores location_zip directly
      const zipCode = user?.location_zip;
      
      console.log('[Dashboard] Weather lookup - User:', user.email, 'ZIP:', zipCode);
      
      if (!zipCode) {
        console.warn('[Dashboard] No ZIP code found on user');
        setWeatherLoading(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const cached = await base44.entities.WeatherCache.filter({
        zip_code: zipCode,
        date: today
      }).then(results => results[0]);

      if (cached && new Date(cached.expires_at) > new Date()) {
        setWeather(cached);
        setWeatherLoading(false);
        return;
      }

      const response = await fetch(`https://wttr.in/${zipCode}?format=j1`);
      const data = await response.json();
      const current = data.current_condition?.[0];
      const forecast = data.weather?.[0];
      
      const weatherData = {
        zip_code: zipCode,
        date: today,
        high_temp: parseInt(forecast?.maxtempF),
        low_temp: parseInt(forecast?.mintempF),
        current_temp: parseInt(current?.temp_F),
        conditions: current?.weatherDesc?.[0]?.value || 'Unknown',
        conditions_icon: getWeatherIcon(current?.weatherCode),
        precipitation_chance: parseInt(forecast?.hourly?.[0]?.chanceofrain) || 0,
        wind_speed_mph: parseInt(current?.windspeedMiles) || 0,
        humidity_percent: parseInt(current?.humidity) || 0,
        frost_warning: parseInt(forecast?.mintempF) <= 32,
        heat_warning: parseInt(forecast?.maxtempF) >= 95
      };

      if (cached) {
        await base44.entities.WeatherCache.update(cached.id, weatherData);
      } else {
        await base44.entities.WeatherCache.create(weatherData);
      }

      setWeather(weatherData);
    } catch (err) {
      console.error('Weather fetch failed:', err);
    } finally {
      setWeatherLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const [gardens, seedLots, crops, tasks, spaces, trades] = await Promise.all([
        base44.entities.Garden.filter({ created_by: userData.email, archived: false }),
        base44.entities.SeedLot.filter({ created_by: userData.email }),
        base44.entities.CropPlan.filter({ created_by: userData.email, status: 'active' }),
        base44.entities.CropTask.filter({ created_by: userData.email, is_completed: false }),
        base44.entities.IndoorGrowSpace.filter({ created_by: userData.email }),
        base44.entities.SeedTrade.filter({ recipient_id: userData.id, status: 'pending' })
      ]);

      setStats({
        gardens: gardens.length,
        seedLots: seedLots.length,
        activeCrops: crops.length,
        tasks: tasks.length,
        indoorSpaces: spaces.length,
        tradesPending: trades.length
      });

      // Load popular crops
      try {
        const popularResponse = await base44.functions.invoke('getPopularCrops', {});
        setPopularCrops(popularResponse.data);
      } catch (error) {
        console.error('Error loading popular crops:', error);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {greeting}, {user?.nickname || user?.full_name?.split(' ')[0] || 'Gardener'}! 🌅
          </h1>
          <p style={{ color: 'var(--text-muted)' }} className="mt-1">
            {format(new Date(), 'MMMM d, yyyy')}
            {user?.zone && ` • Zone ${user.zone}`}
            {user?.last_frost_date && ` • Last frost: ${format(new Date(user.last_frost_date), 'MMM d')}`}
          </p>
        </div>

      {/* Gamification Widgets Row */}
      <div className="grid md:grid-cols-3 gap-4">
        <LevelProgressWidget />
        <StreakWidget />
        <LatestBadgeWidget />
      </div>

      {/* Top Row - Quick Stats + Weather */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <QuickAccessCard
          icon={Sprout}
          title="Active Crops"
          count={stats.activeCrops}
          color="bg-emerald-500"
          page="Calendar"
        />
        <QuickAccessCard
          icon={Calendar}
          title="Tasks Today"
          count={stats.tasks}
          color="bg-blue-500"
          page="CalendarTasks"
        />
        <QuickAccessCard
          icon={Package}
          title="Seed Lots"
          count={stats.seedLots}
          color="bg-amber-500"
          page="SeedStash"
        />
        <WeatherCard weather={weather} weatherLoading={weatherLoading} />
      </div>

      {/* More Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <QuickAccessCard
          icon={ListChecks}
          title="Gardens"
          count={stats.gardens}
          color="bg-green-600"
          page="Gardens"
        />
        <QuickAccessCard
          icon={Sprout}
          title="Indoor Spaces"
          count={stats.indoorSpaces}
          color="bg-purple-500"
          page="IndoorGrowSpaces"
        />
        <QuickAccessCard
          icon={MessageSquare}
          title="Trade Offers"
          count={stats.tradesPending}
          color="bg-pink-500"
          page="SeedTrading"
        />
        <div className="glass-card flex flex-col items-center justify-center">
          <TrendingUp className="w-12 h-12 mb-3" style={{ color: '#10b981' }} />
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Ready to plan?</p>
          <Button
            onClick={() => navigate(createPageUrl('Calendar'))}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            Plan Your Garden
          </Button>
        </div>
      </div>

      {/* Gamification & Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <LeaderboardRankWidget />
        <ChallengeProgressWidget />
        
        {/* Quick Actions */}
        <div className="glass-card-no-padding">
          <div className="p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              <Sprout className="w-5 h-5" />
              Quick Actions
            </h3>
            <div className="space-y-2">
            <Button
              onClick={() => navigate(createPageUrl('Calendar'))}
              variant="outline"
              className="w-full justify-between"
            >
              <span>📅 Plan Crops</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('SeedStash'))}
              variant="outline"
              className="w-full justify-between"
            >
              <span>🌱 Manage Seeds</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('CalendarTasks'))}
              variant="outline"
              className="w-full justify-between"
            >
              <span>✓ View Tasks</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('IndoorGrowSpaces'))}
              variant="outline"
              className="w-full justify-between"
            >
              <span>🏠 Indoor Growing</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Check-In + AI Tools */}
      <div className="grid md:grid-cols-2 gap-4">
        <QuickCheckInWidget />
        
        {/* AI Tools */}
        <div className="glass-card-no-padding">
          <div className="p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              ✨ AI Tools
            </h3>
            <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>🤖 AI Assistants</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Photo diagnosis, plant ID, smart suggestions</p>
              <Button
                onClick={() => navigate(createPageUrl('AIAssistants'))}
                size="sm"
                variant="outline"
                className="mt-2 w-full"
              >
                Explore AI Tools
              </Button>
            </div>
            <div className="border-t pt-3" style={{ borderColor: 'rgba(148, 163, 184, 0.2)' }}>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>🌾 Seed Trading</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Trade with other gardeners</p>
              <Button
                onClick={() => navigate(createPageUrl('SeedTrading'))}
                size="sm"
                variant="outline"
                className="mt-2 w-full"
              >
                Browse Trades
              </Button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Activity Feed and Widgets */}
      <div className="grid md:grid-cols-2 gap-6">
        <ActivityFeed limit={5} />
        <div className="space-y-6">
          <TipOfDayWidget />
          <RecipeSuggestionsWidget />
        </div>
      </div>

      {/* Popular Crops */}
      {popularCrops && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>🔥 What Others Are Growing</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Top Tomatoes */}
            <div className="glass-card-no-padding">
              <div className="p-6">
                <h3 className="text-lg flex items-center gap-2 mb-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  🍅 Top Tomatoes
                </h3>
                <div className="space-y-2">
                  {popularCrops.tomatoes && popularCrops.tomatoes.length > 0 ? (
                    popularCrops.tomatoes.map((crop, idx) => (
                      <a 
                        href={`/ViewVariety?id=${crop.variety_id}`}
                        key={crop.variety_id} 
                        className="flex items-center justify-between text-sm p-2 rounded transition-colors hover:bg-emerald-600/20 cursor-pointer" 
                        style={{ backgroundColor: 'rgba(51, 65, 85, 0.3)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <span className="truncate" style={{ color: 'var(--text-primary)' }}>{crop.variety_name}</span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{crop.unique_users} growers</span>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Not enough data yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top Peppers */}
            <div className="glass-card-no-padding">
              <div className="p-6">
                <h3 className="text-lg flex items-center gap-2 mb-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  🌶️ Top Peppers
                </h3>
                <div className="space-y-2">
                  {popularCrops.peppers && popularCrops.peppers.length > 0 ? (
                    popularCrops.peppers.map((crop, idx) => (
                      <a 
                        href={`/ViewVariety?id=${crop.variety_id}`}
                        key={crop.variety_id} 
                        className="flex items-center justify-between text-sm p-2 rounded transition-colors hover:bg-emerald-600/20 cursor-pointer" 
                        style={{ backgroundColor: 'rgba(51, 65, 85, 0.3)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <span className="truncate" style={{ color: 'var(--text-primary)' }}>{crop.variety_name}</span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{crop.unique_users} growers</span>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Not enough data yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top Other Crops */}
            <div className="glass-card-no-padding">
              <div className="p-6">
                <h3 className="text-lg flex items-center gap-2 mb-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  🥬 Top Other Crops
                </h3>
                <div className="space-y-2">
                  {popularCrops.other && popularCrops.other.length > 0 ? (
                    popularCrops.other.map((crop, idx) => (
                      <a 
                        href={`/ViewVariety?id=${crop.variety_id}`}
                        key={crop.variety_id} 
                        className="flex items-center justify-between text-sm p-2 rounded transition-colors hover:bg-emerald-600/20 cursor-pointer" 
                        style={{ backgroundColor: 'rgba(51, 65, 85, 0.3)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{crop.variety_name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{crop.plant_type_name}</p>
                          </div>
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{crop.unique_users}</span>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Not enough data yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Getting Started */}
      {stats.gardens === 0 && (
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-emerald-50">Getting Started</h3>
          </div>
          <p className="text-sm mb-4 text-emerald-100">
            Create your first garden to start planning crops, tracking seeds, and managing your growing space.
          </p>
          <Button
            onClick={() => navigate(createPageUrl('Gardens'))}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Create Garden
          </Button>
        </div>
      )}
      </div>
  );
}