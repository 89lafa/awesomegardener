import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Clock, MessageSquare, ThumbsUp, Loader2, Search, 
  BookOpen, ArrowLeft, ArrowRight, Calendar, Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

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
      const allPosts = await base44.entities.BlogPost.filter(
        { status: 'published' },
        '-published_date', 
        100
      );
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
    post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const featuredPosts = filtered.filter(p => p.featured);
  const regularPosts = filtered.filter(p => !p.featured);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading blog posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        
        {/* Back Button */}
        <Link to={createPageUrl('Landing')}>
          <Button variant="ghost" size="sm" className="gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>

        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-medium mb-4">
            <BookOpen className="w-4 h-4" />
            Free gardening content
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            📰 Blog & Guides
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Expert tips, growing guides, and the latest gardening news
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative max-w-xl mx-auto"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search posts, tags, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 text-base shadow-lg border-0"
          />
        </motion.div>

        {/* Featured Posts */}
        {featuredPosts.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              Featured Posts
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {featuredPosts.map((post, index) => (
                <Link key={post.id} to={createPageUrl('BlogPost') + `?id=${post.id}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    <Card className="hover:shadow-2xl transition-all hover:-translate-y-1 duration-300 cursor-pointer border-0 overflow-hidden h-full group">
                      {post.hero_image && (
                        <div className="h-56 overflow-hidden relative">
                          <img 
                            src={post.hero_image} 
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          <Badge className="absolute top-4 left-4 bg-amber-500 text-white border-0">
                            Featured
                          </Badge>
                        </div>
                      )}
                      <CardContent className="p-6">
                        <Badge className="capitalize mb-3 bg-emerald-100 text-emerald-700">
                          {post.category}
                        </Badge>
                        <h2 className="text-2xl font-bold mb-3 group-hover:text-emerald-600 transition-colors">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="text-gray-600 line-clamp-2 mb-4 leading-relaxed">{post.excerpt}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {post.published_date && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              {formatDistanceToNow(new Date(post.published_date), { addSuffix: true })}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <ThumbsUp className="w-4 h-4" />
                            {post.upvote_count || 0}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Regular Posts */}
        {regularPosts.length > 0 && (
          <div className="space-y-6">
            {featuredPosts.length > 0 && (
              <h2 className="text-2xl font-bold text-gray-900">All Posts</h2>
            )}
            <div className="space-y-5">
              {regularPosts.map((post, index) => (
                <Link key={post.id} to={createPageUrl('BlogPost') + `?id=${post.id}`}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:shadow-xl transition-all hover:scale-[1.01] duration-300 cursor-pointer border-0 overflow-hidden group">
                      <CardContent className="p-6">
                        <div className="flex gap-6">
                          {post.hero_image && (
                            <div className="w-64 h-40 flex-shrink-0 rounded-xl overflow-hidden">
                              <img 
                                src={post.hero_image} 
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex items-center gap-3 mb-3">
                              <Badge className="capitalize bg-emerald-100 text-emerald-700">
                                {post.category}
                              </Badge>
                              {post.tags && post.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <h2 className="text-2xl font-bold mb-2 group-hover:text-emerald-600 transition-colors">
                              {post.title}
                            </h2>
                            {post.excerpt && (
                              <p className="text-gray-600 line-clamp-2 mb-4 leading-relaxed flex-1">
                                {post.excerpt}
                              </p>
                            )}
                            <div className="flex items-center gap-5 text-sm text-gray-500">
                              {post.author_name && (
                                <span className="font-medium text-gray-700">
                                  By {post.author_name}
                                </span>
                              )}
                              {post.published_date && (
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" />
                                  {formatDistanceToNow(new Date(post.published_date), { addSuffix: true })}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5">
                                <ThumbsUp className="w-4 h-4" />
                                {post.upvote_count || 0}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <MessageSquare className="w-4 h-4" />
                                {post.comment_count || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="py-24 shadow-2xl border-0 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="text-center">
                <BookOpen className="w-24 h-24 text-purple-300 mx-auto mb-8" />
                <h3 className="text-3xl font-bold text-gray-900 mb-4">No Posts Found</h3>
                <p className="text-gray-600 text-lg mb-8">
                  {searchQuery ? 'Try a different search term' : 'Check back later for updates!'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}