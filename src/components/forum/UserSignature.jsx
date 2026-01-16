import React from 'react';
import { MapPin, Sprout } from 'lucide-react';

export default function UserSignature({ user }) {
  console.log('UserSignature - user:', user);
  
  if (!user) {
    console.log('UserSignature - no user data');
    return null;
  }

  const hasSignature = user.usda_zone || user.location_city || user.community_bio || user.community_interests;
  
  console.log('UserSignature - hasSignature:', hasSignature);
  
  if (!hasSignature) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
        {user.usda_zone && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>Zone {user.usda_zone}</span>
          </div>
        )}
        {user.location_city && user.location_state && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>{user.location_city}, {user.location_state}</span>
          </div>
        )}
        {user.community_bio && (
          <div className="italic text-gray-600">"{user.community_bio}"</div>
        )}
        {user.community_interests && (
          <div className="flex items-center gap-1">
            <Sprout className="w-3 h-3" />
            <span className="italic">{user.community_interests}</span>
          </div>
        )}
      </div>
    </div>
  );
}