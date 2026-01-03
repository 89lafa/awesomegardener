import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  Search,
  Plus,
  Sprout,
  ChevronRight,
  Sun,
  Droplets,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function PlantCatalogBrowse() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCrop, setFilterCrop] = useState('all');
  const [filterSun, setFilterSun] = useState('all');
  const [filterTraits, setFilterTraits] = useState('all');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const data = await base44.entities.PlantProfile.list('variety_name', 500);
      setProfiles(data);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = searchQuery === '' ||
      profile.variety_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.common_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCrop = filterCrop === 'all' || profile.common_name === filterCrop;
    const matchesSun = filterSun === 'all' || profile.sun_requirement === filterSun;
    const matchesTraits = filterTraits === 'all' || profile.traits?.includes(filterTraits);

    return matchesSearch && matchesCrop && matchesSun && matchesTraits;
  });

  const cropTypes = [...new Set(profiles.map(p => p.common_name))].filter(Boolean);
  const allTraits = [...new Set(profiles.flatMap(p => p.traits || []))].filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Sprout className="w-8 h-8 animate-pulse text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Plant Catalog</h1>
          <p className="text-gray-600 mt-1">{filteredProfiles.length} varieties</p>
        </div>
        <Link to={createPageUrl('AddPlantProfile')}>
          <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Plus className="w-4 h-4" />
            Add Variety
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search varieties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={filterCrop} onValueChange={setFilterCrop}>
              <SelectTrigger>
                <SelectValue placeholder="All crops" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Crops</SelectItem>
                {cropTypes.map(crop => (
                  <SelectItem key={crop} value={crop}>{crop}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSun} onValueChange={setFilterSun}>
              <SelectTrigger>
                <SelectValue placeholder="Sun requirement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sun</SelectItem>
                <SelectItem value="full_sun">Full Sun</SelectItem>
                <SelectItem value="partial_sun">Partial Sun</SelectItem>
                <SelectItem value="partial_shade">Partial Shade</SelectItem>
                <SelectItem value="full_shade">Full Shade</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTraits} onValueChange={setFilterTraits}>
              <SelectTrigger>
                <SelectValue placeholder="Traits" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Traits</SelectItem>
                {allTraits.map(trait => (
                  <SelectItem key={trait} value={trait}>{trait}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Profiles List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProfiles.map((profile) => (
          <Link key={profile.id} to={createPageUrl('PlantProfileDetail') + `?id=${profile.id}`}>
            <Card className="hover:shadow-lg transition-all cursor-pointer h-full">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900">{profile.variety_name}</h3>
                <p className="text-sm text-gray-600">{profile.common_name}</p>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  {profile.sun_requirement && (
                    <Badge variant="outline" className="text-xs">
                      <Sun className="w-3 h-3 mr-1" />
                      {profile.sun_requirement.replace('_', ' ')}
                    </Badge>
                  )}
                  {profile.container_friendly && (
                    <Badge variant="outline" className="text-xs">Container OK</Badge>
                  )}
                  {profile.short_season_friendly && (
                    <Badge variant="outline" className="text-xs">Short Season</Badge>
                  )}
                  {profile.traits?.slice(0, 2).map(trait => (
                    <Badge key={trait} variant="secondary" className="text-xs">{trait}</Badge>
                  ))}
                </div>

                <div className="flex items-center justify-end mt-3 text-emerald-600 text-sm">
                  <span>View details</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filteredProfiles.length === 0 && (
        <Card className="py-16">
          <CardContent className="text-center">
            <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No varieties found</h3>
            <p className="text-gray-600">Try adjusting your filters</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}