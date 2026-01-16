import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import TopicHeader from '@/components/forum/TopicHeader';
import PostItem from '@/components/forum/PostItem';

export default function ForumTopic() {
  const [searchParams] = useSearchParams();
  const topicId = searchParams.get('id');

  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [newPostBody, setNewPostBody] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (topicId) {
      loadData();
    }
  }, [topicId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userData, topicData, postsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.ForumTopic.filter({ id: topicId }),
        base44.entities.ForumPost.filter({ topic_id: topicId }, 'created_date')
      ]);

      setUser(userData);
      
      if (topicData.length > 0) {
        setTopic(topicData[0]);
        
        // Increment view count
        await base44.entities.ForumTopic.update(topicId, {
          view_count: (topicData[0].view_count || 0) + 1
        });
      }

      const filteredPosts = postsData.filter(p => !p.deleted_at);
      setPosts(filteredPosts);

      // Fetch all unique user data
      const emails = new Set();
      if (topicData.length > 0 && topicData[0].created_by) emails.add(topicData[0].created_by);
      filteredPosts.forEach(p => { if (p.created_by) emails.add(p.created_by); });

      if (emails.size > 0) {
        try {
          const response = await base44.functions.invoke('getForumUserData', {
            emails: Array.from(emails)
          });
          
          console.log('Forum user data response:', response.data);
          setUsersMap(response.data.users || {});
        } catch (err) {
          console.error('Error fetching forum user data:', err);
          // Build fallback map with current user
          const fallbackMap = {};
          emails.forEach(email => {
            if (email === userData.email) {
              fallbackMap[email] = userData;
            }
          });
          setUsersMap(fallbackMap);
        }
      }
    } catch (error) {
      console.error('Error loading topic:', error);
      toast.error('Failed to load topic');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostBody.trim() || posting) return;

    setPosting(true);
    try {
      const post = await base44.entities.ForumPost.create({
        topic_id: topicId,
        body: newPostBody,
        like_count: 0
      });

      setPosts([...posts, post]);
      setNewPostBody('');

      // Update topic
      await base44.entities.ForumTopic.update(topicId, {
        post_count: (topic.post_count || 0) + 1,
        last_activity_at: new Date().toISOString()
      });

      toast.success('Reply posted!');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to post reply');
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;

    try {
      await base44.entities.ForumPost.update(postId, { 
        deleted_at: new Date().toISOString() 
      });
      
      setPosts(posts.filter(p => p.id !== postId));
      
      await base44.entities.AuditLog.create({
        action_type: 'post_delete',
        entity_type: 'ForumPost',
        entity_id: postId,
        user_role: user.role
      });

      toast.success('Post deleted');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handleLike = async (postId) => {
    try {
      const post = posts.find(p => p.id === postId);
      await base44.entities.ForumPost.update(postId, {
        like_count: (post.like_count || 0) + 1
      });
      
      setPosts(posts.map(p => 
        p.id === postId ? { ...p, like_count: (p.like_count || 0) + 1 } : p
      ));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Topic Not Found</h2>
        <Link to={createPageUrl('CommunityBoard')}>
          <Button>Back to Community Board</Button>
        </Link>
      </div>
    );
  }

  const isLocked = topic.status === 'locked';
  const topicAuthor = usersMap[topic.created_by];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('CommunityBoard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      <TopicHeader topic={topic} author={topicAuthor} />

      {/* Posts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {posts.length} {posts.length === 1 ? 'Reply' : 'Replies'}
        </h2>

        {posts.map((post) => (
          <PostItem
            key={post.id}
            post={post}
            author={usersMap[post.created_by]}
            currentUser={user}
            onDelete={handleDeletePost}
            onLike={handleLike}
          />
        ))}
      </div>

      {/* New Post Form */}
      {!isLocked && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Add Reply</h3>
            <Textarea
              placeholder="Share your thoughts..."
              value={newPostBody}
              onChange={(e) => setNewPostBody(e.target.value)}
              rows={4}
              className="mb-3"
            />
            <Button
              onClick={handleCreatePost}
              disabled={!newPostBody.trim() || posting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Post Reply
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}