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

  const QuickAccessCard = ({ icon: Icon, title, count, color, page }) => {
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
            <p className="text-sm mb-1" style={{ color: '#86efac' }}>{title}</p>
            <p className="text-3xl font-bold" style={{ color: iconColor }}>{count}</p>
          </div>
          <div style={{ 
            padding: '12px', 
            borderRadius: '12px',
            color: iconColor
          }}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </div>
    );
  };

  const WeatherCard = () => {
    if (weatherLoading) {
      return (
        <Card>
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
        <Card>
          <CardContent className="p-6 text-center">
            <Cloud className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set ZIP in Settings</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="glass-card relative overflow-hidden cursor-pointer transition-all">
        {/* Decorative circle */}
        <div style={{
          position: 'absolute',
          right: '-20px',
          top: '-20px',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
        }} />
        
        <div style={{ position: 'relative', zIndex: 1, color: 'white' }}>
          <p className="text-xs mb-1" style={{ opacity: 0.8 }}>Today</p>
          <p className="text-3xl font-bold mb-1">{weather.current_temp}°</p>
          <p className="text-xs" style={{ opacity: 0.9 }}>{weather.conditions}</p>
          <div className="flex gap-3 mt-3 text-xs" style={{ opacity: 0.8 }}>
            <span>H: {weather.high_temp}°</span>
            <span>L: {weather.low_temp}°</span>
          </div>
          {weather.frost_warning && (
            <div className="mt-2 flex items-center gap-1 text-xs rounded px-2 py-1" style={{
              backgroundColor: 'rgba(251, 191, 36, 0.2)',
              color: '#fbbf24'
            }}>
              <AlertTriangle className="w-3 h-3" />
              <span>Frost risk!</span>
            </div>
          )}
        </div>
      </div>
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
        <div className="glass-card flex flex-col items-center justify-center">
          <TrendingUp className="w-12 h-12 mb-3" style={{ color: '#10b981' }} />
          <p className="text-sm font-medium mb-3" style={{ color: '#d1fae5' }}>Ready to plan?</p>
          <Button
            onClick={() => navigate(createPageUrl('Calendar'))}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            Plan Your Garden
          </Button>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        {/* Top Actions */}
        <div className="glass-card-no-padding">
          <div className="p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: '#f0fdf4' }}>
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

        {/* New Features */}
        <div className="glass-card-no-padding">
          <div className="p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold mb-4" style={{ color: '#f0fdf4' }}>
              ✨ New Features
            </h3>
            <div className="space-y-3 text-sm">
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
            <div className="border-t pt-3" style={{ borderColor: 'rgba(148, 163, 184, 0.2)' }}>
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
          </div>
        </div>
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
                <h3 className="text-lg flex items-center gap-2 mb-4 font-semibold" style={{ color: '#f0fdf4' }}>
                  🍅 Top Tomatoes
                </h3>
                <div className="space-y-2">
                  {popularCrops.tomatoes && popularCrops.tomatoes.length > 0 ? (
                    popularCrops.tomatoes.map((crop, idx) => (
                      <div key={crop.variety_id} className="flex items-center justify-between text-sm p-2 rounded transition-colors" style={{ backgroundColor: 'rgba(51, 65, 85, 0.3)' }}>
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
              </div>
            </div>

            {/* Top Peppers */}
            <div className="glass-card-no-padding">
              <div className="p-6">
                <h3 className="text-lg flex items-center gap-2 mb-4 font-semibold" style={{ color: '#f0fdf4' }}>
                  🌶️ Top Peppers
                </h3>
                <div className="space-y-2">
                  {popularCrops.peppers && popularCrops.peppers.length > 0 ? (
                    popularCrops.peppers.map((crop, idx) => (
                      <div key={crop.variety_id} className="flex items-center justify-between text-sm p-2 rounded transition-colors" style={{ backgroundColor: 'rgba(51, 65, 85, 0.3)' }}>
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
              </div>
            </div>

            {/* Top Other Crops */}
            <div className="glass-card-no-padding">
              <div className="p-6">
                <h3 className="text-lg flex items-center gap-2 mb-4 font-semibold" style={{ color: '#f0fdf4' }}>
                  🥬 Top Other Crops
                </h3>
                <div className="space-y-2">
                  {popularCrops.other && popularCrops.other.length > 0 ? (
                    popularCrops.other.map((crop, idx) => (
                      <div key={crop.variety_id} className="flex items-center justify-between text-sm p-2 rounded transition-colors" style={{ backgroundColor: 'rgba(51, 65, 85, 0.3)' }}>
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Getting Started */}
      {stats.gardens === 0 && (
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5" style={{ color: '#10b981' }} />
            <h3 className="text-lg font-semibold" style={{ color: '#f0fdf4' }}>Getting Started</h3>
          </div>
          <p className="text-sm mb-4" style={{ color: '#d1fae5' }}>
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