import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, MessageSquare, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function NotificationCard({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      const notifs = await base44.entities.Notification.filter(
        { user_email: user.email },
        '-created_date',
        5
      );
      setNotifications(notifs);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'message':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'mention':
      case 'reply':
        return <MessageSquare className="w-4 h-4 text-purple-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-red-600">{unreadCount}</Badge>
            )}
          </CardTitle>
          <Link to={createPageUrl('Notifications')}>
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(notification => (
              <Link
                key={notification.id}
                to={notification.link_url || createPageUrl('Notifications')}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors",
                  !notification.is_read && "bg-blue-50"
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    !notification.is_read ? "font-semibold" : "font-medium"
                  )}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{notification.body}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {moment(notification.created_date).fromNow()}
                  </p>
                </div>
                {!notification.is_read && (
                  <Badge className="bg-blue-600 h-2 w-2 p-0 rounded-full" />
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}