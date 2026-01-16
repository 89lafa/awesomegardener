import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const results = {
      topics_fixed: 0,
      posts_fixed: 0,
      topics_no_author: [],
      posts_no_author: []
    };

    // Get all topics
    const topics = await base44.asServiceRole.entities.ForumTopic.list();
    for (const topic of topics) {
      if (!topic.created_by) {
        // Try to infer from other fields - check if there's a last_post_by or default to admin
        const authorEmail = topic.last_post_by || user.email;
        await base44.asServiceRole.entities.ForumTopic.update(topic.id, {
          created_by: authorEmail
        });
        results.topics_fixed++;
        results.topics_no_author.push({ id: topic.id, title: topic.title, inferred_author: authorEmail });
      }
    }

    // Get all posts
    const posts = await base44.asServiceRole.entities.ForumPost.list();
    for (const post of posts) {
      if (!post.created_by) {
        // Default to current user (admin running this)
        await base44.asServiceRole.entities.ForumPost.update(post.id, {
          created_by: user.email
        });
        results.posts_fixed++;
        results.posts_no_author.push({ id: post.id, topic_id: post.topic_id });
      }
    }

    return Response.json({ 
      success: true, 
      message: `Fixed ${results.topics_fixed} topics and ${results.posts_fixed} posts`,
      details: results
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});