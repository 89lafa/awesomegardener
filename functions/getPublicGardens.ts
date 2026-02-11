import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Use asServiceRole to bypass RLS and fetch public gardens
    const publicGardens = await base44.asServiceRole.entities.Garden.filter({
      is_public: true
    }, '-updated_date', 100);
    
    // Filter out archived gardens in JavaScript
    const activePublicGardens = publicGardens.filter(g => g.archived !== true);
    
    console.log(`Public gardens found: ${activePublicGardens.length}`);

    // Fetch users - limit to reasonable amount
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 100);
    
    const ownersMap = {};
    allUsers.forEach(u => {
      if (u.id) ownersMap[u.id] = u;
      if (u.email) ownersMap[u.email] = u;
    });

    // Attach owner data to gardens
    const gardensWithOwners = activePublicGardens.map(g => {
      const ownerId = g.created_by_id || g.created_by;
      return {
        ...g,
        owner: ownersMap[ownerId] || null
      };
    });

    return Response.json({ 
      gardens: gardensWithOwners
    });
  } catch (error) {
    console.error('Error in getPublicGardens:', error);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});