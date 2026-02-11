import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Globe,
  Search,
  MapPin,
  Eye,
  ThumbsUp,
  Loader2,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

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
      // Fetch all gardens - RLS handles public filtering
      const allGardens = await base44.entities.Garden.list('-updated_date', 200);
      
      // Fetch users for owner info
      const users = await base44.entities.User.list();
      const userMap = {};
      users.forEach(u => {
        userMap[u.id] = u;
        userMap[u.email] = u;
      });
      
      // Attach owner data
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Browse Gardens</h1>
          <p className="text-gray-600 mt-1">Explore public gardens from the community</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search gardens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {regions.length > 0 && (
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-48">
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
              <SelectTrigger className="w-40">
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

      {/* Gardens Grid */}
      {filteredGardens.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Public Gardens Yet</h3>
            <p className="text-gray-600">Be the first to make your garden public!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGardens.map((garden) => {
            const owner = garden.owner;
            const ownerName = owner?.nickname || owner?.first_name || owner?.full_name || 'Gardener';
            const ownerLocation = owner?.location_city && owner?.location_state 
              ? `${owner.location_city}, ${owner.location_state}` 
              : owner?.location_state || 'Location not set';
            const ownerLogo = owner?.profile_logo_url || owner?.avatar_url;
            
            return (
            <Link key={garden.id} to={createPageUrl('PublicGarden') + `?id=${garden.id}`}>
              <Card className="hover:shadow-lg transition-shadow h-full">
                <div className="aspect-video bg-gradient-to-br from-emerald-100 to-green-50 relative">
                  {garden.cover_image ? (
                    <img 
                      src={garden.cover_image} 
                      alt={garden.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Globe className="w-12 h-12 text-emerald-200" />
                    </div>
                  )}
                  {/* Owner Logo Badge */}
                  {ownerLogo && (
                    <div className="absolute top-3 right-3">
                      <img 
                        src={ownerLogo} 
                        alt={ownerName}
                        className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover"
                      />
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{garden.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <span className="font-medium">by {ownerName}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {ownerLocation}
                    </div>
                  </div>
                  {garden.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{garden.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      {garden.location_region && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {garden.location_region}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        {garden.like_count || 0}
                      </div>
                    </div>
                    <span>{format(new Date(garden.created_date), 'MMM d, yyyy')}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}