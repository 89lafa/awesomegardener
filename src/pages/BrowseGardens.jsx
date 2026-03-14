import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Globe, Search, MapPin, ThumbsUp, Loader2, Sparkles, ArrowLeft, Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function BrowseGardens() {
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    loadGardens();
  }, []);

  const loadGardens = async () => {
    setLoading(true);
    try {
      const allGardens = await base44.entities.Garden.filter(
        { is_public: true }, 
        '-updated_date', 
        200
      );
      
      let userMap = {};
      try {
        const users = await base44.entities.User.list();
        users.forEach(u => {
          userMap[u.id] = u;
          userMap[u.email] = u;
        });
      } catch (e) {
        console.log('Could not load user profiles');
      }
      
      const enriched = allGardens.map(g => ({
        ...g,
        owner: userMap[g.created_by_id] || userMap[g.created_by] || null
      }));
      
      setGardens(enriched);
    } catch (error) {
      console.error('Error loading gardens:', error);
      setGardens([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredGardens = gardens
    .filter(g => {
      const matchesSearch = !searchQuery || 
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRegion = regionFilter === 'all' || g.location_region === regionFilter;
      return matchesSearch && matchesRegion;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.updated_date) - new Date(a.updated_date);
      if (sortBy === 'liked') return (b.like_count || 0) - (a.like_count || 0);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const regions = [...new Set(gardens.map(g => g.location_region).filter(Boolean))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading community gardens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
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
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Free to browse
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            <Globe className="w-12 h-12 text-emerald-600 inline-block mr-3" />
            Community Gardens
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Get inspired by real gardens from growers around the world • See what's working • Share your own creations
          </p>
        </motion.div>

        {/* Filters Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      placeholder="Search gardens by name or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-11 h-12 text-base"
                    />
                  </div>
                </div>
                {regions.length > 0 && (
                  <Select value={regionFilter} onValueChange={setRegionFilter}>
                    <SelectTrigger className="w-48 h-12">
                      <MapPin className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {regions.map(region => (
                        <SelectItem key={region} value={region}>{region}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-44 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="liked">Most Liked</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Count */}
        {filteredGardens.length > 0 && (
          <p className="text-gray-600 text-lg">
            Showing <span className="font-bold text-emerald-600">{filteredGardens.length}</span> public garden{filteredGardens.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Gardens Grid */}
        {filteredGardens.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="py-24 shadow-2xl border-0 bg-gradient-to-br from-emerald-50 to-green-50">
              <CardContent className="text-center">
                <Globe className="w-24 h-24 text-emerald-300 mx-auto mb-8" />
                <h3 className="text-3xl font-bold text-gray-900 mb-4">No Gardens Found</h3>
                <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
                  {searchQuery || regionFilter !== 'all' 
                    ? 'Try adjusting your filters to see more gardens' 
                    : 'Be the first to share your garden with the community!'}
                </p>
                <Button 
                  onClick={() => window.location.href = createPageUrl('Landing')}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6"
                >
                  Create Free Account
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredGardens.map((garden, index) => {
              const owner = garden.owner;
              const ownerName = owner?.nickname || owner?.first_name || owner?.full_name || 'Anonymous Gardener';
              const ownerLocation = owner?.location_city && owner?.location_state 
                ? `${owner.location_city}, ${owner.location_state}` 
                : owner?.location_state || garden.location_region || 'Unknown';
              const ownerLogo = owner?.profile_logo_url || owner?.avatar_url;
              
              return (
                <Link key={garden.id} to={createPageUrl('PublicGarden') + `?id=${garden.id}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:shadow-2xl transition-all hover:-translate-y-1 duration-300 h-full border-0 overflow-hidden group">
                      {/* Garden Image */}
                      <div className="aspect-[4/3] bg-gradient-to-br from-emerald-100 via-green-100 to-lime-100 relative overflow-hidden">
                        {garden.cover_image ? (
                          <img 
                            src={garden.cover_image} 
                            alt={garden.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Globe className="w-20 h-20 text-emerald-300 opacity-50" />
                          </div>
                        )}
                        
                        {/* Overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        {/* Owner Avatar Badge */}
                        {ownerLogo && (
                          <div className="absolute top-4 right-4">
                            <img 
                              src={ownerLogo} 
                              alt={ownerName}
                              className="w-14 h-14 rounded-full border-3 border-white shadow-xl object-cover"
                            />
                          </div>
                        )}
                        
                        {/* Like badge */}
                        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5">
                          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                          <span className="text-sm font-bold text-gray-900">{garden.like_count || 0}</span>
                        </div>
                      </div>

                      {/* Garden Info */}
                      <CardContent className="p-5">
                        <h3 className="font-bold text-xl mb-2 text-gray-900 group-hover:text-emerald-600 transition-colors">
                          {garden.name}
                        </h3>
                        
                        {/* Owner Info */}
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <span className="font-medium">by {ownerName}</span>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {ownerLocation}
                          </div>
                        </div>

                        {/* Description */}
                        {garden.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">
                            {garden.description}
                          </p>
                        )}

                        {/* Tags */}
                        {garden.tags && garden.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {garden.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-500">
                            {format(new Date(garden.created_date), 'MMM d, yyyy')}
                          </span>
                          <span className="text-emerald-600 font-medium text-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            View Garden
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}