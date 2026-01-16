import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MessageSquare, Plus, Pin, Lock, ArrowLeft, Loader2, ThumbsUp, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function ForumCategory() {
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('id');

  const [category, setCategory] = useState(null);
  const [topics, setTopics] = useState([]);
  const [users, setUsers] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [formData, setFormData] = useState({ title: '', body: '' });

  useEffect(() => {
    if (categoryId) {
      loadData();
    }
  }, [categoryId]);

  const loadData = async () => {
    try {
      const [userData, categoryData, topicsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.ForumCategory.filter({ id: categoryId }),
        base44.entities.ForumTopic.filter({ category_id: categoryId }, '-pinned,-last_activity_at')
      ]);

      setUser(userData);
      setCategory(categoryData[0]);
      setTopics(topicsData);

      // Load users for topics
      const userEmails = [...new Set(topicsData.map(t => t.created_by))];
      const usersData = await Promise.all(
        userEmails.map(email => base44.entities.User.filter({ email }))
      );
      const usersMap = {};
      usersData.forEach(arr => {
        if (arr[0]) usersMap[arr[0].email] = arr[0];
      });
      setUsers(usersMap);
    } catch (error) {
      console.error('Error loading category:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await base44.entities.ForumTopic.create({
        category_id: categoryId,
        title: formData.title,
        body: formData.body,
        status: 'open'
      });

      // Update category counts
      await base44.entities.ForumCategory.update(categoryId, {
        topic_count: (category.topic_count || 0) + 1,
        last_activity_at: new Date().toISOString()
      });

      toast.success('Topic created!');
      setShowNewTopic(false);
      setFormData({ title: '', body: '' });
      loadData();
    } catch (error) {
      console.error('Error creating topic:', error);
      toast.error('Failed to create topic');
    }
  };

  const isAdmin = user?.role === 'admin' || user?.is_moderator;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Category Not Found</h2>
        <Link to={createPageUrl('CommunityBoard')}>
          <Button>Back to Community Board</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to={createPageUrl('CommunityBoard')}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Community Board
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
              <span className="text-2xl">{category.icon || '💬'}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
              {category.description && (
                <p className="text-gray-600 mt-1">{category.description}</p>
              )}
            </div>
          </div>
          <Button onClick={() => setShowNewTopic(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            New Topic
          </Button>
        </div>
      </div>

      {/* Topics */}
      {topics.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Topics Yet</h3>
            <p className="text-gray-600 mb-6">Be the first to start a discussion!</p>
            <Button onClick={() => setShowNewTopic(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Topic
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => {
            const author = users[topic.created_by];
            return (
              <Link key={topic.id} to={createPageUrl('ForumTopic') + `?id=${topic.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Stats */}
                      <div className="flex flex-col items-center gap-1 text-center min-w-[60px]">
                        <div className="flex items-center gap-1 text-emerald-600">
                          <ThumbsUp className="w-4 h-4" />
                          <span className="text-sm font-semibold">{topic.like_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-sm">{topic.post_count || 0}</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          {topic.pinned && <Pin className="w-4 h-4 text-emerald-600 mt-1" />}
                          <h3 className="text-lg font-semibold text-gray-900">{topic.title}</h3>
                          {topic.status === 'locked' && (
                            <Badge variant="outline" className="ml-2">
                              <Lock className="w-3 h-3 mr-1" />
                              Locked
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{author?.nickname || author?.full_name || topic.created_by.split('@')[0]}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatDistanceToNow(new Date(topic.created_date), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* New Topic Dialog */}
      <Dialog open={showNewTopic} onOpenChange={setShowNewTopic}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Topic Title *</Label>
              <Input
                id="title"
                placeholder="What's your question or discussion?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="body">Description *</Label>
              <Textarea
                id="body"
                placeholder="Provide details about your topic..."
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="mt-2"
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTopic(false)}>Cancel</Button>
            <Button onClick={handleCreateTopic} className="bg-emerald-600 hover:bg-emerald-700">
              Create Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}