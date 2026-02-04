import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Star, TrendingUp, Loader2 } from 'lucide-react';

export default function LevelProgressWidget() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const progressRecords = await base44.entities.UserProgress.filter({});
      setProgress(progressRecords[0] || { level: 1, total_xp: 0, xp_to_next_level: 100 });
    } catch (error) {
      console.error('Error loading progress:', error);
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

  const currentXP = progress.total_xp % progress.xp_to_next_level;
  const xpNeeded = progress.xp_to_next_level - currentXP;
  const progressPercentage = (currentXP / progress.xp_to_next_level) * 100;

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star className="w-6 h-6 text-purple-600" />
            <span className="text-2xl font-bold text-gray-900">Level {progress.level}</span>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Total XP</p>
            <p className="text-lg font-bold text-purple-600">{progress.total_xp}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{currentXP} / {progress.xp_to_next_level} XP</span>
            <span className="font-medium text-purple-600">{xpNeeded} XP to Level {progress.level + 1}</span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-white rounded-lg">
          <p className="text-sm text-center text-gray-700">
            <TrendingUp className="w-4 h-4 inline mr-1 text-emerald-600" />
            Keep earning XP to level up!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}