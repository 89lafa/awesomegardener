import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get a public trade to test with
    const trades = await base44.asServiceRole.entities.SeedTrade.filter({ is_public: true });
    
    if (trades.length === 0) {
      return Response.json({ error: 'No public trades found' }, { status: 404 });
    }
    
    const trade = trades[0];
    
    // Check what data we have - dump ENTIRE trade object
    const result = {
      trade_full_object: trade,
      current_user_id: user.id,
      current_user_email: user.email
    };
    
    // Get the initiator's email from User entity
    const allUsers = await base44.asServiceRole.entities.User.list();
    const initiator = allUsers.find(u => u.id === trade.initiator_id);
    
    result.initiator_user = initiator;
    result.all_users_count = allUsers.length;
    
    if (initiator) {
      // Try to create a test notification
      try {
        const notification = await base44.asServiceRole.entities.Notification.create({
          user_email: initiator.email,
          type: 'system',
          title: 'Test Trade Interest',
          body: `Test from ${user.email}`,
          link_url: '/SeedTrading',
          is_read: false
        });
        
        result.notification_created = true;
        result.notification_id = notification.id;
      } catch (notifError) {
        result.notification_error = notifError.message;
        result.notification_created = false;
      }
    } else {
      result.notification_error = 'Initiator user not found';
    }
    
    return Response.json(result);
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});