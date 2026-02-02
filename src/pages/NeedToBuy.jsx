import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  ShoppingCart, 
  ExternalLink, 
  Leaf, 
  Heart,
  Loader2,
  Filter,
  Search,
  Package,
  Link as LinkIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function NeedToBuy() {
  const [user, setUser] = useState(null);
  const [needToBuy, setNeedToBuy] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'calendar', 'wishlist'
  const [sortBy, setSortBy] = useState('plant_type');
  const [stashMap, setStashMap] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const userData = await base44.auth.me();
      setUser(userData);

      // Load user's seed stash (what they own)
      const stash = await base44.entities.SeedLot.filter({
        created_by: userData.email,
        is_wishlist: false
      });
      
      // Build map of what user has: plant_profile_id -> count
      const stashProfileMap = {};
      stash.forEach(lot => {
        if (lot.plant_profile_id) {
          stashProfileMap[lot.plant_profile_id] = (stashProfileMap[lot.plant_profile_id] || 0) + 1;
        }
      });
      setStashMap(stashProfileMap);

      // Load wishlist items
      const wishlistItems = await base44.entities.SeedLot.filter({
        created_by: userData.email,
        is_wishlist: true
      });
      
      // Get profiles and varieties for wishlist
      const wishlistProfileIds = wishlistItems.map(w => w.plant_profile_id).filter(Boolean);
      const wishlistProfiles = wishlistProfileIds.length > 0 
        ? await base44.entities.PlantProfile.filter({ id: { $in: wishlistProfileIds } })
        : [];
      
      const wishlistWithData = wishlistItems.map(item => {
        const profile = wishlistProfiles.find(p => p.id === item.plant_profile_id);
        return {
          ...item,
          profile,
          source: 'wishlist',
          plant_type_name: profile?.common_name || 'Unknown',
          variety_name: profile?.variety_name || 'Unknown'
        };
      });
      
      setWishlist(wishlistWithData);

      // Load grow lists and calendar crops
      const growLists = await base44.entities.GrowList.filter({
        created_by: userData.email
      });
      
      const cropPlans = await base44.entities.CropPlan.filter({
        // Filter by garden owner - need to get gardens first
      });

      // Get gardens to filter crop plans
      const gardens = await base44.entities.Garden.filter({
        created_by: userData.email
      });
      
      const gardenIds = gardens.map(g => g.id);
      const allCropPlans = gardenIds.length > 0 
        ? await base44.entities.CropPlan.filter({ garden_id: { $in: gardenIds } })
        : [];

      // Extract varieties/plants from grow lists and calendar
      const needToBuySet = new Set();
      const needToBuyItems = [];

      // From grow lists
      growLists.forEach(list => {
        (list.items || []).forEach(item => {
          if (item.variety_id) {
            needToBuySet.add(item.variety_id);
          }
        });
      });

      // From calendar crops
      allCropPlans.forEach(crop => {
        if (crop.variety_id) {
          needToBuySet.add(crop.variety_id);
        }
      });

      // Load varieties and profiles for items in need to buy
      const varietyIds = Array.from(needToBuySet);
      if (varietyIds.length > 0) {
        const varieties = await base44.entities.Variety.filter({
          id: { $in: varietyIds }
        });

        // Get plant types
        const plantTypeIds = [...new Set(varieties.map(v => v.plant_type_id).filter(Boolean))];
        const plantTypes = plantTypeIds.length > 0
          ? await base44.entities.PlantType.filter({ id: { $in: plantTypeIds } })
          : [];

        varieties.forEach(variety => {
          const plantType = plantTypes.find(pt => pt.id === variety.plant_type_id);
          
          // Check if user actually has this in stash
          // For now, compare by variety - in real app, would check PlantProfile
          const hasInStash = stashProfileMap[variety.id] || false;
          
          if (!hasInStash) {
            needToBuyItems.push({
              ...variety,
              source: 'calendar',
              plant_type_name: plantType?.common_name || 'Unknown',
              plant_type_icon: plantType?.icon || '🌱'
            });
          }
        });
      }

      // Deduplicate by variety_id
      const deduped = Array.from(
        new Map(needToBuyItems.map(item => [item.id, item])).values()
      );

      setNeedToBuy(deduped);
    } catch (error) {
      console.error('Error loading need to buy data:', error);
      toast.error('Failed to load shopping list');
    } finally {
      setLoading(false);
    }
  };

  const allItems = filterType === 'all' 
    ? [...needToBuy, ...wishlist]
    : filterType === 'calendar'
    ? needToBuy
    : wishlist;

  const filtered = allItems.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.variety_name?.toLowerCase().includes(query) || '') ||
      (item.plant_type_name?.toLowerCase().includes(query) || '')
    );
  });

  const sorted = filtered.sort((a, b) => {
    switch (sortBy) {
      case 'plant_type':
        return (a.plant_type_name || '').localeCompare(b.plant_type_name || '');
      case 'variety':
        return (a.variety_name || '').localeCompare(b.variety_name || '');
      case 'source':
        return (a.source || '').localeCompare(b.source || '');
      default:
        return 0;
    }
  });

  const handleAddToWishlist = async (item) => {
    try {
      await base44.entities.SeedLot.create({
        plant_profile_id: item.id,
        is_wishlist: true
      });
      toast.success('Added to wishlist!');
      await loadData();
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast.error('Failed to add to wishlist');
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
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">
            🛒
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shopping List</h1>
            <p className="text-gray-600">Seeds you want to grow but don't own</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Need to Buy</p>
              <p className="text-2xl font-bold text-gray-900">{needToBuy.length}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-emerald-600 opacity-50" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Wishlist</p>
              <p className="text-2xl font-bold text-gray-900">{wishlist.length}</p>
            </div>
            <Heart className="w-8 h-8 text-red-600 opacity-50" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{allItems.length}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[250px]">
            <Input
              placeholder="Search varieties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300"
          >
            <option value="all">All Items</option>
            <option value="calendar">Calendar Only</option>
            <option value="wishlist">Wishlist Only</option>
          </select>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300"
          >
            <option value="plant_type">Sort by Plant Type</option>
            <option value="variety">Sort by Variety</option>
            <option value="source">Sort by Source</option>
          </select>
        </div>
      </div>

      {/* Items List */}
      {sorted.length === 0 ? (
        <Card className="p-12 text-center">
          <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">All Set!</h3>
          <p className="text-gray-600">You have all the seeds you need for your planned crops.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sorted.map((item, idx) => (
            <Card 
              key={`${item.id}-${idx}`}
              className="p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{item.plant_type_icon || '🌱'}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {item.variety_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {item.plant_type_name}
                      </p>
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge 
                      variant={item.source === 'calendar' ? 'default' : 'outline'}
                      className={item.source === 'calendar' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}
                    >
                      {item.source === 'calendar' ? '📅 In Calendar' : '❤️ Wishlist'}
                    </Badge>
                    
                    {item.days_to_maturity && (
                      <Badge variant="outline">
                        {item.days_to_maturity} days
                      </Badge>
                    )}
                    
                    {item.seed_line_type && (
                      <Badge variant="outline">
                        {item.seed_line_type}
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {/* Buy links */}
                  {item.sources && item.sources.length > 0 ? (
                    <a
                      href={item.sources[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Buy Seeds
                    </a>
                  ) : item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Buy
                    </a>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      disabled
                    >
                      <LinkIcon className="w-4 h-4 mr-1" />
                      No Link
                    </Button>
                  )}

                  {/* Add to wishlist (if from calendar) */}
                  {item.source === 'calendar' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddToWishlist(item)}
                      className="whitespace-nowrap"
                    >
                      <Heart className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}