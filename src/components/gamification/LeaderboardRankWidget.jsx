import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Loader2, TrendingUp } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function LeaderboardRankWidget() {
  const [ranks, setRanks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRanks();
  }, []);

  const loadRanks = async () => {
    try {
      const user = await base44.auth.me();
      
      // Get all users' data for ranking
      const [allUserBadges, allCropPlans, allHarvests, allStreaks] = await Promise.all([
        base44.entities.UserBadge.filter({}),
        base44.entities.CropPlan.filter({}),
        base44.entities.HarvestLog.filter({}),
        base44.entities.UserStreak.filter({})
      ]);

      // Calculate user scores
      const userScores = {};
      
      // Varieties count
      allCropPlans.forEach(cp => {
        if (!userScores[cp.created_by]) userScores[cp.created_by] = { varieties: 0, harvests: 0, streak: 0, badges: 0 };
        userScores[cp.created_by].varieties++;
      });

      // Harvests count  
      allHarvests.forEach(h => {
        if (!userScores[h.created_by]) userScores[h.created_by] = { varieties: 0, harvests: 0, streak: 0, badges: 0 };
        userScores[h.created_by].harvests++;
      });

      // Streaks
      allStreaks.forEach(s => {
        if (!userScores[s.created_by]) userScores[s.created_by] = { varieties: 0, harvests: 0, streak: 0, badges: 0 };
        userScores[s.created_by].streak = s.current_streak || 0;
      });

      // Badges
      allUserBadges.filter(b => b.unlocked_date).forEach(b => {
        if (!userScores[b.created_by]) userScores[b.created_by] = { varieties: 0, harvests: 0, streak: 0, badges: 0 };
        userScores[b.created_by].badges++;
      });

      // Calculate ranks
      const varietiesRanked = Object.entries(userScores).sort((a, b) => b[1].varieties - a[1].varieties);
      const harvestsRanked = Object.entries(userScores).sort((a, b) => b[1].harvests - a[1].harvests);
      const streakRanked = Object.entries(userScores).sort((a, b) => b[1].streak - a[1].streak);

      const varietiesRank = varietiesRanked.findIndex(([email]) => email === user.email) + 1;
      const harvestsRank = harvestsRanked.findIndex(([email]) => email === user.email) + 1;
      const streakRank = streakRanked.findIndex(([email]) => email === user.email) + 1;

      const myScores = userScores[user.email] || { varieties: 0, harvests: 0, streak: 0 };

      setRanks({
        varieties: { rank: varietiesRank || '-', count: myScores.varieties },
        harvests: { rank: harvestsRank || '-', count: myScores.harvests },
        streak: { rank: streakRank || '-', count: myScores.streak }
      });
    } catch (error) {
      console.error('Error loading ranks:', error);
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Your Ranking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranks && (
          <>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm font-medium">Varieties:</span>
              <span className="text-sm">
                <span className="font-bold text-emerald-600">#{ranks.varieties.rank}</span>
                <span className="text-gray-500 ml-1">({ranks.varieties.count} total)</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm font-medium">Harvests:</span>
              <span className="text-sm">
                <span className="font-bold text-emerald-600">#{ranks.harvests.rank}</span>
                <span className="text-gray-500 ml-1">({ranks.harvests.count} logged)</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm font-medium">Streak:</span>
              <span className="text-sm">
                <span className="font-bold text-emerald-600">#{ranks.streak.rank}</span>
                <span className="text-gray-500 ml-1">({ranks.streak.count} days)</span>
              </span>
            </div>
          </>
        )}

        <Link to={createPageUrl('Leaderboard')}>
          <Button variant="outline" className="w-full mt-2 group">
            View Leaderboards
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}