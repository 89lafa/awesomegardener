import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Flame, Calendar, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function StreakWidget() {
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStreak();
  }, []);

  const loadStreak = async () => {
    try {
      const streaks = await base44.entities.UserStreak.filter({});
      setStreak(streaks[0]);
    } catch (error) {
      console.error('Error loading streak:', error);
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
    <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4 mb-4">
          {/* Fire icon */}
          <div className="text-6xl">
            🔥
          </div>

          {/* Streak info */}
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
              Current Streak
            </h3>
            <div className="text-4xl font-bold text-gray-900">
              {streak?.current_streak || 0}
              <span className="text-xl text-gray-500 ml-2">days</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Best: {streak?.longest_streak || 0} days
            </p>
          </div>
        </div>

        {/* Motivational message */}
        <div className="p-3 bg-white rounded-lg mb-3">
          <p className="text-sm text-center text-gray-700 font-medium">
            {(streak?.current_streak || 0) > 0
              ? "Don't break the chain! 🔗"
              : "Start your streak today! 🌱"}
          </p>
        </div>

        {/* View details */}
        <Link to={createPageUrl('StreakCalendar')}>
          <Button
            variant="outline"
            className="w-full border-orange-300 hover:bg-orange-100"
          >
            <Calendar className="w-4 h-4 mr-2" />
            View Calendar
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}