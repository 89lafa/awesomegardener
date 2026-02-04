import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Lock, Loader2, Award, Star, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const TIER_COLORS = {
  bronze: 'bg-amber-600 text-white',
  silver: 'bg-gray-400 text-white',
  gold: 'bg-yellow-500 text-white',
  platinum: 'bg-purple-600 text-white'
};

const TIER_ICONS = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎'
};

export default function Achievements() {
  const [achievements, setAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      const [allAchievements, userProgress] = await Promise.all([
        base44.entities.Achievement.filter({ is_active: true }),
        base44.entities.UserAchievement.filter({})
      ]);

      setAchievements(allAchievements);
      setUserAchievements(userProgress);

      // Calculate total points
      const points = userProgress
        .filter(ua => ua.unlocked_date)
        .reduce((sum, ua) => {
          const ach = allAchievements.find(a => a.id === ua.achievement_id);
          return sum + (ach?.points || 0);
        }, 0);
      setTotalPoints(points);
    } catch (error) {
      console.error('Error loading achievements:', error);
      toast.error('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  const getUserProgress = (achievementId) => {
    return userAchievements.find(ua => ua.achievement_id === achievementId);
  };

  const isUnlocked = (achievementId) => {
    const progress = getUserProgress(achievementId);
    return progress?.unlocked_date !== null && progress?.unlocked_date !== undefined;
  };

  const filteredAchievements = achievements.filter(ach => {
    if (filter === 'all') return true;
    if (filter === 'unlocked') return isUnlocked(ach.id);
    if (filter === 'locked') return !isUnlocked(ach.id);
    return ach.category === filter;
  });

  const unlockedCount = achievements.filter(ach => isUnlocked(ach.id)).length;
  const progressPercentage = achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Achievements
          </h1>
          <p className="text-gray-600 mt-1">Unlock badges and earn points for your gardening milestones</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{unlockedCount}</p>
                <p className="text-sm text-gray-600">Unlocked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Lock className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-2xl font-bold">{achievements.length - unlockedCount}</p>
                <p className="text-sm text-gray-600">Locked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{totalPoints}</p>
                <p className="text-sm text-gray-600">Total Points</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{Math.round(progressPercentage)}%</p>
                <p className="text-sm text-gray-600">Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span className="font-medium">{unlockedCount} / {achievements.length}</span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unlocked">Unlocked</TabsTrigger>
          <TabsTrigger value="locked">Locked</TabsTrigger>
          <TabsTrigger value="planting">Planting</TabsTrigger>
          <TabsTrigger value="harvesting">Harvesting</TabsTrigger>
          <TabsTrigger value="streak">Streak</TabsTrigger>
          <TabsTrigger value="milestone">Milestone</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <div className="grid md:grid-cols-3 gap-4">
            {filteredAchievements.map((achievement, index) => {
              const userProgress = getUserProgress(achievement.id);
              const unlocked = isUnlocked(achievement.id);
              const progress = userProgress?.progress || 0;

              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={unlocked ? 'border-2 border-emerald-500' : 'opacity-60'}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                            unlocked ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : 'bg-gray-200'
                          }`}>
                            {unlocked ? achievement.icon : <Lock className="w-6 h-6 text-gray-400" />}
                          </div>
                          <div>
                            <CardTitle className="text-base">{achievement.title}</CardTitle>
                            <Badge className={`mt-1 ${TIER_COLORS[achievement.tier]}`}>
                              {TIER_ICONS[achievement.tier]} {achievement.tier}
                            </Badge>
                          </div>
                        </div>
                        {unlocked && (
                          <Award className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-3">{achievement.description}</p>
                      
                      {!unlocked && progress > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Progress</span>
                            <span className="font-medium">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-3 text-sm">
                        <span className="text-gray-500">Reward:</span>
                        <Badge variant="outline" className="gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          {achievement.points} pts
                        </Badge>
                      </div>

                      {unlocked && userProgress?.unlocked_date && (
                        <p className="text-xs text-gray-500 mt-2">
                          Unlocked {new Date(userProgress.unlocked_date).toLocaleDateString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {filteredAchievements.length === 0 && (
            <div className="text-center py-12">
              <Lock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No achievements found in this category</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}