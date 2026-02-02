import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { TreeDeciduous, ListChecks, Package, Calendar, Loader2, Plus, ArrowRight, TrendingUp, AlertCircle, Sprout, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import AdBanner from '@/components/monetization/AdBanner';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isAfter, isBefore, addDays, isPast } from 'date-fns';
import NotificationCard from '@/components/dashboard/NotificationCard';
import { getPlantTypesCached } from '@/components/utils/dataCache';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [seeds, setSeeds] = useState([]);
  const [growLists, setGrowLists] = useState([]);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // V1B-2: Batch query optimization - load all user data in parallel
      const [gardensData, tasksData, seedsData, growListsData, diaryData] = await Promise.all([
        base44.entities.Garden.filter({ archived: false, created_by: userData.email }, '-updated_date'),
        base44.entities.Task.filter({ created_by: userData.email, status: 'open' }, 'due_date'),
        base44.entities.SeedLot.filter({ created_by: userData.email }),
        base44.entities.GrowList.filter({ created_by: userData.email }),
        base44.entities.GardenDiary.filter({ created_by: userData.email }, '-entry_date', 10)
      ]);

      setGardens(gardensData);
      setTasks(tasksData);
      setSeeds(seedsData);
      setGrowLists(growListsData);
      setDiaryEntries(diaryData);
      setRateLimitError(null);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      if (error.code === 'RATE_LIMIT') {
        setRateLimitError(error);
        setTimeout(() => loadData(true), error.retryInMs || 5000);
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  const today = new Date();
  const nextWeek = addDays(today, 7);
  
  const upcomingTasks = tasks.filter(t => 
    t.due_date && 
    isAfter(new Date(t.due_date), today) &&
    isBefore(new Date(t.due_date), nextWeek)
  );

  const overdueTasks = tasks.filter(t =>
    t.due_date && isPast(new Date(t.due_date))
  );

  const totalSeeds = seeds.filter(s => !s.is_wishlist).length;
  const lowStockSeeds = seeds.filter(s => s.tags?.includes('low_stock'));
  const activeGrowList = growLists.find(l => l.status === 'active') || growLists[0];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {rateLimitError && (
        <RateLimitBanner 
          retryInMs={rateLimitError.retryInMs || 5000} 
          onRetry={() => loadData(true)}
          retrying={retrying}
        />
      )}

      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-emerald-50 via-green-50 to-blue-50 rounded-2xl p-8 border border-emerald-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.full_name?.split(' ')[0] || 'Gardener'}! 🌱
        </h1>
        <p className="text-gray-700">Here's what's happening in your garden today</p>
      </div>

      <AdBanner placement="top_banner" pageType="dashboard" />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to={createPageUrl('Gardens')}>
          <Card className="hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6 text-center">
              <TreeDeciduous className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-blue-900">{gardens.length}</p>
              <p className="text-sm text-blue-700 font-medium">Gardens</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('CalendarTasks')}>
          <Card className="hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-amber-50 to-orange-100 border-orange-200">
            <CardContent className="p-6 text-center">
              <Calendar className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-orange-900">{tasks.length}</p>
              <p className="text-sm text-orange-700 font-medium">Open Tasks</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('SeedStash')}>
          <Card className="hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200">
            <CardContent className="p-6 text-center">
              <Package className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-emerald-900">{totalSeeds}</p>
              <p className="text-sm text-emerald-700 font-medium">Seeds</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('GrowLists')}>
          <Card className="hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6 text-center">
              <ListChecks className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-purple-900">{activeGrowList?.items?.length || 0}</p>
              <p className="text-sm text-purple-700 font-medium">Planned Plants</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Notifications */}
        <NotificationCard user={user} />

        {/* Upcoming Tasks */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-lg">This Week's Tasks</CardTitle>
            </div>
            <Link to={createPageUrl('CalendarTasks')}>
              <Button variant="ghost" size="sm">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 && upcomingTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No upcoming tasks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {overdueTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-red-900 text-sm">{task.title}</p>
                      <p className="text-xs text-red-700">Overdue • {format(new Date(task.due_date), 'MMM d')}</p>
                    </div>
                  </div>
                ))}
                {upcomingTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                      <p className="text-xs text-gray-600">{format(new Date(task.due_date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seed Stash Summary */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-lg">Seed Stash</CardTitle>
            </div>
            <Link to={createPageUrl('SeedStash')}>
              <Button variant="ghost" size="sm">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-4xl font-bold text-emerald-600">{totalSeeds}</p>
                <p className="text-sm text-gray-600">seed varieties</p>
              </div>
              {lowStockSeeds.length > 0 && (
                <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                  {lowStockSeeds.length} low stock
                </Badge>
              )}
            </div>
            {seeds.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs text-gray-500 mb-2">Recent additions:</p>
                {seeds.slice(0, 3).map((seed, idx) => (
                  <p key={idx} className="text-sm text-gray-700 truncate">• {seed.custom_label || 'Seed'}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </div>
            <Link to={createPageUrl('GardenDiary')}>
              <Button variant="ghost" size="sm">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {diaryEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Sprout className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No recent entries</p>
              </div>
            ) : (
              <div className="space-y-3">
                {diaryEntries.slice(0, 5).map(entry => (
                  <div key={entry.id} className="flex items-start gap-2">
                    <Sprout className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{entry.title || entry.entry_text?.substring(0, 50)}</p>
                      <p className="text-xs text-gray-500">{format(new Date(entry.entry_date || entry.created_date), 'MMM d')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grow List Summary */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg">Grow Lists</CardTitle>
            </div>
            <Link to={createPageUrl('GrowLists')}>
              <Button variant="ghost" size="sm">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {activeGrowList ? (
              <div>
                <p className="text-4xl font-bold text-purple-600">{activeGrowList.items?.length || 0}</p>
                <p className="text-sm text-gray-600 mb-3">plants planned</p>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm font-medium text-purple-900 truncate">{activeGrowList.name}</p>
                  <p className="text-xs text-purple-700 mt-1">
                    {activeGrowList.year ? `Year: ${activeGrowList.year}` : 'Active list'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No grow lists yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gardens Overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TreeDeciduous className="w-6 h-6 text-emerald-600" />
            Your Gardens
          </h2>
          <Link to={createPageUrl('Gardens')}>
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        
        {gardens.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <TreeDeciduous className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Gardens Yet</h3>
              <p className="text-gray-600 mb-6">Create your first garden to start planning</p>
              <Link to={createPageUrl('Gardens')}>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Garden
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gardens.slice(0, 6).map((garden) => (
              <Link key={garden.id} to={createPageUrl('MyGarden') + `?gardenId=${garden.id}`}>
                <Card className="hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-white to-emerald-50/30 border-emerald-200">
                  {garden.cover_image && (
                    <div className="h-32 bg-gray-200 rounded-t-xl overflow-hidden">
                      <img src={garden.cover_image} alt={garden.name} loading="lazy" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      {garden.name}
                      {garden.is_public && <Badge variant="outline" className="text-xs">Public</Badge>}
                    </h3>
                    {garden.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{garden.description}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to={createPageUrl('PlantCatalog')}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Sprout className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-medium text-gray-900">Browse Plants</p>
                <p className="text-xs text-gray-500 mt-1">Explore varieties</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('Calendar')}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <p className="font-medium text-gray-900">Planting Calendar</p>
                <p className="text-xs text-gray-500 mt-1">Plan your season</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('GardenDiary')}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-amber-600" />
                </div>
                <p className="font-medium text-gray-900">Garden Diary</p>
                <p className="text-xs text-gray-500 mt-1">Log your progress</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('CommunityBoard')}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="font-medium text-gray-900">Community</p>
                <p className="text-xs text-gray-500 mt-1">Connect with gardeners</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}