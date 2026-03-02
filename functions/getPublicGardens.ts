import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // Fetch public gardens directly - no auth needed for service role
  const publicGardens = await base44.asServiceRole.entities.Garden.list();
  
  // Filter for public, non-archived
  const filtered = publicGardens.filter(g => g.is_public === true && g.archived !== true);
  
  // Fetch users for owner info
  const users = await base44.asServiceRole.entities.User.list();
  
  const userMap = {};
  users.forEach(u => {
    userMap[u.id] = u;
    userMap[u.email] = u;
  });

  // Attach owner data
  const result = filtered.map(g => ({
    ...g,
    owner: userMap[g.created_by_id] || userMap[g.created_by] || null
  }));

  return Response.json({ gardens: result });
});