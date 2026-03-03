import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import {
  Sprout, Plus, Loader2, Search, Filter, MapPin, Calendar,
  Camera, Scissors, AlertTriangle, BarChart3, Globe, Lock,
  Leaf, Clock, Apple, TrendingUp, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  seed_started:  { label: '🌰 Seed Started',     color: 'bg-gray-100 text-gray-800' },
  planted:       { label: '🌱 Planted',           color: 'bg-lime-100 text-lime-800' },
  sprouted:      { label: '🌿 Sprouted',          color: 'bg-green-100 text-green-800' },
  seedling:      { label: '🌿 Seedling',          color: 'bg-emerald-100 text-emerald-800' },
  transplanted:  { label: '🪴 Transplanted',      color: 'bg-teal-100 text-teal-800' },
  vegetative:    { label: '🌿 Vegetative',        color: 'bg-cyan-100 text-cyan-800' },
  flowering:     { label: '🌸 Flowering',         color: 'bg-pink-100 text-pink-800' },
  fruiting:      { label: '🍅 Fruiting',          color: 'bg-orange-100 text-orange-800' },
  harvesting:    { label: '✂️ Harvesting',        color: 'bg-purple-100 text-purple-800' },
  done:          { label: '✓ Done',               color: 'bg-gray-200 text-gray-600' },
  removed:       { label: '🗑 Removed',           color: 'bg-red-100 text-red-600' },
};

const TRACKING_MODE_LABELS = {
  individual: 'Individual Plant',
  row_group: 'Row / Group',
};

// Row crops that should default to row_group tracking
const ROW_CROP_NAMES = [
  'lettuce', 'radish', 'arugula', 'spinach', 'carrot', 'beet', 'turnip',
  'kale', 'chard', 'mustard', 'bok choy', 'mizuna', 'cilantro', 'dill',
  'fennel', 'green onion', 'onion', 'leek', 'pea', 'bean', 'corn',
];

function isRowCrop(plantTypeName = '') {
  const lower = plantTypeName.toLowerCase();
  return ROW_CROP_NAMES.some(name => lower.includes(name));
}

