import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  TreeDeciduous, 
  Calendar, 
  Package, 
  ListChecks,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sprout,
  AlertCircle,
  Plus,
  Apple,
  BookText,
  Bug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import AdBanner from '@/components/monetization/AdBanner';
import { format, isToday, isTomorrow, addDays, isBefore } from 'date-fns';
import { motion } from 'framer-motion';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [seedCount, setSeedCount] = useState(0);
  const [growListCount, setGrowListCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rateLimitError, setRateLimitError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [recentActivity, setRecentActivity] = useState({ harvests: [], diary: [], issues: [] });
  const [myPlantsCount, setMyPlantsCount] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      const [gardensData, tasksData, seedsData, growListsData, harvestsData, diaryData, issuesData, myPlantsData] = await Promise.all([
        smartQuery(base44, 'Garden', { archived: false, created_by: userData.email }, '-updated_date', 5),
        smartQuery(base44, 'Task', { status: 'open', created_by: userData.email }, 'due_date', 10),
        smartQuery(base44, 'SeedLot', { is_wishlist: false, created_by: userData.email }),
        smartQuery(base44, 'GrowList', { status: 'active', created_by: userData.email }),
        smartQuery(base44, 'HarvestLog', { created_by: userData.email }, '-created_date', 3),
        smartQuery(base44, 'GardenDiary', { created_by: userData.email }, '-created_date', 3),
        smartQuery(base44, 'IssueLog', { created_by: userData.email }, '-created_date', 3),
        smartQuery(base44, 'MyPlant', { created_by: userData.email })
      ]);

      setGardens(gardensData);
      setTasks(tasksData);
      setSeedCount(seedsData.length);
      setGrowListCount(growListsData.length);
      setRecentActivity({ harvests: harvestsData, diary: diaryData, issues: issuesData });
      setMyPlantsCount(myPlantsData.length);
      setRateLimitError(null); // Clear any rate limit errors on success
    } catch (error) {
      console.error('Error loading dashboard:', error);
      
      // Handle rate limit errors differently - don't clear existing data
      if (error.code === 'RATE_LIMIT') {
        setRateLimitError(error);
        // Schedule automatic retry
        setTimeout(() => {
          if (rateLimitError) loadDashboardData(true);
        }, error.retryInMs || 5000);
      }
      // For other errors, keep existing data visible (don't set to empty arrays)
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  const markTaskDone = async (task) => {
    try {
      await base44.entities.Task.update(task.id, {
        status: 'done',
        completed_at: new Date().toISOString()
      });
      setTasks(tasks.filter(t => t.id !== task.id));
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const getTaskDateLabel = (date) => {
    if (!date) return 'No date';
    const d = new Date(date);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isBefore(d, new Date())) return 'Overdue';
    return format(d, 'MMM d');
  };

  const getTaskDateColor = (date) => {
    if (!date) return 'text-gray-500';
    const d = new Date(date);
    if (isBefore(d, new Date()) && !isToday(d)) return 'text-red-600';
    if (isToday(d)) return 'text-emerald-600';
    return 'text-gray-600';
  };

  const stats = [
    { label: 'Gardens', value: gardens.length, icon: TreeDeciduous, color: 'bg-emerald-100 text-emerald-600', href: 'Gardens' },
    { label: 'Open Tasks', value: tasks.length, icon: Calendar, color: 'bg-blue-100 text-blue-600', href: 'CalendarTasks' },
    { label: 'My Plants', value: myPlantsCount, icon: Sprout, color: 'bg-green-100 text-green-600', href: 'MyPlants' },
    { label: 'Seeds', value: seedCount, icon: Package, color: 'bg-amber-100 text-amber-600', href: 'SeedStash' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rate Limit Banner */}
      {rateLimitError && (
        <RateLimitBanner 
          retryInMs={rateLimitError.retryInMs || 5000} 
          onRetry={() => loadDashboardData(true)}
          retrying={retrying}
        />
      )}
      
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-gray-600 mt-1">Here's what's happening in your garden</p>
      </div>

      {/* Ad Banner */}
      <AdBanner placement="top_banner" pageType="dashboard" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link to={createPageUrl(stat.href)}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.label}</p>
                      <p className="text-2xl lg:text-3xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              Upcoming Tasks
            </CardTitle>
            <Link to={createPageUrl('CalendarTasks')}>
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">All caught up!</p>
                <p className="text-sm text-gray-400">No pending tasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 5).map((task) => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <button
                      onClick={() => markTaskDone(task)}
                      className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{task.title}</p>
                      {task.plant_display_name && (
                        <p className="text-sm text-gray-500 truncate">{task.plant_display_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className={getTaskDateColor(task.due_date)}>
                        {getTaskDateLabel(task.due_date)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Gardens */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center gap-2">
              <TreeDeciduous className="w-5 h-5 text-emerald-600" />
              Your Gardens
            </CardTitle>
            <Link to={createPageUrl('Gardens')}>
              <Button variant="ghost" size="sm" className="gap-1">
                All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {gardens.length === 0 ? (
              <div className="text-center py-8">
                <Sprout className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">{rateLimitError ? 'Loading...' : 'No gardens yet'}</p>
                <Link to={createPageUrl('Gardens') + '?action=new'}>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Garden
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {gardens.map((garden) => (
                  <Link 
                    key={garden.id}
                    to={createPageUrl('Gardens')}
                    className="block"
                  >
                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      {garden.cover_image ? (
                        <img 
                          src={garden.cover_image} 
                          alt={garden.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <TreeDeciduous className="w-6 h-6 text-emerald-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{garden.name}</p>
                        <p className="text-sm text-gray-500">
                          {garden.privacy === 'public' ? 'Public' : garden.privacy === 'unlisted' ? 'Unlisted' : 'Private'}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {(recentActivity.harvests.length > 0 || recentActivity.diary.length > 0 || recentActivity.issues.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.harvests.slice(0, 3).map(h => (
                <Link key={h.id} to={createPageUrl('HarvestLog')}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <Apple className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">Harvested {h.plant_display_name || 'plant'}</p>
                      <p className="text-xs text-gray-500">{h.quantity} {h.unit} • {format(new Date(h.harvest_date), 'MMM d')}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {recentActivity.diary.slice(0, 2).map(d => (
                <Link key={d.id} to={createPageUrl('GardenDiary')}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <BookText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.title || 'Diary entry'}</p>
                      <p className="text-xs text-gray-500">{format(new Date(d.entry_date), 'MMM d')}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {recentActivity.issues.slice(0, 2).map(issue => (
                <Link key={issue.id} to={createPageUrl('IssuesLog')}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <Bug className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate capitalize">{issue.issue_type?.replace(/_/g, ' ') || 'Issue'}</p>
                      <p className="text-xs text-gray-500">{format(new Date(issue.observed_date), 'MMM d')}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to={createPageUrl('Gardens')}>
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <TreeDeciduous className="w-5 h-5 text-emerald-600" />
                <span>View Gardens</span>
              </Button>
            </Link>
            <Link to={createPageUrl('SeedStash') + '?action=new'}>
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                <span>Add Seeds</span>
              </Button>
            </Link>
            <Link to={createPageUrl('CalendarTasks') + '?action=new'}>
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span>New Task</span>
              </Button>
            </Link>
            <Link to={createPageUrl('PlantCatalog')}>
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <Sprout className="w-5 h-5 text-purple-600" />
                <span>Browse Plants</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}