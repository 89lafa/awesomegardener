import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Use asServiceRole to bypass RLS restrictions completely
    // Query gardens with is_public = true and not archived
    const publicGardens = await base44.asServiceRole.entities.Garden.filter({
      is_public: true,
      archived: { $ne: true }
    }, '-updated_date', 500);
    
    console.log(`Public gardens found: ${publicGardens.length}`);

    // Fetch all users for owner data
    const allUsers = await base44.asServiceRole.entities.User.list();
    
    const ownersMap = {};
    allUsers.forEach(u => {
      if (u.id) ownersMap[u.id] = u;
      if (u.email) ownersMap[u.email] = u;
    });

    // Attach owner data to gardens
    const gardensWithOwners = publicGardens.map(g => {
      const ownerId = g.created_by_id || g.created_by;
      return {
        ...g,
        owner: ownersMap[ownerId] || null
      };
    });

    return Response.json({ 
      gardens: gardensWithOwners,
      debug: {
        totalQueried: publicGardens.length,
        publicGardensCount: publicGardens.length
      }
    });
  } catch (error) {
    console.error('Error in getPublicGardens:', error);
    return Response.json({ 
      error: error.message, 
      stack: error.stack 
    }, { status: 500 });
  }
});