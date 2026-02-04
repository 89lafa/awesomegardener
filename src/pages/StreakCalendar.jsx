import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, Calendar as CalendarIcon, Trophy, Loader2 } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

export default function StreakCalendar() {
  const [streak, setStreak] = useState(null);
  const [activityDays, setActivityDays] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStreakData();
  }, []);

  const loadStreakData = async () => {
    try {
      // Get streak record
      const streaks = await base44.entities.UserStreak.filter({});
      setStreak(streaks[0]);

      // Get last 90 days of activity
      const ninetyDaysAgo = subDays(new Date(), 90);
      const activities = await base44.entities.ActivityLog.filter({});

      // Filter activities from last 90 days
      const recentActivities = activities.filter(a => {
        const activityDate = new Date(a.activity_date || a.created_date);
        return activityDate >= ninetyDaysAgo;
      });

      // Convert to set of date strings
      const days = new Set(
        recentActivities.map(a => new Date(a.activity_date || a.created_date).toDateString())
      );
      setActivityDays(days);
    } catch (error) {
      console.error('Error loading streak data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Generate last 90 days
  const days = [];
  for (let i = 89; i >= 0; i--) {
    days.push(subDays(new Date(), i));
  }

  const milestones = [
    { days: 7, unlocked: (streak?.longest_streak || 0) >= 7 },
    { days: 30, unlocked: (streak?.longest_streak || 0) >= 30 },
    { days: 50, unlocked: (streak?.longest_streak || 0) >= 50 },
    { days: 100, unlocked: (streak?.longest_streak || 0) >= 100 }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Flame className="w-8 h-8 text-orange-500" />
          Your Streak Calendar
        </h1>
        <p className="text-gray-600 mt-1">Track your daily gardening activity streak</p>
      </div>

      {/* Streak stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
          <CardContent className="pt-6 text-center">
            <div className="text-5xl font-bold text-orange-600">
              {streak?.current_streak || 0}
            </div>
            <p className="text-sm text-gray-600 mt-2">Current Streak</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200">
          <CardContent className="pt-6 text-center">
            <div className="text-5xl font-bold text-purple-600">
              {streak?.longest_streak || 0}
            </div>
            <p className="text-sm text-gray-600 mt-2">Longest Streak</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <CardContent className="pt-6 text-center">
            <div className="text-5xl font-bold text-green-600">
              {streak?.total_check_ins || 0}
            </div>
            <p className="text-sm text-gray-600 mt-2">Total Check-ins</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-600" />
            Last 90 Days
          </h3>
          
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}

            {/* Day cells */}
            {days.map(date => {
              const dateString = date.toDateString();
              const hasActivity = activityDays.has(dateString);
              const isToday = dateString === new Date().toDateString();

              return (
                <div
                  key={dateString}
                  className={`
                    aspect-square rounded-lg flex items-center justify-center text-sm font-medium
                    ${hasActivity ? 'bg-emerald-400 text-white' : 'bg-gray-100 text-gray-400'}
                    ${isToday ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                    transition-all hover:scale-110
                  `}
                  title={format(date, 'MMM d, yyyy')}
                >
                  {date.getDate()}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 mt-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-400 rounded"></div>
              <span>Activity logged</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 rounded"></div>
              <span>No activity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
              <span>Today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Milestones
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {milestones.map(milestone => (
              <div
                key={milestone.days}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                  milestone.unlocked
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  milestone.unlocked ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  {milestone.unlocked ? (
                    <Trophy className="w-5 h-5 text-white" />
                  ) : (
                    <span className="text-white font-bold text-sm">{milestone.days}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{milestone.days} Day Streak</p>
                  <p className="text-xs text-gray-600">
                    {milestone.unlocked ? 'Completed! ✓' : `${Math.max(0, milestone.days - (streak?.longest_streak || 0))} more to go`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}