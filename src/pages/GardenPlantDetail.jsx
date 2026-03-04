import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft, Upload, Loader2, MapPin, Calendar, ExternalLink, Plus,
  Sprout, Apple, AlertTriangle, BookOpen, Share2, Camera, Globe, Lock,
  ChevronDown, ChevronUp, Leaf, TrendingUp, Scissors, Package, Heart,
  Edit2, Check, X, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  seed_started:  { label: '🌰 Seed Started',     color: 'bg-gray-100 text-gray-800 border-gray-300' },
  planted:       { label: '🌱 Planted',           color: 'bg-lime-100 text-lime-800 border-lime-300' },
  sprouted:      { label: '🌿 Sprouted',          color: 'bg-green-100 text-green-800 border-green-300' },
  seedling:      { label: '🌿 Seedling',          color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  transplanted:  { label: '🪴 Transplanted',      color: 'bg-teal-100 text-teal-800 border-teal-300' },
  vegetative:    { label: '🌿 Vegetative Growth', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  flowering:     { label: '🌸 Flowering',         color: 'bg-pink-100 text-pink-800 border-pink-300' },
  fruiting:      { label: '🍅 Fruiting',          color: 'bg-orange-100 text-orange-800 border-orange-300' },
  harvesting:    { label: '✂️ Harvesting',        color: 'bg-purple-100 text-purple-800 border-purple-300' },
  done:          { label: '✓ Season Done',        color: 'bg-gray-200 text-gray-600 border-gray-300' },
  removed:       { label: '🗑 Removed',           color: 'bg-red-100 text-red-600 border-red-200' },
};

const HEALTH_CONFIG = {
  thriving:    { label: '💪 Thriving',   color: 'bg-emerald-100 text-emerald-800' },
  good:        { label: '😊 Good',       color: 'bg-green-100 text-green-800' },
  ok:          { label: '😐 OK',         color: 'bg-yellow-100 text-yellow-800' },
  struggling:  { label: '😟 Struggling', color: 'bg-orange-100 text-orange-800' },
  dead:        { label: '💀 Dead',       color: 'bg-red-100 text-red-800' },
};

const ORIGIN_LABELS = {
  direct_seed: '🌰 Direct Seeded',
  started_seed: '🏠 Started from Seed Indoors',
  transplant_seedling: '🌿 Transplanted Seedling',
  purchased_transplant: '🛒 Purchased Transplant',
  unknown: '❓ Unknown',
};

const LOG_TYPE_ICONS = {
  note: '📝', photo: '📷', status_change: '🔄', issue: '⚠️',
  treatment: '💊', harvest: '🍅', measurement: '📏'
};

function SeedStashPopup({ seedLotId, open, onClose }) {
  const [seedLot, setSeedLot] = useState(null);
  const [variety, setVariety] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !seedLotId) return;
    setLoading(true);
    base44.entities.SeedLot.filter({ id: seedLotId }).then(async lots => {
      if (lots.length === 0) { setLoading(false); return; }
      const lot = lots[0];
      setSeedLot(lot);
      if (lot.plant_profile_id) {
        const profiles = await base44.entities.PlantProfile.filter({ id: lot.plant_profile_id });
        if (profiles.length > 0) {
          const prof = profiles[0];
          if (prof.variety_id) {
            const vars = await base44.entities.Variety.filter({ id: prof.variety_id });
            if (vars.length > 0) setVariety(vars[0]);
          }
        }
      }
      setLoading(false);
    });
  }, [open, seedLotId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🌰 Seed Stash Details</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
        ) : !seedLot ? (
          <p className="text-gray-500 text-center py-4">Seed lot not found</p>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <p className="font-bold text-emerald-900 text-lg">{seedLot.custom_label || variety?.variety_name || 'Unknown Variety'}</p>
              <p className="text-emerald-700 text-sm">{variety?.plant_type_name || ''}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {seedLot.quantity && <div className="p-3 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-500">Quantity</p><p className="font-semibold">{seedLot.quantity} {seedLot.unit}</p></div>}
              {seedLot.year_acquired && <div className="p-3 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-500">Year Acquired</p><p className="font-semibold">{seedLot.year_acquired}</p></div>}
              {seedLot.source_vendor_name && <div className="p-3 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-500">Source</p><p className="font-semibold">{seedLot.source_vendor_name}</p></div>}
              {seedLot.seed_line_type && <div className="p-3 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-500">Seed Type</p><p className="font-semibold capitalize">{seedLot.seed_line_type?.replace(/_/g, ' ')}</p></div>}
              {seedLot.germination_rate != null && <div className="p-3 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-500">Germ Rate</p><p className="font-semibold">{seedLot.germination_rate}%</p></div>}
              {seedLot.storage_location && <div className="p-3 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-500">Storage</p><p className="font-semibold">{seedLot.storage_location}</p></div>}
            </div>
            {variety?.description && (
              <div className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-xs text-gray-500 mb-1">Variety Description</p>
                <p className="text-sm text-gray-700 line-clamp-4">{variety.description}</p>
              </div>
            )}
            {variety && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                {variety.days_to_maturity && <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200"><p className="text-blue-600">Days to Maturity</p><p className="font-bold text-blue-900">{variety.days_to_maturity}</p></div>}
                {variety.sun_requirement && <div className="text-center p-2 bg-yellow-50 rounded-lg border border-yellow-200"><p className="text-yellow-600">Sun</p><p className="font-bold text-yellow-900 capitalize">{variety.sun_requirement.replace(/_/g,' ')}</p></div>}
                {variety.water_requirement && <div className="text-center p-2 bg-cyan-50 rounded-lg border border-cyan-200"><p className="text-cyan-600">Water</p><p className="font-bold text-cyan-900 capitalize">{variety.water_requirement}</p></div>}
              </div>
            )}
            {seedLot.lot_notes && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700 mb-1">My Notes</p>
                <p className="text-sm text-amber-900">{seedLot.lot_notes}</p>
              </div>
            )}
            <Link to={createPageUrl('SeedStashDetail') + `?id=${seedLot.id}`} onClick={onClose}>
              <Button variant="outline" className="w-full gap-2"><ExternalLink className="w-4 h-4" />View Full Seed Stash Entry</Button>
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GrowLogEntry({ entry }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm">
        {LOG_TYPE_ICONS[entry.entry_type] || '📝'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-500 capitalize">{entry.entry_type?.replace(/_/g, ' ')}</span>
          {entry.stage && <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-800">{STATUS_CONFIG[entry.stage]?.label || entry.stage}</Badge>}
          <span className="text-xs text-gray-400 ml-auto">{entry.timestamp ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }) : ''}</span>
        </div>
        {entry.content && <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.content}</p>}
        {entry.photo_url && (
          <img src={entry.photo_url} alt="log entry" className="mt-2 rounded-lg max-h-48 object-cover border" />
        )}
      </div>
    </div>
  );
}

