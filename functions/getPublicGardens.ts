import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all public gardens using service role (bypasses RLS)
    const allGardens = await base44.asServiceRole.entities.Garden.filter({
      privacy: 'public',
      archived: false
    }, '-updated_date');

    // Extract unique created_by emails from public gardens
    const ownerEmails = [...new Set(allGardens.map(g => g.created_by))];

    // Fetch user details for these owners using service role
    const allUsers = await base44.asServiceRole.entities.User.filter({
      email: { '$in': ownerEmails }
    });
    
    const ownersMap = {};
    allUsers.forEach(u => {
      ownersMap[u.email] = u;
    });

    // Attach owner data to gardens
    const gardensWithOwners = allGardens.map(g => ({
      ...g,
      owner: ownersMap[g.created_by] || null
    }));

    return Response.json({ gardens: gardensWithOwners });
  } catch (error) {
    console.error('Error in getPublicGardens:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});