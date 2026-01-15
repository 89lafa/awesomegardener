import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, MapPin, Sprout } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';

export default function CommentCard({ comment, user, canDelete, onDelete }) {
  const [commentUser, setCommentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (comment?.created_by) {
      loadCommentUser();
    } else {
      setLoadingUser(false);
    }
  }, [comment?.created_by]);

  const loadCommentUser = async () => {
    try {
      const users = await base44.entities.User.filter({ email: comment.created_by });
      if (users.length > 0) {
        setCommentUser(users[0]);
      }
    } catch (error) {
      console.error('Error loading comment user:', error);
    } finally {
      setLoadingUser(false);
    }
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isAdmin = commentUser?.role === 'admin';
  const isModerator = commentUser?.is_moderator;

  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      <Avatar className="w-8 h-8">
        <AvatarImage src={commentUser?.avatar_url} />
        <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
          {getInitials(commentUser?.full_name || comment.created_by)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900">
            {commentUser?.nickname || commentUser?.full_name || (comment.created_by && typeof comment.created_by === 'string' ? comment.created_by.split('@')[0] : 'Unknown')}
          </span>
          {isAdmin && <Badge className="bg-red-600 text-white text-xs">ADMIN</Badge>}
          {isModerator && !isAdmin && <Badge className="bg-blue-600 text-white text-xs">MOD</Badge>}
          <span className="text-xs text-gray-500">
            {comment.created_date ? formatDistanceToNow(new Date(comment.created_date), { addSuffix: true }) : ''}
          </span>
        </div>
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{comment.body || ''}</ReactMarkdown>
        </div>
        {commentUser && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
            {commentUser.usda_zone && typeof commentUser.usda_zone === 'string' && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>Zone {commentUser.usda_zone}</span>
              </div>
            )}
            {commentUser.location_city && commentUser.location_state && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{commentUser.location_city}, {commentUser.location_state}</span>
              </div>
            )}
            {commentUser.community_interests && typeof commentUser.community_interests === 'string' && (
              <div className="flex items-center gap-1">
                <Sprout className="w-3 h-3" />
                <span className="italic">{commentUser.community_interests}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(comment.id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}