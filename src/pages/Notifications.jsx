import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, MessageSquare, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function Notifications() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const notifs = await base44.entities.Notification.filter(
        { user_email: userData.email },
        '-created_date',
        100
      );

      setNotifications(notifs);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notification) => {
    try {
      await base44.entities.Notification.update(notification.id, {
        is_read: true,
        read_at: new Date().toISOString()
      });

      setNotifications(notifications.map(n =>
        n.id === notification.id ? { ...n, is_read: true } : n
      ));

      if (notification.link_url) {
        navigate(notification.link_url);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.is_read);
      for (const n of unread) {
        await base44.entities.Notification.update(n.id, {
          is_read: true,
          read_at: new Date().toISOString()
        });
      }
      await loadNotifications();
      toast.success('All marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await base44.entities.Notification.delete(notificationId);
      setNotifications(notifications.filter(n => n.id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete notification');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'message':
        return <Mail className="w-5 h-5 text-blue-600" />;
      case 'mention':
      case 'reply':
        return <MessageSquare className="w-5 h-5 text-purple-600" />;
      case 'system':
        return <Bell className="w-5 h-5 text-gray-600" />;
      case 'announcement':
        return <Bell className="w-5 h-5 text-emerald-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" size="sm" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Mark All Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-600">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => (
            <Card
              key={notification.id}
              className={cn(
                "cursor-pointer hover:border-emerald-300 transition-colors",
                !notification.is_read && "bg-blue-50 border-blue-200"
              )}
              onClick={() => markAsRead(notification)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className={cn(
                          "text-sm",
                          !notification.is_read ? "font-semibold text-gray-900" : "font-medium text-gray-700"
                        )}>
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {moment(notification.created_date).fromNow()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => deleteNotification(notification.id, e)}
                          className="h-6 w-6"
                        >
                          <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-600" />
                        </Button>
                      </div>
                    </div>
                    {!notification.is_read && (
                      <Badge className="mt-2 bg-blue-600">New</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}