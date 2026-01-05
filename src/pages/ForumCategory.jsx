import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  ArrowLeft,
  Plus,
  Pin,
  Lock,
  MessageSquare,
  ThumbsUp,
  Loader2,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function ForumCategory() {
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('id');
  
  const [category, setCategory] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState(null);
  const [sortBy, setSortBy] = useState('hot');
  
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    tags: ''
  });

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
        base44.entities.ForumTopic.filter({ category_id: categoryId }, '-created_date')
      ]);
      
      setUser(userData);
      if (categoryData.length > 0) setCategory(categoryData[0]);
      setTopics(topicsData);
    } catch (error) {
      console.error('Error loading category:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!formData.title.trim() || creating) return;
    
    setCreating(true);
    try {
      const topic = await base44.entities.ForumTopic.create({
        category_id: categoryId,
        title: formData.title,
        body: formData.body || '',
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        status: 'open',
        pinned: false,
        post_count: 0,
        like_count: 0,
        last_activity_at: new Date().toISOString()
      });
      
      setTopics([topic, ...topics]);
      setShowCreateTopic(false);
      setFormData({ title: '', body: '', tags: '' });
      toast.success('Topic created!');
    } catch (error) {
      console.error('Error creating topic:', error);
      toast.error('Failed to create topic');
    } finally {
      setCreating(false);
    }
  };

  const sortedTopics = [...topics].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    if (sortBy === 'hot') return (b.like_count || 0) + (b.post_count || 0) - ((a.like_count || 0) + (a.post_count || 0));
    if (sortBy === 'new') return new Date(b.created_date) - new Date(a.created_date);
    if (sortBy === 'top') return (b.like_count || 0) - (a.like_count || 0);
    return 0;
  });

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
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('CommunityBoard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">{category.icon || '💬'}</span>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{category.name}</h1>
          </div>
          {category.description && (
            <p className="text-gray-600">{category.description}</p>
          )}
        </div>
        <Button 
          onClick={() => setShowCreateTopic(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Topic
        </Button>
      </div>

      {/* Sort Options */}
      <div className="flex gap-2">
        <Button
          variant={sortBy === 'hot' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortBy('hot')}
          className={sortBy === 'hot' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Hot
        </Button>
        <Button
          variant={sortBy === 'new' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortBy('new')}
          className={sortBy === 'new' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          <Clock className="w-4 h-4 mr-2" />
          New
        </Button>
        <Button
          variant={sortBy === 'top' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortBy('top')}
          className={sortBy === 'top' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          <ThumbsUp className="w-4 h-4 mr-2" />
          Top
        </Button>
      </div>

      {/* Topics List */}
      {sortedTopics.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Topics Yet</h3>
            <p className="text-gray-600 mb-6">Be the first to start a discussion!</p>
            <Button 
              onClick={() => setShowCreateTopic(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Topic
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTopics.map((topic) => (
            <Link key={topic.id} to={createPageUrl('ForumTopic') + `?id=${topic.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-1 text-sm text-gray-500">
                      <ThumbsUp className="w-4 h-4" />
                      <span>{topic.like_count || 0}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {topic.pinned && (
                          <Pin className="w-4 h-4 text-emerald-600" />
                        )}
                        {topic.status === 'locked' && (
                          <Lock className="w-4 h-4 text-gray-400" />
                        )}
                        <h3 className="font-semibold text-gray-900 truncate">{topic.title}</h3>
                      </div>
                      {topic.tags && topic.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {topic.tags.map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{topic.post_count || 0} replies</span>
                        <span>by {topic.created_by}</span>
                        <span>{formatDistanceToNow(new Date(topic.created_date), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Topic Dialog */}
      <Dialog open={showCreateTopic} onOpenChange={setShowCreateTopic}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="What's your question or discussion topic?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="body">Details (optional)</Label>
              <Textarea
                id="body"
                placeholder="Add more context or details..."
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="mt-2"
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="e.g., tomatoes, pest control"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTopic(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateTopic}
              disabled={!formData.title.trim() || creating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}