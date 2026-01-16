import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Sprout, 
  Package, 
  ListChecks,
  AlertCircle,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

export function TasksCard({ tasks = [], loading }) {
  const today = new Date();
  const nextWeek = addDays(today, 7);
  
  const upcomingTasks = tasks.filter(t => 
    t.status === 'open' && 
    t.due_date && 
    isAfter(new Date(t.due_date), today) &&
    isBefore(new Date(t.due_date), nextWeek)
  );

  const overdueTasks = tasks.filter(t =>
    t.status === 'open' &&
    t.due_date &&
    isBefore(new Date(t.due_date), today)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          This Week's Tasks
        </CardTitle>
        <Link to={createPageUrl('CalendarTasks')}>
          <Button variant="ghost" size="sm">
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-20 flex items-center justify-center text-gray-400">Loading...</div>
        ) : upcomingTasks.length === 0 && overdueTasks.length === 0 ? (
          <p className="text-sm text-gray-600">No upcoming tasks</p>
        ) : (
          <div className="space-y-2">
            {overdueTasks.slice(0, 3).map(task => (
              <div key={task.id} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900 truncate">{task.title}</p>
                  <p className="text-xs text-red-700">Overdue: {format(new Date(task.due_date), 'MMM d')}</p>
                </div>
              </div>
            ))}
            {upcomingTasks.slice(0, 3).map(task => (
              <div key={task.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                <Calendar className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  <p className="text-xs text-gray-600">{format(new Date(task.due_date), 'MMM d')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SeedStashCard({ seeds = [], loading }) {
  const lowStockSeeds = seeds.filter(s => s.tags?.includes('low_stock'));
  const totalSeeds = seeds.filter(s => !s.is_wishlist).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-600" />
          Seed Stash
        </CardTitle>
        <Link to={createPageUrl('SeedStash')}>
          <Button variant="ghost" size="sm">
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-20 flex items-center justify-center text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-900">{totalSeeds}</span>
              <span className="text-sm text-gray-600">total seeds</span>
            </div>
            {lowStockSeeds.length > 0 && (
              <div className="p-2 bg-orange-50 rounded-lg">
                <p className="text-xs text-orange-800">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  {lowStockSeeds.length} low stock warnings
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GrowListCard({ growLists = [], loading }) {
  const activeList = growLists.find(l => l.status === 'active') || growLists[0];
  const totalItems = activeList?.items?.length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-purple-600" />
          Grow Lists
        </CardTitle>
        <Link to={createPageUrl('GrowLists')}>
          <Button variant="ghost" size="sm">
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-20 flex items-center justify-center text-gray-400">Loading...</div>
        ) : activeList ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-900">{totalItems}</span>
              <span className="text-sm text-gray-600">planned</span>
            </div>
            <p className="text-xs text-gray-600 truncate">{activeList.name}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No grow lists</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentActivityCard({ entries = [], loading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-20 flex items-center justify-center text-gray-400">Loading...</div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-600">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 5).map(entry => (
              <div key={entry.id} className="flex items-center gap-2 text-sm">
                <Sprout className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                <span className="text-gray-700 truncate">{entry.title || entry.entry_text?.substring(0, 40)}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {format(new Date(entry.created_date || entry.entry_date), 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}