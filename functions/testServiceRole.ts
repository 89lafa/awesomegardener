import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    console.log('Current user:', user.email, user.id);

    // Try different methods to fetch gardens
    console.log('\n=== Method 1: asServiceRole.entities.Garden.list() ===');
    const method1 = await base44.asServiceRole.entities.Garden.list();
    console.log(`Result: ${method1.length} gardens`);
    method1.forEach(g => console.log(`  - ${g.name}: privacy=${g.privacy}, archived=${g.archived}`));

    console.log('\n=== Method 2: asServiceRole.entities.Garden.filter({}) ===');
    const method2 = await base44.asServiceRole.entities.Garden.filter({});
    console.log(`Result: ${method2.length} gardens`);
    method2.forEach(g => console.log(`  - ${g.name}: privacy=${g.privacy}, archived=${g.archived}`));

    console.log('\n=== Method 3: asServiceRole.entities.Garden.filter({archived: false}) ===');
    const method3 = await base44.asServiceRole.entities.Garden.filter({archived: false});
    console.log(`Result: ${method3.length} gardens`);
    method3.forEach(g => console.log(`  - ${g.name}: privacy=${g.privacy}, archived=${g.archived}`));

    console.log('\n=== Method 4: Regular user context entities.Garden.list() ===');
    const method4 = await base44.entities.Garden.list();
    console.log(`Result: ${method4.length} gardens`);
    method4.forEach(g => console.log(`  - ${g.name}: privacy=${g.privacy}, archived=${g.archived}`));

    return Response.json({ 
      method1_count: method1.length,
      method2_count: method2.length,
      method3_count: method3.length,
      method4_count: method4.length,
      method1: method1.map(g => ({ name: g.name, privacy: g.privacy, is_public: g.is_public })),
      method2: method2.map(g => ({ name: g.name, privacy: g.privacy, is_public: g.is_public })),
      method3: method3.map(g => ({ name: g.name, privacy: g.privacy, is_public: g.is_public })),
      method4: method4.map(g => ({ name: g.name, privacy: g.privacy, is_public: g.is_public }))
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});