import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, MessageCircle, Pin, Lock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function ForumCategory() {
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('id');

  const [category, setCategory] = useState(null);
  const [topics, setTopics] = useState([]);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: '', body: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (categoryId) {
      loadData();
    }
  }, [categoryId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userData, categoryData, topicsData, postsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.ForumCategory.filter({ id: categoryId }),
        base44.entities.ForumTopic.filter({ category_id: categoryId }, '-updated_date'),
        base44.entities.ForumPost.list()
      ]);

      setUser(userData);
      if (categoryData.length > 0) setCategory(categoryData[0]);
      setTopics(topicsData);
      setPosts(postsData);
    } catch (error) {
      console.error('Error loading category:', error);
      toast.error('Failed to load category');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!newTopic.title.trim()) {
      toast.error('Please enter a topic title');
      return;
    }

    setCreating(true);
    try {
      const topic = await base44.entities.ForumTopic.create({
        category_id: categoryId,
        title: newTopic.title,
        body: newTopic.body,
        status: 'open',
        pinned: false,
        view_count: 0,
        post_count: 0,
        like_count: 0
      });

      setTopics([topic, ...topics]);
      setNewTopic({ title: '', body: '' });
      setShowNewTopic(false);
      toast.success('Topic created!');
    } catch (error) {
      console.error('Error creating topic:', error);
      toast.error('Failed to create topic');
    } finally {
      setCreating(false);
    }
  };

  const getTopicStats = (topicId) => {
    const topicPosts = posts.filter(p => p.topic_id === topicId && !p.deleted_at);
    return {
      postCount: topicPosts.length,
      lastPost: topicPosts.length > 0
        ? topicPosts.reduce((latest, p) => {
            const pDate = new Date(p.created_date);
            return pDate > latest ? pDate : latest;
          }, new Date(0))
        : null
    };
  };

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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('CommunityBoard')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{category.icon || '💬'}</span>
              <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
            </div>
            <p className="text-gray-600 mt-1">{category.description}</p>
          </div>
        </div>
        <Button onClick={() => setShowNewTopic(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" />
          New Topic
        </Button>
      </div>

      {/* Topics List */}
      <div className="space-y-3">
        {topics.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No topics yet</h3>
              <p className="text-gray-600 mb-4">Be the first to start a conversation!</p>
              <Button onClick={() => setShowNewTopic(true)}>Create First Topic</Button>
            </CardContent>
          </Card>
        ) : (
          topics.map((topic) => {
            const stats = getTopicStats(topic.id);
            return (
              <Link key={topic.id} to={createPageUrl('ForumTopic') + `?id=${topic.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {topic.pinned && <Pin className="w-4 h-4 text-emerald-600" />}
                          {topic.status === 'locked' && <Lock className="w-4 h-4 text-gray-400" />}
                          <h3 className="font-semibold text-gray-900 hover:text-emerald-600">
                            {topic.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>by {topic.created_by}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(topic.created_date), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-4">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <MessageCircle className="w-4 h-4" />
                          <span>{stats.postCount} replies</span>
                        </div>
                        {stats.lastPost && (
                          <span className="text-xs text-gray-500">
                            Last: {formatDistanceToNow(stats.lastPost, { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>

      {/* New Topic Dialog */}
      <Dialog open={showNewTopic} onOpenChange={setShowNewTopic}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title</label>
              <Input
                placeholder="What's your topic about?"
                value={newTopic.title}
                onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description (optional)</label>
              <Textarea
                placeholder="Add more details..."
                value={newTopic.body}
                onChange={(e) => setNewTopic({ ...newTopic, body: e.target.value })}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTopic(false)}>Cancel</Button>
            <Button onClick={handleCreateTopic} disabled={creating || !newTopic.title.trim()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}