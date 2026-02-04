import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Crown, TrendingUp, Loader2, Calendar, Zap } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { toast } from 'sonner';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('all_time');

  useEffect(() => {
    loadLeaderboard();
  }, [timeframe]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      // Get all users' achievements
      const allUserAchievements = await base44.entities.UserAchievement.filter({});
      const allAchievements = await base44.entities.Achievement.filter({ is_active: true });

      // Get all user streaks
      const allStreaks = await base44.entities.UserStreak.filter({});

      // Calculate points per user
      const userPoints = {};
      const userStreaks = {};
      const userAchievementCounts = {};

      allUserAchievements.forEach(ua => {
        if (!ua.unlocked_date) return;

        const achievement = allAchievements.find(a => a.id === ua.achievement_id);
        if (!achievement) return;

        if (!userPoints[ua.created_by]) {
          userPoints[ua.created_by] = 0;
          userAchievementCounts[ua.created_by] = 0;
        }
        userPoints[ua.created_by] += achievement.points || 0;
        userAchievementCounts[ua.created_by]++;
      });

      allStreaks.forEach(streak => {
        userStreaks[streak.created_by] = streak.current_streak || 0;
      });

      // Build leaderboard
      const leaderboardData = Object.entries(userPoints).map(([email, points]) => ({
        email,
        displayName: email.split('@')[0],
        points,
        achievements: userAchievementCounts[email] || 0,
        currentStreak: userStreaks[email] || 0
      }));

      // Sort by points
      leaderboardData.sort((a, b) => b.points - a.points);

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-xl font-bold text-gray-600">#{rank}</span>;
  };

  const getRankBadgeColor = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
    if (rank === 3) return 'bg-gradient-to-r from-amber-500 to-amber-700 text-white';
    return 'bg-gray-100 text-gray-700';
  };

  const currentUserRank = leaderboard.findIndex(u => u.email === currentUser?.email) + 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Leaderboard
          </h1>
          <p className="text-gray-600 mt-1">See how you rank against other gardeners</p>
        </div>
      </div>

      {/* Current User Card */}
      {currentUserRank > 0 && (
        <Card className="border-2 border-emerald-500 bg-emerald-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getRankBadgeColor(currentUserRank)}`}>
                  {getRankIcon(currentUserRank)}
                </div>
                <div>
                  <p className="font-semibold text-lg">Your Rank</p>
                  <p className="text-sm text-gray-600">{currentUser?.full_name || 'You'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-600">
                  {leaderboard[currentUserRank - 1]?.points || 0}
                </p>
                <p className="text-sm text-gray-600">points</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Tabs value={timeframe} onValueChange={setTimeframe}>
        <TabsList>
          <TabsTrigger value="all_time">
            <Trophy className="w-4 h-4 mr-2" />
            All Time
          </TabsTrigger>
          <TabsTrigger value="monthly">
            <Calendar className="w-4 h-4 mr-2" />
            This Month
          </TabsTrigger>
          <TabsTrigger value="weekly">
            <Zap className="w-4 h-4 mr-2" />
            This Week
          </TabsTrigger>
        </TabsList>

        <TabsContent value={timeframe} className="mt-6 space-y-3">
          {leaderboard.map((user, index) => {
            const rank = index + 1;
            const isCurrentUser = user.email === currentUser?.email;

            return (
              <Card key={user.email} className={isCurrentUser ? 'border-emerald-500 border-2' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRankBadgeColor(rank)}`}>
                        {rank <= 3 ? getRankIcon(rank) : <span className="font-bold">{rank}</span>}
                      </div>
                      <div>
                        <p className="font-semibold">{user.displayName}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {user.achievements} badges
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {user.currentStreak} day streak
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">{user.points}</p>
                      <p className="text-sm text-gray-600">points</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {leaderboard.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No rankings yet. Start earning achievements!</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}