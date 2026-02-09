import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  ArrowLeft, ThumbsUp, Share2, MessageSquare, Loader2, Send,
  Clock, User, MapPin, Shield, Trash2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';

export default function BlogPost() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const postId = searchParams.get('id');
  
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  useEffect(() => {
    if (postId) loadPost();
  }, [postId]);

  const loadPost = async () => {
    try {
      const userData = await base44.auth.me().catch(() => null);
      setUser(userData);

      const posts = await base44.entities.BlogPost.filter({ id: postId });
      if (!posts[0]) {
        toast.error('Post not found');
        navigate(createPageUrl('BlogList'));
        return;
      }
      
      const p = posts[0];
      setPost(p);

      // Increment view count
      await base44.entities.BlogPost.update(postId, {
        view_count: (p.view_count || 0) + 1
      });

      // Load comments
      const commentsData = await base44.entities.BlogComment.filter(
        { blog_post_id: postId, status: 'active' },
        'created_date'
      );
      setComments(commentsData);

      // Check if user upvoted
      if (userData) {
        const upvotes = await base44.entities.BlogUpvote.filter({
          blog_post_id: postId,
          user_email: userData.email
        });
        setHasUpvoted(upvotes.length > 0);
      }
    } catch (error) {
      console.error('Error loading post:', error);
      toast.error('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async () => {
    if (!user) {
      toast.error('Please sign in to upvote');
      return;
    }

    try {
      if (hasUpvoted) {
        const upvotes = await base44.entities.BlogUpvote.filter({
          blog_post_id: postId,
          user_email: user.email
        });
        if (upvotes[0]) {
          await base44.entities.BlogUpvote.delete(upvotes[0].id);
          await base44.entities.BlogPost.update(postId, {
            upvote_count: Math.max((post.upvote_count || 1) - 1, 0)
          });
          setHasUpvoted(false);
        }
      } else {
        await base44.entities.BlogUpvote.create({
          blog_post_id: postId,
          user_email: user.email
        });
        await base44.entities.BlogPost.update(postId, {
          upvote_count: (post.upvote_count || 0) + 1
        });
        setHasUpvoted(true);
      }
      loadPost();
    } catch (error) {
      console.error('Error upvoting:', error);
      toast.error('Failed to upvote');
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: post.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      toast.error('Please sign in to comment');
      return;
    }

    if (!newComment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    setSubmittingComment(true);
    try {
      // Get user location from profile
      const userSettings = await base44.entities.UserSettings.filter({ created_by: user.email });
      const location = userSettings[0]?.location_region || '';

      await base44.entities.BlogComment.create({
        blog_post_id: postId,
        parent_comment_id: replyTo?.id || null,
        author_email: user.email,
        author_name: user.full_name,
        author_location: location,
        content: newComment,
        is_admin_reply: user.role === 'admin',
        is_mod_reply: user.is_moderator === true
      });

      await base44.entities.BlogPost.update(postId, {
        comment_count: (post.comment_count || 0) + 1
      });

      setNewComment('');
      setReplyTo(null);
      toast.success('Comment posted!');
      loadPost();
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (comment) => {
    if (!confirm('Delete this comment?')) return;

    try {
      await base44.entities.BlogComment.delete(comment.id);
      await base44.entities.BlogPost.update(postId, {
        comment_count: Math.max((post.comment_count || 1) - 1, 0)
      });
      toast.success('Comment deleted');
      loadPost();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!post) return null;

  const topLevelComments = comments.filter(c => !c.parent_comment_id);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(createPageUrl('BlogList'))}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Blog
      </Button>

      {post.hero_image && (
        <img 
          src={post.hero_image} 
          alt={post.title}
          className="w-full h-96 object-cover rounded-2xl"
        />
      )}

      <div>
        <div className="flex items-center gap-3 mb-3">
          <Badge className="capitalize">{post.category}</Badge>
          {post.published_date && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(new Date(post.published_date), 'MMMM d, yyyy')}
            </span>
          )}
        </div>
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-4 text-gray-600">
          {post.author_name && (
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author_name}
            </span>
          )}
          <span>{post.view_count || 0} views</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={hasUpvoted ? 'default' : 'outline'}
          onClick={handleUpvote}
          className={hasUpvoted ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          <ThumbsUp className="w-4 h-4 mr-2" />
          {post.upvote_count || 0}
        </Button>
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>

      <Card>
        <CardContent className="p-8 prose prose-emerald max-w-none">
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </CardContent>
      </Card>

      {post.allow_comments && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">
            Comments ({post.comment_count || 0})
          </h2>

          {user && (
            <Card>
              <CardContent className="p-4">
                {replyTo && (
                  <div className="mb-3 p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-600">Replying to {replyTo.author_name}</span>
                    <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>Cancel</Button>
                  </div>
                )}
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleSubmitComment}
                  disabled={submittingComment || !newComment.trim()}
                  className="mt-3 bg-emerald-600 hover:bg-emerald-700"
                >
                  {submittingComment ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Post Comment
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {topLevelComments.map(comment => (
              <CommentCard 
                key={comment.id}
                comment={comment}
                allComments={comments}
                user={user}
                onReply={setReplyTo}
                onDelete={handleDeleteComment}
              />
            ))}
          </div>

          {topLevelComments.length === 0 && (
            <Card className="py-8">
              <CardContent className="text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No comments yet. Be the first to comment!</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CommentCard({ comment, allComments, user, onReply, onDelete }) {
  const replies = allComments.filter(c => c.parent_comment_id === comment.id);
  const canDelete = user && (user.email === comment.author_email || user.role === 'admin');

  return (
    <Card className={comment.is_admin_reply ? 'border-emerald-200 bg-emerald-50/30' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{comment.author_name}</span>
            {comment.is_admin_reply && <Badge className="bg-red-600">Admin</Badge>}
            {comment.is_mod_reply && !comment.is_admin_reply && <Badge className="bg-blue-600">Mod</Badge>}
            {comment.author_location && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {comment.author_location}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(comment.created_date), { addSuffix: true })}
          </span>
        </div>
        <p className="text-gray-700 mb-3">{comment.content}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onReply(comment)}>
            Reply
          </Button>
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(comment)}>
              <Trash2 className="w-3 h-3 text-red-600" />
            </Button>
          )}
        </div>

        {replies.length > 0 && (
          <div className="ml-6 mt-4 space-y-3 border-l-2 border-gray-200 pl-4">
            {replies.map(reply => (
              <CommentCard 
                key={reply.id}
                comment={reply}
                allComments={allComments}
                user={user}
                onReply={onReply}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}