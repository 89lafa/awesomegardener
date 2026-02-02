import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  MessageSquare, 
  AtSign, 
  AlertCircle,
  CheckCircle2,
  Trash2,
  Loader2
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Notifications() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [adminItems, setAdminItems] = useState([]);
  const [filter, setFilter] = useState('all'); // all, unread

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const promises = [
        base44.entities.Notification.filter({ user_email: userData.email }, '-created_date'),
        base44.entities.Task.filter({ 
          created_by: userData.email,
          status: 'open'
        }, 'due_date')
      ];

      // Load admin-specific items
      if (userData.role === 'admin' || userData.role === 'moderator') {
        promises.push(
          base44.entities.VarietySuggestion.filter({ status: 'pending' }),
          base44.entities.FeatureRequest.filter({ status: 'submitted' }),
          base44.entities.VarietyImageSubmission.filter({ status: 'pending' }),
          base44.entities.VarietyChangeRequest.filter({ status: 'pending' })
        );

        // Admin-only: User reports
        if (userData.role === 'admin') {
          promises.push(base44.entities.ContentReport.filter({ status: 'open' }));
        }
      }

      const results = await Promise.all(promises);
      
      setNotifications(results[0]);
      setTasks(results[1]);

      // Combine admin items
      if (userData.role === 'admin' || userData.role === 'moderator') {
        const items = [];
        
        // Variety suggestions
        results[2]?.forEach(item => items.push({
          id: item.id,
          type: 'variety_suggestion',
          title: `New Variety Suggestion: ${item.variety_name || 'Unknown'}`,
          body: `Submitted by user`,
          created_date: item.created_date,
          link_url: createPageUrl('EditorReviewQueue')
        }));

        // Feature requests
        results[3]?.forEach(item => items.push({
          id: item.id,
          type: 'feature_request',
          title: `Feature Request: ${item.title}`,
          body: item.description?.substring(0, 100),
          created_date: item.created_date,
          link_url: createPageUrl('FeatureRequests')
        }));

        // Image submissions
        results[4]?.forEach(item => items.push({
          id: item.id,
          type: 'image_submission',
          title: `Image Submission for Review`,
          body: `Variety: ${item.variety_name || 'Unknown'}`,
          created_date: item.created_date,
          link_url: createPageUrl('ImageSubmissions')
        }));

        // Change requests
        results[5]?.forEach(item => items.push({
          id: item.id,
          type: 'change_request',
          title: `Variety Change Request`,
          body: `Changes to ${item.variety_name || 'variety'}`,
          created_date: item.created_date,
          link_url: createPageUrl('ChangeRequests')
        }));

        // User reports (admin only)
        if (userData.role === 'admin' && results[6]) {
          results[6].forEach(item => items.push({
            id: item.id,
            type: 'content_report',
            title: `Content Report: ${item.report_type}`,
            body: item.reason?.substring(0, 100),
            created_date: item.created_date,
            link_url: createPageUrl('UserReports')
          }));
        }

        setAdminItems(items.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notification) => {
    try {
      await base44.entities.Notification.update(notification.id, { 
        is_read: true,
        read_at: new Date().toISOString()
      });
      setNotifications(notifications.map(n => 
        n.id === notification.id ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.is_read);
      for (const n of unread) {
        await base44.entities.Notification.update(n.id, { 
          is_read: true,
          read_at: new Date().toISOString()
        });
      }
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      toast.success('All marked as read');
    } catch (error) {
      console.error('Error marking all read:', error);
      toast.error('Failed to mark all read');
    }
  };

  const handleDelete = async (notification) => {
    try {
      await base44.entities.Notification.delete(notification.id);
      setNotifications(notifications.filter(n => n.id !== notification.id));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'message': return <MessageSquare className="w-5 h-5" />;
      case 'mention': return <AtSign className="w-5 h-5" />;
      case 'reply': return <MessageSquare className="w-5 h-5" />;
      case 'system': return <AlertCircle className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-gray-600">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={handleMarkAllRead}
            className="gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark All Read
          </Button>
        )}
      </div>

      <Tabs defaultValue="notifications">
        <TabsList className="w-full">
          <TabsTrigger value="notifications" className="flex-1">
            Notifications {unreadCount > 0 && <Badge className="ml-2 bg-emerald-600">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex-1">
            Tasks {tasks.length > 0 && <Badge className="ml-2" variant="outline">{tasks.length}</Badge>}
          </TabsTrigger>
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <TabsTrigger value="admin" className="flex-1">
              Action Required {adminItems.length > 0 && <Badge className="ml-2 bg-red-600">{adminItems.length}</Badge>}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="notifications" className="mt-4">
          <div className="flex gap-2 mb-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'bg-emerald-600' : ''}
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
              className={filter === 'unread' ? 'bg-emerald-600' : ''}
            >
              Unread
            </Button>
          </div>

          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500">No notifications</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map(notification => (
                <Card 
                  key={notification.id}
                  className={cn(
                    "transition-colors cursor-pointer hover:border-emerald-300",
                    !notification.is_read && "bg-emerald-50/50 border-emerald-200"
                  )}
                  onClick={() => {
                    if (!notification.is_read) {
                      handleMarkAsRead(notification);
                    }
                    if (notification.link_url) {
                      window.location.href = notification.link_url;
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        !notification.is_read ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500"
                      )}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{notification.title}</p>
                        {notification.body && (
                          <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {format(new Date(notification.created_date), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notification);
                        }}
                        className="flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500">All caught up!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                        {task.due_date && (
                          <p className="text-xs text-gray-500 mt-2">
                            Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">{task.type}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="admin" className="mt-4">
          {adminItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500">No pending items</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {adminItems.map(item => (
                <Card 
                  key={`${item.type}-${item.id}`}
                  className="transition-colors cursor-pointer hover:border-emerald-300 border-red-200 bg-red-50/30"
                  onClick={() => {
                    if (item.link_url) {
                      window.location.href = item.link_url;
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red-100 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{item.title}</p>
                        {item.body && (
                          <p className="text-sm text-gray-600 mt-1">{item.body}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {format(new Date(item.created_date), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}