import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Flame, Calendar, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function StreakWidget({ loadDelay = 0 }) {
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStreak();
    }, loadDelay);
    return () => clearTimeout(timer);
  }, [loadDelay]);

  const loadStreak = async () => {
    try {
      const streaks = await base44.entities.UserStreak.filter({});
      setStreak(streaks[0]);
    } catch (error) {
      console.warn('Streak widget failed (non-critical)');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-6">
      <div className="flex items-center gap-4 mb-4">
        {/* Fire icon */}
        <div className="text-6xl">
          🔥
        </div>

        {/* Streak info */}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Current Streak
          </h3>
          <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            {streak?.current_streak || 0}
            <span className="text-xl text-gray-500 dark:text-gray-400 ml-2">days</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Best: {streak?.longest_streak || 0} days
          </p>
        </div>
      </div>

      {/* Motivational message */}
      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg mb-3">
        <p className="text-sm text-center text-gray-700 dark:text-gray-300 font-medium">
          {(streak?.current_streak || 0) > 0
            ? "Don't break the chain! 🔗"
            : "Start your streak today! 🌱"}
        </p>
      </div>

      {/* View details */}
      <Link to={createPageUrl('StreakCalendar')}>
        <Button
          variant="outline"
          className="w-full border-orange-300 dark:border-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30"
        >
          <Calendar className="w-4 h-4 mr-2" />
          View Calendar
        </Button>
      </Link>
    </div>
  );
}