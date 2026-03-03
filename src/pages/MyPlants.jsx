import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Sprout, Plus, Loader2, Search, MapPin, Calendar, Camera, ChevronRight, Filter, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/components/utils/usePullToRefresh';
import PullToRefreshIndicator from '@/components/common/PullToRefreshIndicator';

// Row crops that are tracked as a group (not individually)
const ROW_CROP_KEYWORDS = ['lettuce', 'radish', 'arugula', 'spinach', 'chard', 'kale', 'carrot', 'beet', 'turnip', 'onion', 'garlic', 'scallion', 'leek', 'cilantro', 'dill', 'parsley', 'basil', 'chive', 'mache', 'mizuna', 'mustard', 'cress', 'endive', 'escarole', 'radicchio', 'fennel'];

const isRowCrop = (name) => {
  if (!name) return false;
  const lower = name.toLowerCase();
  return ROW_CROP_KEYWORDS.some(k => lower.includes(k));
};

const STATUS_CONFIG = {
  planned:      { label: '📋 Planned',          color: 'bg-gray-100 text-gray-700' },
  started:      { label: '🌱 Started',           color: 'bg-lime-100 text-lime-800' },
  transplanted: { label: '🪴 Transplanted',      color: 'bg-teal-100 text-teal-800' },
  in_ground:    { label: '🌿 In Ground',         color: 'bg-green-100 text-green-800' },
  flowering:    { label: '🌸 Flowering',         color: 'bg-pink-100 text-pink-800' },
  fruiting:     { label: '🍅 Fruiting',          color: 'bg-orange-100 text-orange-800' },
  harvested:    { label: '✂️ Harvesting',        color: 'bg-purple-100 text-purple-800' },
  removed:      { label: '🗑 Removed',           color: 'bg-red-100 text-red-600' },
};

// Group PlantInstances by bed + plant_type for row crops
function groupRowCrops(instances) {
  const groups = {};
  const individuals = [];

  for (const inst of instances) {
    const name = inst.display_name || '';
    if (isRowCrop(name)) {
      const key = `${inst.bed_id}__${inst.plant_type_id || name}`;
      if (!groups[key]) {
        groups[key] = { ...inst, _isGroup: true, _groupCount: 1, _ids: [inst.id] };
      } else {
        groups[key]._groupCount++;
        groups[key]._ids.push(inst.id);
        // Keep most recent photo
        if (inst.photos?.length && !groups[key].photos?.length) {
          groups[key].photos = inst.photos;
        }
      }
    } else {
      individuals.push(inst);
    }
  }

  return [...individuals, ...Object.values(groups)];
}

