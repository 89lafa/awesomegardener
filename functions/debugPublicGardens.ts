import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Test 1: Fetch gardens with privacy filter
    const publicGardens = await base44.asServiceRole.entities.Garden.filter({
      privacy: 'public',
      archived: false
    }, '-updated_date');

    // Test 2: Fetch all gardens
    const allGardens = await base44.asServiceRole.entities.Garden.list('-updated_date');

    // Test 3: Check what archived field looks like
    const nonArchived = allGardens.filter(g => !g.archived);
    const withPrivacy = allGardens.filter(g => g.privacy === 'public');

    return Response.json({ 
      publicGardens,
      allGardensCount: allGardens.length,
      nonArchivedCount: nonArchived.length,
      withPrivacyPublicCount: withPrivacy.length,
      sampleGarden: allGardens[0] || null
    });
  } catch (error) {
    console.error('Error in debugPublicGardens:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});