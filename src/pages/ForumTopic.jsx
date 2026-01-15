import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  ArrowLeft,
  ThumbsUp,
  MessageCircle,
  Pin,
  Lock,
  Trash2,
  Edit,
  Loader2,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import PostCard from '@/components/forum/PostCardFixed';
import CommentCard from '@/components/forum/CommentCardFixed';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import ReportButton from '@/components/forum/ReportButton';
import TopicAuthorCard from '@/components/forum/TopicAuthorCard';

export default function ForumTopic() {
  const [searchParams] = useSearchParams();
  const topicId = searchParams.get('id');
  
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [newPostBody, setNewPostBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [userMap, setUserMap] = useState({});

  useEffect(() => {
    if (topicId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [topicId]);

  const loadData = async () => {
    console.log('[ForumTopic] Loading topic:', topicId);
    setLoading(true);
    try {
      const [userData, topicData, postsData, commentsData, votesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.ForumTopic.filter({ id: topicId }),
        base44.entities.ForumPost.filter({ topic_id: topicId }, 'created_date'),
        base44.entities.ForumComment.list(),
        base44.entities.ForumVote.list()
      ]);
      
      console.log('[ForumTopic] Data loaded:', { topicFound: topicData.length > 0, posts: postsData.length });
      setUser(userData);
      
      const filteredPosts = postsData.filter(p => !p.deleted_at);
      const filteredComments = commentsData.filter(c => !c.deleted_at);
      
      // Gather all unique creator emails
      const creatorEmails = new Set();
      if (topicData.length > 0 && topicData[0].created_by) creatorEmails.add(topicData[0].created_by);
      filteredPosts.forEach(p => { if (p.created_by) creatorEmails.add(p.created_by); });
      filteredComments.forEach(c => { if (c.created_by) creatorEmails.add(c.created_by); });
      
      // Fetch all users at once
      const users = await base44.entities.User.list();
      const usersMap = {};
      users.forEach(u => {
        if (creatorEmails.has(u.email)) {
          usersMap[u.email] = u;
        }
      });
      
      console.log('[ForumTopic] Loaded users:', Object.keys(usersMap).length);
      setUserMap(usersMap);
      
      if (topicData.length > 0) setTopic(topicData[0]);
      setPosts(filteredPosts);
      setComments(filteredComments);
      setVotes(votesData);
      
      // Increment view count
      if (topicData.length > 0) {
        await base44.entities.ForumTopic.update(topicId, {
          view_count: (topicData[0].view_count || 0) + 1
        });
      }
    } catch (error) {
      console.error('[ForumTopic] Error loading topic:', error);
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
        like_count: 0,
        comment_count: 0
      });
      
      setPosts([...posts, post]);
      setNewPostBody('');
      
      // Update topic counts
      const newPostCount = (topic.post_count || 0) + 1;
      await base44.entities.ForumTopic.update(topicId, {
        post_count: newPostCount,
        last_activity_at: new Date().toISOString(),
        last_post_by: user.email
      });
      
      // Update category counts
      if (topic.category_id) {
        const categories = await base44.entities.ForumCategory.filter({ id: topic.category_id });
        if (categories.length > 0) {
          await base44.entities.ForumCategory.update(topic.category_id, {
            post_count: (categories[0].post_count || 0) + 1,
            last_activity_at: new Date().toISOString()
          });
        }
      }
      
      toast.success('Post added!');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleVote = async (targetType, targetId, value) => {
    try {
      const existing = votes.find(v => 
        v.target_type === targetType && 
        v.target_id === targetId && 
        v.user_email === user.email
      );
      
      if (existing) {
        if (existing.value === value) {
          // Remove vote
          await base44.entities.ForumVote.delete(existing.id);
          setVotes(votes.filter(v => v.id !== existing.id));
        } else {
          // Change vote
          await base44.entities.ForumVote.update(existing.id, { value });
          setVotes(votes.map(v => v.id === existing.id ? { ...v, value } : v));
        }
      } else {
        // New vote
        const vote = await base44.entities.ForumVote.create({
          target_type: targetType,
          target_id: targetId,
          value,
          user_email: user.email
        });
        setVotes([...votes, vote]);
      }
      
      // Update like count
      const likeCount = votes.filter(v => 
        v.target_type === targetType && 
        v.target_id === targetId && 
        v.value === 1
      ).length;
      
      if (targetType === 'topic') {
        await base44.entities.ForumTopic.update(targetId, { like_count: likeCount });
      } else if (targetType === 'post') {
        await base44.entities.ForumPost.update(targetId, { like_count: likeCount });
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to vote');
    }
  };

  const getUserVote = (targetType, targetId) => {
    const vote = votes.find(v => 
      v.target_type === targetType && 
      v.target_id === targetId && 
      v.user_email === user?.email
    );
    return vote?.value || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!topicId) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Topic ID Provided</h2>
        <p className="text-gray-600 mb-4">Please provide a topic ID in the URL (e.g., /ForumTopic?id=...)</p>
        <Link to={createPageUrl('CommunityBoard')}>
          <Button>Back to Community Board</Button>
        </Link>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Topic Not Found</h2>
        <p className="text-gray-600 mb-4">This topic may have been deleted or the ID is incorrect.</p>
        <Link to={createPageUrl('CommunityBoard')}>
          <Button>Back to Community Board</Button>
        </Link>
      </div>
    );
  }

  const isLocked = topic.status === 'locked';

  return (
    <ErrorBoundary fallbackTitle="Forum Error" fallbackMessage="An error occurred loading this topic. Please try again.">
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('CommunityBoard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {topic.pinned && <Pin className="w-4 h-4 text-emerald-600" />}
            {isLocked && <Lock className="w-4 h-4 text-gray-400" />}
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{topic.title}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>by {topic.created_by}</span>
            <span>{formatDistanceToNow(new Date(topic.created_date), { addSuffix: true })}</span>
            <span>{topic.view_count || 0} views</span>
          </div>
        </div>
      </div>

      {/* Topic Body */}
      {topic.body && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-end mb-2">
                <ReportButton 
                  reportType="forum_topic" 
                  targetId={topic.id} 
                  targetPreview={topic.body} 
                />
              </div>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{topic.body}</ReactMarkdown>
              </div>
              {topic.tags && topic.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t">
                  {topic.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <TopicAuthorCard createdBy={topic.created_by} />
        </div>
      )}

      {/* Posts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {posts.length} {posts.length === 1 ? 'Reply' : 'Replies'}
        </h2>
        
        {posts.map((post) => {
          const postComments = comments.filter(c => c.post_id === post.id);
          const postAuthor = userMap[post.created_by];
          return (
            <div key={post.id} className="space-y-3">
              <PostCard
                post={post}
                author={postAuthor}
                user={user}
                userVote={getUserVote('post', post.id)}
                onVote={(value) => handleVote('post', post.id, value)}
                onDelete={async (postId) => {
                  await base44.entities.ForumPost.update(postId, { deleted_at: new Date().toISOString() });
                  setPosts(posts.filter(p => p.id !== postId));
                  
                  // Log the deletion
                  await base44.entities.AuditLog.create({
                    action_type: 'comment_delete',
                    entity_type: 'ForumPost',
                    entity_id: postId,
                    entity_name: `Post in ${topic.title}`,
                    user_role: user.role
                  });
                  
                  toast.success('Post deleted');
                }}
              />
              {postComments.length > 0 && (
                <div className="ml-12 space-y-2">
                  {postComments.map(comment => {
                    const commentAuthor = userMap[comment.created_by];
                    return (
                      <CommentCard
                        key={comment.id}
                        comment={comment}
                        author={commentAuthor}
                        user={user}
                        canDelete={user?.role === 'admin' || user?.is_moderator || comment.created_by === user?.email}
                        onDelete={async (commentId) => {
                          await base44.entities.ForumComment.update(commentId, { deleted_at: new Date().toISOString() });
                          setComments(comments.filter(c => c.id !== commentId));
                          toast.success('Comment deleted');
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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

      {isLocked && (
        <Card className="bg-gray-50">
          <CardContent className="p-6 text-center">
            <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">This topic has been locked</p>
          </CardContent>
        </Card>
      )}
    </div>
    </ErrorBoundary>
  );
}