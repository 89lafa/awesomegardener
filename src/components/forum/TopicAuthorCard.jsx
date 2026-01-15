import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Sprout, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function TopicAuthorCard({ createdBy }) {
  const [authorUser, setAuthorUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuthor();
  }, [createdBy]);

  const loadAuthor = async () => {
    try {
      const allUsers = await base44.entities.User.list();
      const foundUser = allUsers.find(u => u.email === createdBy);
      if (foundUser) {
        setAuthorUser(foundUser);
      }
    } catch (error) {
      console.error('Error loading author:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !authorUser) return null;

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Card className="bg-gray-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={authorUser.avatar_url || authorUser.profile_logo_url} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700">
              {getInitials(authorUser.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">
                {authorUser.nickname || authorUser.full_name || createdBy.split('@')[0]}
              </span>
              {authorUser.role === 'admin' && <Badge className="bg-red-600 text-white text-xs">ADMIN</Badge>}
              {authorUser.is_moderator && authorUser.role !== 'admin' && <Badge className="bg-blue-600 text-white text-xs">MOD</Badge>}
            </div>
            {authorUser.community_bio && (
              <p className="text-sm text-gray-600 mb-2">{authorUser.community_bio}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
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
              {authorUser.community_interests && (
                <div className="flex items-center gap-1">
                  <Sprout className="w-3 h-3" />
                  <span className="italic">{authorUser.community_interests}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}