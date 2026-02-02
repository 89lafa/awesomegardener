import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nickname } = await req.json();
    
    if (!nickname || !nickname.trim()) {
      return Response.json({ available: false, error: 'Nickname is required' });
    }

    const trimmedNickname = nickname.trim();
    
    // Check if nickname is taken by another user
    const existingUsers = await base44.asServiceRole.entities.User.filter({ 
      nickname: trimmedNickname 
    });
    
    // Filter out current user
    const takenByOther = existingUsers.some(u => u.email !== user.email);
    
    return Response.json({ 
      available: !takenByOther,
      nickname: trimmedNickname
    });
  } catch (error) {
    console.error('Error validating nickname:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});