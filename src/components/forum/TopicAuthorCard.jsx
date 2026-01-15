import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MapPin, Sprout } from 'lucide-react';

export default function TopicAuthorCard({ createdBy, showSignature = true }) {
  const [authorUser, setAuthorUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (createdBy) {
      loadAuthor();
    } else {
      setLoading(false);
    }
  }, [createdBy]);

  const loadAuthor = async () => {
    try {
      const users = await base44.entities.User.filter({ email: createdBy });
      if (users.length > 0) {
        setAuthorUser(users[0]);
      }
    } catch (error) {
      console.error('Error loading author:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isAdmin = authorUser?.role === 'admin';
  const isModerator = authorUser?.is_moderator;

  return (
    <div className="flex items-center gap-3">
      <Avatar className="w-8 h-8">
        <AvatarImage src={authorUser?.avatar_url} />
        <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm">
          {getInitials(authorUser?.full_name || createdBy)}
        </AvatarFallback>
      </Avatar>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900">
            {authorUser?.nickname || authorUser?.full_name || (createdBy && typeof createdBy === 'string' ? createdBy.split('@')[0] : 'Unknown')}
          </span>
          {isAdmin && <Badge className="bg-red-600 text-white text-xs">ADMIN</Badge>}
          {isModerator && !isAdmin && <Badge className="bg-blue-600 text-white text-xs">MOD</Badge>}
        </div>
        {showSignature && authorUser && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
            {authorUser.usda_zone && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>Zone {authorUser.usda_zone}</span>
              </div>
            )}
            {authorUser.location_city && authorUser.location_state && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{authorUser.location_city}, {authorUser.location_state}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}