export default function MyPlants() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGardenId, setActiveGardenId] = useState(null);
  const [beds, setBeds] = useState([]);
  const [instances, setInstances] = useState([]);
  const [plantTypes, setPlantTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bedFilter, setBedFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');

  const { isPulling, pullDistance, isRefreshing } = usePullToRefresh(async () => {
    await loadInstances(activeGardenId);
    toast.success('Refreshed');
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGardenId) loadInstances(activeGardenId);
  }, [activeGardenId]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const gardensData = await base44.entities.Garden.filter({ created_by: userData.email, archived: false }, '-updated_date');
      setGardens(gardensData);

      if (gardensData.length > 0) {
        setActiveGardenId(gardensData[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadInstances = async (gardenId) => {
    if (!gardenId) return;
    setLoading(true);
    try {
      const [allInstances, bedsData, typesData] = await Promise.all([
        base44.entities.PlantInstance.filter({ garden_id: gardenId }),
        base44.entities.Bed.filter({ garden_id: gardenId }),
        base44.entities.PlantType.list('common_name', 500),
      ]);

      setBeds(bedsData);

      const typesMap = {};
      typesData.forEach(t => { typesMap[t.id] = t; });
      setPlantTypes(typesMap);

      // Exclude removed
      setInstances(allInstances.filter(i => i.status !== 'removed'));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load plants');
    } finally {
      setLoading(false);
    }
  };

  // All unique seasons
  const allSeasons = [...new Set(instances.map(i => i.season_year).filter(Boolean))].sort().reverse();

  // Filter
  const filtered = instances.filter(inst => {
    if (statusFilter !== 'all' && inst.status !== statusFilter) return false;
    if (bedFilter !== 'all' && inst.bed_id !== bedFilter) return false;
    if (seasonFilter !== 'all' && inst.season_year !== seasonFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(inst.display_name || '').toLowerCase().includes(q) &&
          !(inst.custom_name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group row crops
  const grouped = groupRowCrops(filtered);

  // Sort
  const sorted = [...grouped].sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.display_name || '').localeCompare(b.display_name || '');
      case 'planted': return new Date(b.actual_plant_out_date || b.created_date) - new Date(a.actual_plant_out_date || a.created_date);
      case 'status': return (a.status || '').localeCompare(b.status || '');
      case 'updated':
      default: return new Date(b.updated_date) - new Date(a.updated_date);
    }
  });

  // Group by status for display
  const byStatus = {};
  sorted.forEach(inst => {
    const s = inst.status || 'planned';
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push(inst);
  });

  const statusOrder = ['in_ground', 'transplanted', 'flowering', 'fruiting', 'harvested', 'started', 'planned', 'removed'];

  const getBed = (bedId) => beds.find(b => b.id === bedId);
  const getOriginLabel = (inst) => {
    if (inst.growing_method === 'SEEDLING_TRANSPLANT') return '🪴 Transplanted Seedling';
    if (inst.growing_method === 'DIRECT_SOW') return '🌰 Direct Sown';
    if (inst.growing_method === 'INDOOR_TRANSPLANT') return '🏠 Started Indoors';
    if (inst.actual_transplant_date) return '🪴 Transplanted';
    if (inst.actual_sow_date) return '🌰 Direct Sown';
    return null;
  };

  if (loading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <>
      <PullToRefreshIndicator isPulling={isPulling} pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Sprout className="w-6 h-6 text-emerald-600" />
              My Garden Plants
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{sorted.length} plant{sorted.length !== 1 ? 's' : ''} in garden</p>
          </div>
          {gardens.length > 1 && (
            <Select value={activeGardenId} onValueChange={setActiveGardenId}>
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gardens.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search plants..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                <SelectItem key={v} value={v}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {beds.length > 0 && (
            <Select value={bedFilter} onValueChange={setBedFilter}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Beds</SelectItem>
                {beds.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {allSeasons.length > 1 && (
            <Select value={seasonFilter} onValueChange={setSeasonFilter}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                {allSeasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Recent</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="planted">Planted</SelectItem>
              <SelectItem value="status">Stage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Empty state */}
        {sorted.length === 0 && !loading && (
          <div className="text-center py-16">
            <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">No plants in garden yet</h2>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Plants appear here automatically when you place them in the Garden Spaces or Plot Layout.
            </p>
            <Button onClick={() => navigate(createPageUrl('GardenPlanting'))} className="bg-emerald-600 hover:bg-emerald-700">
              Go to Garden Spaces
            </Button>
          </div>
        )}

        {/* Plants by status */}
        <div className="space-y-6">
          {statusOrder.map(status => {
            const plants = byStatus[status];
            if (!plants?.length) return null;
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.planned;

            return (
              <div key={status}>
                <h3 className="font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  {cfg.label}
                  <Badge variant="outline" className="text-xs">{plants.length}</Badge>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {plants.map(inst => {
                    const bed = getBed(inst.bed_id);
                    const mainPhoto = inst.photos?.[0];
                    const originLabel = getOriginLabel(inst);
                    const plantedDate = inst.actual_plant_out_date || inst.actual_sow_date || inst.actual_transplant_date;
                    const daysGrowing = plantedDate ? differenceInDays(new Date(), new Date(plantedDate)) : null;
                    const plantType = plantTypes[inst.plant_type_id];

                    return (
                      <Card
                        key={inst.id}
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden group"
                        onClick={() => navigate(createPageUrl('GardenPlantDetail') + `?id=${inst.id}`)}
                      >
                        {/* Photo or placeholder */}
                        <div className={cn('h-36 flex items-center justify-center relative overflow-hidden', mainPhoto ? '' : 'bg-gradient-to-br from-emerald-50 to-green-100')}>
                          {mainPhoto ? (
                            <img src={mainPhoto.url} alt={inst.display_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <span className="text-5xl">{plantType?.icon || inst.plant_type_icon || '🌱'}</span>
                          )}
                          {/* Status badge */}
                          <div className="absolute top-2 left-2">
                            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                              {cfg.label}
                            </span>
                          </div>
                          {/* Row crop badge */}
                          {inst._isGroup && (
                            <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                              {inst._groupCount} plants
                            </div>
                          )}
                          {/* Photo count */}
                          {(inst.photos?.length > 0) && (
                            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <Camera className="w-3 h-3" />
                              {inst.photos.length}
                            </div>
                          )}
                        </div>

                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                {inst.custom_name || inst.display_name || 'Unknown Plant'}
                              </p>
                              {bed && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3" />{bed.name}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          </div>

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {originLabel && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-medium">
                                {originLabel}
                              </span>
                            )}
                            {inst.season_year && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                {inst.season_year}
                              </span>
                            )}
                            {daysGrowing !== null && daysGrowing >= 0 && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                                Day {daysGrowing}
                              </span>
                            )}
                          </div>

                          {/* Harvest info */}
                          {(inst.harvest_count > 0 || inst.total_yield_lbs > 0) && (
                            <div className="mt-2 pt-2 border-t flex items-center gap-2 text-xs text-purple-700">
                              <span>✂️ {inst.harvest_count || 0} harvest{(inst.harvest_count || 0) !== 1 ? 's' : ''}</span>
                              {inst.total_yield_lbs > 0 && <span>· {inst.total_yield_lbs.toFixed(1)} lbs</span>}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}