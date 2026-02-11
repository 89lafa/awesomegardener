import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // RLS allows reading public gardens - use regular filter (no service role needed)
    const publicGardens = await base44.entities.Garden.filter({
      is_public: true,
      archived: { $ne: true }
    }, '-updated_date', 100);
    
    console.log(`Public gardens found: ${publicGardens.length}`);

    // Fetch all users using service role
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);
    
    const ownersMap = {};
    allUsers.forEach(u => {
      if (u.id) ownersMap[u.id] = u;
      if (u.email) ownersMap[u.email] = u;
    });

    // Attach owner data
    const gardensWithOwners = publicGardens.map(g => {
      const ownerId = g.created_by_id || g.created_by;
      return {
        ...g,
        owner: ownersMap[ownerId] || null
      };
    });

    return Response.json({ gardens: gardensWithOwners });
  } catch (error) {
    console.error('Error in getPublicGardens:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});