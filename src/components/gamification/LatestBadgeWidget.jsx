import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, ArrowRight, Loader2, Lock } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function LatestBadgeWidget() {
  const [latestBadge, setLatestBadge] = useState(null);
  const [nextBadge, setNextBadge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      const [userBadges, allBadges] = await Promise.all([
        base44.entities.UserBadge.filter({}),
        base44.entities.Badge.filter({ is_active: true })
      ]);

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="w-5 h-5 text-yellow-500" />
            Latest Badge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">Start earning badges by completing milestones</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Award className="w-5 h-5 text-yellow-500" />
          Latest Badge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {latestBadge ? (
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg">
            <div className="text-5xl mb-2">{latestBadge.icon}</div>
            <h4 className="font-bold text-lg">{latestBadge.title}</h4>
            <p className="text-sm text-gray-600 mt-1">
              Unlocked {formatDistanceToNow(new Date(latestBadge.unlocked_date), { addSuffix: true })}
            </p>
          </div>
        ) : (
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No badges unlocked yet</p>
          </div>
        )}

        {nextBadge && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Next Badge:</p>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-3xl">{nextBadge.icon}</div>
              <div className="flex-1">
                <p className="font-medium text-sm">{nextBadge.title}</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${nextBadge.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{nextBadge.progress}% complete</p>
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
      </CardContent>
    </Card>
  );
}