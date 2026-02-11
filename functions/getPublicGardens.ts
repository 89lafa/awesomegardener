import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch ALL gardens using service role to bypass any RLS issues
    const allGardens = await base44.asServiceRole.entities.Garden.list();
    
    console.log(`Total gardens fetched: ${allGardens.length}`);
    console.log('All gardens:', JSON.stringify(allGardens.map(g => ({
      id: g.id,
      name: g.name,
      is_public: g.is_public,
      privacy: g.privacy,
      archived: g.archived,
      created_by: g.created_by
    }))));
    
    // Filter for gardens that are public and not archived
    const publicGardens = allGardens.filter(g => {
      const isPublic = g.is_public === true;
      const privacyPublic = g.privacy === 'public';
      const notArchived = g.archived !== true;
      console.log(`Garden ${g.name}: is_public=${g.is_public}, privacy=${g.privacy}, archived=${g.archived}, passes=${isPublic && privacyPublic && notArchived}`);
      return isPublic && privacyPublic && notArchived;
    });
    
    console.log(`Public gardens count: ${publicGardens.length}`);

    // Fetch user details using service role
    const allUsers = await base44.asServiceRole.entities.User.list();
    
    const ownersMap = {};
    allUsers.forEach(u => {
      ownersMap[u.id] = u;
      ownersMap[u.email] = u;
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
        totalGardens: allGardens.length,
        publicGardensCount: publicGardens.length
      }
    });
  } catch (error) {
    console.error('Error in getPublicGardens:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});