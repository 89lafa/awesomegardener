import React, { createContext, useContext, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import BadgeUnlockModal from './BadgeUnlockModal';
import LevelUpModal from './LevelUpModal';
import { toast } from 'sonner';

const GamificationContext = createContext();

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return context;
};

export function GamificationProvider({ children }) {
  const [unlockedBadge, setUnlockedBadge] = useState(null);
  const [levelUp, setLevelUp] = useState(null);

  const checkBadges = useCallback(async (triggerType) => {
    try {
      const response = await base44.functions.invoke('checkBadges', { triggerType });
      
      if (response.data?.newlyUnlocked && response.data.newlyUnlocked.length > 0) {
        // Show first badge modal
        setUnlockedBadge(response.data.newlyUnlocked[0]);
        
        // If multiple badges, show toast for others
        if (response.data.newlyUnlocked.length > 1) {
          toast.success(`You unlocked ${response.data.newlyUnlocked.length} badges!`);
        }
      }

      return response.data;
    } catch (error) {
      console.error('Error checking badges:', error);
    }
  }, []);

  const updateStreak = useCallback(async () => {
    try {
      const response = await base44.functions.invoke('updateStreak', {});
      const data = response.data;

      if (data.newStreak && data.increased) {
        toast.success(`🔥 Streak increased to ${data.streak} days!`);
      } else if (data.brokeStreak) {
        toast.error('Streak broken. Starting fresh!', { duration: 4000 });
      } else if (data.alreadyCheckedIn) {
        toast.info('Already checked in today');
      }

      // Check for streak badges
      await checkBadges('streak_milestone');

      return data;
    } catch (error) {
      console.error('Error updating streak:', error);
      toast.error('Failed to update streak');
    }
  }, [checkBadges]);

  const addXP = useCallback(async (points, action) => {
    try {
      // Get current progress
      const progressRecords = await base44.entities.UserProgress.filter({});
      let userProgress = progressRecords[0];

      if (!userProgress) {
        userProgress = await base44.entities.UserProgress.create({
          level: 1,
          total_xp: 0,
          xp_to_next_level: 100
        });
      }

      const newTotalXP = userProgress.total_xp + points;
      let newLevel = userProgress.level;
      let xpToNext = userProgress.xp_to_next_level;

      // Level up logic
      const leveledUp = newTotalXP >= xpToNext;
      while (newTotalXP >= xpToNext) {
        newLevel++;
        xpToNext = newLevel * 100;
      }

      await base44.entities.UserProgress.update(userProgress.id, {
        total_xp: newTotalXP,
        level: newLevel,
        xp_to_next_level: xpToNext
      });

      // Show level up modal
      if (leveledUp) {
        setLevelUp(newLevel);
      } else {
        toast.success(`+${points} XP ${action ? `for ${action}` : ''}`);
      }

      return { leveledUp, newLevel };
    } catch (error) {
      console.error('Error adding XP:', error);
    }
  }, []);

  const logActivity = useCallback(async (activityType, metadata = {}) => {
    try {
      // Log activity
      await base44.entities.ActivityLog.create({
        activity_type: activityType,
        activity_date: new Date().toISOString(),
        metadata
      });

      // Update streak
      await updateStreak();

      return true;
    } catch (error) {
      console.error('Error logging activity:', error);
      return false;
    }
  }, [updateStreak]);

  return (
    <GamificationContext.Provider
      value={{
        checkBadges,
        updateStreak,
        addXP,
        logActivity
      }}
    >
      {children}
      
      <BadgeUnlockModal
        badge={unlockedBadge}
        open={!!unlockedBadge}
        onClose={() => setUnlockedBadge(null)}
      />
      
      <LevelUpModal
        newLevel={levelUp}
        open={!!levelUp}
        onClose={() => setLevelUp(null)}
      />
    </GamificationContext.Provider>
  );
}