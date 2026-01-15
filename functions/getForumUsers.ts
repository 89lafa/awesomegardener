import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate the user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the emails from the request body
    const { emails } = await req.json();
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return Response.json({ users: {} });
    }

    // Fetch each user individually with service role
    const usersMap = {};
    for (const email of emails) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email });
        if (users.length > 0) {
          const u = users[0];
          usersMap[u.email] = {
            email: u.email,
            nickname: u.nickname,
            full_name: u.full_name,
            role: u.role,
            is_moderator: u.is_moderator,
            avatar_url: u.avatar_url,
            profile_logo_url: u.profile_logo_url,
            usda_zone: u.usda_zone,
            location_city: u.location_city,
            location_state: u.location_state,
            community_bio: u.community_bio,
            community_interests: u.community_interests
          };
        }
      } catch (error) {
        console.error(`Error fetching user ${email}:`, error);
      }
    }

    return Response.json({ users: usersMap });
  } catch (error) {
    console.error('Error fetching forum users:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});