import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Sprout, Plus, Loader2, Search, MapPin, Calendar, Camera, ChevronRight,
  Filter, Leaf, Edit2, LayoutGrid, List, ChevronUp, ChevronDown, ChevronsUpDown,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/components/utils/usePullToRefresh';
import PullToRefreshIndicator from '@/components/common/PullToRefreshIndicator';
import BackButton from '@/components/common/BackButton';

// ─────────────────────────────────────────────────────────────────
// Large fruiting plants — each instance keeps its OWN card
// ─────────────────────────────────────────────────────────────────
const LARGE_PLANT_KEYWORDS = [
  'tomato', 'pepper', 'cucumber', 'squash', 'zucchini', 'courgette',
  'melon', 'watermelon', 'cantaloupe', 'pumpkin', 'eggplant', 'aubergine',
  'corn', 'maize', 'artichoke', 'okra', 'tomatillo', 'pea', 'bean',
  'sunflower', 'gourd', 'broccoli', 'cauliflower', 'cabbage', 'kohlrabi',
];

const isLargePlant = (plantTypeName = '', displayName = '') => {
  const combined = `${plantTypeName} ${displayName}`.toLowerCase();
  return LARGE_PLANT_KEYWORDS.some(k => combined.includes(k));
};

// ─────────────────────────────────────────────────────────────────
// Grouping: small/row crops → one card per (bed + plant_type_id)
//           large plants    → individual cards
// ─────────────────────────────────────────────────────────────────
function groupInstances(instances, plantTypes) {
  const grouped = {};   // key → merged record
  const individuals = [];

  for (const inst of instances) {
    const ptName = inst.plant_type_name
      || plantTypes[inst.plant_type_id]?.common_name
      || '';
    const displayName = inst.display_name || inst.custom_name || '';

    if (isLargePlant(ptName, displayName)) {
      individuals.push({ ...inst, _isGroup: false, _groupCount: 1 });
    } else {
      // Group key = bed location + plant_type
      const key = `${inst.bed_id || 'no-bed'}__${inst.plant_type_id || ptName}`;

      if (!grouped[key]) {
        grouped[key] = {
          ...inst,
          _isGroup: true,
          _groupCount: 1,
          _ids: [inst.id],
          _allStatuses: [inst.status],
        };
      } else {
        grouped[key]._groupCount++;
        grouped[key]._ids.push(inst.id);
        grouped[key]._allStatuses.push(inst.status);

        // Prefer most recent updated_date on representative card
        if (new Date(inst.updated_date) > new Date(grouped[key].updated_date)) {
          grouped[key].updated_date = inst.updated_date;
        }
        // Keep first found photo
        if (inst.photos?.length && !grouped[key].photos?.length) {
          grouped[key].photos = inst.photos;
        }
        // Accumulate harvest numbers
        grouped[key].harvest_count = (grouped[key].harvest_count || 0) + (inst.harvest_count || 0);
        grouped[key].total_yield_lbs = (grouped[key].total_yield_lbs || 0) + (inst.total_yield_lbs || 0);
      }
    }
  }

  return [...individuals, ...Object.values(grouped)];
}

// ─────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  planned:      { label: '📋 Planned',          color: 'bg-gray-100 text-gray-700' },
  started:      { label: '🌱 Started',           color: 'bg-lime-100 text-lime-800' },
  transplanted: { label: '🪴 Transplanted',      color: 'bg-teal-100 text-teal-800' },
  in_ground:    { label: '🌿 In Ground',         color: 'bg-green-100 text-green-800' },
  harvested:    { label: '✂️ Harvesting',        color: 'bg-purple-100 text-purple-800' },
  removed:      { label: '🗑 Removed',           color: 'bg-red-100 text-red-600' },
  seed_started: { label: '🌰 Seed Started',     color: 'bg-gray-100 text-gray-800' },
  planted:      { label: '🌱 Planted',           color: 'bg-lime-100 text-lime-800' },
  sprouted:     { label: '🌿 Sprouted',          color: 'bg-green-100 text-green-800' },
  seedling:     { label: '🌿 Seedling',          color: 'bg-emerald-100 text-emerald-800' },
  vegetative:   { label: '🌿 Vegetative',        color: 'bg-cyan-100 text-cyan-800' },
  flowering:    { label: '🌸 Flowering',         color: 'bg-pink-100 text-pink-800' },
  fruiting:     { label: '🍅 Fruiting',          color: 'bg-orange-100 text-orange-800' },
  harvesting:   { label: '✂️ Harvesting',        color: 'bg-purple-100 text-purple-800' },
  done:         { label: '✓ Season Done',        color: 'bg-gray-200 text-gray-600' },
};

