import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, ArrowRight, Loader2, Trophy, Calendar } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function ChallengeProgressWidget() {
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const [userChallenges, allChallenges] = await Promise.all([
        base44.entities.UserChallenge.filter({}),
        base44.entities.Challenge.filter({ is_active: true })
      ]);

      const active = userChallenges
        .filter(uc => !uc.completed)
        .map(uc => {
          const challenge = allChallenges.find(c => c.id === uc.challenge_id);
          return { ...challenge, progress: uc.progress };
        })
        .filter(c => c.title)
        .slice(0, 2); // Show top 2

      setActiveChallenges(active);
    } catch (error) {
      console.error('Error loading challenges:', error);
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
          <Target className="w-5 h-5 text-emerald-600" />
          Active Challenges
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeChallenges.length > 0 ? (
          <>
            {activeChallenges.map((challenge) => (
              <div key={challenge.id} className="p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                <div className="flex items-start gap-3 mb-2">
                  <div className="text-2xl">{challenge.icon || '🎯'}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{challenge.title}</h4>
                    <p className="text-xs text-gray-600 mt-0.5">{challenge.description}</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Progress value={challenge.progress || 0} className="h-2" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">{challenge.progress || 0}% complete</span>
                    {challenge.end_date && (
                      <span className="text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Ends {formatDistanceToNow(new Date(challenge.end_date), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    <Trophy className="w-3 h-3 mr-1 text-yellow-500" />
                    {challenge.reward_points} pts
                  </Badge>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Target className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No active challenges</p>
            <p className="text-xs text-gray-500 mt-1">Join a challenge to start earning rewards</p>
          </div>
        )}

        <Link to={createPageUrl('Challenges')}>
          <Button variant="outline" className="w-full group">
            Browse All Challenges
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}