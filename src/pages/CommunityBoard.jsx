import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  MessageSquare,
  Plus,
  Pin,
  Lock,
  TrendingUp,
  Clock,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

export default function CommunityBoard() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, categoriesData, topicsData, postsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.ForumCategory.list('sort_order'),
        base44.entities.ForumTopic.list(),
        base44.entities.ForumPost.list()
      ]);
      setUser(userData);
      
      // Compute accurate counts for each category
      const categoriesWithCounts = categoriesData.map(cat => {
        const topicCount = topicsData.filter(t => t.category_id === cat.id).length;
        const topicIds = topicsData.filter(t => t.category_id === cat.id).map(t => t.id);
        const postCount = postsData.filter(p => topicIds.includes(p.topic_id) && !p.deleted_at).length;
        
        return {
          ...cat,
          topic_count: topicCount,
          post_count: postCount
        };
      });
      
      setCategories(categoriesWithCounts);
    } catch (error) {
      console.error('Error loading forum data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Community Board</h1>
          <p className="text-gray-600 mt-1">Connect, share, and learn from fellow gardeners</p>
        </div>
        {user?.role === 'admin' && (
          <Link to={createPageUrl('ForumAdmin')}>
            <Button variant="outline">Manage Categories</Button>
          </Link>
        )}
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Categories Yet</h3>
            <p className="text-gray-600 mb-6">The community board is being set up</p>
            {user?.role === 'admin' && (
              <Link to={createPageUrl('ForumAdmin')}>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Category
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <Link key={category.id} to={createPageUrl('ForumCategory') + `?id=${category.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl flex-shrink-0">
                      {category.icon || '💬'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{category.topic_count || 0} topics</span>
                        <span>{category.post_count || 0} posts</span>
                        {category.last_activity_at && (
                          <span>Last active {formatDistanceToNow(new Date(category.last_activity_at), { addSuffix: true })}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}