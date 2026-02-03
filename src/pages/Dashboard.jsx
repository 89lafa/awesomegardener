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
import { usePullToRefresh } from '@/components/utils/usePullToRefresh';
import PullToRefreshIndicator from '@/components/common/PullToRefreshIndicator';

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

  const { isPulling, pullDistance, isRefreshing } = usePullToRefresh(async () => {
    await Promise.all([loadDashboard(), loadWeather()]);
    toast.success('Dashboard refreshed');
  });

  useEffect(() => {
    loadDashboard();
    loadWeather();
  }, []);

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

  const QuickAccessCard = ({ icon: Icon, title, count, color, page }) => (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-300" 
      onClick={() => navigate(createPageUrl(page))}
      style={{ 
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border)'
      }}
    >
      <CardContent className="p-6 text-center">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center mx-auto mb-3`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <p className="text-2xl font-bold" style={{ color: 'var(--brand-primary)' }}>{count}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{title}</p>
      </CardContent>
    </Card>
  );

  const WeatherCard = () => {
    if (weatherLoading) {
      return (
        <Card style={{ background: 'var(--bg-card)' }}>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-2">
              <div className="h-4 rounded w-20" style={{ background: 'var(--bg-muted)' }}></div>
              <div className="h-8 rounded w-16" style={{ background: 'var(--bg-muted)' }}></div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!weather) {
      return (
        <Card style={{ background: 'var(--bg-muted)' }}>
          <CardContent className="p-6 text-center">
            <Cloud className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set ZIP in Settings</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card 
        className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-all"
        style={{
          background: weather.frost_warning
            ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
            : weather.heat_warning
            ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
            : 'linear-gradient(135deg, #10b981, #059669)'
        }}
      >
        <CardContent className="p-6 text-white relative">
          <div className="absolute -right-2 -top-2 text-4xl opacity-20">{weather.conditions_icon}</div>
          <div className="relative z-10">
            <p className="text-xs opacity-80 mb-1">Today</p>
            <p className="text-3xl font-bold mb-1">{weather.current_temp}°</p>
            <p className="text-xs opacity-90">{weather.conditions}</p>
            <div className="flex gap-3 mt-3 text-xs opacity-80">
              <span>H: {weather.high_temp}°</span>
              <span>L: {weather.low_temp}°</span>
            </div>
            {weather.frost_warning && (
              <div className="mt-2 flex items-center gap-1 text-xs bg-white/20 rounded px-2 py-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Frost!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <PullToRefreshIndicator 
        isPulling={isPulling} 
        pullDistance={pullDistance} 
        isRefreshing={isRefreshing} 
      />
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {greeting}, {user?.full_name?.split(' ')[0] || 'Gardener'}! 🌅
          </h1>
          <p style={{ color: 'var(--text-muted)' }} className="mt-1">
            {format(new Date(), 'MMMM d, yyyy')}
            {user?.zone && ` • Zone ${user.zone}`}
            {user?.last_frost_date && ` • Last frost: ${format(new Date(user.last_frost_date), 'MMM d')}`}
          </p>
        </div>

      {/* Top Row - Quick Stats + Weather */}
      <div className="grid md:grid-cols-4 gap-4">
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
        <WeatherCard />
      </div>

      {/* More Stats */}
      <div className="grid md:grid-cols-4 gap-4">
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
        <Card 
          className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 hover:shadow-lg transition-all duration-300"
          style={{ 
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)'
          }}
        >
          <CardContent className="p-6 text-center">
            <TrendingUp className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Ready to plan?</p>
            <Button
              onClick={() => navigate(createPageUrl('Calendar'))}
              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700"
              size="sm"
            >
              Plan Your Garden
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Grid */}
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        {/* Top Actions */}
        <Card 
          className="hover:shadow-lg transition-all duration-300"
          style={{ 
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)'
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Sprout className="w-5 h-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>

        {/* New Features */}
        <Card 
          className="border-blue-200 dark:border-blue-700/50 hover:shadow-lg transition-all duration-300"
          style={{ 
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)'
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              ✨ New Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>🌾 Seed Trading</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Propose trades with other gardeners</p>
              <Button
                onClick={() => navigate(createPageUrl('SeedTrading'))}
                size="sm"
                variant="outline"
                className="mt-2 w-full"
              >
                Browse Trades
              </Button>
            </div>
            <div className="border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>💰 Expense Tracking</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Track garden spending by season</p>
              <Button
                onClick={() => navigate(createPageUrl('GardenExpenses'))}
                size="sm"
                variant="outline"
                className="mt-2 w-full"
              >
                View Expenses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Popular Crops */}
      {popularCrops && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>🔥 What Others Are Growing</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Top Tomatoes */}
            <Card 
              className="hover:shadow-lg transition-all duration-300"
              style={{ 
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--glass-border)'
              }}
            >
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  🍅 Top Tomatoes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {popularCrops.tomatoes && popularCrops.tomatoes.length > 0 ? (
                    popularCrops.tomatoes.map((crop, idx) => (
                      <div key={crop.variety_id} className="flex items-center justify-between text-sm p-2 rounded transition-colors" style={{ backgroundColor: 'var(--surface-hover)' }}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <span className="truncate" style={{ color: 'var(--text-primary)' }}>{crop.variety_name}</span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{crop.unique_users} growers</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Not enough data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Peppers */}
            <Card 
              className="hover:shadow-lg transition-all duration-300"
              style={{ 
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--glass-border)'
              }}
            >
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  🌶️ Top Peppers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {popularCrops.peppers && popularCrops.peppers.length > 0 ? (
                    popularCrops.peppers.map((crop, idx) => (
                      <div key={crop.variety_id} className="flex items-center justify-between text-sm p-2 rounded transition-colors" style={{ backgroundColor: 'var(--surface-hover)' }}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <span className="truncate" style={{ color: 'var(--text-primary)' }}>{crop.variety_name}</span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{crop.unique_users} growers</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Not enough data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Other Crops */}
            <Card 
              className="hover:shadow-lg transition-all duration-300"
              style={{ 
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--glass-border)'
              }}
            >
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  🥬 Top Other Crops
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {popularCrops.other && popularCrops.other.length > 0 ? (
                    popularCrops.other.map((crop, idx) => (
                      <div key={crop.variety_id} className="flex items-center justify-between text-sm p-2 rounded transition-colors" style={{ backgroundColor: 'var(--surface-hover)' }}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{crop.variety_name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{crop.plant_type_name}</p>
                          </div>
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{crop.unique_users}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Not enough data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Getting Started */}
      {stats.gardens === 0 && (
        <Card 
          className="border-amber-200 dark:border-amber-700/50 hover:shadow-lg transition-all duration-300"
          style={{ 
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)'
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <AlertTriangle className="w-5 h-5 text-emerald-600" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Create your first garden to start planning crops, tracking seeds, and managing your growing space.
            </p>
            <Button
              onClick={() => navigate(createPageUrl('Gardens'))}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Create Garden
            </Button>
          </CardContent>
        </Card>
      )}
      </div>
    </>
  );
}

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