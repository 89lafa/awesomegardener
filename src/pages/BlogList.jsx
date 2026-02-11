import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Clock, MessageSquare, ThumbsUp, Loader2, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      // List all posts - RLS will filter to published ones automatically
      const allPosts = await base44.entities.BlogPost.list('-published_date', 100);
      setPosts(allPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = posts.filter(post => 
    !searchQuery ||
    post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Blog & News</h1>
        <p className="text-gray-600 mt-2">Updates, tips, and announcements from the AwesomeGardener team</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search posts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-6">
        {filtered.map(post => (
          <Link key={post.id} to={createPageUrl('BlogPost') + `?id=${post.id}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  {post.hero_image && (
                    <img 
                      src={post.hero_image} 
                      alt={post.title}
                      className="w-48 h-32 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h2 className="text-2xl font-bold">{post.title}</h2>
                      <Badge className="capitalize">{post.category}</Badge>
                    </div>
                    {post.excerpt && (
                      <p className="text-gray-600 line-clamp-2 mb-3">{post.excerpt}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {post.author_name && <span>By {post.author_name}</span>}
                      {post.published_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDistanceToNow(new Date(post.published_date), { addSuffix: true })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-4 h-4" />
                        {post.upvote_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {post.comment_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="py-16">
          <CardContent className="text-center">
            <h3 className="text-lg font-semibold mb-2">No posts found</h3>
            <p className="text-gray-600">Check back later for updates!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}