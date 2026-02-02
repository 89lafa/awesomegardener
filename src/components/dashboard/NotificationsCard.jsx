import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  MessageSquare, 
  AtSign,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function NotificationsCard() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const user = await base44.auth.me();
      const data = await base44.entities.Notification.filter(
        { user_email: user.email },
        '-created_date'
      );
      setNotifications(data.slice(0, 5)); // Show latest 5
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'message': return <MessageSquare className="w-4 h-4" />;
      case 'mention': return <AtSign className="w-4 h-4" />;
      case 'reply': return <MessageSquare className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-emerald-600" />
          <CardTitle className="text-lg">Notifications</CardTitle>
          {unreadCount > 0 && (
            <Badge className="bg-emerald-600">{unreadCount}</Badge>
          )}
        </div>
        <Link to={createPageUrl('Notifications')}>
          <Button variant="ghost" size="sm" className="gap-1">
            View All
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(notification => (
              <Link
                key={notification.id}
                to={notification.link_url || createPageUrl('Notifications')}
                className={cn(
                  "block p-3 rounded-lg border transition-colors hover:border-emerald-300",
                  !notification.is_read ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-gray-200"
                )}
              >
                <div className="flex gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    !notification.is_read ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500"
                  )}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{notification.title}</p>
                    {notification.body && (
                      <p className="text-xs text-gray-600 truncate mt-0.5">{notification.body}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(notification.created_date), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}