const STATUS_ORDER = [
  'in_ground','transplanted','vegetative','flowering','fruiting','harvesting',
  'harvested','seedling','sprouted','planted','started','seed_started',
  'planned','done','removed',
];

// ─────────────────────────────────────────────────────────────────
// Sortable column header helper
// ─────────────────────────────────────────────────────────────────
function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <button
      className={cn(
        'flex items-center gap-1 text-xs font-semibold uppercase tracking-wide select-none whitespace-nowrap hover:text-emerald-700 transition-colors',
        active ? 'text-emerald-700' : 'text-gray-500'
      )}
      onClick={() => onSort(field)}
    >
      {label}
      {active ? (
        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronsUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export default function MyPlants() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGardenId, setActiveGardenId] = useState(null);
  const [beds, setBeds] = useState([]);
  const [plantingSpaces, setPlantingSpaces] = useState([]);
  const [instances, setInstances] = useState([]);
  const [plantTypes, setPlantTypes] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bedFilter, setBedFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');

  // View
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Grid sort
  const [gridSortBy, setGridSortBy] = useState('updated');

  // List sort
  const [listSortField, setListSortField] = useState('name');
  const [listSortDir, setListSortDir] = useState('asc');

  const { isPulling, pullDistance, isRefreshing } = usePullToRefresh(async () => {
    await loadInstances(activeGardenId);
    toast.success('Refreshed');
  });

  const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }));

  const handleQuickStatusChange = async (inst, newStatus, e) => {
    e.stopPropagation();
    try {
      // If it's a group, update all in the group
      const ids = inst._ids || [inst.id];
      await Promise.all(ids.map(id => base44.entities.PlantInstance.update(id, { status: newStatus })));
      setInstances(prev => prev.map(i =>
        ids.includes(i.id) ? { ...i, status: newStatus } : i
      ));
      toast.success(`Updated to ${STATUS_OPTIONS.find(s => s.value === newStatus)?.label || newStatus}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeGardenId) loadInstances(activeGardenId); }, [activeGardenId]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      const gardensData = await base44.entities.Garden.filter({ created_by: userData.email, archived: false }, '-updated_date');
      setGardens(gardensData);

      if (gardensData.length > 0) {
        const allGardenIds = gardensData.map(g => g.id);
        const allInstancesArrays = await Promise.all(
          allGardenIds.map(gid => base44.entities.PlantInstance.filter({ garden_id: gid }, '-updated_date', 500))
        );
        let bestGardenIdx = 0, maxCount = 0;
        allInstancesArrays.forEach((arr, idx) => {
          if (arr.length > maxCount) { maxCount = arr.length; bestGardenIdx = idx; }
        });
        const selectedGardenId = gardensData[bestGardenIdx].id;
        const selectedInstances = allInstancesArrays[bestGardenIdx];

        const [bedsData, spacesData, typesData] = await Promise.all([
          base44.entities.Bed.filter({ garden_id: selectedGardenId }),
          base44.entities.PlantingSpace.filter({ garden_id: selectedGardenId, is_active: true }),
          base44.entities.PlantType.list('common_name', 500),
        ]);
        const typesMap = {};
        typesData.forEach(t => { typesMap[t.id] = t; });
        setPlantTypes(typesMap);
        setBeds(bedsData);
        setPlantingSpaces(spacesData);
        setInstances(selectedInstances.filter(i => i.status !== 'removed'));
        setActiveGardenId(selectedGardenId);
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
      const [allInstances, bedsData, spacesData, typesData] = await Promise.all([
        base44.entities.PlantInstance.filter({ garden_id: gardenId }, '-updated_date', 500),
        base44.entities.Bed.filter({ garden_id: gardenId }),
        base44.entities.PlantingSpace.filter({ garden_id: gardenId, is_active: true }),
        base44.entities.PlantType.list('common_name', 500),
      ]);
      setBeds(bedsData);
      setPlantingSpaces(spacesData);
      const typesMap = {};
      typesData.forEach(t => { typesMap[t.id] = t; });
      setPlantTypes(typesMap);
      setInstances(allInstances.filter(i => i.status !== 'removed'));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load plants');
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──
  const getLocationName = (inst) => {
    if (inst.location_name) return inst.location_name;
    const space = plantingSpaces.find(s => s.plot_item_id === inst.bed_id || s.id === inst.bed_id);
    if (space) return space.name;
    const bed = beds.find(b => b.id === inst.bed_id);
    if (bed) return bed.name;
    return null;
  };

  const getOriginLabel = (inst) => {
    if (inst.growing_method === 'SEEDLING_TRANSPLANT') return '🪴 Transplanted Seedling';
    if (inst.growing_method === 'DIRECT_SOW') return '🌰 Direct Sown';
    if (inst.growing_method === 'INDOOR_TRANSPLANT') return '🏠 Started Indoors';
    if (inst.actual_transplant_date) return '🪴 Transplanted';
    if (inst.actual_sow_date) return '🌰 Direct Sown';
    return null;
  };

  const getPlantedDate = (inst) =>
    inst.actual_plant_out_date || inst.actual_sow_date || inst.actual_transplant_date || null;

  const getDaysGrowing = (inst) => {
    const d = getPlantedDate(inst);
    if (!d) return null;
    const days = differenceInDays(new Date(), new Date(d));
    return days >= 0 ? days : null;
  };

  // ── All unique seasons ──
  const allSeasons = [...new Set(instances.map(i => i.season_year).filter(Boolean))].sort().reverse();

  // ── Filter raw instances first ──
  const filteredRaw = instances.filter(inst => {
    if (statusFilter !== 'all' && inst.status !== statusFilter) return false;
    if (bedFilter !== 'all' && inst.bed_id !== bedFilter) return false;
    if (seasonFilter !== 'all' && inst.season_year !== seasonFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(inst.display_name || '').toLowerCase().includes(q) &&
          !(inst.custom_name || '').toLowerCase().includes(q) &&
          !(inst.plant_type_name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Group after filter ──
  const grouped = groupInstances(filteredRaw, plantTypes);

  // ── Grid sort ──
  const gridSorted = [...grouped].sort((a, b) => {
    switch (gridSortBy) {
      case 'name':    return (a.display_name || '').localeCompare(b.display_name || '');
      case 'planted': return new Date(getPlantedDate(b) || 0) - new Date(getPlantedDate(a) || 0);
      case 'status':  return (a.status || '').localeCompare(b.status || '');
      default:        return new Date(b.updated_date) - new Date(a.updated_date);
    }
  });

  // Group grid results by status
  const byStatus = {};
  gridSorted.forEach(inst => {
    const s = inst.status || 'planned';
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push(inst);
  });

  // ── List sort ──
  const handleListSort = (field) => {
    if (listSortField === field) {
      setListSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setListSortField(field);
      setListSortDir('asc');
    }
  };

  const listSorted = [...grouped].sort((a, b) => {
    let valA, valB;
    switch (listSortField) {
      case 'name':
        valA = (a.display_name || a.custom_name || '').toLowerCase();
        valB = (b.display_name || b.custom_name || '').toLowerCase();
        break;
      case 'location':
        valA = (getLocationName(a) || '').toLowerCase();
        valB = (getLocationName(b) || '').toLowerCase();
        break;
      case 'status':
        valA = STATUS_ORDER.indexOf(a.status) ?? 99;
        valB = STATUS_ORDER.indexOf(b.status) ?? 99;
        break;
      case 'planted':
        valA = new Date(getPlantedDate(a) || 0).getTime();
        valB = new Date(getPlantedDate(b) || 0).getTime();
        break;
      case 'days':
        valA = getDaysGrowing(a) ?? -1;
        valB = getDaysGrowing(b) ?? -1;
        break;
      case 'season':
        valA = (a.season_year || '').toLowerCase();
        valB = (b.season_year || '').toLowerCase();
        break;
      case 'count':
        valA = a._groupCount || 1;
        valB = b._groupCount || 1;
        break;
      case 'harvests':
        valA = a.harvest_count || 0;
        valB = b.harvest_count || 0;
        break;
      default:
        valA = new Date(a.updated_date).getTime();
        valB = new Date(b.updated_date).getTime();
    }
    if (typeof valA === 'string') {
      return listSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return listSortDir === 'asc' ? valA - valB : valB - valA;
  });

  // ── Loading state ──
  if (loading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // ── Shared plant card ──
  const renderCard = (inst) => {
    const cfg = STATUS_CONFIG[inst.status] || STATUS_CONFIG.planned;
    const mainPhoto = inst.photos?.[0];
    const originLabel = getOriginLabel(inst);
    const daysGrowing = getDaysGrowing(inst);
    const plantType = plantTypes[inst.plant_type_id];
    const location = getLocationName(inst);

    return (
      <Card
        key={inst._isGroup ? inst._ids?.join('-') : inst.id}
        className="cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden group"
        onClick={() => {
          if (inst._isGroup && inst._ids?.length > 1) {
            // For grouped plants, navigate to the first/representative instance
            navigate(createPageUrl('GardenPlantDetail') + `?id=${inst.id}`);
          } else {
            navigate(createPageUrl('GardenPlantDetail') + `?id=${inst.id}`);
          }
        }}
      >
        {/* Photo or placeholder */}
        <div className={cn('h-36 flex items-center justify-center relative overflow-hidden',
          mainPhoto ? '' : 'bg-gradient-to-br from-emerald-50 to-green-100')}>
          {mainPhoto ? (
            <img src={mainPhoto.url} alt={inst.display_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <span className="text-5xl">{plantType?.icon || inst.plant_type_icon || '🌱'}</span>
          )}
          {/* Status badge */}
          <div className="absolute top-2 left-2">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
              {cfg.label}
            </span>
          </div>
          {/* Group count badge */}
          {inst._groupCount > 1 && (
            <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {inst._groupCount} plants
            </div>
          )}
          {/* Photo count */}
          {(inst.photos?.length > 0) && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Camera className="w-3 h-3" />{inst.photos.length}
            </div>
          )}
        </div>

        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {inst.custom_name || inst.display_name || 'Unknown Plant'}
              </p>
              {location && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />{location}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 px-1.5 text-xs gap-1"
                    onClick={e => e.stopPropagation()} title="Change Status">
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-50">
                  {STATUS_OPTIONS.map(opt => (
                    <DropdownMenuItem key={opt.value}
                      onClick={e => handleQuickStatusChange(inst, opt.value, e)}
                      className={inst.status === opt.value ? 'font-bold bg-emerald-50' : ''}>
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />
            </div>
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
            {daysGrowing !== null && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                Day {daysGrowing}
              </span>
            )}
          </div>

          {(inst.harvest_count > 0 || inst.total_yield_lbs > 0) && (
            <div className="mt-2 pt-2 border-t flex items-center gap-2 text-xs text-purple-700">
              <span>✂️ {inst.harvest_count || 0} harvest{(inst.harvest_count || 0) !== 1 ? 's' : ''}</span>
              {inst.total_yield_lbs > 0 && <span>· {inst.total_yield_lbs.toFixed(1)} lbs</span>}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── LIST ROW ──
  const renderListRow = (inst, idx) => {
    const cfg = STATUS_CONFIG[inst.status] || STATUS_CONFIG.planned;
    const location = getLocationName(inst);
    const plantedDate = getPlantedDate(inst);
    const daysGrowing = getDaysGrowing(inst);
    const plantType = plantTypes[inst.plant_type_id];
    const originLabel = getOriginLabel(inst);

    return (
      <tr
        key={inst._isGroup ? (inst._ids?.join('-') || inst.id) : inst.id}
        className={cn(
          'border-b border-gray-100 hover:bg-emerald-50/60 cursor-pointer transition-colors',
          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
        )}
        onClick={() => navigate(createPageUrl('GardenPlantDetail') + `?id=${inst.id}`)}
      >
        {/* Emoji / photo thumbnail */}
        <td className="px-3 py-2 w-10 text-center">
          {inst.photos?.[0]
            ? <img src={inst.photos[0].url} alt="" className="w-8 h-8 rounded object-cover mx-auto" />
            : <span className="text-xl">{plantType?.icon || inst.plant_type_icon || '🌱'}</span>
          }
        </td>

        {/* Name */}
        <td className="px-3 py-2 min-w-[160px]">
          <p className="text-sm font-semibold text-gray-800 leading-tight">
            {inst.custom_name || inst.display_name || 'Unknown Plant'}
          </p>
          {originLabel && (
            <span className="text-[10px] text-amber-700 font-medium">{originLabel}</span>
          )}
        </td>

        {/* Location */}
        <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
          {location ? (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-gray-400" />{location}
            </span>
          ) : <span className="text-gray-300">—</span>}
        </td>

        {/* Status */}
        <td className="px-3 py-2 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
              {cfg.label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 px-1 text-xs"
                  onClick={e => e.stopPropagation()}>
                  <Edit2 className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-50">
                {STATUS_OPTIONS.map(opt => (
                  <DropdownMenuItem key={opt.value}
                    onClick={e => handleQuickStatusChange(inst, opt.value, e)}
                    className={inst.status === opt.value ? 'font-bold bg-emerald-50' : ''}>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>

        {/* Season */}
        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
          {inst.season_year
            ? <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{inst.season_year}</span>
            : <span className="text-gray-300">—</span>}
        </td>

        {/* Planted date */}
        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
          {plantedDate
            ? format(new Date(plantedDate), 'MMM d, yyyy')
            : <span className="text-gray-300">—</span>}
        </td>

        {/* Days growing */}
        <td className="px-3 py-2 text-xs text-center whitespace-nowrap">
          {daysGrowing !== null
            ? <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Day {daysGrowing}</span>
            : <span className="text-gray-300">—</span>}
        </td>

        {/* Plant count */}
        <td className="px-3 py-2 text-xs text-center font-semibold whitespace-nowrap">
          {inst._groupCount > 1
            ? <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{inst._groupCount}</span>
            : <span className="text-gray-400">1</span>}
        </td>

        {/* Harvests */}
        <td className="px-3 py-2 text-xs text-center whitespace-nowrap">
          {inst.harvest_count > 0 ? (
            <span className="text-purple-700 font-medium">
              ✂️ {inst.harvest_count}
              {inst.total_yield_lbs > 0 && ` · ${inst.total_yield_lbs.toFixed(1)} lbs`}
            </span>
          ) : <span className="text-gray-300">—</span>}
        </td>

        {/* Photos */}
        <td className="px-3 py-2 text-xs text-center text-gray-500 whitespace-nowrap">
          {inst.photos?.length > 0 ? (
            <span className="flex items-center justify-center gap-1">
              <Camera className="w-3 h-3" />{inst.photos.length}
            </span>
          ) : <span className="text-gray-300">—</span>}
        </td>

        {/* Arrow */}
        <td className="px-2 py-2 text-right">
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </td>
      </tr>
    );
  };

  return (
    <>
      <PullToRefreshIndicator isPulling={isPulling} pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-4">
          <BackButton />
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Sprout className="w-6 h-6 text-emerald-600" />
              My Garden Plants
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {grouped.length} entr{grouped.length !== 1 ? 'ies' : 'y'}
              {' '}({filteredRaw.length} total plant{filteredRaw.length !== 1 ? 's' : ''})
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div />
          <div className="flex items-center gap-2">
            {/* Garden selector */}
            {gardens.length > 1 && (
              <Select value={activeGardenId} onValueChange={setActiveGardenId}>
                <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {gardens.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {/* View mode toggle */}
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={cn('px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors',
                  viewMode === 'grid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50')}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </button>
              <button
                className={cn('px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors border-l',
                  viewMode === 'list'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50')}
                onClick={() => setViewMode('list')}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search plants..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                <SelectItem key={v} value={v}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {beds.length > 0 && (
            <Select value={bedFilter} onValueChange={setBedFilter}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="All Beds" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Beds</SelectItem>
                {beds.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {allSeasons.length > 1 && (
            <Select value={seasonFilter} onValueChange={setSeasonFilter}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="All Seasons" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                {allSeasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Grid sort only shown in grid mode */}
          {viewMode === 'grid' && (
            <Select value={gridSortBy} onValueChange={setGridSortBy}>
              <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Recent</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="planted">Planted</SelectItem>
                <SelectItem value="status">Stage</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── Empty state ── */}
        {grouped.length === 0 && !loading && (
          <div className="text-center py-16">
            <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">No plants found</h2>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Plants appear here automatically when you place them in the Garden Spaces or Plot Layout.
            </p>
            <Button onClick={() => navigate(createPageUrl('GardenPlanting'))} className="bg-emerald-600 hover:bg-emerald-700">
              Go to Garden Spaces
            </Button>
          </div>
        )}

        {/* ════════════════════════════════════════
            GRID VIEW
        ════════════════════════════════════════ */}
        {viewMode === 'grid' && grouped.length > 0 && (
          <div className="space-y-6">
            {STATUS_ORDER.map(status => {
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
                    {plants.map(inst => renderCard(inst))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════════════════════════════════════════
            LIST VIEW — Excel-style sortable table
        ════════════════════════════════════════ */}
        {viewMode === 'list' && grouped.length > 0 && (
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    {/* icon col */}
                    <th className="px-3 py-3 w-10" />
                    <th className="px-3 py-3 text-left">
                      <SortHeader label="Plant" field="name" sortField={listSortField} sortDir={listSortDir} onSort={handleListSort} />
                    </th>
                    <th className="px-3 py-3 text-left">
                      <SortHeader label="Location" field="location" sortField={listSortField} sortDir={listSortDir} onSort={handleListSort} />
                    </th>
                    <th className="px-3 py-3 text-left">
                      <SortHeader label="Status" field="status" sortField={listSortField} sortDir={listSortDir} onSort={handleListSort} />
                    </th>
                    <th className="px-3 py-3 text-left">
                      <SortHeader label="Season" field="season" sortField={listSortField} sortDir={listSortDir} onSort={handleListSort} />
                    </th>
                    <th className="px-3 py-3 text-left">
                      <SortHeader label="Planted" field="planted" sortField={listSortField} sortDir={listSortDir} onSort={handleListSort} />
                    </th>
                    <th className="px-3 py-3 text-center">
                      <SortHeader label="Days" field="days" sortField={listSortField} sortDir={listSortDir} onSort={handleListSort} />
                    </th>
                    <th className="px-3 py-3 text-center">
                      <SortHeader label="# Plants" field="count" sortField={listSortField} sortDir={listSortDir} onSort={handleListSort} />
                    </th>
                    <th className="px-3 py-3 text-center">
                      <SortHeader label="Harvests" field="harvests" sortField={listSortField} sortDir={listSortDir} onSort={handleListSort} />
                    </th>
                    <th className="px-3 py-3 text-center">
                      <SortHeader label="📷" field="photos" sortField={listSortField} sortDir={listSortDir} onSort={handleListSort} />
                    </th>
                    <th className="px-2 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {listSorted.map((inst, idx) => renderListRow(inst, idx))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 bg-gray-50 border-t text-xs text-gray-500">
              Showing {listSorted.length} entr{listSorted.length !== 1 ? 'ies' : 'y'} · {filteredRaw.length} total plants
            </div>
          </div>
        )}
      </div>
    </>
  );
}