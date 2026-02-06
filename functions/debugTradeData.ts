import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all trades
    const trades = await base44.asServiceRole.entities.SeedTrade.filter({}, '-created_date');
    
    // Get detailed info
    const tradeDetails = trades.map(t => ({
      id: t.id,
      initiator_id: t.initiator_id,
      status: t.status,
      is_public: t.is_public,
      interested_users_count: t.interested_users?.length || 0,
      interested_users: t.interested_users,
      offering: t.offering_seeds,
      requesting: t.requesting_seeds
    }));

    return Response.json({
      total_trades: trades.length,
      current_user_id: user.id,
      trades: tradeDetails
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});