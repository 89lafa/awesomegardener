import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, ThumbsUp, MessageSquare, Trash2, Share2, Flag, MapPin, Sprout, Lock, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import ReportButton from '@/components/forum/ReportButton';

export default function ForumTopic() {
  const [searchParams] = useSearchParams();
  const topicId = searchParams.get('id');

  const [topic, setTopic] = useState(null);
  const [category, setCategory] = useState(null);
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState({});
  const [userVotes, setUserVotes] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (topicId) {
      loadData();
    }
  }, [topicId]);

  const loadData = async () => {
    try {
      const [userData, topicData, postsData, votesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.ForumTopic.filter({ id: topicId }),
        base44.entities.ForumPost.filter({ topic_id: topicId }, 'created_date'),
        base44.entities.ForumVote.filter({ item_id: topicId })
      ]);

      if (!topicData[0]) {
        setLoading(false);
        return;
      }

      setUser(userData);
      setTopic(topicData[0]);
      setPosts(postsData);

      // Load category
      if (topicData[0].category_id) {
        const categoryData = await base44.entities.ForumCategory.filter({ id: topicData[0].category_id });
        setCategory(categoryData[0]);
      }

      // Load users
      const allEmails = [topicData[0].created_by, ...postsData.map(p => p.created_by)];
      const uniqueEmails = [...new Set(allEmails)];
      const usersData = await Promise.all(
        uniqueEmails.map(email => base44.entities.User.filter({ email }))
      );
      const usersMap = {};
      usersData.forEach(arr => {
        if (arr[0]) usersMap[arr[0].email] = arr[0];
      });
      setUsers(usersMap);

      // User votes
      const votesMap = {};
      votesData.filter(v => v.created_by === userData.email).forEach(v => {
        votesMap[v.item_id] = v.vote_value;
      });
      setUserVotes(votesMap);

      // Increment view count
      await base44.entities.ForumTopic.update(topicId, {
        view_count: (topicData[0].view_count || 0) + 1
      });
    } catch (error) {
      console.error('Error loading topic:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (itemId, itemType, currentValue) => {
    const newValue = userVotes[itemId] === 1 ? 0 : 1;
    
    try {
      const existing = await base44.entities.ForumVote.filter({
        item_id: itemId,
        created_by: user.email
      });

      if (existing.length > 0) {
        if (newValue === 0) {
          await base44.entities.ForumVote.delete(existing[0].id);
        } else {
          await base44.entities.ForumVote.update(existing[0].id, { vote_value: newValue });
        }
      } else if (newValue === 1) {
        await base44.entities.ForumVote.create({
          item_id: itemId,
          item_type: itemType,
          vote_value: newValue
        });
      }

      // Update like count
      const newCount = Math.max(0, (currentValue || 0) + (newValue - (userVotes[itemId] || 0)));
      if (itemType === 'topic') {
        await base44.entities.ForumTopic.update(itemId, { like_count: newCount });
      } else if (itemType === 'post') {
        await base44.entities.ForumPost.update(itemId, { like_count: newCount });
      }

      setUserVotes({ ...userVotes, [itemId]: newValue });
      loadData();
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handlePostReply = async () => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.ForumPost.create({
        topic_id: topicId,
        body: replyText
      });

      // Update counts
      await base44.entities.ForumTopic.update(topicId, {
        post_count: (topic.post_count || 0) + 1,
        last_activity_at: new Date().toISOString(),
        last_post_by: user.email
      });

      if (category) {
        await base44.entities.ForumCategory.update(category.id, {
          post_count: (category.post_count || 0) + 1,
          last_activity_at: new Date().toISOString()
        });
      }

      toast.success('Reply posted!');
      setReplyText('');
      loadData();
    } catch (error) {
      console.error('Error posting reply:', error);
      toast.error('Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (post) => {
    if (!confirm('Delete this post?')) return;

    try {
      await base44.entities.ForumPost.delete(post.id);
      toast.success('Post deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: topic.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
  };

  const isAdmin = user?.role === 'admin' || user?.is_moderator;

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

  const topicAuthor = users[topic.created_by];
  const canReply = topic.status !== 'locked';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link to={createPageUrl('CommunityBoard')} className="hover:text-emerald-600">Community Board</Link>
        <span>/</span>
        {category && (
          <>
            <Link to={createPageUrl('ForumCategory') + `?id=${category.id}`} className="hover:text-emerald-600">
              {category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-gray-900">{topic.title}</span>
      </div>

      {/* Topic Post */}
      <Card>
        <CardContent className="p-0">
          <div className="flex gap-4 p-6 border-b">
            {/* Vote Column */}
            <div className="flex flex-col items-center gap-1 pt-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleVote(topic.id, 'topic', topic.like_count)}
                className={userVotes[topic.id] === 1 ? 'text-emerald-600 bg-emerald-50' : ''}
              >
                <ThumbsUp className="w-5 h-5" />
              </Button>
              <span className="text-lg font-bold text-gray-700">{topic.like_count || 0}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {topic.pinned && <Pin className="w-4 h-4 text-emerald-600" />}
                    <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
                  </div>
                  {topic.status === 'locked' && (
                    <Badge variant="outline" className="mb-3">
                      <Lock className="w-3 h-3 mr-1" />
                      Locked
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={handleShare}>
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <ReportButton
                    reportType="forum_topic"
                    targetId={topic.id}
                    targetPreview={topic.title}
                  />
                </div>
              </div>

              {/* Author Info */}
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={topicAuthor?.avatar_url} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 font-medium">
                    {topicAuthor?.full_name ? topicAuthor.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {topicAuthor?.nickname || topicAuthor?.full_name || (topic.created_by ? topic.created_by.split('@')[0] : 'Unknown')}
                    </span>
                    {topicAuthor?.role === 'admin' && <Badge className="bg-red-600 text-white text-xs">ADMIN</Badge>}
                    {topicAuthor?.is_moderator && <Badge className="bg-blue-600 text-white text-xs">MOD</Badge>}
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(topic.created_date), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="prose prose-sm max-w-none mb-4">
                <ReactMarkdown>{topic.body}</ReactMarkdown>
              </div>

              {/* Signature */}
              {topicAuthor && (
                <div className="mt-4 pt-4 border-t bg-gray-50/50 p-3 rounded-lg">
                  {topicAuthor.community_bio && (
                    <p className="text-xs text-gray-700 mb-2 italic">"{topicAuthor.community_bio}"</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
                    {topicAuthor.location_city && topicAuthor.location_state && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{topicAuthor.location_city}, {topicAuthor.location_state}</span>
                      </div>
                    )}
                    {topicAuthor.usda_zone && (
                      <div className="flex items-center gap-1">
                        <Sprout className="w-3 h-3" />
                        <span>Zone {topicAuthor.usda_zone}</span>
                      </div>
                    )}
                    {topicAuthor.community_interests && (
                      <div className="flex items-center gap-1">
                        <span className="italic">Growing: {topicAuthor.community_interests}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {posts.length} {posts.length === 1 ? 'Reply' : 'Replies'}
        </h2>

        {posts.map((post) => {
          const postAuthor = users[post.created_by];
          const canDelete = isAdmin || post.created_by === user?.email;
          
          return (
            <Card key={post.id}>
              <CardContent className="p-0">
                <div className="flex gap-4 p-6">
                  {/* Vote Column */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleVote(post.id, 'post', post.like_count)}
                      className={userVotes[post.id] === 1 ? 'text-emerald-600 bg-emerald-50' : ''}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium text-gray-700">{post.like_count || 0}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={postAuthor?.avatar_url} />
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 font-medium">
                            {postAuthor?.full_name ? postAuthor.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {postAuthor?.nickname || postAuthor?.full_name || (post.created_by ? post.created_by.split('@')[0] : 'Unknown')}
                            </span>
                            {postAuthor?.role === 'admin' && <Badge className="bg-red-600 text-white text-xs">ADMIN</Badge>}
                            {postAuthor?.is_moderator && <Badge className="bg-blue-600 text-white text-xs">MOD</Badge>}
                          </div>
                          <span className="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <ReportButton
                          reportType="forum_post"
                          targetId={post.id}
                          targetPreview={post.body}
                        />
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePost(post)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="prose prose-sm max-w-none mb-4">
                      <ReactMarkdown>{post.body}</ReactMarkdown>
                    </div>

                    {post.images && post.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {post.images.map((url, idx) => (
                          <img key={idx} src={url} alt="" className="rounded-lg w-full h-auto" />
                        ))}
                      </div>
                    )}

                    {/* Signature */}
                    {postAuthor && (
                      <div className="mt-4 pt-4 border-t bg-gray-50/50 p-3 rounded-lg">
                        {postAuthor.community_bio && (
                          <p className="text-xs text-gray-700 mb-2 italic">"{postAuthor.community_bio}"</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
                          {postAuthor.location_city && postAuthor.location_state && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{postAuthor.location_city}, {postAuthor.location_state}</span>
                            </div>
                          )}
                          {postAuthor.usda_zone && (
                            <div className="flex items-center gap-1">
                              <Sprout className="w-3 h-3" />
                              <span>Zone {postAuthor.usda_zone}</span>
                            </div>
                          )}
                          {postAuthor.community_interests && (
                            <div className="flex items-center gap-1">
                              <span className="italic">Growing: {postAuthor.community_interests}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reply Form */}
      {canReply ? (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Post a Reply</h3>
            <Textarea
              placeholder="Share your thoughts..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              className="mb-4"
            />
            <div className="flex justify-end">
              <Button
                onClick={handlePostReply}
                disabled={submitting || !replyText.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Post Reply
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Lock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600">This topic is locked. No new replies can be posted.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}