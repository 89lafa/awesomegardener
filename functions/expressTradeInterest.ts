import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { tradeId } = await req.json();
    
    if (!tradeId) {
      return Response.json({ error: 'Trade ID required' }, { status: 400 });
    }
    
    // Get the trade
    const trade = await base44.asServiceRole.entities.SeedTrade.get(tradeId);
    
    if (!trade) {
      return Response.json({ error: 'Trade not found' }, { status: 404 });
    }
    
    const interested = trade.interested_users || [];
    
    // Check if user already expressed interest
    if (interested.some(u => u.user_id === user.id)) {
      return Response.json({ error: 'Already expressed interest' }, { status: 400 });
    }
    
    // Add current user to interested_users
    interested.push({
      user_id: user.id,
      user_nickname: user.full_name || user.email,
      message: '',
      timestamp: new Date().toISOString()
    });
    
    // Update the trade
    await base44.asServiceRole.entities.SeedTrade.update(tradeId, {
      interested_users: interested
    });
    
    // Get seller's email from User entity using service role
    const allUsers = await base44.asServiceRole.entities.User.list();
    const seller = allUsers.find(u => u.id === trade.initiator_id);
    
    if (!seller) {
      return Response.json({ error: 'Seller user not found' }, { status: 404 });
    }
    
    // Create notification for seller
    await base44.asServiceRole.entities.Notification.create({
      user_email: seller.email,
      type: 'system',
      title: 'New Trade Interest',
      body: `${user.full_name || user.email} is interested in your seed trade offer!`,
      link_url: '/SeedTrading',
      is_read: false
    });
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error in expressTradeInterest:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});