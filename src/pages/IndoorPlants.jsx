import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Grid3X3, 
  List, 
  Search,
  Thermometer,
  Droplets,
  Sun,
  Sprout,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function IndoorPlants() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    setLoading(true);
    try {
      const spacesData = await base44.entities.IndoorSpace.filter({ is_active: true }, '-created_date');
      
      // Load plant counts for each space
      for (const space of spacesData) {
        const plants = await base44.entities.IndoorPlant.filter({
          indoor_space_id: space.id,
          is_active: true
        });
        space.plant_count = plants.length;
      }
      
      setSpaces(spacesData);
    } catch (error) {
      console.error('Error loading spaces:', error);
      toast.error('Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };

  const filteredSpaces = spaces.filter(space => 
    space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    space.room_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLocationType = (type) => {
    const labels = {
      'tiered_rack': 'Multi-Tier Rack',
      'bookshelf': 'Bookshelf',
      'floating_shelf': 'Floating Shelf',
      'window_sill': 'Window Sill',
      'table': 'Table',
      'floor_standing': 'Floor',
      'hanging': 'Hanging',
      'greenhouse_mini': 'Mini Greenhouse',
      'custom': 'Custom'
    };
    return labels[type] || type;
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
            🪴 Indoor Plants
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your houseplant collection and growing spaces
          </p>
        </div>
        
        <Button onClick={() => navigate(createPageUrl('AddIndoorSpace'))} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Space
        </Button>
      </div>

      {/* Search & View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search spaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="gap-2"
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden sm:inline">Grid</span>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-2"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">List</span>
          </Button>
        </div>
      </div>

      {/* Spaces Display */}
      {filteredSpaces.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <div className="text-6xl mb-4">🪴</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {searchQuery ? 'No spaces found' : 'No Indoor Spaces Yet'}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery 
                ? 'Try a different search term'
                : 'Create your first indoor growing space to start managing your plant collection. Design racks, shelves, or window arrangements!'
              }
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate(createPageUrl('AddIndoorSpace'))} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Space
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredSpaces.map((space, index) => (
              <motion.div
                key={space.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div onClick={(e) => {
                  e.preventDefault();
                  navigate(createPageUrl('IndoorSpaceDetail') + `?id=${space.id}`);
                }}>
                  <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-emerald-400">
                    {/* Photo or Placeholder */}
                    <div className="aspect-video bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center overflow-hidden">
                      {space.photo_url ? (
                        <img src={space.photo_url} className="w-full h-full object-cover" alt={space.name} />
                      ) : (
                        <div className="text-6xl">🪴</div>
                      )}
                    </div>
                    
                    <CardContent className="p-4">
                      <h3 className="font-bold text-gray-800 mb-1">{space.name}</h3>
                      <p className="text-sm text-gray-500 mb-3">
                        {formatLocationType(space.location_type)} • {space.plant_count || 0} plants
                      </p>
                      
                      {/* Environmental Stats */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {space.avg_temperature_f && (
                          <div className="flex items-center gap-1">
                            <Thermometer size={14} className="text-orange-500" />
                            <span>{space.avg_temperature_f}°F</span>
                          </div>
                        )}
                        {space.avg_humidity_percent && (
                          <div className="flex items-center gap-1">
                            <Droplets size={14} className="text-blue-500" />
                            <span>{space.avg_humidity_percent}%</span>
                          </div>
                        )}
                        {space.light_hours_per_day && (
                          <div className="flex items-center gap-1">
                            <Sun size={14} className="text-yellow-500" />
                            <span>{space.light_hours_per_day}hr</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Grow Lights Badge */}
                      {space.has_grow_lights && (
                        <div className="mt-2">
                          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                            💡 Grow Lights
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSpaces.map((space) => (
            <div key={space.id} onClick={(e) => {
              e.preventDefault();
              navigate(createPageUrl('IndoorSpaceDetail') + `?id=${space.id}`);
            }}>
              <Card className="hover:shadow-md transition-all cursor-pointer hover:border-emerald-400">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-green-100 rounded-lg flex items-center justify-center text-3xl flex-shrink-0">
                      🪴
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800">{space.name}</h3>
                      <p className="text-sm text-gray-500">
                        {formatLocationType(space.location_type)} • {space.room_name || 'No room'}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                        <span>{space.plant_count || 0} plants</span>
                        {space.avg_temperature_f && (
                          <span className="flex items-center gap-1">
                            <Thermometer size={12} className="text-orange-500" />
                            {space.avg_temperature_f}°F
                          </span>
                        )}
                        {space.avg_humidity_percent && (
                          <span className="flex items-center gap-1">
                            <Droplets size={12} className="text-blue-500" />
                            {space.avg_humidity_percent}%
                          </span>
                        )}
                      </div>
                    </div>
                    {space.has_grow_lights && (
                      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                        💡
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}