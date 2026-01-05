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

  useEffect(() => {
    if (topicId) {
      loadData();
    }
  }, [topicId]);

  const loadData = async () => {
    try {
      const [userData, topicData, postsData, commentsData, votesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.ForumTopic.filter({ id: topicId }),
        base44.entities.ForumPost.filter({ topic_id: topicId }, 'created_date'),
        base44.entities.ForumComment.list(),
        base44.entities.ForumVote.list()
      ]);
      
      setUser(userData);
      if (topicData.length > 0) setTopic(topicData[0]);
      setPosts(postsData.filter(p => !p.deleted_at));
      setComments(commentsData.filter(c => !c.deleted_at));
      setVotes(votesData);
      
      // Increment view count
      if (topicData.length > 0) {
        await base44.entities.ForumTopic.update(topicId, {
          view_count: (topicData[0].view_count || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error loading topic:', error);
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
      
      // Update topic
      await base44.entities.ForumTopic.update(topicId, {
        post_count: (topic.post_count || 0) + 1,
        last_activity_at: new Date().toISOString(),
        last_post_by: user.email
      });
      
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

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('ForumCategory') + `?id=${topic.category_id}`}>
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
        <Card>
          <CardContent className="p-6">
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
      )}

      {/* Posts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {posts.length} {posts.length === 1 ? 'Reply' : 'Replies'}
        </h2>
        
        {posts.map((post) => {
          const userVote = getUserVote('post', post.id);
          const postComments = comments.filter(c => c.post_id === post.id && !c.parent_comment_id);
          
          return (
            <Card key={post.id}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleVote('post', post.id, 1)}
                      className={cn(userVote === 1 && "text-emerald-600")}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium">{post.like_count || 0}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
                      <span className="font-medium text-gray-900">{post.created_by}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}</span>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{post.body}</ReactMarkdown>
                    </div>
                    {post.images && post.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {post.images.map((url, idx) => (
                          <img key={idx} src={url} alt="Post attachment" className="rounded-lg" />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyingTo(post.id)}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Reply
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
  );
}