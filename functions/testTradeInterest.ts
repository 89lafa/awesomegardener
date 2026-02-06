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
    
    // Check what data we have
    const result = {
      trade_id: trade.id,
      initiator_id: trade.initiator_id,
      created_by: trade.created_by,
      current_user_id: user.id,
      current_user_email: user.email,
      
      // Try to create notification
      notification_data: {
        user_email: trade.created_by,
        type: 'system',
        title: 'Test Trade Interest',
        body: `Test from ${user.email}`,
        link_url: '/SeedTrading',
        is_read: false
      }
    };
    
    // Try to create a test notification
    try {
      const notification = await base44.asServiceRole.entities.Notification.create({
        user_email: trade.created_by,
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
    
    return Response.json(result);
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});