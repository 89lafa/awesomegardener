import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emails } = await req.json();
    
    if (!emails || !Array.isArray(emails)) {
      return Response.json({ error: 'emails array required' }, { status: 400 });
    }

    // Use service role to fetch user profiles
    const profiles = {};
    for (const email of emails) {
      try {
        const userData = await base44.asServiceRole.entities.User.filter({ email });
        if (userData[0]) {
          // Return only public-safe fields
          profiles[email] = {
            email: userData[0].email,
            full_name: userData[0].full_name,
            nickname: userData[0].nickname,
            avatar_url: userData[0].avatar_url,
            role: userData[0].role,
            is_moderator: userData[0].is_moderator,
            community_bio: userData[0].community_bio,
            location_city: userData[0].location_city,
            location_state: userData[0].location_state,
            usda_zone: userData[0].usda_zone,
            community_interests: userData[0].community_interests
          };
        }
      } catch (err) {
        console.error('Error loading user:', email, err);
      }
    }

    return Response.json({ profiles });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});