import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  Search,
  Filter,
  Plus,
  Package,
  AlertTriangle,
  Star,
  Grid3x3,
  List,
  Hash,
  ChevronRight
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SeedInventory() {
  const [seedLots, setSeedLots] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [settings, setSettings] = useState({ aging_threshold_years: 2, old_threshold_years: 3 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [filterCrop, setFilterCrop] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('az');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [lotsData, profilesData, settingsData] = await Promise.all([
        base44.entities.SeedLot.filter({ is_wishlist: false }),
        base44.entities.PlantProfile.list('variety_name', 500),
        base44.entities.UserSettings.list()
      ]);

      setSeedLots(lotsData);
      
      const profilesMap = {};
      profilesData.forEach(p => {
        profilesMap[p.id] = p;
      });
      setProfiles(profilesMap);

      if (settingsData.length > 0) {
        setSettings(settingsData[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const getAge = (lot) => {
    const currentYear = new Date().getFullYear();
    const year = lot.packed_for_year || lot.year_acquired;
    return year ? currentYear - year : 0;
  };

  const getAgeStatus = (lot) => {
    const age = getAge(lot);
    if (age >= settings.old_threshold_years) return { status: 'OLD', color: 'red', icon: Star };
    if (age >= settings.aging_threshold_years) return { status: 'AGING', color: 'amber', icon: AlertTriangle };
    return { status: 'OK', color: 'green', icon: null };
  };

  const filteredLots = seedLots
    .filter(lot => {
      const profile = profiles[lot.plant_profile_id];
      if (!profile) return false;

      const matchesSearch = searchQuery === '' || 
        profile.variety_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.common_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lot.lot_notes?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCrop = filterCrop === 'all' || profile.common_name === filterCrop;
      
      const ageStatus = getAgeStatus(lot);
      const matchesStatus = filterStatus === 'all' || ageStatus.status === filterStatus;

      return matchesSearch && matchesCrop && matchesStatus;
    })
    .sort((a, b) => {
      const profileA = profiles[a.plant_profile_id];
      const profileB = profiles[b.plant_profile_id];
      
      if (sortBy === 'az') {
        return (profileA?.variety_name || '').localeCompare(profileB?.variety_name || '');
      } else if (sortBy === 'age') {
        return getAge(b) - getAge(a);
      }
      return 0;
    });

  const cropTypes = [...new Set(Object.values(profiles).map(p => p.common_name))].filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="w-8 h-8 animate-pulse text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Seed Inventory</h1>
          <p className="text-gray-600 mt-1">{filteredLots.length} seed lots</p>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl('PlantCatalogBrowse')}>
            <Button variant="outline" className="gap-2">
              <Search className="w-4 h-4" />
              Browse Catalog
            </Button>
          </Link>
          <Link to={createPageUrl('AddSeedLot')}>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" />
              Add Seeds
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search varieties, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCrop} onValueChange={setFilterCrop}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All crops" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Crops</SelectItem>
                {cropTypes.map(crop => (
                  <SelectItem key={crop} value={crop}>{crop}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OK">✓ OK</SelectItem>
                <SelectItem value="AGING">⚠ Aging</SelectItem>
                <SelectItem value="OLD">★ Old</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="az">A-Z</SelectItem>
                <SelectItem value="age">By Age</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'numbered' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('numbered')}
                className={viewMode === 'numbered' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                <Hash className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seed Lots List */}
      {viewMode === 'list' || viewMode === 'numbered' ? (
        <div className="space-y-2">
          {filteredLots.map((lot, index) => {
            const profile = profiles[lot.plant_profile_id];
            const ageStatus = getAgeStatus(lot);
            const age = getAge(lot);
            
            return (
              <Link key={lot.id} to={createPageUrl('SeedLotDetail') + `?id=${lot.id}`}>
                <Card className={cn(
                  "hover:shadow-md transition-all cursor-pointer",
                  ageStatus.status === 'AGING' && "border-amber-300 bg-amber-50/30",
                  ageStatus.status === 'OLD' && "border-red-300 bg-red-50/30"
                )}>
                  <CardContent className="p-4 flex items-center gap-4">
                    {viewMode === 'numbered' && (
                      <div className="text-2xl font-bold text-gray-400 w-12 text-center">
                        {index + 1}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">
                          {lot.custom_label || profile?.variety_name}
                        </h3>
                        {profile?.common_name && (
                          <Badge variant="outline">{profile.common_name}</Badge>
                        )}
                        {ageStatus.status !== 'OK' && (
                          <Badge variant="outline" className={cn(
                            ageStatus.status === 'AGING' && "border-amber-500 text-amber-700",
                            ageStatus.status === 'OLD' && "border-red-500 text-red-700"
                          )}>
                            {ageStatus.icon && <ageStatus.icon className="w-3 h-3 mr-1" />}
                            {ageStatus.status} ({age}yr)
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                        {lot.source_vendor_name && <span>• {lot.source_vendor_name}</span>}
                        {lot.year_acquired && <span>• {lot.year_acquired}</span>}
                        {lot.quantity && <span>• {lot.quantity} {lot.unit}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredLots.map((lot) => {
            const profile = profiles[lot.plant_profile_id];
            const ageStatus = getAgeStatus(lot);
            
            return (
              <Link key={lot.id} to={createPageUrl('SeedLotDetail') + `?id=${lot.id}`}>
                <Card className={cn(
                  "hover:shadow-lg transition-all cursor-pointer h-full",
                  ageStatus.status === 'AGING' && "border-amber-300",
                  ageStatus.status === 'OLD' && "border-red-300"
                )}>
                  <CardContent className="p-4">
                    {ageStatus.status !== 'OK' && (
                      <Badge variant="outline" className={cn(
                        "mb-2",
                        ageStatus.status === 'AGING' && "border-amber-500 text-amber-700",
                        ageStatus.status === 'OLD' && "border-red-500 text-red-700"
                      )}>
                        {ageStatus.icon && <ageStatus.icon className="w-3 h-3 mr-1" />}
                        {ageStatus.status}
                      </Badge>
                    )}
                    <h3 className="font-semibold text-gray-900 truncate">
                      {lot.custom_label || profile?.variety_name}
                    </h3>
                    <p className="text-sm text-gray-600 truncate">{profile?.common_name}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {filteredLots.length === 0 && (
        <Card className="py-16">
          <CardContent className="text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No seeds found</h3>
            <p className="text-gray-600 mb-4">Start by adding seeds from the catalog</p>
            <Link to={createPageUrl('PlantCatalogBrowse')}>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                Browse Catalog
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}