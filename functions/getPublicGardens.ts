import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch all gardens using service role to bypass RLS
    const allGardens = await base44.asServiceRole.entities.Garden.list('-updated_date', 100);
    
    console.log(`Total gardens: ${allGardens.length}`);
    
    // Filter for public, non-archived gardens
    const publicGardens = allGardens.filter(g => {
      return g.is_public === true && g.archived !== true;
    });
    
    console.log(`Public gardens found: ${publicGardens.length}`);

    // Fetch users
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 100);
    
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