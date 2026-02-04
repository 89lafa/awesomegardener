import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const streaks = await base44.entities.UserStreak.filter({});
    let streak = streaks[0];
    const today = new Date().toDateString();

    if (!streak) {
      // First ever check-in
      streak = await base44.entities.UserStreak.create({
        current_streak: 1,
        longest_streak: 1,
        last_check_in_date: new Date().toISOString(),
        total_check_ins: 1
      });

      return Response.json({
        success: true,
        newStreak: true,
        streak: 1,
        increased: true
      });
    }

    const lastCheckIn = new Date(streak.last_check_in_date).toDateString();

    // Already checked in today?
    if (lastCheckIn === today) {
      return Response.json({
        success: true,
        newStreak: false,
        streak: streak.current_streak,
        alreadyCheckedIn: true
      });
    }

    // Was yesterday a check-in? (consecutive)
    const yesterday = new Date(Date.now() - 24*60*60*1000).toDateString();
    const isConsecutive = (lastCheckIn === yesterday);

    let newStreak;
    if (isConsecutive) {
      // Continue streak
      newStreak = streak.current_streak + 1;
    } else {
      // Broke streak, reset to 1
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, streak.longest_streak);

    await base44.entities.UserStreak.update(streak.id, {
      current_streak: newStreak,
      longest_streak: newLongest,
      last_check_in_date: new Date().toISOString(),
      total_check_ins: streak.total_check_ins + 1
    });

    // Check for streak milestone badges
    if (newStreak === 7 || newStreak === 30 || newStreak === 100) {
      await base44.functions.invoke('checkBadges', { triggerType: 'streak_milestone' });
    }

    return Response.json({
      success: true,
      newStreak: true,
      streak: newStreak,
      increased: isConsecutive,
      brokeStreak: !isConsecutive && streak.current_streak > 1
    });
  } catch (error) {
    console.error('Streak update error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});