export default function GardenPlantDetail() {
  const [searchParams] = useSearchParams();
  const plantId = searchParams.get('id');

  const [plant, setPlant] = useState(null);
  const [variety, setVariety] = useState(null);
  const [plantType, setPlantType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showSeedStash, setShowSeedStash] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);
  const [showHarvestDialog, setShowHarvestDialog] = useState(false);
  const [showEditStatus, setShowEditStatus] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [logForm, setLogForm] = useState({ entry_type: 'note', content: '', photo_url: '' });
  const [harvestForm, setHarvestForm] = useState({ date: new Date().toISOString().split('T')[0], weight_lbs: '', notes: '' });
  const [uploadingLogPhoto, setUploadingLogPhoto] = useState(false);

  useEffect(() => {
    if (plantId) {
      loadPlant();
    } else {
      setLoading(false);
    }
  }, [plantId]);

  const loadPlant = async () => {
    setLoading(true);
    try {
      const [instances, user] = await Promise.all([
        base44.entities.PlantInstance.filter({ id: plantId }),
        base44.auth.me().catch(() => null)
      ]);
      if (!instances.length) { setLoading(false); return; }
      const p = instances[0];
      setPlant(p);
      // Always allow owner actions — if we can fetch it, user owns it (RLS enforces this)
      setIsOwner(true);

      const fetches = [];
      if (p.variety_id) fetches.push(base44.entities.Variety.filter({ id: p.variety_id }).then(r => r[0] && setVariety(r[0])));
      if (p.plant_type_id) fetches.push(base44.entities.PlantType.filter({ id: p.plant_type_id }).then(r => r[0] && setPlantType(r[0])));
      await Promise.all(fetches);
    } catch (err) {
      toast.error('Failed to load plant');
    } finally {
      setLoading(false);
    }
  };

  const saveUpdate = async (updates) => {
    await base44.entities.PlantInstance.update(plant.id, updates);
    setPlant(prev => ({ ...prev, ...updates }));
  };

  const handleStatusChange = async (newStatus) => {
    const updates = { status: newStatus };
    const today = new Date().toISOString().split('T')[0];
    if (newStatus === 'sprouted' && !plant.germination_date) updates.germination_date = today;
    if (newStatus === 'transplanted' && !plant.transplant_date) updates.transplant_date = today;
    if (newStatus === 'flowering' && !plant.first_flower_date) updates.first_flower_date = today;
    if (newStatus === 'fruiting' && !plant.first_fruit_date) updates.first_fruit_date = today;
    if (['harvesting','done'].includes(newStatus) && !plant.first_harvest_date) updates.first_harvest_date = today;

    // Add log entry
    const newLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      entry_type: 'status_change',
      content: `Stage changed to: ${STATUS_CONFIG[newStatus]?.label || newStatus}`,
      stage: newStatus,
    };
    updates.grow_log = [...(plant.grow_log || []), newLog];

    await saveUpdate(updates);
    setShowEditStatus(false);
    toast.success('Stage updated');
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newPhoto = { url: file_url, caption: '', stage: plant.status, taken_at: new Date().toISOString() };
      const newLog = { id: Date.now().toString(), timestamp: new Date().toISOString(), entry_type: 'photo', content: '', photo_url: file_url, stage: plant.status };
      await saveUpdate({
        photos: [...(plant.photos || []), newPhoto],
        grow_log: [...(plant.grow_log || []), newLog],
      });
      toast.success('Photo added!');
    } catch { toast.error('Failed to upload'); }
    finally { setUploadingPhoto(false); }
  };

  const handleAddLog = async () => {
    if (!logForm.content && !logForm.photo_url) { toast.error('Add a note or photo'); return; }
    const entry = { id: Date.now().toString(), timestamp: new Date().toISOString(), ...logForm, stage: plant.status };
    const updates = { grow_log: [...(plant.grow_log || []), entry] };
    if (logForm.photo_url) {
      updates.photos = [...(plant.photos || []), { url: logForm.photo_url, caption: logForm.content, stage: plant.status, taken_at: new Date().toISOString() }];
    }
    await saveUpdate(updates);
    setLogForm({ entry_type: 'note', content: '', photo_url: '' });
    setShowAddLog(false);
    toast.success('Log entry added');
  };

  const handleLogPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setLogForm(prev => ({ ...prev, photo_url: file_url, entry_type: 'photo' }));
    } catch { toast.error('Failed to upload photo'); }
    finally { setUploadingLogPhoto(false); }
  };

  const handleLogHarvest = async () => {
    const weight = parseFloat(harvestForm.weight_lbs) || 0;
    const newTotal = (plant.total_yield_lbs || 0) + weight;
    const newCount = (plant.harvest_count || 0) + 1;
    const logEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      entry_type: 'harvest',
      content: `Harvest #${newCount}: ${weight > 0 ? weight + ' lbs' : ''}${harvestForm.notes ? ' — ' + harvestForm.notes : ''}`,
      data: { weight_lbs: weight, date: harvestForm.date },
      stage: plant.status,
    };
    const updates = {
      total_yield_lbs: newTotal,
      harvest_count: newCount,
      grow_log: [...(plant.grow_log || []), logEntry],
    };
    if (!plant.first_harvest_date) updates.first_harvest_date = harvestForm.date;
    updates.final_harvest_date = harvestForm.date;
    await saveUpdate(updates);
    setHarvestForm({ date: new Date().toISOString().split('T')[0], weight_lbs: '', notes: '' });
    setShowHarvestDialog(false);
    toast.success(`Harvest #${newCount} logged!`);
  };

  const handleTogglePublic = async () => {
    const newPrivacy = plant.privacy === 'public' ? 'private' : 'public';
    const updates = { privacy: newPrivacy };
    if (newPrivacy === 'public' && !plant.share_token) {
      updates.share_token = Math.random().toString(36).substring(2, 12);
    }
    await saveUpdate(updates);
    toast.success(newPrivacy === 'public' ? 'Now public! Anyone with the link can view.' : 'Set to private');
  };

  const copyShareUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}?id=${plant.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );

  if (!plantId) return (
    <div className="text-center py-16">
      <Sprout className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-700 mb-2">Plant Detail Tracker</h2>
      <p className="text-gray-500 mb-6">Open a plant from your My Garden Plants page to see its full detail, grow log, photos, and harvest tracking.</p>
      <Link to={createPageUrl('MyPlants')}><Button className="bg-emerald-600 hover:bg-emerald-700">Go to My Garden Plants</Button></Link>
    </div>
  );

  if (!plant) return (
    <div className="text-center py-16">
      <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-700">Plant not found</h2>
      <Link to={createPageUrl('MyPlants')}><Button className="mt-4" variant="outline">← My Plants</Button></Link>
    </div>
  );

  const statusCfg = STATUS_CONFIG[plant.status] || STATUS_CONFIG.planted;
  const healthCfg = HEALTH_CONFIG[plant.health_status];
  const daysSincePlanted = plant.planted_date ? differenceInDays(new Date(), new Date(plant.planted_date)) : null;
  const sortedLog = [...(plant.grow_log || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const photoGallery = plant.photos || [];
  const tabs = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'growth_log', label: `📝 Growth Log (${sortedLog.length})` },
    { id: 'photos', label: `📷 Photos (${photoGallery.length})` },
    { id: 'variety', label: '🌿 Variety Info' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link to={createPageUrl('MyPlants')}>
        <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />My Plants</Button>
      </Link>

      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {plant.name || plant.variety_name || plant.plant_type_name || 'My Plant'}
            </h1>
            <span className={cn('px-3 py-1 rounded-full text-sm font-semibold border', statusCfg.color)}>
              {statusCfg.label}
            </span>
            {healthCfg && (
              <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', healthCfg.color)}>
                {healthCfg.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
            {plant.plant_type_name && <span className="flex items-center gap-1"><Leaf className="w-3.5 h-3.5 text-emerald-500" />{plant.plant_type_name}</span>}
            {plant.location_name && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-red-400" />{plant.location_name}</span>}
            {daysSincePlanted !== null && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-blue-400" />Day {daysSincePlanted}</span>}
            {plant.tracking_mode === 'row_group' && (
              <span className="flex items-center gap-1 text-purple-600"><TrendingUp className="w-3.5 h-3.5" />Row Group{plant.row_quantity ? ` · ${plant.row_quantity} plants` : ''}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {plant.origin && <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">{ORIGIN_LABELS[plant.origin]}</span>}
            {plant.season_year && <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">📅 {plant.season_year}</span>}
            {plant.tags?.map((t, i) => <span key={i} className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">#{t}</span>)}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <>
              <Button size="sm" onClick={() => setShowEditStatus(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Edit2 className="w-3.5 h-3.5" />Change Stage
              </Button>
              <Button onClick={() => setShowHarvestDialog(true)} size="sm" className="bg-purple-600 hover:bg-purple-700 gap-1">
                <Scissors className="w-3.5 h-3.5" />Harvest
              </Button>
              <Button onClick={() => setShowAddLog(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                <Plus className="w-3.5 h-3.5" />Log Entry
              </Button>
            </>
          )}
          <Button
            variant="outline" size="sm" onClick={copyShareUrl} className="gap-1"
            title={plant.privacy === 'public' ? 'Copy public link' : 'Link (private)'}
          >
            <Share2 className="w-3.5 h-3.5" />
          </Button>
          {isOwner && (
            <Button
              variant="outline" size="sm"
              onClick={handleTogglePublic}
              className={cn('gap-1', plant.privacy === 'public' ? 'text-emerald-700 border-emerald-300' : '')}
            >
              {plant.privacy === 'public' ? <><Globe className="w-3.5 h-3.5" />Public</> : <><Lock className="w-3.5 h-3.5" />Private</>}
            </Button>
          )}
        </div>
      </div>

      {/* Cover photo */}
      {photoGallery.length > 0 && (
        <div className="relative h-64 rounded-2xl overflow-hidden shadow-lg">
          <img src={photoGallery[photoGallery.length - 1].url} alt="Most recent" className="w-full h-full object-cover" />
          <div className="absolute bottom-3 right-3 flex gap-2">
            {isOwner && (
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg text-sm font-medium shadow hover:bg-white transition-colors">
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Add Photo
                </span>
              </label>
            )}
          </div>
          <div className="absolute top-3 left-3 bg-black/40 text-white text-xs px-2 py-1 rounded-lg">
            {photoGallery.length} photo{photoGallery.length !== 1 ? 's' : ''} · Most recent
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {daysSincePlanted !== null && (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
            <Clock className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-black text-emerald-900">{daysSincePlanted}</p>
            <p className="text-xs text-emerald-700">Days Growing</p>
          </div>
        )}
        {plant.harvest_count > 0 && (
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 text-center">
            <Scissors className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-black text-purple-900">{plant.harvest_count}</p>
            <p className="text-xs text-purple-700">Harvests</p>
          </div>
        )}
        {plant.total_yield_lbs > 0 && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
            <Apple className="w-5 h-5 text-amber-600 mx-auto mb-1" />
            <p className="text-2xl font-black text-amber-900">{plant.total_yield_lbs.toFixed(1)}</p>
            <p className="text-xs text-amber-700">Lbs Harvested</p>
          </div>
        )}
        {sortedLog.length > 0 && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center">
            <BookOpen className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-black text-blue-900">{sortedLog.length}</p>
            <p className="text-xs text-blue-700">Log Entries</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* === OVERVIEW TAB === */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Lifecycle milestones */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">📅 Lifecycle Milestones</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {[
                  ['Planted', plant.planted_date],
                  ['Germinated', plant.germination_date],
                  ['Transplanted', plant.transplant_date],
                  ['First Flower', plant.first_flower_date],
                  ['First Fruit', plant.first_fruit_date],
                  ['First Harvest', plant.first_harvest_date],
                  ['Last Harvest', plant.final_harvest_date],
                ].map(([label, date]) => (
                  <div key={label} className={cn('p-3 rounded-lg border text-center', date ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200')}>
                    <p className={cn('text-xs font-medium mb-1', date ? 'text-emerald-700' : 'text-gray-400')}>{label}</p>
                    <p className={cn('text-sm font-bold', date ? 'text-emerald-900' : 'text-gray-400')}>
                      {date ? format(new Date(date), 'MMM d, yyyy') : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Planting Info */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">🌱 Planting Info</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {plant.origin && <div className="flex justify-between"><span className="text-gray-500">Origin</span><span className="font-medium">{ORIGIN_LABELS[plant.origin]}</span></div>}
              {plant.location_name && <div className="flex justify-between"><span className="text-gray-500">Location</span><span className="font-medium">{plant.location_name}</span></div>}
              {plant.position_in_bed && <div className="flex justify-between"><span className="text-gray-500">Position</span><span className="font-medium">{plant.position_in_bed}</span></div>}
              {plant.tracking_mode === 'row_group' && plant.row_quantity && <div className="flex justify-between"><span className="text-gray-500">Row Plants</span><span className="font-medium">~{plant.row_quantity}</span></div>}
              {plant.tracking_mode === 'row_group' && plant.row_length_feet && <div className="flex justify-between"><span className="text-gray-500">Row Length</span><span className="font-medium">{plant.row_length_feet} ft</span></div>}
            </CardContent>
          </Card>

          {/* Seed Stash Link */}
          {plant.seed_lot_id && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">Grown from Seed Stash</p>
                    <p className="text-xs text-amber-700">Click to view seed details, variety info, germination rate, and more</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowSeedStash(true)} className="gap-1 border-amber-300 text-amber-800 hover:bg-amber-100">
                  <ExternalLink className="w-3.5 h-3.5" />View Seed
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {plant.notes && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">📝 Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{plant.notes}</p></CardContent>
            </Card>
          )}

          {/* Harvest Summary */}
          {plant.harvest_count > 0 && (
            <Card className="border-purple-200">
              <CardHeader className="pb-3"><CardTitle className="text-base">🍅 Harvest Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <p className="text-3xl font-black text-purple-900">{plant.harvest_count}</p>
                    <p className="text-xs text-purple-700">Total Harvests</p>
                  </div>
                  {plant.total_yield_lbs > 0 && (
                    <div className="p-4 bg-amber-50 rounded-xl">
                      <p className="text-3xl font-black text-amber-900">{plant.total_yield_lbs.toFixed(1)}</p>
                      <p className="text-xs text-amber-700">Total Lbs</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* === GROWTH LOG TAB === */}
      {activeTab === 'growth_log' && (
        <div className="space-y-4">
          {isOwner && (
            <div className="flex gap-2">
              <Button onClick={() => setShowAddLog(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                <Plus className="w-4 h-4" />Add Log Entry
              </Button>
              <Button onClick={() => setShowHarvestDialog(true)} size="sm" variant="outline" className="gap-1">
                <Scissors className="w-4 h-4" />Log Harvest
              </Button>
            </div>
          )}
          {sortedLog.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3" />
              <p className="font-medium">No log entries yet</p>
              <p className="text-sm">Start tracking your plant's journey</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedLog.map((entry, i) => <GrowLogEntry key={entry.id || i} entry={entry} />)}
            </div>
          )}
        </div>
      )}

      {/* === PHOTOS TAB === */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          {isOwner && (
            <label className="cursor-pointer block">
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-emerald-300 rounded-xl hover:bg-emerald-50 transition-colors text-emerald-700 font-medium">
                {uploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Camera className="w-5 h-5" />Add Photo</>}
              </div>
            </label>
          )}
          {photoGallery.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Camera className="w-12 h-12 mx-auto mb-3" />
              <p className="font-medium">No photos yet</p>
              <p className="text-sm">Document your plant's growth with photos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...photoGallery].reverse().map((photo, i) => (
                <div key={i} className="relative group">
                  <img src={photo.url} alt={photo.caption || 'Plant photo'} className="w-full aspect-square object-cover rounded-xl shadow" />
                  {(photo.stage || photo.taken_at) && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl">
                      <p className="text-white text-xs truncate">{photo.stage ? STATUS_CONFIG[photo.stage]?.label : ''}</p>
                      {photo.taken_at && <p className="text-white/70 text-[10px]">{format(new Date(photo.taken_at), 'MMM d, yyyy')}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === VARIETY INFO TAB === */}
      {activeTab === 'variety' && (
        <div className="space-y-4">
          {variety ? (
            <>
              <Card>
                <CardHeader><CardTitle>{variety.variety_name}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {variety.description && <p className="text-sm text-gray-700">{variety.description}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {variety.days_to_maturity && <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center"><p className="text-xs text-blue-600">Days to Maturity</p><p className="text-xl font-bold text-blue-900">{variety.days_to_maturity}</p></div>}
                    {variety.sun_requirement && <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center"><p className="text-xs text-yellow-600">Sun</p><p className="text-sm font-bold text-yellow-900 capitalize">{variety.sun_requirement.replace(/_/g,' ')}</p></div>}
                    {variety.water_requirement && <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200 text-center"><p className="text-xs text-cyan-600">Water</p><p className="text-sm font-bold text-cyan-900 capitalize">{variety.water_requirement}</p></div>}
                    {(variety.spacing_min || variety.spacing_recommended) && <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center"><p className="text-xs text-green-600">Spacing</p><p className="text-sm font-bold text-green-900">{variety.spacing_recommended || `${variety.spacing_min}–${variety.spacing_max}`}"</p></div>}
                    {(variety.scoville_min || variety.scoville_max) && <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center"><p className="text-xs text-red-600">Heat</p><p className="text-sm font-bold text-red-900">{Number(variety.scoville_min || 0).toLocaleString()}–{Number(variety.scoville_max || 0).toLocaleString()} SHU</p></div>}
                    {variety.disease_resistance && <div className="p-3 bg-teal-50 rounded-lg border border-teal-200"><p className="text-xs text-teal-600">Disease Resistance</p><p className="text-sm font-bold text-teal-900">{variety.disease_resistance}</p></div>}
                  </div>
                  {variety.flavor_profile && <div className="p-3 bg-purple-50 rounded-lg border border-purple-200"><p className="text-xs text-purple-600 mb-1">Flavor</p><p className="text-sm text-purple-900">{variety.flavor_profile}</p></div>}
                  {variety.uses && <div className="p-3 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-600 mb-1">Uses</p><p className="text-sm text-gray-900">{variety.uses}</p></div>}
                  <Link to={createPageUrl('ViewVariety') + `?id=${variety.id}`}>
                    <Button variant="outline" size="sm" className="gap-1 w-full"><ExternalLink className="w-3.5 h-3.5" />View Full Variety in Catalog</Button>
                  </Link>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Leaf className="w-12 h-12 mx-auto mb-3" />
              <p className="font-medium">No variety linked</p>
              <p className="text-sm">Link a variety from the plant catalog to see detailed info</p>
            </div>
          )}
        </div>
      )}

      {/* === MODALS === */}

      {/* Change Stage */}
      <Dialog open={showEditStatus} onOpenChange={setShowEditStatus}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Growth Stage</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <button key={val} onClick={() => handleStatusChange(val)}
                className={cn('p-3 rounded-xl border text-left transition-all hover:scale-[1.02]',
                  plant.status === val ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300' : 'border-gray-200 bg-gray-50 hover:bg-gray-100')}>
                <span className="text-sm font-semibold">{cfg.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Log Entry */}
      <Dialog open={showAddLog} onOpenChange={setShowAddLog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Log Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Entry Type</Label>
              <Select value={logForm.entry_type} onValueChange={v => setLogForm(prev => ({ ...prev, entry_type: v }))}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LOG_TYPE_ICONS).map(([val, icon]) => (
                    <SelectItem key={val} value={val}>{icon} {val.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={logForm.content} onChange={e => setLogForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="What did you observe?" className="mt-2" rows={3} />
            </div>
            <div>
              <Label>Photo (optional)</Label>
              <div className="mt-2">
                {logForm.photo_url ? (
                  <div className="relative">
                    <img src={logForm.photo_url} alt="log" className="w-full h-40 object-cover rounded-lg" />
                    <button onClick={() => setLogForm(prev => ({ ...prev, photo_url: '' }))}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-red-50">
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogPhotoUpload} />
                    {uploadingLogPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-500">Add Photo</span></>}
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLog(false)}>Cancel</Button>
            <Button onClick={handleAddLog} className="bg-emerald-600 hover:bg-emerald-700">Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Harvest */}
      <Dialog open={showHarvestDialog} onOpenChange={setShowHarvestDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>🍅 Log Harvest</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={harvestForm.date} onChange={e => setHarvestForm(p => ({ ...p, date: e.target.value }))} className="mt-2" />
            </div>
            <div>
              <Label>Weight (lbs) — optional</Label>
              <Input type="number" step="0.1" value={harvestForm.weight_lbs} onChange={e => setHarvestForm(p => ({ ...p, weight_lbs: e.target.value }))}
                placeholder="e.g. 1.5" className="mt-2" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={harvestForm.notes} onChange={e => setHarvestForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Quality, count, observations..." className="mt-2" rows={2} />
            </div>
            {plant.harvest_count > 0 && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-sm text-purple-800">
                This will be harvest #{(plant.harvest_count || 0) + 1} · Total so far: {plant.total_yield_lbs?.toFixed(1) || 0} lbs
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHarvestDialog(false)}>Cancel</Button>
            <Button onClick={handleLogHarvest} className="bg-purple-600 hover:bg-purple-700">Log Harvest</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed Stash Popup */}
      <SeedStashPopup seedLotId={plant.seed_lot_id} open={showSeedStash} onClose={() => setShowSeedStash(false)} />
    </div>
  );
}