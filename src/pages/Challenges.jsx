import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Users, Calendar, Clock, Trophy, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Challenges() {
  const [challenges, setChallenges] = useState([]);
  const [userChallenges, setUserChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const [allChallenges, userProgress] = await Promise.all([
        base44.entities.Challenge.filter({ is_active: true }),
        base44.entities.UserChallenge.filter({})
      ]);

      setChallenges(allChallenges);
      setUserChallenges(userProgress);
    } catch (error) {
      console.error('Error loading challenges:', error);
      toast.error('Failed to load challenges');
    } finally {
      setLoading(false);
    }
  };

  const joinChallenge = async (challengeId) => {
    try {
      await base44.entities.UserChallenge.create({
        challenge_id: challengeId,
        joined_date: new Date().toISOString(),
        progress: 0,
        completed: false
      });

      // Update participant count
      const challenge = challenges.find(c => c.id === challengeId);
      if (challenge) {
        await base44.entities.Challenge.update(challengeId, {
          participant_count: (challenge.participant_count || 0) + 1
        });
      }

      await loadChallenges();
      toast.success('Challenge joined!');
    } catch (error) {
      console.error('Error joining challenge:', error);
      toast.error('Failed to join challenge');
    }
  };

  const getUserProgress = (challengeId) => {
    return userChallenges.find(uc => uc.challenge_id === challengeId);
  };

  const isJoined = (challengeId) => {
    return userChallenges.some(uc => uc.challenge_id === challengeId);
  };

  const filteredChallenges = challenges.filter(challenge => {
    const joined = isJoined(challenge.id);
    const userProgress = getUserProgress(challenge.id);
    
    if (filter === 'active') return joined && !userProgress?.completed;
    if (filter === 'available') return !joined;
    if (filter === 'completed') return userProgress?.completed;
    return challenge.challenge_type === filter;
  });

  const getChallengeIcon = (type) => {
    switch (type) {
      case 'daily': return <Clock className="w-5 h-5" />;
      case 'weekly': return <Calendar className="w-5 h-5" />;
      case 'monthly': return <Target className="w-5 h-5" />;
      case 'seasonal': return <Trophy className="w-5 h-5" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'daily': return 'bg-blue-100 text-blue-800';
      case 'weekly': return 'bg-green-100 text-green-800';
      case 'monthly': return 'bg-purple-100 text-purple-800';
      case 'seasonal': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
            <Target className="w-8 h-8 text-emerald-600" />
            Challenges
          </h1>
          <p className="text-gray-600 mt-1">Complete challenges to earn extra points and achievements</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{userChallenges.filter(uc => !uc.completed).length}</p>
                <p className="text-sm text-gray-600">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{userChallenges.filter(uc => uc.completed).length}</p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {userChallenges.reduce((sum, uc) => {
                    if (!uc.completed) return sum;
                    const challenge = challenges.find(c => c.id === uc.challenge_id);
                    return sum + (challenge?.reward_points || 0);
                  }, 0)}
                </p>
                <p className="text-sm text-gray-600">Points Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <div className="grid md:grid-cols-2 gap-4">
            {filteredChallenges.map((challenge, index) => {
              const userProgress = getUserProgress(challenge.id);
              const joined = isJoined(challenge.id);
              const completed = userProgress?.completed;
              const progress = userProgress?.progress || 0;

              return (
                <motion.div
                  key={challenge.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={completed ? 'border-2 border-green-500' : joined ? 'border-emerald-500' : ''}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            completed ? 'bg-green-100' : 'bg-emerald-100'
                          }`}>
                            {completed ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : challenge.icon || getChallengeIcon(challenge.challenge_type)}
                          </div>
                          <div>
                            <CardTitle className="text-base">{challenge.title}</CardTitle>
                            <Badge className={`mt-1 ${getTypeColor(challenge.challenge_type)}`}>
                              {challenge.challenge_type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">{challenge.description}</p>

                      {joined && !completed && (
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span className="font-medium">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1 text-gray-600">
                            <Users className="w-4 h-4" />
                            {challenge.participant_count || 0} joined
                          </span>
                          {challenge.end_date && (
                            <span className="flex items-center gap-1 text-gray-600">
                              <Calendar className="w-4 h-4" />
                              Ends {format(new Date(challenge.end_date), 'MMM d')}
                            </span>
                          )}
                        </div>
                        <Badge variant="outline" className="gap-1">
                          <Trophy className="w-3 h-3 text-yellow-500" />
                          {challenge.reward_points} pts
                        </Badge>
                      </div>

                      {!joined && !completed && (
                        <Button
                          onClick={() => joinChallenge(challenge.id)}
                          className="w-full mt-4"
                          variant="outline"
                        >
                          Join Challenge
                        </Button>
                      )}

                      {completed && (
                        <div className="flex items-center gap-2 mt-4 text-sm text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          Completed {userProgress.completed_date && format(new Date(userProgress.completed_date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {filteredChallenges.length === 0 && (
            <div className="text-center py-12">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No challenges found in this category</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}