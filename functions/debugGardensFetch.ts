import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('Testing different methods to fetch gardens...');
    
    // Method 1: Normal user context
    try {
      const method1 = await base44.entities.Garden.list();
      console.log('Method 1 (user context list):', method1.length, 'gardens');
    } catch (e) {
      console.log('Method 1 failed:', e.message);
    }
    
    // Method 2: User context filter
    try {
      const method2 = await base44.entities.Garden.filter({});
      console.log('Method 2 (user context filter):', method2.length, 'gardens');
    } catch (e) {
      console.log('Method 2 failed:', e.message);
    }
    
    // Method 3: Service role list
    try {
      const method3 = await base44.asServiceRole.entities.Garden.list();
      console.log('Method 3 (service role list):', method3.length, 'gardens');
      console.log('Gardens:', JSON.stringify(method3.map(g => ({
        id: g.id,
        name: g.name,
        is_public: g.is_public,
        privacy: g.privacy,
        archived: g.archived,
        created_by: g.created_by
      }))));
      
      return Response.json({ 
        success: true,
        method: 'service role list',
        count: method3.length,
        gardens: method3
      });
    } catch (e) {
      console.log('Method 3 failed:', e.message);
    }
    
    // Method 4: Service role filter
    try {
      const method4 = await base44.asServiceRole.entities.Garden.filter({});
      console.log('Method 4 (service role filter):', method4.length, 'gardens');
      
      return Response.json({ 
        success: true,
        method: 'service role filter',
        count: method4.length,
        gardens: method4
      });
    } catch (e) {
      console.log('Method 4 failed:', e.message);
    }
    
    return Response.json({ error: 'All methods failed' }, { status: 500 });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});