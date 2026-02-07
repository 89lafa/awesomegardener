import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get current user to verify auth
    const user = await base44.auth.me();

    // Use regular context to get gardens (RLS should allow public gardens)
    const allGardens = await base44.entities.Garden.list('-updated_date', 100);
    
    console.log('=== DEBUG getPublicGardens ===');
    console.log(`Total gardens fetched: ${allGardens.length}`);
    allGardens.forEach(g => {
      console.log(`Garden: ${g.name} - privacy: ${g.privacy}, is_public: ${g.is_public}, archived: ${g.archived}`);
    });
    
    // Find gardens that are public
    const publicGardens = allGardens.filter(g => 
      (g.privacy === 'public' || g.is_public === true) && g.archived === false
    );
    
    console.log(`Public gardens after filter: ${publicGardens.length}`);

    // Extract unique created_by emails/ids from public gardens
    const ownerIds = [...new Set(publicGardens.map(g => g.created_by_id || g.created_by).filter(Boolean))];

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
      gardens: gardensWithOwners
    });
  } catch (error) {
    console.error('Error in getPublicGardens:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});