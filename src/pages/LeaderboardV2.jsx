import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Flame, Package, Sprout, Award, Crown, Medal, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const categoryIcons = {
  varieties: <Sprout className="w-5 h-5" />,
  harvests: <Trophy className="w-5 h-5" />,
  streak: <Flame className="w-5 h-5" />,
  seeds: <Package className="w-5 h-5" />,
  badges: <Award className="w-5 h-5" />
};

const categoryNames = {
  varieties: 'Most Varieties',
  harvests: 'Most Harvests',
  streak: 'Longest Streak',
  seeds: 'Seed Collection',
  badges: 'Most Badges'
};

export default function LeaderboardV2() {
  const [category, setCategory] = useState('varieties');
  const [period, setPeriod] = useState('all_time');
  const [entries, setEntries] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadLeaderboard();
    }
  }, [category, period, currentUser]);

  const loadUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      if (period === 'all_time') {
        // Calculate real-time leaderboard
        await calculateRealTimeLeaderboard();
      } else {
        // Load from saved leaderboard
        await loadSavedLeaderboard();
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const calculateRealTimeLeaderboard = async () => {
    // Get all users
    const allUsers = await base44.asServiceRole.entities.User.list();
    const scores = [];

    for (const user of allUsers) {
      const score = await calculateUserScore(user.email, category);
      if (score > 0) {
        scores.push({
          email: user.email,
          display_name: user.full_name || user.email.split('@')[0],
          score
        });
      }
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    // Add ranks
    const rankedScores = scores.map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));

    setEntries(rankedScores);

    // Find current user's rank
    const userEntry = rankedScores.find(e => e.email === currentUser.email);
    setMyRank(userEntry);
  };

  const loadSavedLeaderboard = async () => {
    // Get current leaderboard for category and period
    const leaderboards = await base44.entities.Leaderboard.filter({
      category,
      period,
      is_active: true
    });

    if (leaderboards.length === 0) {
      setEntries([]);
      setMyRank(null);
      return;
    }

    const leaderboard = leaderboards[0];

    // Get entries
    const leaderboardEntries = await base44.entities.LeaderboardEntry.filter({
      leaderboard_id: leaderboard.id
    });

    // Sort by rank
    leaderboardEntries.sort((a, b) => a.rank - b.rank);

    setEntries(leaderboardEntries);

    // Find my rank
    const myEntry = leaderboardEntries.find(e => e.user_email === currentUser.email);
    setMyRank(myEntry);
  };

  const calculateUserScore = async (userEmail, category) => {
    switch (category) {
      case 'varieties': {
        const crops = await base44.asServiceRole.entities.CropPlan.filter({ created_by: userEmail });
        return crops.length;
      }
      
      case 'harvests': {
        const harvests = await base44.asServiceRole.entities.HarvestLog.filter({ created_by: userEmail });
        return harvests.length;
      }
      
      case 'streak': {
        const streaks = await base44.asServiceRole.entities.UserStreak.filter({ created_by: userEmail });
        return streaks[0]?.current_streak || 0;
      }
      
      case 'seeds': {
        const seeds = await base44.asServiceRole.entities.SeedLot.filter({ created_by: userEmail });
        return seeds.length;
      }
      
      case 'badges': {
        const badges = await base44.asServiceRole.entities.UserBadge.filter({ created_by: userEmail });
        return badges.filter(b => b.unlocked_date).length;
      }
      
      default:
        return 0;
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return null;
  };

  const getRankBadgeColor = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
    if (rank === 3) return 'bg-gradient-to-r from-amber-500 to-amber-700 text-white';
    return 'bg-gray-100 text-gray-700';
  };

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
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          Leaderboards
        </h1>
        <p className="text-gray-600 mt-1">See how you rank against other gardeners</p>
      </div>

      {/* My rank card */}
      {myRank && (
        <Card className="border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getRankBadgeColor(myRank.rank)}`}>
                  {getRankIcon(myRank.rank) || <span className="font-bold text-xl">#{myRank.rank}</span>}
                </div>
                <div>
                  <p className="font-semibold text-lg">Your Rank</p>
                  <p className="text-sm text-gray-600">{currentUser?.full_name || 'You'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-600">
                  {myRank.score}
                </p>
                <p className="text-sm text-gray-600">score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(categoryNames).map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 ${
              category === cat
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {categoryIcons[cat]}
            {categoryNames[cat]}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {entries.length > 0 ? (
              entries.map((entry, index) => {
                const isCurrentUser = entry.email === currentUser?.email || entry.user_email === currentUser?.email;
                const rank = entry.rank;

                return (
                  <motion.div
                    key={entry.email || entry.user_email}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <div
                      className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                        isCurrentUser
                          ? 'bg-emerald-50 border-emerald-500'
                          : rank <= 3
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRankBadgeColor(rank)}`}>
                          {getRankIcon(rank) || <span className="font-bold">{rank}</span>}
                        </div>
                        <div>
                          <p className="font-semibold">{entry.display_name}</p>
                          {isCurrentUser && (
                            <Badge className="mt-1 bg-emerald-600 text-white">You</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">{entry.score}</p>
                        <p className="text-xs text-gray-500">score</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No rankings yet. Start earning achievements!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}