function PlantCard({ plant, onClick }) {
  const statusCfg = STATUS_CONFIG[plant.status] || STATUS_CONFIG.planted;
  const latestPhoto = plant.photos?.[plant.photos.length - 1];
  const daysSince = plant.planted_date ? differenceInDays(new Date(), new Date(plant.planted_date)) : null;

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 overflow-hidden"
      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
      onClick={onClick}
    >
      {latestPhoto && (
        <div className="h-40 overflow-hidden">
          <img src={latestPhoto.url} alt={plant.name || plant.plant_type_name} className="w-full h-full object-cover" />
        </div>
      )}
      {!latestPhoto && (
        <div className="h-24 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100">
          <span className="text-4xl">{plant.plant_type_icon || '🌱'}</span>
        </div>
      )}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {plant.name || plant.variety_name || plant.plant_type_name || 'Plant'}
            </p>
            {plant.variety_name && plant.name && (
              <p className="text-xs truncate text-gray-500">{plant.variety_name}</p>
            )}
          </div>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap', statusCfg.color)}>
            {statusCfg.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {plant.location_name && (
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{plant.location_name}</span>
          )}
          {daysSince !== null && (
            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />Day {daysSince}</span>
          )}
          {plant.tracking_mode === 'row_group' && plant.row_quantity && (
            <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3 text-purple-500" />~{plant.row_quantity}</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2 text-xs text-gray-500">
            {plant.photos?.length > 0 && <span className="flex items-center gap-0.5"><Camera className="w-3 h-3" />{plant.photos.length}</span>}
            {plant.harvest_count > 0 && <span className="flex items-center gap-0.5 text-purple-600"><Scissors className="w-3 h-3" />{plant.harvest_count}</span>}
            {plant.total_yield_lbs > 0 && <span className="flex items-center gap-0.5 text-amber-600"><Apple className="w-3 h-3" />{plant.total_yield_lbs.toFixed(1)} lbs</span>}
          </div>
          {plant.privacy === 'public' && <Globe className="w-3 h-3 text-emerald-500" />}
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyPlants() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [beds, setBeds] = useState([]);
  const [gardenFilter, setGardenFilter] = useState('all');

  const [newPlant, setNewPlant] = useState({
    plant_type_id: '',
    plant_type_name: '',
    variety_id: '',
    variety_name: '',
    name: '',
    tracking_mode: 'individual',
    origin: 'direct_seed',
    status: 'planted',
    location_name: '',
    bed_id: '',
    garden_id: '',
    planted_date: new Date().toISOString().split('T')[0],
    row_quantity: '',
    season_year: new Date().getFullYear().toString(),
    notes: '',
    privacy: 'private',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      const [plantsData, ptData, gardensData] = await Promise.all([
        base44.entities.MyPlant.filter({ created_by: userData.email }, '-updated_date', 500),
        base44.entities.PlantType.list('common_name', 200),
        base44.entities.Garden.filter({ created_by: userData.email, archived: false }),
      ]);
      setPlants(plantsData);
      setPlantTypes(ptData);
      setGardens(gardensData);
    } catch (err) {
      toast.error('Failed to load plants');
    } finally {
      setLoading(false);
    }
  };

  // Load varieties when plant type changes
  useEffect(() => {
    if (!newPlant.plant_type_id) { setVarieties([]); return; }
    base44.entities.Variety.filter({ plant_type_id: newPlant.plant_type_id, status: 'active' }, 'variety_name', 200)
      .then(setVarieties).catch(() => setVarieties([]));
  }, [newPlant.plant_type_id]);

  // Load beds when garden changes
  useEffect(() => {
    if (!newPlant.garden_id) { setBeds([]); return; }
    base44.entities.Bed.filter({ garden_id: newPlant.garden_id }, 'name', 100)
      .then(setBeds).catch(() => setBeds([]));
  }, [newPlant.garden_id]);

  // Auto set tracking mode based on plant type
  useEffect(() => {
    if (newPlant.plant_type_name) {
      setNewPlant(prev => ({ ...prev, tracking_mode: isRowCrop(newPlant.plant_type_name) ? 'row_group' : 'individual' }));
    }
  }, [newPlant.plant_type_name]);

  const handleAddPlant = async () => {
    if (!newPlant.plant_type_name) { toast.error('Select a plant type'); return; }
    try {
      const payload = {
        plant_type_id: newPlant.plant_type_id || undefined,
        plant_type_name: newPlant.plant_type_name,
        variety_id: newPlant.variety_id || undefined,
        variety_name: newPlant.variety_name || undefined,
        garden_id: newPlant.garden_id || undefined,
        bed_id: newPlant.bed_id || undefined,
        name: newPlant.name || undefined,
        tracking_mode: newPlant.tracking_mode,
        origin: newPlant.origin,
        status: newPlant.tracking_mode === 'row_group' ? 'planted' : newPlant.status,
        location_name: newPlant.location_name || undefined,
        planted_date: newPlant.planted_date || undefined,
        season_year: newPlant.season_year,
        notes: newPlant.notes || undefined,
        privacy: newPlant.privacy,
        row_quantity: newPlant.row_quantity ? parseInt(newPlant.row_quantity) : undefined,
        grow_log: [{
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          entry_type: 'status_change',
          content: `Plant added: ${newPlant.origin === 'direct_seed' ? 'Direct seeded' : newPlant.origin === 'started_seed' ? 'Started from seed indoors' : newPlant.origin === 'transplant_seedling' ? 'Transplanted seedling' : 'Planted'}`,
          stage: 'planted',
        }]
      };
      await base44.entities.MyPlant.create(payload);
      await loadData();
      setShowAddPlant(false);
      setNewPlant({
        plant_type_id: '', plant_type_name: '', variety_id: '', variety_name: '',
        name: '', tracking_mode: 'individual', origin: 'direct_seed', status: 'planted',
        location_name: '', bed_id: '', garden_id: '',
        planted_date: new Date().toISOString().split('T')[0],
        row_quantity: '', season_year: new Date().getFullYear().toString(), notes: '', privacy: 'private',
      });
      toast.success('Plant added to My Garden Plants!');
    } catch (err) {
      toast.error('Failed to add plant: ' + err.message);
    }
  };

  // Filtering
  const ACTIVE_STATUSES = ['seed_started','planted','sprouted','seedling','transplanted','vegetative','flowering','fruiting','harvesting'];
  const filtered = plants.filter(p => {
    if (gardenFilter !== 'all' && p.garden_id !== gardenFilter) return false;
    if (statusFilter === 'active' && !ACTIVE_STATUSES.includes(p.status)) return false;
    if (statusFilter !== 'all' && statusFilter !== 'active' && p.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(p.name || '').toLowerCase().includes(q) &&
          !(p.variety_name || '').toLowerCase().includes(q) &&
          !(p.plant_type_name || '').toLowerCase().includes(q) &&
          !(p.location_name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const grouped = filtered.reduce((acc, p) => {
    const key = STATUS_CONFIG[p.status]?.label || p.status;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );

  const totalActive = plants.filter(p => ACTIVE_STATUSES.includes(p.status)).length;
  const totalHarvests = plants.reduce((sum, p) => sum + (p.harvest_count || 0), 0);
  const totalYield = plants.reduce((sum, p) => sum + (p.total_yield_lbs || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Sprout className="w-6 h-6 text-emerald-600" />My Garden Plants
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track every plant from seed to harvest</p>
        </div>
        <Button onClick={() => setShowAddPlant(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />Add Plant
        </Button>
      </div>

      {/* Stats bar */}
      {plants.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
            <p className="text-2xl font-black text-emerald-900">{totalActive}</p>
            <p className="text-xs text-emerald-700">Active Plants</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-center">
            <p className="text-2xl font-black text-purple-900">{totalHarvests}</p>
            <p className="text-xs text-purple-700">Harvests</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
            <p className="text-2xl font-black text-amber-900">{totalYield.toFixed(1)}</p>
            <p className="text-xs text-amber-700">Lbs Harvested</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search plants..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">🌱 Active Only</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {gardens.length > 1 && (
          <Select value={gardenFilter} onValueChange={setGardenFilter}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Gardens</SelectItem>
              {gardens.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Plant grid grouped by status */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-600">{plants.length === 0 ? 'No plants yet' : 'No plants match your filters'}</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            {plants.length === 0 ? 'Add your first plant to start tracking your garden!' : ''}
          </p>
          {plants.length === 0 && (
            <Button onClick={() => setShowAddPlant(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" />Add First Plant
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([statusLabel, groupPlants]) => (
            <div key={statusLabel}>
              <h3 className="font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                {statusLabel}
                <span className="text-xs font-normal px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{groupPlants.length}</span>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupPlants.map(plant => (
                  <PlantCard key={plant.id} plant={plant}
                    onClick={() => navigate(createPageUrl('GardenPlantDetail') + `?id=${plant.id}`)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Plant Dialog */}
      <Dialog open={showAddPlant} onOpenChange={setShowAddPlant}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🌱 Add Plant to Track</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Plant type */}
            <div>
              <Label>Plant Type *</Label>
              <Select value={newPlant.plant_type_id} onValueChange={v => {
                const pt = plantTypes.find(t => t.id === v);
                setNewPlant(p => ({ ...p, plant_type_id: v, plant_type_name: pt?.common_name || '', variety_id: '', variety_name: '' }));
              }}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Select plant type..." /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {plantTypes.map(pt => <SelectItem key={pt.id} value={pt.id}>{pt.icon || '🌱'} {pt.common_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Variety */}
            {newPlant.plant_type_id && (
              <div>
                <Label>Variety (optional)</Label>
                <Select value={newPlant.variety_id} onValueChange={v => {
                  const vr = varieties.find(vr => vr.id === v);
                  setNewPlant(p => ({ ...p, variety_id: v, variety_name: vr?.variety_name || '' }));
                }}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Select variety..." /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value={null}>No specific variety</SelectItem>
                    {varieties.map(v => <SelectItem key={v.id} value={v.id}>{v.variety_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Custom name */}
            <div>
              <Label>Custom Name (optional)</Label>
              <Input value={newPlant.name} onChange={e => setNewPlant(p => ({ ...p, name: e.target.value }))}
                placeholder={`e.g., ${newPlant.variety_name || newPlant.plant_type_name || 'Cherokee Purple'} #1`} className="mt-2" />
            </div>

            {/* Tracking Mode */}
            <div>
              <Label>Tracking Mode</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  { val: 'individual', label: '🌿 Individual Plant', desc: 'One entry per plant (tomato, pepper, squash, etc.)' },
                  { val: 'row_group', label: '🌾 Row / Group', desc: 'One entry for a whole row (lettuce, radish, carrots, etc.)' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setNewPlant(p => ({ ...p, tracking_mode: opt.val }))}
                    className={cn('p-3 rounded-xl border text-left transition-all',
                      newPlant.tracking_mode === opt.val ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-gray-200 hover:bg-gray-50')}>
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {newPlant.tracking_mode === 'row_group' && (
              <div>
                <Label>Approx. Number of Plants / Seeds in Row</Label>
                <Input type="number" value={newPlant.row_quantity} onChange={e => setNewPlant(p => ({ ...p, row_quantity: e.target.value }))}
                  placeholder="e.g. 50" className="mt-2" />
              </div>
            )}

            {/* Origin */}
            <div>
              <Label>How was it planted?</Label>
              <Select value={newPlant.origin} onValueChange={v => setNewPlant(p => ({ ...p, origin: v }))}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct_seed">🌰 Direct Seeded</SelectItem>
                  <SelectItem value="started_seed">🏠 Started from Seed (Indoors)</SelectItem>
                  <SelectItem value="transplant_seedling">🌿 Transplanted Seedling</SelectItem>
                  <SelectItem value="purchased_transplant">🛒 Purchased Transplant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Garden + Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Garden</Label>
                <Select value={newPlant.garden_id} onValueChange={v => setNewPlant(p => ({ ...p, garden_id: v, bed_id: '' }))}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Select garden..." /></SelectTrigger>
                  <SelectContent>
                    {gardens.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bed / Location</Label>
                {beds.length > 0 ? (
                  <Select value={newPlant.bed_id} onValueChange={v => {
                    const b = beds.find(b => b.id === v);
                    setNewPlant(p => ({ ...p, bed_id: v, location_name: b?.name || '' }));
                  }}>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Select bed..." /></SelectTrigger>
                    <SelectContent>
                      {beds.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={newPlant.location_name} onChange={e => setNewPlant(p => ({ ...p, location_name: e.target.value }))}
                    placeholder="e.g. Raised Bed A, Row 2" className="mt-2" />
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date Planted</Label>
                <Input type="date" value={newPlant.planted_date} onChange={e => setNewPlant(p => ({ ...p, planted_date: e.target.value }))} className="mt-2" />
              </div>
              <div>
                <Label>Season Year</Label>
                <Input value={newPlant.season_year} onChange={e => setNewPlant(p => ({ ...p, season_year: e.target.value }))}
                  placeholder="2025" className="mt-2" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <Textarea value={newPlant.notes} onChange={e => setNewPlant(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any notes about this planting..." className="mt-2" rows={2} />
            </div>

            {/* Privacy */}
            <div>
              <Label>Privacy</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  { val: 'private', label: '🔒 Private', desc: 'Only you can see this' },
                  { val: 'public', label: '🌍 Public', desc: 'Anyone with the link can view' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setNewPlant(p => ({ ...p, privacy: opt.val }))}
                    className={cn('p-3 rounded-xl border text-left transition-all',
                      newPlant.privacy === opt.val ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-gray-200 hover:bg-gray-50')}>
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPlant(false)}>Cancel</Button>
            <Button onClick={handleAddPlant} disabled={!newPlant.plant_type_name} className="bg-emerald-600 hover:bg-emerald-700">
              Add Plant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}