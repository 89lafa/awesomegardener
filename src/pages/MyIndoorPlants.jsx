import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Grid3X3, List, Table, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function MyIndoorPlants() {
  const navigate = useNavigate();
  const [plants, setPlants] = useState([]);
  const [varieties, setVarieties] = useState({});
  const [spaces, setSpaces] = useState({});
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    space_id: 'all',
    health_status: 'all'
  });
  const [uploadingFor, setUploadingFor] = useState(null);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plantsData, varietiesData, spacesData] = await Promise.all([
        base44.entities.IndoorPlant.filter({ is_active: true }, '-created_date'),
        base44.entities.Variety.list('variety_name', 1000),
        base44.entities.IndoorSpace.filter({ is_active: true })
      ]);

      const varietiesMap = {};
      varietiesData.forEach(v => varietiesMap[v.id] = v);

      const spacesMap = {};
      spacesData.forEach(s => spacesMap[s.id] = s);

      const enrichedPlants = plantsData.map(plant => {
        const variety = varietiesMap[plant.variety_id];
        const space = spacesMap[plant.indoor_space_id];
        
        const daysSinceWatered = plant.last_watered_date 
          ? Math.floor((new Date() - new Date(plant.last_watered_date)) / (1000 * 60 * 60 * 24))
          : null;
        
        const needsWater = daysSinceWatered && plant.watering_frequency_days
          ? daysSinceWatered >= plant.watering_frequency_days
          : false;

        const ageInDays = Math.floor((new Date() - new Date(plant.acquisition_date)) / (1000 * 60 * 60 * 24));
        const years = Math.floor(ageInDays / 365);
        const months = Math.floor((ageInDays % 365) / 30);
        let ageDisplay = '';
        if (years > 0) ageDisplay += `${years}y `;
        if (months > 0 || years === 0) ageDisplay += `${months}m`;

        return {
          ...plant,
          variety_name: variety?.variety_name,
          space_name: space?.name,
          days_since_watered: daysSinceWatered,
          needs_water: needsWater,
          age_display: ageDisplay.trim()
        };
      });

      setPlants(enrichedPlants);
      setVarieties(varietiesMap);
      setSpaces(spacesMap);
    } catch (error) {
      console.error('Error loading plants:', error);
      toast.error('Failed to load plants');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlants = plants.filter(plant => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch = !filters.search || 
      plant.nickname?.toLowerCase().includes(searchLower) ||
      plant.variety_name?.toLowerCase().includes(searchLower);
    
    const matchesSpace = filters.space_id === 'all' || plant.indoor_space_id === filters.space_id;
    const matchesHealth = filters.health_status === 'all' || plant.health_status === filters.health_status;

    return matchesSearch && matchesSpace && matchesHealth;
  });

  const stats = {
    thriving: plants.filter(p => p.health_status === 'thriving').length,
    needs_care: plants.filter(p => p.needs_water || p.has_pests || p.has_disease).length,
    struggling: plants.filter(p => ['struggling', 'sick'].includes(p.health_status)).length
  };

  const getStatusBadge = (plant) => {
    if (plant.health_status === 'thriving') {
      return <Badge className="bg-emerald-500 text-white">🌿 Thriving</Badge>;
    }
    if (['struggling', 'sick'].includes(plant.health_status)) {
      return <Badge className="bg-amber-500 text-white">⚠️ {plant.health_status}</Badge>;
    }
    if (plant.has_pests || plant.has_disease) {
      return <Badge className="bg-red-500 text-white">🐛 Issues</Badge>;
    }
    return <Badge className="bg-gray-200 text-gray-700">🌱 {plant.health_status || 'healthy'}</Badge>;
  };

  const handlePhotoUpload = async (e, plantId) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFor(plantId);
    try {
      const uploadedUrls = [];
      
      for (let i = 0; i < Math.min(files.length, 3); i++) {
        const file = files[i];
        const result = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(result.file_url);
      }

      const targetPlant = plants.find(p => p.id === plantId);
      
      // Set first as primary if no primary exists
      if (!targetPlant.primary_photo_url && uploadedUrls.length > 0) {
        await base44.entities.IndoorPlant.update(plantId, {
          primary_photo_url: uploadedUrls[0]
        });
      }

      // Log all photos
      for (const url of uploadedUrls) {
        await base44.entities.IndoorPlantLog.create({
          indoor_plant_id: plantId,
          log_type: 'photo',
          log_date: new Date().toISOString(),
          photos: [url]
        });
      }

      toast.success(`${uploadedUrls.length} photo(s) uploaded!`);
      loadData();
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Failed to upload photos');
    } finally {
      setUploadingFor(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          const plantId = e.target.dataset.plantId;
          if (plantId) handlePhotoUpload(e, plantId);
        }}
        className="hidden"
      />
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
            🌿 My Indoor Plants ({filteredPlants.length})
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your indoor plant collection
          </p>
        </div>
        
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate(createPageUrl('AddIndoorPlant'))}>
          <Plus className="w-4 h-4 mr-2" />
          Add Plant
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search plants..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>

            <Select value={filters.space_id} onValueChange={(v) => setFilters({ ...filters, space_id: v })}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Spaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Spaces</SelectItem>
                {Object.values(spaces).map(space => (
                  <SelectItem key={space.id} value={space.id}>{space.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.health_status} onValueChange={(v) => setFilters({ ...filters, health_status: v })}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="thriving">🌿 Thriving</SelectItem>
                <SelectItem value="healthy">🌱 Healthy</SelectItem>
                <SelectItem value="struggling">⚠️ Struggling</SelectItem>
                <SelectItem value="sick">🚨 Sick</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-1 border rounded-lg p-1">
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('grid')}>
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')}>
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 bg-emerald-50">
            <div className="text-3xl font-bold text-emerald-700">{stats.thriving}</div>
            <div className="text-sm text-emerald-600">🌿 Thriving</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 bg-blue-50">
            <div className="text-3xl font-bold text-blue-700">{stats.needs_care}</div>
            <div className="text-sm text-blue-600">💧 Needs Care</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 bg-amber-50">
            <div className="text-3xl font-bold text-amber-700">{stats.struggling}</div>
            <div className="text-sm text-amber-600">⚠️ Struggling</div>
          </CardContent>
        </Card>
      </div>

      {filteredPlants.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <div className="text-6xl mb-4">🪴</div>
            <h3 className="text-xl font-bold mb-2">
              {filters.search ? 'No plants found' : 'No Indoor Plants Yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {filters.search ? 'Try a different search term' : 'Start building your indoor plant collection!'}
            </p>
            {!filters.search && (
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate(createPageUrl('AddIndoorPlant'))}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Plant
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredPlants.map((plant, index) => (
              <motion.div
                key={plant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-lg transition-all border-2 hover:border-emerald-400 group">
                  <div 
                    className="aspect-square bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center relative overflow-hidden cursor-pointer"
                    onClick={() => navigate(createPageUrl('IndoorPlantDetail') + `?id=${plant.id}`)}
                  >
                    {plant.primary_photo_url ? (
                      <img src={plant.primary_photo_url} className="w-full h-full object-cover" alt={plant.nickname} />
                    ) : (
                      <div className="text-6xl">🌿</div>
                    )}
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(plant)}
                    </div>
                    
                    {/* Add Photo Button Overlay */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fileInputRef.current.dataset.plantId = plant.id;
                        fileInputRef.current.click();
                      }}
                      disabled={uploadingFor === plant.id}
                      className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-lg hover:bg-white transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
                    >
                      {uploadingFor === plant.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>Add Photo</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <CardContent 
                    className="p-4 cursor-pointer"
                    onClick={() => navigate(createPageUrl('IndoorPlantDetail') + `?id=${plant.id}`)}
                  >
                    <h3 className="font-bold text-gray-800 mb-1 truncate">
                      {plant.nickname || plant.variety_name || 'Unnamed Plant'}
                    </h3>
                    {plant.nickname && plant.variety_name && (
                      <p className="text-xs text-gray-500 italic mb-2 truncate">
                        {plant.variety_name}
                      </p>
                    )}
                    {!plant.nickname && !plant.variety_name && (
                      <p className="text-xs text-gray-500 italic mb-2">No variety set</p>
                    )}
                    
                    {plant.needs_water && (
                      <Badge className="bg-blue-100 text-blue-700 mb-2">
                        💧 Water {plant.days_since_watered > plant.watering_frequency_days ? 'overdue' : 'soon'}
                      </Badge>
                    )}
                    
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex items-center gap-1">
                        <span>📍</span>
                        <span className="truncate">{plant.space_name || 'No location'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>📅</span>
                        <span>{plant.age_display}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlants.map((plant) => (
            <Card key={plant.id} className="hover:shadow-md transition-all hover:border-emerald-400 group">
              <CardContent 
                className="p-4 cursor-pointer"
                onClick={() => navigate(createPageUrl('IndoorPlantDetail') + `?id=${plant.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-green-100 rounded-lg flex items-center justify-center text-3xl flex-shrink-0 relative">
                    {plant.primary_photo_url ? (
                      <img src={plant.primary_photo_url} className="w-full h-full object-cover rounded-lg" alt={plant.nickname} />
                    ) : (
                      <span>🌿</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800">{plant.nickname || plant.variety_name || 'Unnamed Plant'}</h3>
                    <p className="text-sm text-gray-500 truncate">
                      {plant.variety_name || 'No variety'} • {plant.space_name || 'No location'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(plant)}
                      {plant.needs_water && (
                        <Badge className="bg-blue-100 text-blue-700">💧 Water due</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 text-right">
                      {plant.age_display}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fileInputRef.current.dataset.plantId = plant.id;
                        fileInputRef.current.click();
                      }}
                      disabled={uploadingFor === plant.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {uploadingFor === plant.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Photo</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}