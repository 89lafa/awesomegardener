import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Edit, Trash2, Package, Calendar, MapPin, ExternalLink, Loader2,
  AlertTriangle, Star, Sun, Ruler, Plus, TrendingUp, Droplets, Share2, Sprout,
  Clock, Scissors, Leaf, Shield, Bug, ThermometerSun, FlaskConical, Tag,
  CheckCircle2, XCircle, Heart, RefreshCw, Beaker,
} from 'lucide-react';
import SuggestVarietyButton from '@/components/seedstash/SuggestVarietyButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ShareButton from '@/components/common/ShareButton';
import { smartQuery } from '@/components/utils/smartQuery';

/* ── helpers ──────────────────────────────────────────────── */
function resolve(profile, variety, ...keys) {
  for (const k of keys) {
    if (profile?.[k] != null && profile[k] !== '') return profile[k];
    if (variety?.[k] != null && variety[k] !== '') return variety[k];
  }
  return null;
}

function InfoTile({ icon: Icon, label, value, colorClass, iconColor, textColor, small = false }) {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex flex-col items-center p-4 bg-gradient-to-br ${colorClass} rounded-xl border`}>
      <Icon className={`w-6 h-6 ${iconColor} mb-2`} />
      <p className={`text-xs ${iconColor} mb-1 text-center`}>{label}</p>
      <p className={`${small ? 'text-sm' : 'text-xl'} font-bold ${textColor} text-center`}>{value}</p>
    </div>
  );
}

function MiniCard({ label, value, colorClass = 'bg-gray-50 border-gray-200', labelColor = 'text-gray-600', valueColor = 'text-gray-900' }) {
  if (!value && value !== 0 && value !== false) return null;
  return (
    <div className={`p-3 rounded-lg border ${colorClass}`}>
      <p className={`text-xs font-semibold ${labelColor} mb-1`}>{label}</p>
      <p className={`text-sm ${valueColor} capitalize`}>{String(value)}</p>
    </div>
  );
}

function LotRow({ icon: Icon, iconColor = 'text-gray-500', label, value, children }) {
  if (!value && !children) return null;
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl border bg-white dark:bg-gray-900/20" style={{ borderColor: 'var(--border-color)' }}>
      <span className="font-medium flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {label}
      </span>
      {children || <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{value}</span>}
    </div>
  );
}

const ACQ_LABELS = {
  purchased: '🛒 Purchased', traded: '🤝 Traded', saved: '🌱 Seed Saved',
  gift: '🎁 Gift', swap: '🔄 Seed Swap', foraged: '🌿 Foraged', grown: '🪴 Grown by me',
};

export default function SeedStashDetail() {
  const [searchParams] = useSearchParams();
  const seedId = searchParams.get('id');
  const [seed, setSeed] = useState(null);
  const [profile, setProfile] = useState(null);
  const [variety, setVariety] = useState(null);
  const [plantType, setPlantType] = useState(null);
  const [subCategory, setSubCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settings, setSettings] = useState({ aging_threshold_years: 2, old_threshold_years: 3 });
  const [activeTab, setActiveTab] = useState('profile');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditLot, setShowEditLot] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [lotForm, setLotForm] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showGermTest, setShowGermTest] = useState(false);
  const [germForm, setGermForm] = useState({ seeds_tested: '', seeds_germinated: '', test_date: '', notes: '' });

  useEffect(() => { if (seedId) loadSeed(); else { setNotFound(true); setLoading(false); } }, [seedId]);

  const loadSeed = async () => {
    try {
      const user = await base44.auth.me();
      const [seedData, userSettings] = await Promise.all([
        base44.entities.SeedLot.filter({ id: seedId, created_by: user.email }),
        base44.entities.UserSettings.filter({ created_by: user.email })
      ]);
      if (seedData.length === 0) { setNotFound(true); setLoading(false); return; }
      if (userSettings.length > 0) {
        setSettings({
          aging_threshold_years: userSettings[0].aging_threshold_years || 2,
          old_threshold_years: userSettings[0].old_threshold_years || 3
        });
      }
      const seedLot = seedData[0];
      setSeed(seedLot);
      setLotForm(seedLot);
      if (seedLot.plant_profile_id) {
        const profileData = await smartQuery(base44, 'PlantProfile', { id: seedLot.plant_profile_id });
        if (profileData.length > 0) {
          const prof = profileData[0];
          setProfile(prof);
          setProfileForm(prof);
          if (prof.variety_id) {
            const varietyData = await smartQuery(base44, 'Variety', { id: prof.variety_id });
            if (varietyData.length > 0) {
              const vr = varietyData[0];
              setVariety(vr);
              if (vr.plant_type_id) {
                const typeData = await smartQuery(base44, 'PlantType', { id: vr.plant_type_id });
                if (typeData.length > 0) setPlantType(typeData[0]);
              }
              if (vr.plant_subcategory_id) {
                const subcatData = await smartQuery(base44, 'PlantSubCategory', { id: vr.plant_subcategory_id });
                if (subcatData.length > 0) setSubCategory(subcatData[0]);
              }
            }
          } else if (prof.plant_type_id) {
            const typeData = await smartQuery(base44, 'PlantType', { id: prof.plant_type_id });
            if (typeData.length > 0) setPlantType(typeData[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading seed:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const getAge = () => {
    if (!seed) return 0;
    const y = seed.packed_for_year || seed.year_acquired;
    return y ? new Date().getFullYear() - y : 0;
  };

  const getAgeStatus = () => {
    const age = getAge();
    if (age >= settings.old_threshold_years) return { status: 'OLD', color: 'red' };
    if (age >= settings.aging_threshold_years) return { status: 'AGING', color: 'amber' };
    return { status: 'FRESH', color: 'green' };
  };

  const handleSaveProfile = async () => {
    try {
      await base44.entities.PlantProfile.update(profile.id, profileForm);
      setProfile(profileForm);
      setShowEditProfile(false);
      toast.success('Variety attributes updated');
    } catch { toast.error('Failed to update'); }
  };

  const handleSaveLot = async () => {
    try {
      await base44.entities.SeedLot.update(seed.id, lotForm);
      setSeed(lotForm);
      setShowEditLot(false);
      toast.success('Lot info updated');
    } catch { toast.error('Failed to update'); }
  };

  const handleGermTest = async () => {
    const { seeds_tested, seeds_germinated, test_date } = germForm;
    if (!seeds_tested || !seeds_germinated) { toast.error('Enter tested and germinated counts'); return; }
    const rate = Math.round((Number(seeds_germinated) / Number(seeds_tested)) * 100);
    const updated = {
      ...seed,
      germination_rate: rate,
      germination_test_date: test_date || new Date().toISOString().split('T')[0],
      germination_seeds_tested: Number(seeds_tested),
      germination_seeds_germinated: Number(seeds_germinated),
      germination_notes: germForm.notes,
    };
    try {
      await base44.entities.SeedLot.update(seed.id, updated);
      setSeed(updated);
      setLotForm(updated);
      setShowGermTest(false);
      toast.success(`Germination rate: ${rate}% saved`);
    } catch { toast.error('Failed to save germination test'); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updatedImages = [...(seed.lot_images || []), file_url];
      await base44.entities.SeedLot.update(seed.id, { lot_images: updatedImages });
      setSeed({ ...seed, lot_images: updatedImages });
    } catch { toast.error('Failed to upload photo'); }
    finally { setUploadingPhoto(false); }
  };

  const handleDeletePhoto = async (url) => {
    const updated = seed.lot_images.filter(u => u !== url);
    await base44.entities.SeedLot.update(seed.id, { lot_images: updated });
    setSeed({ ...seed, lot_images: updated });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${profile?.variety_name || seed?.custom_label}"?`)) return;
    await base44.entities.SeedLot.delete(seed.id);
    toast.success('Seed deleted');
    window.location.href = createPageUrl('SeedStash');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  if (notFound || !seed) return (
    <div className="flex items-center justify-center h-64">
      <Card className="max-w-md w-full"><CardContent className="p-8 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Seed Not Found</h2>
        <Link to={createPageUrl('SeedStash')}><Button className="bg-emerald-600 hover:bg-emerald-700">Back to Seed Stash</Button></Link>
      </CardContent></Card>
    </div>
  );

  const ageStatus = getAgeStatus();
  const age = getAge();
  const r = (key) => resolve(profile, variety, key);
  const isFromCatalog = !!variety;

  const daysToMaturity = r('days_to_maturity_seed') || r('days_to_maturity');
  const sunReq = r('sun_requirement');
  const waterReq = r('water_requirement');
  const spacingMin = r('spacing_in_min') || r('spacing_min');
  const spacingMax = r('spacing_in_max') || r('spacing_max');
  const spacingRec = r('spacing_recommended');
  const heightMin = r('height_in_min') || r('height_min');
  const heightMax = r('height_in_max') || r('height_max');
  const description = r('description');
  const flavorProfile = r('flavor_profile');
  const fruitColor = r('color_notes') || r('fruit_color');
  const fruitShape = r('fruit_shape');
  const fruitSize = r('fruit_size');
  const podColor = r('pod_color');
  const podShape = r('pod_shape');
  const growthHabit = r('growth_habit');
  const uses = resolve(variety, profile, 'uses');
  const breeder = r('breeder') || r('breeder_or_origin');
  const scovilleMin = r('heat_scoville_min') || r('scoville_min');
  const scovilleMax = r('heat_scoville_max') || r('scoville_max');
  const containerFriendly = r('container_friendly');
  const trellisRequired = r('trellis_required');
  const diseaseResistance = resolve(variety, profile, 'disease_resistance');
  const seedLineType = resolve(variety, profile, 'seed_line_type');
  const growingNotes = r('notes_public') || resolve(variety, null, 'grower_notes');
  const traits = profile?.traits || (variety?.traits
    ? (typeof variety.traits === 'string' ? variety.traits.split(',').map(t => t.trim()) : variety.traits)
    : null);

  const ext = variety?.extended_data || {};
  const commonPests = ext.common_pests || variety?.common_pests;
  const commonDiseases = ext.common_diseases || variety?.common_diseases;
  const soilType = ext.soil_type_recommended || variety?.soil_type_recommended;
  const humidityPref = ext.humidity_preference || variety?.humidity_preference;
  const tempMin = ext.temp_min_f || variety?.temp_min_f;
  const tempMax = ext.temp_max_f || variety?.temp_max_f;
  const propagation = ext.propagation_methods || variety?.propagation_methods;
  const careLevel = ext.care_difficulty || variety?.care_difficulty;
  const petSafe = ext.pet_safe ?? variety?.pet_safe;
  const toxicCats = ext.toxic_to_cats ?? variety?.toxic_to_cats;
  const toxicDogs = ext.toxic_to_dogs ?? variety?.toxic_to_dogs;
  const pruningNeeds = ext.pruning_needs || variety?.pruning_needs;
  const matureHeight = ext.mature_indoor_height || variety?.mature_indoor_height;

  const seedTypeLabelMap = {
    open_pollinated: { label: '🌿 Open-Pollinated', bg: 'bg-emerald-100 text-emerald-800' },
    hybrid: { label: '🔬 Hybrid (F1)', bg: 'bg-blue-100 text-blue-800' },
    heirloom: { label: '🏺 Heirloom', bg: 'bg-amber-100 text-amber-800' },
  };
  const seedTypeInfo = seedTypeLabelMap[seedLineType?.toLowerCase()];

  const germRate = seed.germination_rate;
  const germColor = germRate >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : germRate >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';

  const tabs = [
    { id: 'profile', label: '📖 Variety Info' },
    { id: 'lot', label: '🔒 My Stash' },
    { id: 'germination', label: '🧪 Germination' },
    { id: 'photos', label: '📷 Photos' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link to={createPageUrl('SeedStash')}>
        <Button variant="ghost"><ArrowLeft className="w-4 h-4 mr-2" />Back to Seed Stash</Button>
      </Link>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {profile?.variety_name || seed.custom_label || 'Unknown Seed'}
            </h1>
            <span className={cn(
              'px-3 py-1 rounded-full text-xs font-bold border',
              ageStatus.status === 'FRESH' && 'bg-emerald-100 text-emerald-800 border-emerald-200',
              ageStatus.status === 'AGING' && 'bg-amber-100 text-amber-800 border-amber-200',
              ageStatus.status === 'OLD' && 'bg-red-100 text-red-800 border-red-200',
            )}>
              {ageStatus.status === 'FRESH' ? '✓' : ageStatus.status === 'AGING' ? '⚠' : '!'} {ageStatus.status}
              {age > 0 ? ` · ${age}yr` : ''}
            </span>
          </div>
          {(plantType?.common_name || profile?.common_name) && (
            <p className="mt-1 text-lg" style={{ color: 'var(--text-secondary)' }}>
              {plantType?.common_name || profile?.common_name}
              {subCategory?.name && ` · ${subCategory.name}`}
            </p>
          )}
          {/* Tag badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            {isFromCatalog
              ? <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">📚 Catalog Linked</span>
              : profile && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">📝 Custom / Imported</span>}
            {seedTypeInfo && <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${seedTypeInfo.bg}`}>{seedTypeInfo.label}</span>}
            {seed.acquisition_source && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 border border-violet-200">
                {ACQ_LABELS[seed.acquisition_source] || seed.acquisition_source}
              </span>
            )}
            {scovilleMax && parseInt(scovilleMax) > 100000 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">🔥 Extreme Heat</span>
            )}
            {seed.is_wishlist && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-100 text-pink-800 border border-pink-200">💖 Wishlist</span>}
            {seed.tags?.map((tag, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">#{tag}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {variety && (
            <Link to={createPageUrl('ViewVariety') + `?id=${variety.id}`}>
              <Button variant="outline" className="gap-2"><ExternalLink className="w-4 h-4" />View in Catalog</Button>
            </Link>
          )}
          {profile && (
            <>
              <ShareButton title={`${profile.variety_name} - Seed Stash`} text={`Check out this variety!`}
                url={`${window.location.origin}${createPageUrl('PublicSeed')}?id=${seed.id}`} imageUrl={seed.lot_images?.[0]} />
              {!seed.from_catalog && <SuggestVarietyButton profile={profile} seedLot={seed} />}
            </>
          )}
          <Button variant="outline" onClick={handleDelete} className="gap-2 text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        </div>
      </div>

      {/* ── Quick Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {seed.quantity && (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
            <Package className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-xs text-emerald-700">Quantity</p>
            <p className="text-xl font-bold text-emerald-900">{seed.quantity} <span className="text-sm">{seed.unit}</span></p>
          </div>
        )}
        {daysToMaturity && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center">
            <Calendar className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-blue-700">Days to Maturity</p>
            <p className="text-xl font-bold text-blue-900">{daysToMaturity}</p>
          </div>
        )}
        {germRate != null && (
          <div className={`p-4 rounded-xl border text-center ${germColor}`}>
            <Beaker className="w-5 h-5 mx-auto mb-1" />
            <p className="text-xs">Germ Rate</p>
            <p className="text-xl font-bold">{germRate}%</p>
          </div>
        )}
        {age > 0 && (
          <div className={cn('p-4 rounded-xl border text-center',
            ageStatus.status === 'FRESH' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : ageStatus.status === 'AGING' ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-red-50 border-red-200 text-red-800')}>
            <Clock className="w-5 h-5 mx-auto mb-1" />
            <p className="text-xs">Seed Age</p>
            <p className="text-xl font-bold">{age} yr{age !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB: VARIETY PROFILE ═══════════════ */}
      {activeTab === 'profile' && (
        <Card style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl" style={{ color: 'var(--text-primary)' }}>
              📖 Variety Profile
              {isFromCatalog
                ? <span className="text-sm font-normal text-gray-500 ml-2">(From Catalog)</span>
                : <span className="text-sm font-normal text-gray-500 ml-2">(Custom)</span>}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowEditProfile(true)}>
              <Edit className="w-4 h-4 mr-2" />Edit Details
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Variety / Type row */}
            {(variety?.variety_name || profile?.variety_name || plantType?.common_name) && (
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 rounded-xl border border-emerald-200">
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  {(variety?.variety_name || profile?.variety_name) && (
                    <div><span className="text-emerald-700 font-medium">Variety:</span>
                      <span className="ml-2 text-emerald-900 font-semibold">{variety?.variety_name || profile?.variety_name}</span></div>
                  )}
                  {(plantType?.common_name || profile?.common_name) && (
                    <div><span className="text-emerald-700 font-medium">Type:</span>
                      <span className="ml-2 text-emerald-900">{plantType?.common_name || profile?.common_name}</span></div>
                  )}
                  {seedLineType && (
                    <div><span className="text-emerald-700 font-medium">Seed:</span>
                      <span className="ml-2 text-emerald-900 capitalize">{seedLineType.replace(/_/g, ' ')}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Hero tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoTile icon={Sun} label="Sun" value={sunReq?.replace(/_/g, ' ')}
                colorClass="from-yellow-50 to-amber-100 border-yellow-200" iconColor="text-yellow-600" textColor="text-yellow-900" small />
              {(spacingMin || spacingMax || spacingRec) && (
                <InfoTile icon={Ruler} label="Spacing"
                  value={spacingMin && spacingMax ? `${spacingMin}–${spacingMax}"` : spacingRec ? `${spacingRec}"` : `${spacingMin || spacingMax}"`}
                  colorClass="from-green-50 to-emerald-100 border-green-200" iconColor="text-green-600" textColor="text-green-900" />
              )}
              <InfoTile icon={Droplets} label="Water" value={waterReq}
                colorClass="from-cyan-50 to-blue-100 border-cyan-200" iconColor="text-cyan-600" textColor="text-cyan-900" small />
              {(heightMin || heightMax) && (
                <InfoTile icon={TrendingUp} label="Height"
                  value={heightMin && heightMax ? `${heightMin}–${heightMax}"` : `${heightMin || heightMax}"`}
                  colorClass="from-slate-50 to-gray-100 border-slate-200" iconColor="text-slate-500" textColor="text-slate-800" />
              )}
            </div>

            {/* Heat */}
            {(scovilleMin || scovilleMax) && (
              <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-200">
                <div className="flex items-center gap-2 mb-2"><span className="text-2xl">🌶️</span><p className="font-semibold text-red-900">Heat Level</p></div>
                <p className="text-lg font-bold text-red-700">
                  {scovilleMin && scovilleMax
                    ? `${Number(scovilleMin).toLocaleString()}–${Number(scovilleMax).toLocaleString()}`
                    : Number(scovilleMin || scovilleMax).toLocaleString()} SHU
                </p>
              </div>
            )}

            {/* Planting timeline */}
            {(r('start_indoors_weeks_before_last_frost_min') || r('start_indoors_weeks') || r('transplant_weeks_after_last_frost_min') || r('direct_sow_weeks_relative_to_last_frost_min')) && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">📅 Planting Timeline</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {(r('start_indoors_weeks_before_last_frost_min') || r('start_indoors_weeks')) && (
                    <MiniCard label="Start Indoors"
                      value={`${r('start_indoors_weeks_before_last_frost_min') || r('start_indoors_weeks')} weeks before frost`}
                      colorClass="bg-indigo-50 border-indigo-200" labelColor="text-indigo-700" valueColor="text-indigo-900" />
                  )}
                  {r('transplant_weeks_after_last_frost_min') && (
                    <MiniCard label="Transplant" value={`${r('transplant_weeks_after_last_frost_min')} weeks after frost`}
                      colorClass="bg-violet-50 border-violet-200" labelColor="text-violet-700" valueColor="text-violet-900" />
                  )}
                  {r('direct_sow_weeks_relative_to_last_frost_min') && (
                    <MiniCard label="Direct Sow" value={`${r('direct_sow_weeks_relative_to_last_frost_min')} weeks after frost`}
                      colorClass="bg-amber-50 border-amber-200" labelColor="text-amber-700" valueColor="text-amber-900" />
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {description && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border">
                <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Description</p>
                <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
              </div>
            )}

            {/* Flavor / fruit */}
            {(flavorProfile || uses || fruitColor || fruitShape || fruitSize || podColor || podShape) && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">🍅 Flavor & Fruit Details</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <MiniCard label="Flavor" value={flavorProfile} colorClass="bg-purple-50 border-purple-200" labelColor="text-purple-700" valueColor="text-purple-900" />
                  <MiniCard label="Uses" value={uses} colorClass="bg-blue-50 border-blue-200" labelColor="text-blue-700" valueColor="text-blue-900" />
                  <MiniCard label="Color" value={fruitColor || podColor} colorClass="bg-pink-50 border-pink-200" labelColor="text-pink-700" valueColor="text-pink-900" />
                  <MiniCard label="Shape" value={fruitShape || podShape} colorClass="bg-orange-50 border-orange-200" labelColor="text-orange-700" valueColor="text-orange-900" />
                  <MiniCard label="Size" value={fruitSize} colorClass="bg-rose-50 border-rose-200" labelColor="text-rose-700" valueColor="text-rose-900" />
                  <MiniCard label="Growth Habit" value={growthHabit} colorClass="bg-green-50 border-green-200" labelColor="text-green-700" valueColor="text-green-900" />
                </div>
              </div>
            )}

            {/* Indoor data */}
            {(careLevel || humidityPref || tempMin || tempMax || propagation || matureHeight || pruningNeeds) && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">🪴 Indoor Care</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {careLevel && <MiniCard label="Care Difficulty" value={careLevel} colorClass="bg-teal-50 border-teal-200" labelColor="text-teal-700" valueColor="text-teal-900" />}
                  {humidityPref && <MiniCard label="Humidity" value={humidityPref} colorClass="bg-cyan-50 border-cyan-200" labelColor="text-cyan-700" valueColor="text-cyan-900" />}
                  {tempMin && <MiniCard label="Min Temp" value={`${tempMin}°F`} colorClass="bg-blue-50 border-blue-200" labelColor="text-blue-700" valueColor="text-blue-900" />}
                  {tempMax && <MiniCard label="Max Temp" value={`${tempMax}°F`} colorClass="bg-red-50 border-red-200" labelColor="text-red-700" valueColor="text-red-900" />}
                  {matureHeight && <MiniCard label="Mature Height" value={matureHeight} colorClass="bg-lime-50 border-lime-200" labelColor="text-lime-700" valueColor="text-lime-900" />}
                  {propagation && <MiniCard label="Propagation" value={propagation} colorClass="bg-violet-50 border-violet-200" labelColor="text-violet-700" valueColor="text-violet-900" />}
                  {soilType && <MiniCard label="Soil Type" value={soilType} colorClass="bg-amber-50 border-amber-200" labelColor="text-amber-700" valueColor="text-amber-900" />}
                  {pruningNeeds && <MiniCard label="Pruning" value={pruningNeeds} colorClass="bg-green-50 border-green-200" labelColor="text-green-700" valueColor="text-green-900" />}
                </div>
              </div>
            )}

            {/* Pet safety */}
            {(petSafe !== undefined && petSafe !== null || toxicCats !== undefined || toxicDogs !== undefined) && (
              <div className={cn('p-3 rounded-xl border flex items-center gap-3',
                petSafe === true || petSafe === 'true' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
                {petSafe === true || petSafe === 'true'
                  ? <><CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" /><p className="text-sm text-emerald-800 font-medium">Pet Safe — non-toxic to cats & dogs</p></>
                  : <><XCircle className="w-5 h-5 text-red-600 flex-shrink-0" /><p className="text-sm text-red-800 font-medium">⚠️ Toxic{toxicCats ? ' to cats' : ''}{toxicDogs ? ' & dogs' : ''} — keep away from pets</p></>}
              </div>
            )}

            {/* Disease resistance */}
            {diseaseResistance && (
              <div className="p-4 bg-sky-50 rounded-lg border border-sky-200">
                <div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-sky-600" /><p className="font-semibold text-sky-900">Disease Resistance</p></div>
                <p className="text-sm text-sky-800">{diseaseResistance}</p>
              </div>
            )}

            {/* Pest & Disease */}
            {(commonPests || commonDiseases) && (
              <div className="grid sm:grid-cols-2 gap-3">
                {commonPests && <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-1 mb-1"><Bug className="w-3 h-3 text-orange-600" /><p className="text-xs font-semibold text-orange-700">Common Pests</p></div>
                  <p className="text-sm text-orange-900">{commonPests}</p></div>}
                {commonDiseases && <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs font-semibold text-red-700 mb-1">Common Diseases</p>
                  <p className="text-sm text-red-900">{commonDiseases}</p></div>}
              </div>
            )}

            {/* Traits pills */}
            {traits?.length > 0 && (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="font-semibold text-emerald-900 mb-3">✨ Variety Traits</p>
                <div className="flex flex-wrap gap-2">
                  {traits.map((t, i) => (
                    <span key={i} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-full">
                      {typeof t === 'string' ? t : t.name || t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Breeder / origin */}
            {breeder && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-1">🏅 Breeder / Origin</p>
                <p className="text-sm text-amber-900">{breeder}</p>
              </div>
            )}

            {/* Growing notes */}
            {growingNotes && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>📝 Growing Notes</p>
                <p className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{growingNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════ TAB: MY STASH ═══════════════ */}
      {activeTab === 'lot' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <CardTitle className="text-xl" style={{ color: 'var(--text-primary)' }}>🔒 My Stash Info</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowEditLot(true)}>
                <Edit className="w-4 h-4 mr-2" />Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <LotRow icon={Package} iconColor="text-emerald-600" label="Quantity">
                {seed.quantity && (
                  <Badge className="bg-emerald-600 text-white text-sm px-3 py-1">{seed.quantity} {seed.unit}</Badge>
                )}
              </LotRow>
              <LotRow icon={Calendar} iconColor="text-blue-600" label="Year Acquired" value={seed.year_acquired} />
              <LotRow icon={Calendar} iconColor="text-indigo-600" label="Packed For Year" value={seed.packed_for_year} />
              <LotRow icon={MapPin} iconColor="text-red-600" label="Storage Location" value={seed.storage_location} />
              {seed.storage_container && <LotRow icon={Package} iconColor="text-orange-600" label="Container" value={seed.storage_container} />}
              {seed.acquisition_source && <LotRow icon={Leaf} iconColor="text-violet-600" label="Acquisition" value={ACQ_LABELS[seed.acquisition_source] || seed.acquisition_source} />}
              {seed.acquired_from && <LotRow icon={Share2} iconColor="text-purple-600" label="Acquired From" value={seed.acquired_from} />}
              {seed.source_vendor_name && (
                <LotRow icon={ExternalLink} iconColor="text-blue-600" label="Vendor">
                  <div className="text-right">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{seed.source_vendor_name}</p>
                    {seed.source_vendor_url && (
                      <a href={seed.source_vendor_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                        Visit <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </LotRow>
              )}
              {seed.price_paid != null && <LotRow icon={Tag} iconColor="text-green-600" label="Price Paid" value={`$${seed.price_paid}`} />}
            </CardContent>
          </Card>

          <Card style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
            <CardHeader className="border-b"><CardTitle className="text-xl" style={{ color: 'var(--text-primary)' }}>📦 Availability & Tags</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-6">
              {seed.quantity_available_trade > 0 && (
                <LotRow icon={RefreshCw} iconColor="text-teal-600" label="Available to Trade">
                  <Badge className="bg-teal-100 text-teal-800">{seed.quantity_available_trade} {seed.unit}</Badge>
                </LotRow>
              )}
              {seed.quantity_available_sale > 0 && (
                <LotRow icon={Tag} iconColor="text-emerald-600" label="Available to Sell">
                  <Badge className="bg-emerald-100 text-emerald-800">{seed.quantity_available_sale} {seed.unit}</Badge>
                </LotRow>
              )}
              {seed.tags?.length > 0 && (
                <div className="py-3 px-4 rounded-xl border bg-white" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-sm font-medium text-gray-600 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {seed.tags.map((tag, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {seed.lot_notes && (
                <div className="py-3 px-4 rounded-xl border bg-white" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-sm font-medium text-gray-600 mb-1">My Notes</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{seed.lot_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════ TAB: GERMINATION ═══════════════ */}
      {activeTab === 'germination' && (
        <Card style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle className="text-xl" style={{ color: 'var(--text-primary)' }}>🧪 Germination Tracking</CardTitle>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" size="sm" onClick={() => setShowGermTest(true)}>
              <Plus className="w-4 h-4" /> Log Test
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {germRate != null ? (
              <div className="space-y-6">
                {/* Big rate display */}
                <div className={cn('p-8 rounded-2xl border text-center', germColor)}>
                  <Beaker className="w-10 h-10 mx-auto mb-3" />
                  <p className="text-6xl font-black mb-2">{germRate}%</p>
                  <p className="text-sm font-medium">Germination Rate</p>
                  {germRate >= 80 && <p className="text-xs mt-1">Excellent — seeds are viable and healthy</p>}
                  {germRate >= 60 && germRate < 80 && <p className="text-xs mt-1">Good — plant more densely to compensate</p>}
                  {germRate < 60 && <p className="text-xs mt-1">Poor — consider replacing or testing again</p>}
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border text-center">
                    <p className="text-2xl font-bold text-gray-900">{seed.germination_seeds_tested}</p>
                    <p className="text-xs text-gray-600">Seeds Tested</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                    <p className="text-2xl font-bold text-emerald-900">{seed.germination_seeds_germinated}</p>
                    <p className="text-xs text-emerald-700">Germinated</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border text-center">
                    <p className="text-lg font-bold text-gray-900">{seed.germination_test_date || '—'}</p>
                    <p className="text-xs text-gray-600">Test Date</p>
                  </div>
                </div>

                {seed.germination_notes && (
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Test Notes</p>
                    <p className="text-sm text-gray-600">{seed.germination_notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Beaker className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-700 mb-2">No Germination Test Yet</p>
                <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
                  Run a paper towel germination test to check seed viability, especially for older seeds.
                </p>
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => setShowGermTest(true)}>
                  <Plus className="w-4 h-4" /> Log Germination Test
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════ TAB: PHOTOS ═══════════════ */}
      {activeTab === 'photos' && (
        <Card style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <CardHeader className="border-b">
            <CardTitle className="text-xl" style={{ color: 'var(--text-primary)' }}>📷 My Seed Photos</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {seed.lot_images?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                {seed.lot_images.map((url, idx) => (
                  <div key={idx} className="relative group aspect-square">
                    <img src={url} alt="Variety photo" className="w-full h-full object-cover rounded-xl shadow-md" />
                    <Button variant="destructive" size="icon"
                      className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeletePhoto(url)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <span className="text-5xl block mb-3">📷</span>
                <p className="text-lg font-medium">No photos yet</p>
                <p className="text-sm">Add photos of your seeds, packets, or plants</p>
              </div>
            )}
            <button onClick={() => document.getElementById('photo-upload-tab').click()}
              className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 text-gray-500 hover:text-emerald-600">
              {uploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /><span className="font-medium">Add Photo</span></>}
            </button>
            <input id="photo-upload-tab" type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </CardContent>
        </Card>
      )}

      {/* ═══════════════ GERMINATION DIALOG ═══════════════ */}
      <Dialog open={showGermTest} onOpenChange={setShowGermTest}>
        <DialogContent>
          <DialogHeader><DialogTitle>🧪 Log Germination Test</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Dampen a paper towel, place seeds, fold, and check after 5–10 days. Count how many sprouted.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Seeds Tested</Label>
                <Input type="number" value={germForm.seeds_tested}
                  onChange={e => setGermForm({ ...germForm, seeds_tested: e.target.value })} className="mt-2" placeholder="e.g. 10" />
              </div>
              <div>
                <Label>Seeds Germinated</Label>
                <Input type="number" value={germForm.seeds_germinated}
                  onChange={e => setGermForm({ ...germForm, seeds_germinated: e.target.value })} className="mt-2" placeholder="e.g. 8" />
              </div>
            </div>
            {germForm.seeds_tested && germForm.seeds_germinated && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                <p className="text-2xl font-black text-emerald-800">
                  {Math.round((Number(germForm.seeds_germinated) / Number(germForm.seeds_tested)) * 100)}%
                </p>
                <p className="text-xs text-emerald-600">Germination Rate</p>
              </div>
            )}
            <div>
              <Label>Test Date</Label>
              <Input type="date" value={germForm.test_date}
                onChange={e => setGermForm({ ...germForm, test_date: e.target.value })} className="mt-2" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={germForm.notes} onChange={e => setGermForm({ ...germForm, notes: e.target.value })}
                placeholder="e.g. Tested after 7 days on damp paper towel, room temperature" className="mt-2" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGermTest(false)}>Cancel</Button>
            <Button onClick={handleGermTest} className="bg-emerald-600 hover:bg-emerald-700">Save Test Result</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ EDIT PROFILE DIALOG ═══════════════ */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Variety Attributes</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Days to Maturity (seed)</Label>
                <Input type="number" value={profileForm.days_to_maturity_seed || ''}
                  onChange={e => setProfileForm({ ...profileForm, days_to_maturity_seed: parseInt(e.target.value) || null })} className="mt-2" /></div>
              <div><Label>Days to Maturity (transplant)</Label>
                <Input type="number" value={profileForm.days_to_maturity_transplant || ''}
                  onChange={e => setProfileForm({ ...profileForm, days_to_maturity_transplant: parseInt(e.target.value) || null })} className="mt-2" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Spacing Min (inches)</Label>
                <Input type="number" value={profileForm.spacing_in_min || ''}
                  onChange={e => setProfileForm({ ...profileForm, spacing_in_min: parseInt(e.target.value) || null })} className="mt-2" /></div>
              <div><Label>Spacing Max (inches)</Label>
                <Input type="number" value={profileForm.spacing_in_max || ''}
                  onChange={e => setProfileForm({ ...profileForm, spacing_in_max: parseInt(e.target.value) || null })} className="mt-2" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Height Min (inches)</Label>
                <Input type="number" value={profileForm.height_in_min || ''}
                  onChange={e => setProfileForm({ ...profileForm, height_in_min: parseInt(e.target.value) || null })} className="mt-2" /></div>
              <div><Label>Height Max (inches)</Label>
                <Input type="number" value={profileForm.height_in_max || ''}
                  onChange={e => setProfileForm({ ...profileForm, height_in_max: parseInt(e.target.value) || null })} className="mt-2" /></div>
            </div>
            <div><Label>Sun Requirement</Label>
              <Select value={profileForm.sun_requirement || ''} onValueChange={v => setProfileForm({ ...profileForm, sun_requirement: v })}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Select sun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_sun">Full Sun</SelectItem>
                  <SelectItem value="partial_sun">Partial Sun</SelectItem>
                  <SelectItem value="partial_shade">Partial Shade</SelectItem>
                  <SelectItem value="full_shade">Full Shade</SelectItem>
                </SelectContent>
              </Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Scoville Min</Label>
                <Input type="number" value={profileForm.heat_scoville_min || ''}
                  onChange={e => setProfileForm({ ...profileForm, heat_scoville_min: parseInt(e.target.value) || null })} className="mt-2" /></div>
              <div><Label>Scoville Max</Label>
                <Input type="number" value={profileForm.heat_scoville_max || ''}
                  onChange={e => setProfileForm({ ...profileForm, heat_scoville_max: parseInt(e.target.value) || null })} className="mt-2" /></div>
            </div>
            <div className="flex gap-6">
              {[['container_friendly', 'Container Friendly'], ['trellis_required', 'Trellis Required'], ['perennial', 'Perennial']].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={profileForm[key] || false}
                    onChange={e => setProfileForm({ ...profileForm, [key]: e.target.checked })} className="rounded" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            <div><Label>Description</Label>
              <Textarea value={profileForm.description || ''} onChange={e => setProfileForm({ ...profileForm, description: e.target.value })}
                placeholder="Describe this variety..." className="mt-2" rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Flavor Profile</Label>
                <Input value={profileForm.flavor_profile || ''} onChange={e => setProfileForm({ ...profileForm, flavor_profile: e.target.value })}
                  placeholder="e.g. Sweet, tangy" className="mt-2" /></div>
              <div><Label>Fruit / Pod Color</Label>
                <Input value={profileForm.color_notes || ''} onChange={e => setProfileForm({ ...profileForm, color_notes: e.target.value })}
                  placeholder="e.g. Red, Green" className="mt-2" /></div>
            </div>
            <div><Label>Growing Notes</Label>
              <Textarea value={profileForm.notes_public || ''} onChange={e => setProfileForm({ ...profileForm, notes_public: e.target.value })}
                placeholder="Tips for growing..." className="mt-2" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProfile(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} className="bg-emerald-600 hover:bg-emerald-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ EDIT LOT DIALOG ═══════════════ */}
      <Dialog open={showEditLot} onOpenChange={setShowEditLot}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit My Stash Info</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantity</Label>
                <Input type="number" value={lotForm.quantity || ''}
                  onChange={e => setLotForm({ ...lotForm, quantity: parseInt(e.target.value) || null })} className="mt-2" /></div>
              <div><Label>Unit</Label>
                <Select value={lotForm.unit || 'seeds'} onValueChange={v => setLotForm({ ...lotForm, unit: v })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seeds">Seeds</SelectItem>
                    <SelectItem value="grams">Grams</SelectItem>
                    <SelectItem value="packets">Packets</SelectItem>
                    <SelectItem value="ounces">Ounces</SelectItem>
                  </SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Year Acquired</Label>
                <Input type="number" value={lotForm.year_acquired || ''}
                  onChange={e => setLotForm({ ...lotForm, year_acquired: parseInt(e.target.value) || null })} className="mt-2" /></div>
              <div><Label>Packed For Year</Label>
                <Input type="number" value={lotForm.packed_for_year || ''}
                  onChange={e => setLotForm({ ...lotForm, packed_for_year: parseInt(e.target.value) || null })} className="mt-2" /></div>
            </div>
            <div><Label>Acquisition Source</Label>
              <Select value={lotForm.acquisition_source || ''} onValueChange={v => setLotForm({ ...lotForm, acquisition_source: v })}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="How did you get these?" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACQ_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div><Label>Acquired From (person / org)</Label>
              <Input value={lotForm.acquired_from || ''} onChange={e => setLotForm({ ...lotForm, acquired_from: e.target.value })}
                placeholder="e.g. Grandma, Baker Creek Seed Swap" className="mt-2" /></div>
            <div><Label>Vendor / Source</Label>
              <Input value={lotForm.source_vendor_name || ''} onChange={e => setLotForm({ ...lotForm, source_vendor_name: e.target.value })} className="mt-2" /></div>
            <div><Label>Vendor URL</Label>
              <Input type="url" value={lotForm.source_vendor_url || ''} onChange={e => setLotForm({ ...lotForm, source_vendor_url: e.target.value })} className="mt-2" /></div>
            <div><Label>Price Paid ($)</Label>
              <Input type="number" step="0.01" value={lotForm.price_paid || ''}
                onChange={e => setLotForm({ ...lotForm, price_paid: parseFloat(e.target.value) || null })} className="mt-2" /></div>
            <div><Label>Storage Location</Label>
              <Input value={lotForm.storage_location || ''} onChange={e => setLotForm({ ...lotForm, storage_location: e.target.value })} className="mt-2" /></div>
            <div><Label>Storage Container</Label>
              <Input value={lotForm.storage_container || ''} onChange={e => setLotForm({ ...lotForm, storage_container: e.target.value })}
                placeholder="e.g. Red tin, Freezer bag" className="mt-2" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Available for Trade</Label>
                <Input type="number" value={lotForm.quantity_available_trade || ''}
                  onChange={e => setLotForm({ ...lotForm, quantity_available_trade: parseInt(e.target.value) || null })} placeholder="0" className="mt-2" /></div>
              <div><Label>Available for Sale</Label>
                <Input type="number" value={lotForm.quantity_available_sale || ''}
                  onChange={e => setLotForm({ ...lotForm, quantity_available_sale: parseInt(e.target.value) || null })} placeholder="0" className="mt-2" /></div>
            </div>
            <div><Label>Tags (comma separated)</Label>
              <Input value={Array.isArray(lotForm.tags) ? lotForm.tags.join(', ') : (lotForm.tags || '')}
                onChange={e => setLotForm({ ...lotForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                placeholder="e.g. favorite, rare, heirloom, must-grow" className="mt-2" /></div>
            <div><Label>Notes</Label>
              <Textarea value={lotForm.lot_notes || ''} onChange={e => setLotForm({ ...lotForm, lot_notes: e.target.value })} className="mt-2" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditLot(false)}>Cancel</Button>
            <Button onClick={handleSaveLot} className="bg-emerald-600 hover:bg-emerald-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
