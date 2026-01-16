import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import UserSignature from './UserSignature';
import ReportButton from './ReportButton';
import ShareButton from './ShareButton';

export default function PostItem({ post, author, currentUser, onDelete, onLike }) {
  const authorEmail = post.author_email || post.created_by;
  const displayName = author?.nickname || author?.full_name || authorEmail?.split('@')[0] || 'Unknown User';
  const isAdmin = author?.role === 'admin';
  const isModerator = author?.is_moderator;
  const canDelete = currentUser?.role === 'admin' || currentUser?.is_moderator || authorEmail === currentUser?.email;

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex gap-4 p-6">
          {/* Vote Column */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onLike(post.id)}
              className="h-8 w-8 hover:text-emerald-600"
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
                  <AvatarImage src={author?.profile_logo_url || author?.avatar_url} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {displayName}
                    </span>
                    {isAdmin && <Badge className="bg-red-600 text-white text-xs">ADMIN</Badge>}
                    {isModerator && !isAdmin && <Badge className="bg-blue-600 text-white text-xs">MOD</Badge>}
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ShareButton type="post" id={post.id} />
                <ReportButton
                  reportType="forum_post"
                  targetId={post.id}
                  targetPreview={post.body}
                />
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(post.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="prose prose-sm max-w-none mb-4">
              <ReactMarkdown>{post.body || ''}</ReactMarkdown>
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
            {author && <UserSignature user={author} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}