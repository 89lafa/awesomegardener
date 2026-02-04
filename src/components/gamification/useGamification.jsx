import { useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export function useGamification() {
  const checkBadges = useCallback(async (triggerType) => {
    try {
      const response = await base44.functions.invoke('checkBadges', { triggerType });
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
        return data; // Silent - already checked in
      }

      return data;
    } catch (error) {
      console.error('Error updating streak:', error);
      toast.error('Failed to update streak');
    }
  }, []);

  const logActivity = useCallback(async (activityType, metadata = {}) => {
    try {
      // Log activity
      await base44.entities.ActivityLog.create({
        activity_type: activityType,
        activity_date: new Date().toISOString(),
        notes: metadata.notes || '',
        ...(metadata.garden_id && { garden_id: metadata.garden_id }),
        ...(metadata.crop_plan_ids && { crop_plan_ids: metadata.crop_plan_ids })
      });

      // Update streak
      await updateStreak();

      return true;
    } catch (error) {
      console.error('Error logging activity:', error);
      return false;
    }
  }, [updateStreak]);

  return {
    checkBadges,
    updateStreak,
    logActivity
  };
}