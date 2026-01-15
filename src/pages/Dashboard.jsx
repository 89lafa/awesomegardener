import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  TreeDeciduous, 
  Calendar, 
  Package, 
  ListChecks,
  Sprout,
  Plus,
  Apple,
  BookText,
  Bug,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  MessageCircle,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { format, isToday, isTomorrow, isBefore, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import { smartQuery } from '@/components/utils/smartQuery';
import RateLimitBanner from '@/components/common/RateLimitBanner';
import AdBanner from '@/components/monetization/AdBanner';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [seeds, setSeeds] = useState([]);
  const [growLists, setGrowLists] = useState([]);
  const [myPlants, setMyPlants] = useState([]);
  const [recentActivity, setRecentActivity] = useState({ harvests: [], diary: [], issues: [] });
  const [forumActivity, setForumActivity] = useState({ topics: 0, posts: 0 });
  const [loading, setLoading] = useState(true);
  const [rateLimitError, setRateLimitError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const [
        gardensData,
        tasksData,
        seedsData,
        growListsData,
        myPlantsData,
        harvestsData,
        diaryData,
        issuesData,
        topicsData,
        postsData
      ] = await Promise.all([
        smartQuery(base44, 'Garden', { created_by: userData.email }, '-updated_date', 10).catch(() => []),
        smartQuery(base44, 'Task', { status: 'open', created_by: userData.email }, 'due_date', 20).catch(() => []),
        smartQuery(base44, 'SeedLot', { created_by: userData.email }).catch(() => []),
        smartQuery(base44, 'GrowList', { created_by: userData.email }).catch(() => []),
        smartQuery(base44, 'MyPlant', { created_by: userData.email }).catch(() => []),
        smartQuery(base44, 'HarvestLog', { created_by: userData.email }, '-created_date', 5).catch(() => []),
        smartQuery(base44, 'GardenDiary', { created_by: userData.email }, '-created_date', 5).catch(() => []),
        smartQuery(base44, 'IssueLog', { created_by: userData.email }, '-created_date', 5).catch(() => []),
        smartQuery(base44, 'ForumTopic', { created_by: userData.email }).catch(() => []),
        smartQuery(base44, 'ForumPost', { created_by: userData.email }).catch(() => [])
      ]);

      setGardens(gardensData);
      setTasks(tasksData);
      setSeeds(seedsData);
      setGrowLists(growListsData);
      setMyPlants(myPlantsData);
      setRecentActivity({ harvests: harvestsData, diary: diaryData, issues: issuesData });
      setForumActivity({ topics: topicsData.length, posts: postsData.length });
    } catch (error) {
      console.error('Dashboard load error:', error);
      if (error.code === 'RATE_LIMIT') {
        setRateLimitError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const markTaskDone = async (taskId) => {
    try {
      await base44.entities.Task.update(taskId, {
        status: 'done',
        completed_at: new Date().toISOString()
      });
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const getTaskStatus = (task) => {
    if (!task.due_date) return { label: 'No date', color: 'bg-gray-100 text-gray-600', priority: 3 };
    const d = new Date(task.due_date);
    if (isBefore(d, new Date()) && !isToday(d)) return { label: 'Overdue', color: 'bg-red-100 text-red-700', priority: 1 };
    if (isToday(d)) return { label: 'Today', color: 'bg-emerald-100 text-emerald-700', priority: 2 };
    if (isTomorrow(d)) return { label: 'Tomorrow', color: 'bg-blue-100 text-blue-700', priority: 2 };
    return { label: format(d, 'MMM d'), color: 'bg-gray-100 text-gray-600', priority: 3 };
  };

  const stats = [
    { label: 'Gardens', value: gardens.length, icon: TreeDeciduous, color: 'from-emerald-500 to-green-600', href: 'Gardens' },
    { label: 'Open Tasks', value: tasks.length, icon: Clock, color: 'from-blue-500 to-indigo-600', href: 'CalendarTasks' },
    { label: 'My Plants', value: myPlants.length, icon: Sprout, color: 'from-green-500 to-emerald-600', href: 'MyPlants' },
    { label: 'Seed Stash', value: seeds.filter(s => !s.is_wishlist).length, icon: Package, color: 'from-amber-500 to-orange-600', href: 'SeedStash' },
    { label: 'Wishlist', value: seeds.filter(s => s.is_wishlist).length, icon: ListChecks, color: 'from-purple-500 to-pink-600', href: 'SeedStash' },
    { label: 'Grow Lists', value: growLists.length, icon: ListChecks, color: 'from-indigo-500 to-purple-600', href: 'GrowLists' },
  ];

  const quickActions = [
    { label: 'Browse Catalog', icon: Sprout, href: 'PlantCatalog', color: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: 'Plan Garden', icon: TreeDeciduous, href: 'Gardens', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Add Seeds', icon: Package, href: 'SeedStash', color: 'bg-amber-600 hover:bg-amber-700' },
    { label: 'View Calendar', icon: Calendar, href: 'Calendar', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Community', icon: MessageCircle, href: 'CommunityBoard', color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Growing Guides', icon: BookText, href: 'GardeningBasics', color: 'bg-indigo-600 hover:bg-indigo-700' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-80 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const statusA = getTaskStatus(a);
    const statusB = getTaskStatus(b);
    if (statusA.priority !== statusB.priority) return statusA.priority - statusB.priority;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  const oldSeeds = seeds.filter(s => {
    const year = s.packed_for_year || s.year_acquired;
    return year && (new Date().getFullYear() - year >= 3);
  }).length;

  return (
    <div className="space-y-6 pb-12">
      {rateLimitError && <RateLimitBanner retryInMs={rateLimitError.retryInMs} onRetry={loadDashboard} />}

      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-6 lg:p-8 text-white">
        <h1 className="text-2xl lg:text-4xl font-bold mb-2">
          Welcome back{user?.nickname ? `, ${user.nickname}` : user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}! 🌱
        </h1>
        <p className="text-emerald-50 text-sm lg:text-base">
          {user?.location_city && user?.location_state 
            ? `Gardening in ${user.location_city}, ${user.location_state} • Zone ${user.usda_zone || 'Unknown'}`
            : 'Your garden dashboard'}
        </p>
      </div>

      <AdBanner placement="top_banner" pageType="dashboard" />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Link to={createPageUrl(stat.href)}>
              <Card className="hover:shadow-lg transition-all cursor-pointer border-0 overflow-hidden">
                <div className={`h-1 bg-gradient-to-r ${stat.color}`} />
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-600 mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Priority Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Priority Tasks
              </CardTitle>
              <CardDescription className="mt-1">
                {tasks.filter(t => getTaskStatus(t).priority === 1).length} overdue • {tasks.filter(t => getTaskStatus(t).priority === 2).length} upcoming
              </CardDescription>
            </div>
            <Link to={createPageUrl('CalendarTasks')}>
              <Button variant="ghost" size="sm">View All <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {sortedTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-emerald-200 mx-auto mb-3" />
                <p className="text-gray-900 font-medium mb-1">All caught up!</p>
                <p className="text-sm text-gray-500">No pending tasks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTasks.slice(0, 8).map(task => {
                  const status = getTaskStatus(task);
                  return (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group">
                      <button
                        onClick={() => markTaskDone(task.id)}
                        className="w-5 h-5 rounded border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 flex-shrink-0 transition-all"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{task.title}</p>
                        {task.plant_display_name && (
                          <p className="text-xs text-gray-500 truncate">{task.plant_display_name}</p>
                        )}
                      </div>
                      <Badge className={`${status.color} text-xs flex-shrink-0`}>{status.label}</Badge>
                    </div>
                  );
                })}
                {tasks.length > 8 && (
                  <Link to={createPageUrl('CalendarTasks')}>
                    <Button variant="ghost" size="sm" className="w-full mt-2">
                      View {tasks.length - 8} more tasks
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats & Insights */}
        <div className="space-y-4">
          {/* Seed Alerts */}
          {oldSeeds > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 text-sm mb-1">Aging Seeds</p>
                    <p className="text-xs text-amber-800 mb-2">{oldSeeds} seed lot{oldSeeds > 1 ? 's are' : ' is'} 3+ years old</p>
                    <Link to={createPageUrl('SeedStash')}>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-amber-600 text-amber-700 hover:bg-amber-100">
                        Review Now
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Community Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-purple-600" />
                Community
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Your Topics</span>
                <span className="font-semibold text-gray-900">{forumActivity.topics}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Your Posts</span>
                <span className="font-semibold text-gray-900">{forumActivity.posts}</span>
              </div>
              <Link to={createPageUrl('CommunityBoard')}>
                <Button size="sm" variant="outline" className="w-full mt-2">
                  Visit Community Board
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Growing Season Info */}
          {user?.last_frost_date && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Growing Season
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Frost</span>
                    <span className="font-medium text-gray-900">{format(new Date(user.last_frost_date), 'MMM d')}</span>
                  </div>
                  {user.first_frost_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">First Frost</span>
                      <span className="font-medium text-gray-900">{format(new Date(user.first_frost_date), 'MMM d')}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Activity Feed */}
      {(recentActivity.harvests.length > 0 || recentActivity.diary.length > 0 || recentActivity.issues.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.harvests.map(h => (
                <Link key={h.id} to={createPageUrl('HarvestLog')}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Apple className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Harvested {h.plant_display_name || 'plant'}</p>
                      <p className="text-xs text-gray-500">{h.quantity} {h.unit} • {format(new Date(h.harvest_date), 'MMM d, yyyy')}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
              {recentActivity.diary.map(d => (
                <Link key={d.id} to={createPageUrl('GardenDiary')}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <BookText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.title || 'Diary entry'}</p>
                      <p className="text-xs text-gray-500">{format(new Date(d.entry_date), 'MMM d, yyyy')}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
              {recentActivity.issues.map(issue => (
                <Link key={issue.id} to={createPageUrl('IssuesLog')}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Bug className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 capitalize">{issue.issue_type?.replace(/_/g, ' ') || 'Issue logged'}</p>
                      <p className="text-xs text-gray-500">{format(new Date(issue.observed_date), 'MMM d, yyyy')}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gardens Overview */}
      {gardens.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center gap-2">
              <TreeDeciduous className="w-5 h-5 text-emerald-600" />
              Your Gardens
            </CardTitle>
            <Link to={createPageUrl('Gardens')}>
              <Button variant="ghost" size="sm">Manage <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gardens.slice(0, 6).map(garden => (
                <Link key={garden.id} to={createPageUrl('MyGarden') + `?id=${garden.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      {garden.cover_image ? (
                        <img src={garden.cover_image} alt={garden.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                      ) : (
                        <div className="w-full h-32 bg-gradient-to-br from-emerald-100 to-green-100 rounded-lg flex items-center justify-center mb-3">
                          <TreeDeciduous className="w-12 h-12 text-emerald-600" />
                        </div>
                      )}
                      <h3 className="font-semibold text-gray-900 truncate mb-1">{garden.name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {garden.privacy === 'public' ? 'Public' : garden.privacy === 'unlisted' ? 'Unlisted' : 'Private'}
                        </Badge>
                        {garden.current_season_year && (
                          <Badge variant="outline" className="text-xs">{garden.current_season_year}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map(action => (
              <Link key={action.label} to={createPageUrl(action.href)}>
                <Button 
                  className={`w-full h-auto py-4 flex-col gap-2 ${action.color}`}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}