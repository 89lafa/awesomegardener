import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Pin, Lock, Loader2, Settings, Users, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function CommunityBoard() {
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, categoriesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.ForumCategory.list('sort_order')
      ]);

      setUser(userData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading community board:', error);
    } finally {
      setLoading(false);
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Community Board</h1>
          <p className="text-gray-600 mt-1">Connect, share, and learn from fellow gardeners</p>
        </div>
        {isAdmin && (
          <Link to={createPageUrl('ManageForumCategories')}>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Settings className="w-4 h-4" />
              Manage Categories
            </Button>
          </Link>
        )}
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Categories Yet</h3>
            <p className="text-gray-600 mb-6">
              {isAdmin ? 'Create your first category to get started' : 'Check back soon!'}
            </p>
            {isAdmin && (
              <Link to={createPageUrl('ManageForumCategories')}>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Category
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <Link key={category.id} to={createPageUrl('ForumCategory') + `?id=${category.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">{category.icon || '💬'}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>{category.topic_count || 0} topics</span>
                        </div>
                        {category.last_activity_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatDistanceToNow(new Date(category.last_activity_at), { addSuffix: true })}</span>
                          </div>
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