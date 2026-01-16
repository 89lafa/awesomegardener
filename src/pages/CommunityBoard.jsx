import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Eye, Settings, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function CommunityBoard() {
  const [categories, setCategories] = useState([]);
  const [topics, setTopics] = useState([]);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, categoriesData, topicsData, postsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.ForumCategory.list('-sort_order'),
        base44.entities.ForumTopic.list(),
        base44.entities.ForumPost.list()
      ]);

      setUser(userData);
      setCategories(categoriesData);
      setTopics(topicsData);
      setPosts(postsData);
    } catch (error) {
      console.error('Error loading community board:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryStats = (categoryId) => {
    const categoryTopics = topics.filter(t => t.category_id === categoryId);
    const topicIds = categoryTopics.map(t => t.id);
    const categoryPosts = posts.filter(p => topicIds.includes(p.topic_id));
    
    const lastActivity = categoryTopics.length > 0
      ? categoryTopics.reduce((latest, t) => {
          const tDate = new Date(t.last_activity_at || t.created_date);
          return tDate > latest ? tDate : latest;
        }, new Date(0))
      : null;

    return {
      topicCount: categoryTopics.length,
      postCount: categoryPosts.length,
      lastActivity
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Community Board</h1>
          <p className="text-gray-600">Connect, share, and learn from fellow gardeners</p>
        </div>
        {isAdmin && (
          <Link to={createPageUrl('ForumAdmin')}>
            <Button variant="outline" className="gap-2">
              <Settings className="w-4 h-4" />
              Manage Categories
            </Button>
          </Link>
        )}
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        {categories.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No categories yet</h3>
              <p className="text-gray-600 mb-4">Categories will appear here once created</p>
              {isAdmin && (
                <Link to={createPageUrl('ForumAdmin')}>
                  <Button>Create First Category</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          categories.map((category) => {
            const stats = getCategoryStats(category.id);
            return (
              <Link key={category.id} to={createPageUrl('ForumCategory') + `?id=${category.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-3xl">{category.icon || '💬'}</div>
                          <div>
                            <h3 className="text-xl font-semibold text-gray-900">{category.name}</h3>
                            <p className="text-sm text-gray-600">{category.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 ml-4">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            <span>{stats.topicCount} topics</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            <span>{stats.postCount} posts</span>
                          </div>
                        </div>
                        {stats.lastActivity && (
                          <span className="text-xs text-gray-500">
                            Last activity: {format(stats.lastActivity, 'MMM d, yyyy')}
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
    </div>
  );
}