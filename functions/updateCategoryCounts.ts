import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can trigger manual updates
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const categories = await base44.asServiceRole.entities.ForumCategory.list();
    let updated = 0;

    for (const category of categories) {
      const topics = await base44.asServiceRole.entities.ForumTopic.filter({
        category_id: category.id
      });

      let totalPosts = 0;
      let lastActivity = null;

      for (const topic of topics) {
        const posts = await base44.asServiceRole.entities.ForumPost.filter({
          topic_id: topic.id
        });
        totalPosts += posts.length;

        if (posts.length > 0) {
          const latestPost = posts.sort((a, b) => 
            new Date(b.created_date) - new Date(a.created_date)
          )[0];
          if (!lastActivity || new Date(latestPost.created_date) > new Date(lastActivity)) {
            lastActivity = latestPost.created_date;
          }
        }
      }

      await base44.asServiceRole.entities.ForumCategory.update(category.id, {
        topic_count: topics.length,
        post_count: totalPosts,
        last_activity_at: lastActivity
      });

      updated++;
    }

    return Response.json({ success: true, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});