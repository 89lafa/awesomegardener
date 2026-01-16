import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const results = {
      topics_migrated: 0,
      posts_migrated: 0,
      topics_defaulted: 0,
      posts_defaulted: 0
    };

    // Migrate all topics
    const topics = await base44.asServiceRole.entities.ForumTopic.list();
    for (const topic of topics) {
      if (!topic.author_email) {
        // Use created_by if available, otherwise default to current admin
        const authorEmail = topic.created_by || user.email;
        await base44.asServiceRole.entities.ForumTopic.update(topic.id, {
          author_email: authorEmail
        });
        if (topic.created_by) {
          results.topics_migrated++;
        } else {
          results.topics_defaulted++;
        }
      }
    }

    // Migrate all posts
    const posts = await base44.asServiceRole.entities.ForumPost.list();
    for (const post of posts) {
      if (!post.author_email) {
        // Use created_by if available, otherwise default to current admin
        const authorEmail = post.created_by || user.email;
        await base44.asServiceRole.entities.ForumPost.update(post.id, {
          author_email: authorEmail
        });
        if (post.created_by) {
          results.posts_migrated++;
        } else {
          results.posts_defaulted++;
        }
      }
    }

    return Response.json({ 
      success: true, 
      message: `Migrated ${results.topics_migrated} topics and ${results.posts_migrated} posts from created_by. Defaulted ${results.topics_defaulted} topics and ${results.posts_defaulted} posts to admin.`,
      results
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});