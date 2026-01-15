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
  Bug,
  TrendingUp,
  Users,
  MessageSquare,
  Star
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
import GardenOverview from '@/components/dashboard/GardenOverview';
import UpcomingTasksCard from '@/components/dashboard/UpcomingTasksCard';

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
  const [forumTopics, setForumTopics] = useState([]);
  const [upcomingSeasons, setUpcomingSeasons] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      const [gardensData, tasksData, seedsData, growListsData, harvestsData, diaryData, issuesData, myPlantsData, topicsData] = await Promise.all([
        smartQuery(base44, 'Garden', { archived: false, created_by: userData.email }, '-updated_date', 5),
        smartQuery(base44, 'Task', { status: 'open', created_by: userData.email }, 'due_date', 10),
        smartQuery(base44, 'SeedLot', { is_wishlist: false, created_by: userData.email }),
        smartQuery(base44, 'GrowList', { status: 'active', created_by: userData.email }),
        smartQuery(base44, 'HarvestLog', { created_by: userData.email }, '-created_date', 3),
        smartQuery(base44, 'GardenDiary', { created_by: userData.email }, '-created_date', 3),
        smartQuery(base44, 'IssueLog', { created_by: userData.email }, '-created_date', 3),
        smartQuery(base44, 'MyPlant', { created_by: userData.email }),
        smartQuery(base44, 'ForumTopic', {}, '-last_activity_at', 5)
      ]);

      setGardens(gardensData);
      setTasks(tasksData);
      setSeedCount(seedsData.length);
      setGrowListCount(growListsData.length);
      setRecentActivity({ harvests: harvestsData, diary: diaryData, issues: issuesData });
      setMyPlantsCount(myPlantsData.length);
      setForumTopics(topicsData.filter(t => !t.deleted_at));
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



  const stats = [
    { label: 'Gardens', value: gardens.length, icon: TreeDeciduous, color: 'bg-emerald-100 text-emerald-600', href: 'Gardens' },
    { label: 'Open Tasks', value: tasks.length, icon: Calendar, color: 'bg-blue-100 text-blue-600', href: 'CalendarTasks' },
    { label: 'My Plants', value: myPlantsCount, icon: Sprout, color: 'bg-green-100 text-green-600', href: 'MyPlants' },
    { label: 'Seeds', value: seedCount, icon: Package, color: 'bg-amber-100 text-amber-600', href: 'SeedStash' },
    { label: 'Grow Lists', value: growListCount, icon: ListChecks, color: 'bg-purple-100 text-purple-600', href: 'GrowLists' },
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link to={createPageUrl(stat.href)}>
              <Card className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer border-l-4 border-l-transparent hover:border-l-emerald-500">
                <CardContent className="p-3 lg:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs lg:text-sm text-gray-600">{stat.label}</p>
                      <p className="text-xl lg:text-2xl font-bold mt-0.5 lg:mt-1">{stat.value}</p>
                    </div>
                    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${stat.color} flex items-center justify-center shadow-sm`}>
                      <stat.icon className="w-5 h-5 lg:w-6 lg:h-6" />
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
        <UpcomingTasksCard 
          tasks={tasks} 
          loading={loading}
          onTaskComplete={(taskId) => setTasks(tasks.filter(t => t.id !== taskId))}
        />

        {/* Recent Gardens */}
        <GardenOverview gardens={gardens} loading={loading} />
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

      {/* Community Activity */}
      {forumTopics.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              Community Activity
            </CardTitle>
            <Link to={createPageUrl('CommunityBoard')}>
              <Button variant="ghost" size="sm" className="gap-1">
                View Board <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {forumTopics.slice(0, 3).map((topic) => (
                <Link key={topic.id} to={createPageUrl('ForumTopic') + `?id=${topic.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <MessageSquare className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{topic.title}</p>
                      <p className="text-xs text-gray-500">
                        {topic.post_count || 0} replies • {topic.view_count || 0} views
                      </p>
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
            <Link to={createPageUrl('MyPlants')}>
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <Sprout className="w-5 h-5 text-green-600" />
                <span>My Plants</span>
              </Button>
            </Link>
            <Link to={createPageUrl('GrowLists')}>
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <ListChecks className="w-5 h-5 text-indigo-600" />
                <span>Grow Lists</span>
              </Button>
            </Link>
            <Link to={createPageUrl('HarvestLog')}>
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <Apple className="w-5 h-5 text-red-600" />
                <span>Harvest Log</span>
              </Button>
            </Link>
            <Link to={createPageUrl('CommunityBoard')}>
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span>Community</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}