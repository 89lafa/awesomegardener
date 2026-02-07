import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get current user to verify auth
    const user = await base44.auth.me();

    // Fetch gardens with user context (this respects RLS and should get public gardens)
    const allGardens = await base44.entities.Garden.list('-updated_date', 100);
    
    console.log('Total gardens fetched:', allGardens.length);
    console.log('Sample garden:', JSON.stringify(allGardens[0], null, 2));
    
    // Find gardens that are public
    const publicGardens = allGardens.filter(g => 
      g.privacy === 'public' && g.archived === false
    );

    console.log('Public gardens found:', publicGardens.length);

    // Extract unique created_by emails/ids from public gardens
    const ownerIds = [...new Set(publicGardens.map(g => g.created_by_id || g.created_by).filter(Boolean))];
    console.log('Owner IDs:', ownerIds);

    // Fetch user details using service role
    const allUsers = await base44.asServiceRole.entities.User.list();
    console.log('Total users fetched:', allUsers.length);
    
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

    console.log('Gardens with owners:', gardensWithOwners.length);
    console.log('First garden owner:', gardensWithOwners[0]?.owner ? 'Found' : 'Not found');

    return Response.json({ 
      gardens: gardensWithOwners
    });
  } catch (error) {
    console.error('Error in getPublicGardens:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});