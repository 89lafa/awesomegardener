import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Use list() with no filter to get ALL gardens, then filter in JS
    const allGardens = await base44.asServiceRole.entities.Garden.list();
    
    console.log(`Total gardens fetched: ${allGardens.length}`);
    allGardens.forEach(g => {
      console.log(`Garden: ${g.name}, is_public: ${g.is_public}, archived: ${g.archived}`);
    });
    
    // Filter for public, non-archived gardens
    const publicGardens = allGardens.filter(g => {
      const isPublic = g.is_public === true;
      const notArchived = !g.archived || g.archived === false;
      console.log(`${g.name}: isPublic=${isPublic}, notArchived=${notArchived}`);
      return isPublic && notArchived;
    });
    
    console.log(`Public gardens after filter: ${publicGardens.length}`);

    // Fetch users
    const allUsers = await base44.asServiceRole.entities.User.list();
    
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