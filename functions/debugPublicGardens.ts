import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Test: Direct query without filters
    const response1 = await fetch(`${Deno.env.get('BASE44_API_URL')}/apps/${Deno.env.get('BASE44_APP_ID')}/entities/Garden`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      }
    });
    const data1 = await response1.json();

    // Test 2: Using SDK
    const allGardens = await base44.asServiceRole.entities.Garden.list('-updated_date', 100);

    return Response.json({ 
      directAPICall: data1,
      sdkCall: allGardens,
      sdkCount: allGardens.length
    });
  } catch (error) {
    console.error('Error in debugPublicGardens:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});