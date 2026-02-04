import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active achievements
    const achievements = await base44.entities.Achievement.filter({ is_active: true });
    
    // Get user's current achievements
    const userAchievements = await base44.entities.UserAchievement.filter({ created_by: user.email });
    const unlockedIds = new Set(userAchievements.filter(ua => ua.unlocked_date).map(ua => ua.achievement_id));
    
    // Get user stats
    const [cropPlans, harvests, streak] = await Promise.all([
      base44.entities.CropPlan.filter({ created_by: user.email }),
      base44.entities.HarvestLog.filter({ created_by: user.email }),
      base44.entities.UserStreak.filter({ created_by: user.email })
    ]);
    
    const stats = {
      plant_count: cropPlans.length,
      harvest_count: harvests.length,
      current_streak: streak[0]?.current_streak || 0
    };
    
    const newlyUnlocked = [];
    
    // Check each achievement
    for (const achievement of achievements) {
      if (unlockedIds.has(achievement.id)) continue;
      
      const req = achievement.requirement;
      let unlocked = false;
      let progress = 0;
      
      if (req.type === 'plant_count') {
        progress = Math.min(100, (stats.plant_count / req.value) * 100);
        unlocked = stats.plant_count >= req.value;
      } else if (req.type === 'harvest_count') {
        progress = Math.min(100, (stats.harvest_count / req.value) * 100);
        unlocked = stats.harvest_count >= req.value;
      } else if (req.type === 'streak') {
        progress = Math.min(100, (stats.current_streak / req.value) * 100);
        unlocked = stats.current_streak >= req.value;
      }
      
      // Find or create UserAchievement
      let userAch = userAchievements.find(ua => ua.achievement_id === achievement.id);
      
      if (unlocked) {
        if (!userAch) {
          userAch = await base44.entities.UserAchievement.create({
            achievement_id: achievement.id,
            unlocked_date: new Date().toISOString(),
            progress: 100
          });
        } else if (!userAch.unlocked_date) {
          await base44.entities.UserAchievement.update(userAch.id, {
            unlocked_date: new Date().toISOString(),
            progress: 100
          });
        }
        newlyUnlocked.push(achievement);
      } else if (userAch && userAch.progress !== progress) {
        await base44.entities.UserAchievement.update(userAch.id, { progress });
      } else if (!userAch && progress > 0) {
        await base44.entities.UserAchievement.create({
          achievement_id: achievement.id,
          progress
        });
      }
    }
    
    return Response.json({
      success: true,
      newlyUnlocked: newlyUnlocked.map(a => ({ title: a.title, points: a.points })),
      stats
    });
  } catch (error) {
    console.error('Achievement check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});