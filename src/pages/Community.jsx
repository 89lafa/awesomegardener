import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Globe, 
  Search, 
  TreeDeciduous, 
  User,
  Eye,
  Loader2,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import AdBanner from '@/components/monetization/AdBanner';

export default function Community() {
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const publicGardens = await base44.entities.Garden.filter({ 
        privacy: 'public',
        archived: false 
      }, '-updated_date', 50);
      setGardens(publicGardens);

      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const userData = await base44.auth.me();
          setUser(userData);
        }
      } catch (e) {
        // Not logged in
      }
    } catch (error) {
      console.error('Error loading community gardens:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGardens = gardens.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogin = () => {
    base44.auth.redirectToLogin(createPageUrl('Dashboard'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Community Gardens</h1>
          <p className="text-gray-600 mt-1">Explore gardens shared by other gardeners</p>
        </div>
        {!user && (
          <Button onClick={handleLogin} className="bg-emerald-600 hover:bg-emerald-700">
            Sign In to Share
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search public gardens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <AdBanner placement="top_banner" pageType="community" />

      {/* Gardens Grid */}
      {filteredGardens.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No matching gardens' : 'No public gardens yet'}
            </h3>
            <p className="text-gray-600">
              {searchQuery 
                ? 'Try adjusting your search' 
                : 'Be the first to share your garden!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGardens.map((garden, index) => (
            <motion.div
              key={garden.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={createPageUrl('PublicGarden') + `?id=${garden.id}`}>
                <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
                  {/* Cover */}
                  <div className="aspect-video bg-gradient-to-br from-emerald-100 to-green-50 relative overflow-hidden">
                    {garden.cover_image ? (
                      <img 
                        src={garden.cover_image} 
                        alt={garden.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <TreeDeciduous className="w-16 h-16 text-emerald-200" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <Badge className="absolute top-3 left-3 bg-white/90 text-gray-700">
                      <Globe className="w-3 h-3 mr-1" />
                      Public
                    </Badge>
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                      {garden.name}
                    </h3>
                    {garden.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mt-1">{garden.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <User className="w-4 h-4" />
                        <span>Gardener</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-emerald-600">
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}