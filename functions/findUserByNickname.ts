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
      return Response.json({ error: 'Nickname is required' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ 
      nickname: nickname.trim() 
    });
    
    if (users.length === 0) {
      return Response.json({ found: false });
    }

    const foundUser = users[0];
    return Response.json({ 
      found: true,
      email: foundUser.email,
      full_name: foundUser.full_name,
      nickname: foundUser.nickname
    });
  } catch (error) {
    console.error('Error finding user:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});