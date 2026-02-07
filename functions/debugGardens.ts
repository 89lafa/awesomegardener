import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    console.log('=== CURRENT USER ===');
    console.log(`Email: ${user.email}`);
    console.log(`ID: ${user.id}`);
    console.log(`Role: ${user.role}`);

    // Get ALL gardens using service role (bypass RLS)
    const allGardensServiceRole = await base44.asServiceRole.entities.Garden.list();
    console.log(`\n=== ALL GARDENS (Service Role) - Total: ${allGardensServiceRole.length} ===`);
    allGardensServiceRole.forEach(g => {
      console.log(`\nGarden: ${g.name}`);
      console.log(`  ID: ${g.id}`);
      console.log(`  Owner: ${g.created_by} (${g.created_by_id})`);
      console.log(`  privacy: ${g.privacy}`);
      console.log(`  is_public: ${g.is_public}`);
      console.log(`  archived: ${g.archived}`);
    });

    // Get gardens with user context (respects RLS)
    const gardensUserContext = await base44.entities.Garden.list();
    console.log(`\n=== GARDENS USER CAN SEE (User Context) - Total: ${gardensUserContext.length} ===`);
    gardensUserContext.forEach(g => {
      console.log(`\nGarden: ${g.name}`);
      console.log(`  Owner: ${g.created_by}`);
      console.log(`  privacy: ${g.privacy}`);
      console.log(`  is_public: ${g.is_public}`);
    });

    // Filter for public gardens
    const publicGardens = allGardensServiceRole.filter(g => 
      g.privacy === 'public' && g.archived === false
    );
    console.log(`\n=== PUBLIC NON-ARCHIVED GARDENS - Total: ${publicGardens.length} ===`);
    publicGardens.forEach(g => {
      console.log(`- ${g.name} (owner: ${g.created_by})`);
    });

    return Response.json({ 
      currentUser: { email: user.email, id: user.id, role: user.role },
      allGardens: allGardensServiceRole.length,
      gardensUserCanSee: gardensUserContext.length,
      publicGardens: publicGardens.length,
      details: {
        allGardens: allGardensServiceRole.map(g => ({
          name: g.name,
          owner: g.created_by,
          privacy: g.privacy,
          is_public: g.is_public,
          archived: g.archived
        })),
        publicGardens: publicGardens.map(g => ({
          name: g.name,
          owner: g.created_by,
          privacy: g.privacy
        }))
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});