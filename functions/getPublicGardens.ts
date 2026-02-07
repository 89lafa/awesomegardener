import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get current user to verify auth
    const user = await base44.auth.me();

    // Try fetching gardens with user context first
    const userGardens = await base44.entities.Garden.list('-updated_date', 100);

    // Fetch ALL gardens using service role
    const serviceGardens = await base44.asServiceRole.entities.Garden.list('-updated_date', 100);
    
    // Filter for public and non-archived in JavaScript
    const publicGardens = serviceGardens.filter(g => 
      g.privacy === 'public' && g.archived === false
    );

    // Extract unique created_by emails from public gardens
    const ownerEmails = [...new Set(publicGardens.map(g => g.created_by))];

    // Fetch user details for these owners using service role
    const allUsers = await base44.asServiceRole.entities.User.list();
    const usersForOwners = allUsers.filter(u => ownerEmails.includes(u.email));
    
    const ownersMap = {};
    usersForOwners.forEach(u => {
      ownersMap[u.email] = u;
    });

    // Attach owner data to gardens
    const gardensWithOwners = publicGardens.map(g => ({
      ...g,
      owner: ownersMap[g.created_by] || null
    }));

    return Response.json({ 
      gardens: gardensWithOwners,
      debug: {
        currentUser: user.email,
        userGardensCount: userGardens.length,
        serviceGardensCount: serviceGardens.length,
        publicGardens: publicGardens.length,
        ownerEmailsFound: ownerEmails.length,
        totalUsersInSystem: allUsers.length,
        sampleUserGarden: userGardens[0] || null,
        sampleServiceGarden: serviceGardens[0] || null
      }
    });
  } catch (error) {
    console.error('Error in getPublicGardens:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});