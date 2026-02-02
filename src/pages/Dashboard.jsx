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
  ArrowRight
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { WeatherWidget } from '@/components/weather/WeatherWidget';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

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
      className="cursor-pointer hover:shadow-lg transition-all" 
      onClick={() => navigate(createPageUrl(page))}
    >
      <CardContent className="p-6 text-center">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center mx-auto mb-3`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <p className="text-2xl font-bold text-gray-900">{count}</p>
        <p className="text-sm text-gray-600 mt-1">{title}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.full_name}!</h1>
        <p className="text-gray-600 mt-1">Here's what's happening in your garden</p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-4">
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
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="p-6 text-center">
            <TrendingUp className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">Ready to plan?</p>
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

      {/* Weather Widget */}
      <div>
        <WeatherWidget />
      </div>

      {/* Quick Access Grid */}
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        {/* Top Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900 flex items-center gap-2">
              ✨ New Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-blue-900">🌾 Seed Trading</p>
              <p className="text-blue-700 text-xs mt-1">Propose trades with other gardeners</p>
              <Button
                onClick={() => navigate(createPageUrl('SeedTrading'))}
                size="sm"
                variant="outline"
                className="mt-2 w-full"
              >
                Browse Trades
              </Button>
            </div>
            <div className="border-t border-blue-200 pt-3">
              <p className="font-medium text-blue-900">💰 Expense Tracking</p>
              <p className="text-blue-700 text-xs mt-1">Track garden spending by season</p>
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

      {/* Getting Started */}
      {stats.gardens === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-amber-700 text-sm mb-4">
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
  );
}