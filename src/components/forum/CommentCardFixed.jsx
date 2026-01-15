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

  useEffect(() => {
    if (comment?.created_by) {
      loadCommentUser();
    }
  }, [comment?.created_by]);

  const loadCommentUser = async () => {
    try {
      const allUsers = await base44.entities.User.list();
      const foundUser = allUsers.find(u => u.email === comment.created_by);
      if (foundUser) {
        setCommentUser(foundUser);
        console.debug('[CommentCard] Loaded user:', foundUser.email, 'nickname:', foundUser.nickname);
      } else {
        console.warn('[CommentCard] User not found:', comment.created_by);
      }
    } catch (error) {
      console.error('[CommentCard] Error loading user:', error);
    }
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayName = commentUser?.nickname || commentUser?.full_name || comment.created_by?.split('@')[0] || 'Unknown';
  const isAdmin = commentUser?.role === 'admin';
  const isModerator = commentUser?.is_moderator;

  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      <Avatar className="w-8 h-8">
        <AvatarImage src={commentUser?.avatar_url || commentUser?.profile_logo_url} />
        <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900">
            {displayName}
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
            {commentUser.usda_zone && (
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
            {commentUser.community_bio && (
              <div className="italic text-gray-600">"{commentUser.community_bio}"</div>
            )}
            {commentUser.community_interests && (
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