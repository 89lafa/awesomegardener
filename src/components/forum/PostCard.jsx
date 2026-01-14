import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, MessageCircle, Trash2, MapPin, Sprout } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import ReportButton from '@/components/forum/ReportButton';
import { toast } from 'sonner';

export default function PostCard({ post, user, onVote, onDelete, userVote, showSignature = true }) {
  console.debug('[PostCard] Rendering post', { 
    id: post?.id, 
    keys: Object.keys(post || {}),
    created_by: post?.created_by,
    body: post?.body?.substring(0, 50)
  });
  
  const [deleting, setDeleting] = useState(false);
  const [postUser, setPostUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  if (!post) {
    console.error('[PostCard] No post provided');
    return null;
  }

  React.useEffect(() => {
    if (post?.created_by) {
      loadPostUser();
    } else {
      setLoadingUser(false);
    }
  }, [post?.created_by]);

  const loadPostUser = async () => {
    console.debug('[PostCard] Loading user for:', post.created_by);
    try {
      const users = await base44.entities.User.filter({ email: post.created_by });
      if (users.length > 0) {
        setPostUser(users[0]);
        console.debug('[PostCard] User loaded:', users[0].email);
      } else {
        console.debug('[PostCard] No user found for:', post.created_by);
      }
    } catch (error) {
      console.error('[PostCard] Error loading post user:', error);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    
    setDeleting(true);
    try {
      await onDelete(post.id);
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isAdmin = postUser?.role === 'admin';
  const isModerator = postUser?.is_moderator;
  const canDelete = user?.role === 'admin' || user?.is_moderator || post.created_by === user?.email;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex gap-4 p-6">
          {/* Vote Column */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onVote(1)}
              className={cn(
                "h-8 w-8",
                userVote === 1 && "text-emerald-600 bg-emerald-50"
              )}
            >
              <ThumbsUp className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-gray-700">
              {post.like_count || 0}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={postUser?.avatar_url} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
                    {getInitials(postUser?.full_name || post.created_by)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {postUser?.nickname || postUser?.full_name || (post.created_by && typeof post.created_by === 'string' ? post.created_by.split('@')[0] : 'Unknown')}
                    </span>
                    {isAdmin && <Badge className="bg-red-600 text-white text-xs">ADMIN</Badge>}
                    {isModerator && !isAdmin && <Badge className="bg-blue-600 text-white text-xs">MOD</Badge>}
                  </div>
                  <span className="text-sm text-gray-500">
                    {post.created_date ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true }) : 'Unknown date'}
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
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="prose prose-sm max-w-none mb-4">
              <ReactMarkdown>{post.body || '(No content)'}</ReactMarkdown>
            </div>

            {/* Images */}
            {post.images && post.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {post.images.map((url, idx) => (
                  <img key={idx} src={url} alt="" className="rounded-lg w-full h-auto" />
                ))}
              </div>
            )}

            {/* Signature */}
            {showSignature && postUser && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                  {postUser.usda_zone && typeof postUser.usda_zone === 'string' && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>Zone {postUser.usda_zone}</span>
                    </div>
                  )}
                  {postUser.location_city && postUser.location_state && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{postUser.location_city}, {postUser.location_state}</span>
                    </div>
                  )}
                  {postUser.community_interests && typeof postUser.community_interests === 'string' && (
                    <div className="flex items-center gap-1">
                      <Sprout className="w-3 h-3" />
                      <span className="italic">{postUser.community_interests}</span>
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
}