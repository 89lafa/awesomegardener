import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Mail, 
  MapPin, 
  Calendar,
  Award,
  Trophy,
  Flame,
  Star,
  Settings,
  Loader2,
  Crown
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TIER_COLORS = {
  bronze: 'bg-amber-600 text-white',
  silver: 'bg-gray-400 text-white',
  gold: 'bg-yellow-500 text-white',
  platinum: 'bg-purple-600 text-white',
  common: 'bg-gray-400 text-white',
  uncommon: 'bg-green-500 text-white',
  rare: 'bg-blue-500 text-white',
  legendary: 'bg-purple-500 text-white'
};

const RARITY_COLORS = {
  common: 'bg-gray-100 text-gray-800',
  uncommon: 'bg-green-100 text-green-800',
  rare: 'bg-blue-100 text-blue-800',
  legendary: 'bg-purple-100 text-purple-800'
};

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [badges, setBadges] = useState([]);
  const [progress, setProgress] = useState(null);
  const [streak, setStreak] = useState(null);
  const [ranks, setRanks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // Load badges
      const [userBadges, allBadges] = await Promise.all([
        base44.entities.UserBadge.filter({}),
        base44.entities.Badge.filter({ is_active: true })
      ]);

      const unlocked = userBadges.filter(ub => ub.unlocked_date);
      const badgeDetails = unlocked.map(ub => {
        const badge = allBadges.find(b => b.id === ub.badge_id);
        return badge ? { ...badge, unlocked_date: ub.unlocked_date } : null;
      }).filter(Boolean);

      badgeDetails.sort((a, b) => new Date(b.unlocked_date) - new Date(a.unlocked_date));
      setBadges(badgeDetails);

      // Load progress
      const progressRecords = await base44.entities.UserProgress.filter({});
      setProgress(progressRecords[0] || { level: 1, total_xp: 0, xp_to_next_level: 100 });

      // Load streak
      const streaks = await base44.entities.UserStreak.filter({});
      setStreak(streaks[0]);

      // Load ranks (simplified - get position in all-time)
      const allCropPlans = await base44.asServiceRole.entities.CropPlan.filter({});
      const allHarvests = await base44.asServiceRole.entities.HarvestLog.filter({});
      const allStreaks = await base44.asServiceRole.entities.UserStreak.filter({});

      // Group by user
      const userScores = {};
      allCropPlans.forEach(cp => {
        if (!userScores[cp.created_by]) userScores[cp.created_by] = { varieties: 0, harvests: 0, streak: 0 };
        userScores[cp.created_by].varieties++;
      });

      allHarvests.forEach(h => {
        if (!userScores[h.created_by]) userScores[h.created_by] = { varieties: 0, harvests: 0, streak: 0 };
        userScores[h.created_by].harvests++;
      });

      allStreaks.forEach(s => {
        if (!userScores[s.created_by]) userScores[s.created_by] = { varieties: 0, harvests: 0, streak: 0 };
        userScores[s.created_by].streak = s.current_streak || 0;
      });

      // Calculate ranks
      const varietiesRanked = Object.entries(userScores).sort((a, b) => b[1].varieties - a[1].varieties);
      const harvestsRanked = Object.entries(userScores).sort((a, b) => b[1].harvests - a[1].harvests);
      const streakRanked = Object.entries(userScores).sort((a, b) => b[1].streak - a[1].streak);

      const varietiesRank = varietiesRanked.findIndex(([email]) => email === userData.email) + 1;
      const harvestsRank = harvestsRanked.findIndex(([email]) => email === userData.email) + 1;
      const streakRank = streakRanked.findIndex(([email]) => email === userData.email) + 1;

      const myScores = userScores[userData.email] || { varieties: 0, harvests: 0, streak: 0 };

      setRanks({
        varieties: { rank: varietiesRank || '-', count: myScores.varieties, total: varietiesRanked.length },
        harvests: { rank: harvestsRank || '-', count: myScores.harvests, total: harvestsRanked.length },
        streak: { rank: streakRank || '-', count: myScores.streak, total: streakRanked.length }
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
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

  const currentXP = progress ? progress.total_xp % progress.xp_to_next_level : 0;
  const xpNeeded = progress ? progress.xp_to_next_level - currentXP : 100;
  const progressPercentage = progress ? (currentXP / progress.xp_to_next_level) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <User className="w-8 h-8 text-emerald-600" />
            Profile
          </h1>
          <p className="text-gray-600 mt-1">Your gardening profile and achievements</p>
        </div>
        <Link to={createPageUrl('Settings')}>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </Link>
      </div>

      {/* User Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'G'}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{user?.nickname || user?.full_name || 'Gardener'}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  {user?.email}
                </div>
                {user?.zone && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    Zone {user.zone}
                  </div>
                )}
                {user?.created_date && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    Member since {format(new Date(user.created_date), 'MMM yyyy')}
                  </div>
                )}
              </div>
            </div>

            {/* Level badge */}
            {progress && (
              <div className="text-center bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg p-4">
                <Star className="w-6 h-6 mx-auto mb-1" />
                <p className="text-2xl font-bold">Level {progress.level}</p>
                <p className="text-xs opacity-90">{progress.total_xp} XP</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Level Progress */}
      {progress && (
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-purple-600" />
              Level Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Level {progress.level}</span>
                <span className="font-medium">Level {progress.level + 1}</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex justify-between text-xs text-gray-600">
                <span>{currentXP} / {progress.xp_to_next_level} XP</span>
                <span>{xpNeeded} XP needed</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streak Stats */}
      {streak && (
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-600" />
              Streak Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-orange-600">{streak.current_streak || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Current</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-purple-600">{streak.longest_streak || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Longest</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{streak.total_check_ins || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Total</p>
              </div>
            </div>
            <Link to={createPageUrl('StreakCalendar')}>
              <Button variant="outline" className="w-full mt-4">
                View Streak Calendar
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Ranks */}
      {ranks && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Leaderboard Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <div>
                  <p className="font-medium">Varieties</p>
                  <p className="text-xs text-gray-600">{ranks.varieties.count} varieties grown</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-600">#{ranks.varieties.rank}</p>
                  <p className="text-xs text-gray-500">of {ranks.varieties.total}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium">Harvests</p>
                  <p className="text-xs text-gray-600">{ranks.harvests.count} harvests logged</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">#{ranks.harvests.rank}</p>
                  <p className="text-xs text-gray-500">of {ranks.harvests.total}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div>
                  <p className="font-medium">Streak</p>
                  <p className="text-xs text-gray-600">{ranks.streak.count} day streak</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-orange-600">#{ranks.streak.rank}</p>
                  <p className="text-xs text-gray-500">of {ranks.streak.total}</p>
                </div>
              </div>
            </div>

            <Link to={createPageUrl('LeaderboardV2')}>
              <Button variant="outline" className="w-full mt-4">
                View Full Leaderboards
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Badge Showcase */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              Badges ({badges.length})
            </CardTitle>
            <Link to={createPageUrl('Achievements')}>
              <Button variant="ghost" size="sm">
                View All →
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {badges.length > 0 ? (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {badges.slice(0, 8).map(badge => (
                <div
                  key={badge.id}
                  className="relative bg-white border-2 border-gray-200 rounded-lg p-4 text-center hover:border-emerald-400 transition cursor-pointer"
                  title={badge.description}
                >
                  {/* Badge icon */}
                  <div className="text-4xl mb-2">
                    {badge.icon}
                  </div>

                  {/* Badge name */}
                  <p className="text-xs font-medium text-gray-700 line-clamp-2">
                    {badge.title}
                  </p>

                  {/* Unlock date */}
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(badge.unlocked_date), 'MMM d')}
                  </p>

                  {/* Rarity indicator */}
                  <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                    badge.rarity === 'legendary' ? 'bg-purple-500' :
                    badge.rarity === 'rare' ? 'bg-blue-500' :
                    badge.rarity === 'uncommon' ? 'bg-green-500' :
                    'bg-gray-400'
                  }`} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Award className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No badges unlocked yet</p>
              <p className="text-sm text-gray-500 mt-1">Start your gardening journey to earn badges!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}