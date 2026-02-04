import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const categories = ['varieties', 'harvests', 'streak', 'seeds', 'badges'];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const categoryNames = {
      varieties: 'Most Varieties',
      harvests: 'Most Harvests',
      streak: 'Longest Streak',
      seeds: 'Largest Seed Collection',
      badges: 'Most Badges'
    };

    for (const category of categories) {
      // Deactivate old leaderboards
      const oldLeaderboards = await base44.asServiceRole.entities.Leaderboard.filter({
        category,
        period: 'monthly',
        is_active: true
      });
      
      for (const old of oldLeaderboards) {
        await base44.asServiceRole.entities.Leaderboard.update(old.id, { is_active: false });
      }

      // Create new leaderboard
      const leaderboard = await base44.asServiceRole.entities.Leaderboard.create({
        name: `${categoryNames[category]} - ${monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        category,
        period: 'monthly',
        period_start: monthStart.toISOString(),
        period_end: monthEnd.toISOString(),
        is_active: true
      });

      // Get all users
      const allUsers = await base44.asServiceRole.entities.User.list();
      const scores = [];

      for (const targetUser of allUsers) {
        const score = await calculateScore(base44, targetUser.email, category, monthStart, monthEnd);
        if (score > 0) {
          scores.push({
            email: targetUser.email,
            display_name: targetUser.full_name || targetUser.email.split('@')[0],
            score
          });
        }
      }

      // Sort by score descending
      scores.sort((a, b) => b.score - a.score);

      // Save top 100
      for (let i = 0; i < Math.min(100, scores.length); i++) {
        await base44.asServiceRole.entities.LeaderboardEntry.create({
          leaderboard_id: leaderboard.id,
          user_email: scores[i].email,
          rank: i + 1,
          score: scores[i].score,
          display_name: scores[i].display_name
        });
      }
    }

    return Response.json({ success: true, message: 'Leaderboards generated' });
  } catch (error) {
    console.error('Leaderboard generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function calculateScore(base44, userEmail, category, startDate, endDate) {
  switch (category) {
    case 'varieties': {
      const crops = await base44.asServiceRole.entities.CropPlan.filter({ created_by: userEmail });
      return crops.length;
    }
    
    case 'harvests': {
      const harvests = await base44.asServiceRole.entities.HarvestLog.filter({ created_by: userEmail });
      return harvests.filter(h => {
        const harvestDate = new Date(h.harvest_date || h.created_date);
        return harvestDate >= startDate && harvestDate <= endDate;
      }).length;
    }
    
    case 'streak': {
      const streaks = await base44.asServiceRole.entities.UserStreak.filter({ created_by: userEmail });
      return streaks[0]?.current_streak || 0;
    }
    
    case 'seeds': {
      const seeds = await base44.asServiceRole.entities.SeedLot.filter({ created_by: userEmail });
      return seeds.length;
    }
    
    case 'badges': {
      const badges = await base44.asServiceRole.entities.UserBadge.filter({ created_by: userEmail });
      return badges.filter(b => b.unlocked_date).length;
    }
    
    default:
      return 0;
  }
}