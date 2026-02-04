import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { triggerType } = await req.json();

    // Get all active badges for this trigger
    const badges = await base44.entities.Badge.filter({ 
      trigger_type: triggerType,
      is_active: true 
    });

    // Get user's badges
    const userBadges = await base44.entities.UserBadge.filter({});
    const unlockedIds = new Set(userBadges.filter(ub => ub.unlocked_date).map(ub => ub.badge_id));

    const newlyUnlocked = [];
    
    for (const badge of badges) {
      if (unlockedIds.has(badge.id)) continue;

      // Evaluate criteria
      const result = await evaluateCriteria(base44, user, badge.unlock_criteria);
      
      if (result.met) {
        // Unlock badge
        await base44.entities.UserBadge.create({
          badge_id: badge.id,
          unlocked_date: new Date().toISOString(),
          is_displayed: true,
          progress: 100
        });

        // Add XP
        await addXP(base44, user, badge.points);

        newlyUnlocked.push({
          ...badge,
          points: badge.points
        });
      } else {
        // Update progress
        const existing = userBadges.find(ub => ub.badge_id === badge.id);
        const progressValue = Math.round((result.current / result.target) * 100);
        
        if (existing) {
          await base44.entities.UserBadge.update(existing.id, {
            progress: progressValue
          });
        } else {
          await base44.entities.UserBadge.create({
            badge_id: badge.id,
            progress: progressValue
          });
        }
      }
    }

    return Response.json({
      success: true,
      newlyUnlocked
    });
  } catch (error) {
    console.error('Badge check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function evaluateCriteria(base44, user, criteria) {
  if (criteria.type === 'count') {
    const count = await base44.entities[criteria.entity].filter({}).then(items => items.length);
    return {
      met: count >= criteria.threshold,
      current: count,
      target: criteria.threshold
    };
  }
  
  if (criteria.type === 'variety_count') {
    const plants = await base44.entities.CropPlan.filter({});
    const varietyCount = plants.filter(p => p.plant_type_id === criteria.plant_type_id).length;
    return {
      met: varietyCount >= criteria.threshold,
      current: varietyCount,
      target: criteria.threshold
    };
  }
  
  if (criteria.type === 'streak') {
    const streaks = await base44.entities.UserStreak.filter({});
    const currentStreak = streaks[0]?.current_streak || 0;
    return {
      met: currentStreak >= criteria.days,
      current: currentStreak,
      target: criteria.days
    };
  }

  return { met: false, current: 0, target: 1 };
}

async function addXP(base44, user, points) {
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
  while (newTotalXP >= xpToNext) {
    newLevel++;
    xpToNext = newLevel * 100; // Simple formula: level * 100
  }

  await base44.entities.UserProgress.update(userProgress.id, {
    total_xp: newTotalXP,
    level: newLevel,
    xp_to_next_level: xpToNext
  });

  return { leveledUp: newLevel > userProgress.level, newLevel };
}