import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, ArrowRight, Loader2, Lock } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function LatestBadgeWidget({ loadDelay = 0 }) {
  const [latestBadge, setLatestBadge] = useState(null);
  const [nextBadge, setNextBadge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBadges();
    }, loadDelay);
    return () => clearTimeout(timer);
  }, [loadDelay]);

  const loadBadges = async () => {
    try {
      const userBadges = await base44.entities.UserBadge.filter({});
      await new Promise(resolve => setTimeout(resolve, 300));
      const allBadges = await base44.entities.Badge.filter({ is_active: true });

      // Get latest unlocked badge
      const unlocked = userBadges.filter(ub => ub.unlocked_date);
      if (unlocked.length > 0) {
        unlocked.sort((a, b) => new Date(b.unlocked_date) - new Date(a.unlocked_date));
        const latestBadgeData = allBadges.find(b => b.id === unlocked[0].badge_id);
        setLatestBadge({ ...latestBadgeData, unlocked_date: unlocked[0].unlocked_date });
      }

      // Find next badge in progress
      const inProgress = userBadges
        .filter(ub => !ub.unlocked_date && ub.progress > 0)
        .sort((a, b) => b.progress - a.progress);
      
      if (inProgress.length > 0) {
        const nextBadgeData = allBadges.find(b => b.id === inProgress[0].badge_id);
        setNextBadge({ ...nextBadgeData, progress: inProgress[0].progress });
      }
    } catch (error) {
      console.error('Error loading badges:', error);
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

  if (!latestBadge && !nextBadge) {
    return (
      <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center gap-2 text-lg font-semibold mb-4">
          <Award className="w-5 h-5 text-yellow-500" />
          <span className="text-gray-900 dark:text-gray-100">Latest Badge</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Start earning badges by completing milestones</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="flex items-center gap-2 text-lg font-semibold mb-4">
        <Award className="w-5 h-5 text-yellow-500" />
        <span className="text-gray-900 dark:text-gray-100">Latest Badge</span>
      </div>
      <div className="space-y-4">
        {latestBadge ? (
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg">
            <div className="text-5xl mb-2">{latestBadge.icon}</div>
            <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{latestBadge.title}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Unlocked {formatDistanceToNow(new Date(latestBadge.unlocked_date), { addSuffix: true })}
            </p>
          </div>
        ) : (
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">No badges unlocked yet</p>
          </div>
        )}

        {nextBadge && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Next Badge:</p>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-3xl">{nextBadge.icon}</div>
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{nextBadge.title}</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${nextBadge.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{nextBadge.progress}% complete</p>
              </div>
            </div>
          </div>
        )}

        <Link to={createPageUrl('Achievements')}>
          <Button variant="outline" className="w-full group">
            View All Badges
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
    </div>
  );
}