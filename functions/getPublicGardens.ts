import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get app and environment from request
    const url = new URL(req.url);
    const appId = Deno.env.get('BASE44_APP_ID');
    
    console.log('App ID:', appId);
    
    // Try to fetch gardens using direct API call with service role
    const serviceRoleKey = Deno.env.get('BASE44_SERVICE_ROLE_KEY');
    const apiUrl = Deno.env.get('BASE44_API_URL') || 'https://api.base44.com';
    
    const response = await fetch(`${apiUrl}/entities/Garden`, {
      headers: {
        'X-App-Id': appId,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });
    
    const data = await response.json();
    console.log('Direct API response:', JSON.stringify(data));
    
    const allGardens = data.entities || [];
    console.log(`Total gardens fetched: ${allGardens.length}`);
    
    // Find gardens that are public and not archived
    const publicGardens = allGardens.filter(g => {
      const isPublic = g.data?.is_public === true;
      const notArchived = g.data?.archived !== true;
      console.log(`Garden ${g.data?.name}: is_public=${g.data?.is_public}, archived=${g.data?.archived}, passes=${isPublic && notArchived}`);
      return isPublic && notArchived;
    });
    
    console.log(`Public gardens count: ${publicGardens.length}`);

    // Fetch user details using service role
    const allUsers = await base44.asServiceRole.entities.User.list();
    
    const ownersMap = {};
    allUsers.forEach(u => {
      ownersMap[u.id] = u;
      ownersMap[u.email] = u;
    });

    // Attach owner data to gardens and flatten structure
    const gardensWithOwners = publicGardens.map(g => {
      const ownerId = g.created_by_id || g.created_by;
      return {
        ...g.data,
        id: g.id,
        created_date: g.created_date,
        updated_date: g.updated_date,
        created_by_id: g.created_by_id,
        is_sample: g.is_sample,
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