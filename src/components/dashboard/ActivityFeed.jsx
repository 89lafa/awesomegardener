import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ACTIVITY_CONFIG = {
  watered: { icon: '💧', label: 'Watered', color: 'bg-blue-100 text-blue-800' },
  harvested: { icon: '🍅', label: 'Harvested', color: 'bg-green-100 text-green-800' },
  planted: { icon: '🌱', label: 'Planted', color: 'bg-emerald-100 text-emerald-800' },
  fertilized: { icon: '🌿', label: 'Fertilized', color: 'bg-lime-100 text-lime-800' },
  problem: { icon: '⚠️', label: 'Problem', color: 'bg-yellow-100 text-yellow-800' },
  note: { icon: '📝', label: 'Update', color: 'bg-gray-100 text-gray-800' },
  milestone: { icon: '🎉', label: 'Milestone', color: 'bg-purple-100 text-purple-800' }
};

export default function ActivityFeed({ limit = 10, loadDelay = 0 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadActivities();
    }, loadDelay);
    return () => clearTimeout(timer);
  }, [loadDelay]);

  const loadActivities = async () => {
    try {
      const results = await base44.entities.ActivityLog.list('-activity_date', limit);
      setActivities(results);
    } catch (error) {
      console.warn('Activity feed failed (non-critical)');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No activities yet. Check in to track your garden!
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const config = ACTIVITY_CONFIG[activity.activity_type] || ACTIVITY_CONFIG.note;
              return (
                <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="text-2xl flex-shrink-0">{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={config.color}>{config.label}</Badge>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(activity.activity_date), { addSuffix: true })}
                      </span>
                    </div>
                    {activity.notes && (
                      <p className="text-sm text-gray-700">{activity.notes}</p>
                    )}
                    {activity.photo_url && (
                      <div className="mt-2 h-24 w-24 rounded-lg overflow-hidden">
                        <img
                          src={activity.photo_url}
                          alt="Activity"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}