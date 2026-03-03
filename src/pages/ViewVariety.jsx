import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, ExternalLink, Loader2, Edit, Package, Plus, Sprout, Sun, Calendar,
  Ruler, Droplets, TrendingUp, ThermometerSun, Bug, Leaf, Scissors, Wind,
  ChevronDown, ChevronUp, Beaker, Shield, Star, FlowerIcon, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import AddToStashModal from '@/components/catalog/AddToStashModal';
import ReviewSection from '@/components/variety/ReviewSection';
import SpecialCareWarnings from '@/components/indoor/SpecialCareWarnings';

/* ── helpers ─────────────────────────────────────────────── */
function val(v, ...keys) {
  for (const k of keys) {
    if (v?.[k] != null && v[k] !== '' && v[k] !== false) return v[k];
  }
  return null;
}

function ColourBadge({ color = 'emerald', icon, children }) {
  const map = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    blue:    'bg-blue-100 text-blue-800 border-blue-200',
    purple:  'bg-purple-100 text-purple-800 border-purple-200',
    amber:   'bg-amber-100 text-amber-800 border-amber-200',
    rose:    'bg-rose-100 text-rose-800 border-rose-200',
    cyan:    'bg-cyan-100 text-cyan-800 border-cyan-200',
    violet:  'bg-violet-100 text-violet-800 border-violet-200',
    orange:  'bg-orange-100 text-orange-800 border-orange-200',
    lime:    'bg-lime-100 text-lime-800 border-lime-200',
    red:     'bg-red-100 text-red-800 border-red-200',
    gray:    'bg-gray-100 text-gray-700 border-gray-200',
    teal:    'bg-teal-100 text-teal-800 border-teal-200',
    pink:    'bg-pink-100 text-pink-800 border-pink-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${map[color] || map.gray}`}>
      {icon && <span>{icon}</span>}
      {children}
    </span>
  );
}

function InfoTile({ icon: Icon, label, value, colorClass = 'from-slate-50 to-slate-100 border-slate-200', iconColor = 'text-slate-500', textColor = 'text-slate-900', small = false }) {
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
  if (!value) return null;
  return (
    <div className={`p-3 rounded-lg border ${colorClass}`}>
      <p className={`text-xs font-semibold ${labelColor} mb-1`}>{label}</p>
      <p className={`text-sm ${valueColor} capitalize`}>{value}</p>
    </div>
  );
}

export default function ViewVariety() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const varietyId = searchParams.get('id');

  const [variety, setVariety] = useState(null);
  const [plantType, setPlantType] = useState(null);
  const [subCategories, setSubCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequestChange, setShowRequestChange] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);
  const [showAddToStash, setShowAddToStash] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageOwnership, setImageOwnership] = useState(false);
  const [showAllDetails, setShowAllDetails] = useState(false);

  useEffect(() => { if (varietyId) loadData(); }, [varietyId]);

  const loadData = async () => {
    try {
      const [userData, varietyData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Variety.filter({ id: varietyId })
      ]);
      setUser(userData);
      if (varietyData.length === 0) { setLoading(false); return; }
      const v = varietyData[0];
      if (v.status === 'removed' && v.extended_data?.merged_into_variety_id) {
        window.location.href = createPageUrl('ViewVariety') + `?id=${v.extended_data.merged_into_variety_id}`;
        return;
      }
      setVariety(v);
      if (v.plant_type_id) {
        const types = await base44.entities.PlantType.filter({ id: v.plant_type_id });
        if (types.length > 0) setPlantType(types[0]);
      }
      const allSubcatIds = v.plant_subcategory_ids || (v.plant_subcategory_id ? [v.plant_subcategory_id] : []);
      if (allSubcatIds.length > 0) {
        const subcats = await base44.entities.PlantSubCategory.list();
        setSubCategories(subcats.filter(s => allSubcatIds.includes(s.id)));
      }
    } catch (error) {
      console.error('Error loading variety:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChange = async () => {
    if (!requestReason.trim()) { toast.error('Please provide a reason for this change request'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      await base44.entities.VarietyChangeRequest.create({
        variety_id: varietyId, requested_changes: { note: 'User requested edit access' },
        reason: requestReason, submitted_by: user.email, status: 'pending'
      });
      toast.success('Change request submitted for review');
      setShowRequestChange(false);
      setRequestReason('');
    } catch (error) { toast.error('Failed to submit request'); }
    finally { setSubmitting(false); }
  };

  const handleImageUpload = (e) => { const file = e.target.files?.[0]; if (file) setImageFile(file); };

  const handleSubmitImage = async () => {
    if (!imageFile || !imageOwnership) { toast.error('Please upload an image and confirm ownership'); return; }
    if (uploadingImage) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
      await base44.entities.VarietyChangeRequest.create({
        variety_id: varietyId, requested_changes: { images: [file_url] },
        reason: 'User submitted image for variety', submitted_by: user.email, status: 'pending'
      });
      toast.success('Image submitted for review');
      setShowAddImage(false);
      setImageFile(null);
      setImageOwnership(false);
    } catch (error) { toast.error('Failed to submit image'); }
    finally { setUploadingImage(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  if (!varietyId || !variety) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Variety Not Found</h2>
        <Link to={createPageUrl('PlantCatalog')}><Button>Back to Plant Catalog</Button></Link>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const v = variety;

  /* ── derived display values ─────────────────────────────── */
  const dtm = v.days_to_maturity
    || (v.days_to_maturity_min && v.days_to_maturity_max ? `${v.days_to_maturity_min}–${v.days_to_maturity_max}` : v.days_to_maturity_min);
  const spacing = v.spacing_recommended
    || (v.spacing_min && v.spacing_max ? `${v.spacing_min}–${v.spacing_max}"` : v.spacing_min ? `${v.spacing_min}"` : null);
  const height = v.plant_height_typical
    || (v.height_min && v.height_max ? `${v.height_min}–${v.height_max}"` : v.height_min ? `${v.height_min}"` : null);
  const traitsArr = v.traits
    ? (Array.isArray(v.traits) ? v.traits : String(v.traits).split(',').map(t => t.trim()).filter(Boolean))
    : [];

  // Extended data from JSON blob
  const ext = v.extended_data || {};
  const careLevel = ext.care_difficulty || ext.care_level;
  const commonPests = ext.common_pests || v.common_pests;
  const commonDiseases = ext.common_diseases || v.common_diseases;
  const toxicCats = ext.toxic_to_cats ?? v.toxic_to_cats;
  const toxicDogs = ext.toxic_to_dogs ?? v.toxic_to_dogs;
  const petSafe = ext.pet_safe ?? v.pet_safe;
  const growthSpeed = ext.growth_speed || v.growth_speed;
  const fragrant = ext.fragrant ?? v.fragrant;
  const airPurifying = ext.air_purifying ?? v.air_purifying;
  const propagationMethods = ext.propagation_methods || v.propagation_methods;
  const dormancyRequired = ext.dormancy_required || v.dormancy_required;
  const winterDormancy = ext.winter_dormancy || v.winter_dormancy;
  const soilType = ext.soil_type_recommended || v.soil_type_recommended;
  const humidityPref = ext.humidity_preference || v.humidity_preference;
  const tempMinF = ext.temp_min_f || v.temp_min_f;
  const tempMaxF = ext.temp_max_f || v.temp_max_f;
  const fertFreq = ext.fertilizer_frequency || v.fertilizer_frequency;
  const droughtTol = ext.drought_tolerant || v.drought_tolerant;
  const pruningNeeds = ext.pruning_needs || v.pruning_needs;
  const matureHeight = ext.mature_indoor_height || v.mature_indoor_height;
  const matureWidth = ext.mature_indoor_width || v.mature_indoor_width;
  const lightReq = ext.light_requirement_indoor || v.light_requirement_indoor;

  const hasIndoorData = !!(careLevel || commonPests || toxicCats !== undefined || tempMinF || humidityPref || propagationMethods || matureHeight);
  const hasExtendedData = !!(v.disease_resistance || v.synonyms || v.source_attribution || commonDiseases || soilType || fertFreq || droughtTol !== undefined);

  // Seed type label
  const seedTypeLabelMap = {
    open_pollinated: { label: '🌿 Open-Pollinated', color: 'emerald' },
    hybrid: { label: '🔬 Hybrid (F1)', color: 'blue' },
    heirloom: { label: '🏺 Heirloom', color: 'amber' },
    f1: { label: '🔬 F1 Hybrid', color: 'blue' },
  };
  const seedTypeInfo = seedTypeLabelMap[v.seed_line_type?.toLowerCase()] || (v.seed_line_type ? { label: v.seed_line_type, color: 'gray' } : null);

  const allSubcatIds = v.plant_subcategory_ids || (v.plant_subcategory_id ? [v.plant_subcategory_id] : []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to={createPageUrl('PlantCatalogDetail') + `?id=${v.plant_type_id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{v.variety_name}</h1>
            {v.popularity_tier === 'high' && <ColourBadge color="amber" icon="⭐">Popular</ColourBadge>}
            {v.status === 'active' && <ColourBadge color="emerald" icon="✓">Verified</ColourBadge>}
          </div>
          <p className="text-gray-600 text-lg">{plantType?.common_name || v.plant_type_name}</p>
          {v.synonyms && <p className="text-sm text-gray-400 italic">Also known as: {v.synonyms}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowAddToStash(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Package className="w-4 h-4" /> Add to Stash
          </Button>
          <Button onClick={() => navigate(createPageUrl('AddIndoorPlant') + `?varietyId=${varietyId}`)} className="bg-purple-600 hover:bg-purple-700 gap-2">
            <Sprout className="w-4 h-4" /> Add Indoor Plant
          </Button>
          <Button variant="outline" onClick={() => setShowAddImage(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Image
          </Button>
          {isAdmin ? (
            <Link to={createPageUrl('EditVariety') + `?id=${varietyId}`}>
              <Button variant="outline" className="gap-2"><Edit className="w-4 h-4" /> Edit</Button>
            </Link>
          ) : (
            <Button variant="outline" onClick={() => setShowRequestChange(true)} className="gap-2">
              <Edit className="w-4 h-4" /> Request Change
            </Button>
          )}
        </div>
      </div>

      {/* ── Images ── */}
      {v.images?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {v.images.map((url, idx) => (
            <img key={idx} src={url} alt={`${v.variety_name} ${idx + 1}`} loading="lazy"
              className="w-full aspect-square object-cover rounded-xl shadow-md"
              onError={(e) => { e.target.style.display = 'none'; }} />
          ))}
        </div>
      )}

      {/* ── Special Care Warnings ── */}
      <SpecialCareWarnings variety={v} />

      {/* ── Key Trait Badges (unified, NO duplicate container_friendly) ── */}
      <div className="flex flex-wrap gap-2">
        {seedTypeInfo && <ColourBadge color={seedTypeInfo.color}>{seedTypeInfo.label}</ColourBadge>}
        {v.season_timing && (
          <ColourBadge color="orange" icon="🗓️">
            {v.season_timing.charAt(0).toUpperCase() + v.season_timing.slice(1)} Season
          </ColourBadge>
        )}
        {v.species && <ColourBadge color="teal" icon="🔬">{v.species}</ColourBadge>}
        {v.container_friendly && <ColourBadge color="blue" icon="📦">Container Friendly</ColourBadge>}
        {v.trellis_required && <ColourBadge color="lime" icon="🌿">Needs Trellis</ColourBadge>}
        {(v.is_ornamental === true || v.is_ornamental === 'true') && <ColourBadge color="pink" icon="🌸">Ornamental</ColourBadge>}
        {(v.is_organic === true || v.is_organic === 'true') && <ColourBadge color="emerald" icon="🌱">Organic</ColourBadge>}
        {plantType?.is_perennial && <ColourBadge color="purple" icon="🔄">Perennial</ColourBadge>}
        {petSafe === true || petSafe === 'true' ? <ColourBadge color="emerald" icon="🐾">Pet Safe</ColourBadge>
          : (toxicCats || toxicDogs) ? <ColourBadge color="red" icon="⚠️">Toxic to Pets</ColourBadge> : null}
        {airPurifying === true || airPurifying === 'true' ? <ColourBadge color="cyan" icon="💨">Air Purifying</ColourBadge> : null}
        {fragrant === true || fragrant === 'true' ? <ColourBadge color="violet" icon="🌺">Fragrant</ColourBadge> : null}
        {droughtTol === true || droughtTol === 'true' ? <ColourBadge color="amber" icon="☀️">Drought Tolerant</ColourBadge> : null}
        {careLevel && (
          <ColourBadge color={careLevel === 'easy' ? 'emerald' : careLevel === 'moderate' ? 'amber' : 'red'} icon="🌿">
            {careLevel.charAt(0).toUpperCase() + careLevel.slice(1)} Care
          </ColourBadge>
        )}
      </div>

      {/* ── Buy Seeds Banner ── */}
      {v.affiliate_url && (
        <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Buy Seeds</p>
                  <p className="text-sm text-emerald-700">Get this variety from our trusted partner</p>
                </div>
              </div>
              <a href={v.affiliate_url} target="_blank" rel="noopener noreferrer">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <ExternalLink className="w-4 h-4 mr-2" /> Buy Now
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Variety Profile Card ── */}
      <Card>
        <CardHeader><CardTitle className="text-xl">📖 Variety Profile</CardTitle></CardHeader>
        <CardContent className="space-y-6">

          {/* Description */}
          {v.description && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <p className="text-gray-700 leading-relaxed">{v.description}</p>
            </div>
          )}

          {/* Hero stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoTile icon={Calendar} label="Days to Maturity" value={dtm}
              colorClass="from-blue-50 to-blue-100 border-blue-200" iconColor="text-blue-600" textColor="text-blue-900" />
            <InfoTile icon={Sun} label="Sun Exposure" value={v.sun_requirement?.replace(/_/g, ' ')}
              colorClass="from-yellow-50 to-amber-100 border-yellow-200" iconColor="text-yellow-600" textColor="text-yellow-900" small />
            <InfoTile icon={Ruler} label="Spacing" value={spacing}
              colorClass="from-green-50 to-emerald-100 border-green-200" iconColor="text-green-600" textColor="text-green-900" />
            <InfoTile icon={Droplets} label="Water Needs" value={v.water_requirement}
              colorClass="from-cyan-50 to-blue-100 border-cyan-200" iconColor="text-cyan-600" textColor="text-cyan-900" small />
          </div>

          {/* Second row tiles — height, maturity, sow, temp */}
          {(height || v.start_indoors_weeks || v.direct_sow_weeks_min || growthSpeed || tempMinF) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {height && (
                <InfoTile icon={TrendingUp} label="Plant Height" value={height}
                  colorClass="from-slate-50 to-gray-100 border-slate-200" iconColor="text-slate-500" textColor="text-slate-800" small />
              )}
              {v.start_indoors_weeks && (
                <InfoTile icon={Sprout} label="Start Indoors" value={`${v.start_indoors_weeks}wk before frost`}
                  colorClass="from-indigo-50 to-indigo-100 border-indigo-200" iconColor="text-indigo-600" textColor="text-indigo-900" small />
              )}
              {v.direct_sow_weeks_min != null && (
                <InfoTile icon={Leaf} label="Direct Sow" value={`${v.direct_sow_weeks_min}wk after frost`}
                  colorClass="from-lime-50 to-lime-100 border-lime-200" iconColor="text-lime-600" textColor="text-lime-900" small />
              )}
              {growthSpeed && (
                <InfoTile icon={TrendingUp} label="Growth Speed" value={growthSpeed}
                  colorClass="from-violet-50 to-violet-100 border-violet-200" iconColor="text-violet-600" textColor="text-violet-900" small />
              )}
            </div>
          )}

          {/* Indoor plant temp range */}
          {(tempMinF || tempMaxF) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {tempMinF && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Min Temperature</p>
                  <p className="text-lg font-bold text-blue-900">{tempMinF}°F</p>
                </div>
              )}
              {tempMaxF && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs font-semibold text-red-700 mb-1">Max Temperature</p>
                  <p className="text-lg font-bold text-red-900">{tempMaxF}°F</p>
                </div>
              )}
            </div>
          )}

          {/* Heat Level */}
          {(v.scoville_min || v.scoville_max) && (
            <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🌶️</span>
                <p className="font-semibold text-red-900">Heat Level</p>
              </div>
              <p className="text-lg font-bold text-red-700">
                {v.scoville_min && v.scoville_max
                  ? `${Number(v.scoville_min).toLocaleString()}–${Number(v.scoville_max).toLocaleString()}`
                  : Number(v.scoville_min || v.scoville_max).toLocaleString()} SHU
              </p>
            </div>
          )}

          {/* Flavor / Uses / Fruit attributes */}
          {(v.flavor_profile || v.uses || v.fruit_color || v.fruit_shape || v.fruit_size ||
            v.pod_color || v.pod_shape || v.pod_size || v.growth_habit) && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">🍅 Flavor & Characteristics</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <MiniCard label="Flavor" value={v.flavor_profile}
                  colorClass="bg-purple-50 border-purple-200" labelColor="text-purple-700" valueColor="text-purple-900" />
                <MiniCard label="Uses" value={v.uses}
                  colorClass="bg-blue-50 border-blue-200" labelColor="text-blue-700" valueColor="text-blue-900" />
                <MiniCard label="Fruit / Pod Color" value={v.fruit_color || v.pod_color}
                  colorClass="bg-pink-50 border-pink-200" labelColor="text-pink-700" valueColor="text-pink-900" />
                <MiniCard label="Shape" value={v.fruit_shape || v.pod_shape}
                  colorClass="bg-orange-50 border-orange-200" labelColor="text-orange-700" valueColor="text-orange-900" />
                <MiniCard label="Size" value={v.fruit_size || v.pod_size}
                  colorClass="bg-rose-50 border-rose-200" labelColor="text-rose-700" valueColor="text-rose-900" />
                <MiniCard label="Growth Habit" value={v.growth_habit}
                  colorClass="bg-green-50 border-green-200" labelColor="text-green-700" valueColor="text-green-900" />
              </div>
            </div>
          )}

          {/* Indoor plant specifics */}
          {hasIndoorData && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">🪴 Indoor Plant Details</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {matureHeight && (
                  <MiniCard label="Mature Height" value={matureHeight}
                    colorClass="bg-teal-50 border-teal-200" labelColor="text-teal-700" valueColor="text-teal-900" />
                )}
                {matureWidth && (
                  <MiniCard label="Mature Width" value={matureWidth}
                    colorClass="bg-teal-50 border-teal-200" labelColor="text-teal-700" valueColor="text-teal-900" />
                )}
                {humidityPref && (
                  <MiniCard label="Humidity" value={humidityPref}
                    colorClass="bg-cyan-50 border-cyan-200" labelColor="text-cyan-700" valueColor="text-cyan-900" />
                )}
                {lightReq && (
                  <MiniCard label="Indoor Light" value={lightReq}
                    colorClass="bg-yellow-50 border-yellow-200" labelColor="text-yellow-700" valueColor="text-yellow-900" />
                )}
                {soilType && (
                  <MiniCard label="Soil Type" value={soilType}
                    colorClass="bg-amber-50 border-amber-200" labelColor="text-amber-700" valueColor="text-amber-900" />
                )}
                {fertFreq && (
                  <MiniCard label="Fertilizer Frequency" value={fertFreq}
                    colorClass="bg-lime-50 border-lime-200" labelColor="text-lime-700" valueColor="text-lime-900" />
                )}
                {pruningNeeds && (
                  <MiniCard label="Pruning" value={pruningNeeds}
                    colorClass="bg-green-50 border-green-200" labelColor="text-green-700" valueColor="text-green-900" />
                )}
                {propagationMethods && (
                  <MiniCard label="Propagation" value={propagationMethods}
                    colorClass="bg-violet-50 border-violet-200" labelColor="text-violet-700" valueColor="text-violet-900" />
                )}
              </div>
            </div>
          )}

          {/* Breeder / Origin */}
          {v.breeder_or_origin && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 mb-1">🏅 Breeder / Origin</p>
              <p className="text-sm text-amber-900">{v.breeder_or_origin}</p>
            </div>
          )}

          {/* Disease Resistance */}
          {v.disease_resistance && (
            <div className="p-4 bg-sky-50 rounded-lg border border-sky-200">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-sky-600" />
                <p className="font-semibold text-sky-900">Disease Resistance</p>
              </div>
              <p className="text-sm text-sky-800">{v.disease_resistance}</p>
            </div>
          )}

          {/* Traits */}
          {traitsArr.length > 0 && (
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="font-semibold text-emerald-900 mb-3">✨ Variety Traits</p>
              <div className="flex flex-wrap gap-2">
                {traitsArr.map((trait, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-sm">
                    {typeof trait === 'string' ? trait : trait.name || trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pest & Disease warnings (indoor) */}
          {(commonPests || commonDiseases) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {commonPests && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Bug className="w-3 h-3 text-orange-600" />
                    <p className="text-xs font-semibold text-orange-700">Common Pests</p>
                  </div>
                  <p className="text-sm text-orange-900">{commonPests}</p>
                </div>
              )}
              {commonDiseases && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Shield className="w-3 h-3 text-red-600" />
                    <p className="text-xs font-semibold text-red-700">Common Diseases</p>
                  </div>
                  <p className="text-sm text-red-900">{commonDiseases}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes sections */}
          {(v.grower_notes || v.notes_public) && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <p className="font-semibold text-gray-900 mb-2">📝 Grower Notes</p>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{v.grower_notes || v.notes_public}</p>
            </div>
          )}
          {v.seed_saving_notes && (
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="font-semibold text-emerald-900 mb-2">🌱 Seed Saving Notes</p>
              <p className="text-emerald-800">{v.seed_saving_notes}</p>
            </div>
          )}
          {v.pollination_notes && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-900 mb-2">🐝 Pollination Notes</p>
              <p className="text-blue-800">{v.pollination_notes}</p>
            </div>
          )}

          {/* Transplant details */}
          {(v.transplant_weeks_after_last_frost_min != null) && (
            <div className="grid sm:grid-cols-2 gap-3">
              <MiniCard label="Transplant After Frost"
                value={v.transplant_weeks_after_last_frost_min != null && v.transplant_weeks_after_last_frost_max != null
                  ? `${v.transplant_weeks_after_last_frost_min}–${v.transplant_weeks_after_last_frost_max} weeks`
                  : `${v.transplant_weeks_after_last_frost_min} weeks`}
                colorClass="bg-gray-50 border-gray-200" labelColor="text-gray-600" valueColor="text-gray-900" />
            </div>
          )}

          {/* Dormancy info for tropicals/houseplants */}
          {(dormancyRequired || winterDormancy) && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-1">💤 Dormancy</p>
              <p className="text-sm text-slate-900">
                {dormancyRequired === 'true' || dormancyRequired === true ? 'Dormancy required' : ''}
                {winterDormancy ? (winterDormancy === 'true' || winterDormancy === true ? ' • Winter dormancy expected' : '') : ''}
              </p>
            </div>
          )}

          {/* Show More toggle for any remaining extended data */}
          {hasExtendedData && !showAllDetails && (
            <button
              onClick={() => setShowAllDetails(true)}
              className="w-full py-2 text-sm text-emerald-600 font-medium flex items-center justify-center gap-1 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <ChevronDown className="w-4 h-4" /> Show more details
            </button>
          )}

          {/* Extended details section */}
          {showAllDetails && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-semibold text-gray-700">Additional Information</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {soilType && (
                  <MiniCard label="Soil Type" value={soilType}
                    colorClass="bg-amber-50 border-amber-200" labelColor="text-amber-700" valueColor="text-amber-900" />
                )}
                {droughtTol !== null && droughtTol !== undefined && (
                  <MiniCard label="Drought Tolerant" value={droughtTol === true || droughtTol === 'true' ? 'Yes' : 'No'}
                    colorClass="bg-orange-50 border-orange-200" labelColor="text-orange-700" valueColor="text-orange-900" />
                )}
                {v.source_attribution && (
                  <div className="col-span-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Source / Attribution</p>
                    <p className="text-sm text-gray-800">{v.source_attribution}</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowAllDetails(false)}
                className="w-full py-2 text-sm text-gray-500 flex items-center justify-center gap-1 hover:bg-gray-50 rounded-lg"
              >
                <ChevronUp className="w-4 h-4" /> Show less
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Additional Info Card ── */}
      <Card>
        <CardHeader><CardTitle className="text-xl">Additional Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {allSubcatIds.length > 0 && (
            <div>
              <Label className="text-sm text-gray-600 font-semibold">Categories</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allSubcatIds.map(subcatId => {
                  const subcat = subCategories.find(s => s.id === subcatId);
                  return subcat ? (
                    <Badge key={subcatId} variant="secondary" className="px-3 py-1">
                      {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                      {subcat.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}
          {v.sources?.length > 0 && (
            <div>
              <Label className="text-sm text-gray-600 font-semibold">Seed Sources</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {v.sources.map((source, idx) => (
                  <Badge key={idx} variant="outline" className="px-3 py-1">{source}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Reviews ── */}
      <Card>
        <CardHeader><CardTitle className="text-xl">⭐ Community Reviews</CardTitle></CardHeader>
        <CardContent>
          <ReviewSection varietyId={varietyId} plantProfileId={v.plant_profile_id} />
        </CardContent>
      </Card>

      {/* ── Dialogs ── */}
      <Dialog open={showRequestChange} onOpenChange={setShowRequestChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Change to {v.variety_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Describe what changes you'd like to make. An admin or moderator will review your request.</p>
            <div>
              <Label>Reason for Change</Label>
              <Textarea placeholder="e.g., I have grown this variety and found the days to maturity to be incorrect..."
                value={requestReason} onChange={(e) => setRequestReason(e.target.value)} className="mt-2" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestChange(false)}>Cancel</Button>
            <Button onClick={handleRequestChange} disabled={!requestReason.trim() || submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddImage} onOpenChange={setShowAddImage}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Image to {v.variety_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Upload a photo. Images are reviewed before being added.</p>
            <div>
              <Label>Upload Image</Label>
              <div className="mt-2">
                {imageFile ? (
                  <div className="relative">
                    <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => setImageFile(null)}>
                      <Plus className="w-4 h-4 rotate-45" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => document.getElementById('variety-image-upload').click()} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Select Image
                  </Button>
                )}
                <input id="variety-image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="imageOwnership" checked={imageOwnership} onCheckedChange={setImageOwnership} />
              <Label htmlFor="imageOwnership" className="text-sm font-normal">This image is my own and I have the right to share it</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddImage(false); setImageFile(null); setImageOwnership(false); }}>Cancel</Button>
            <Button onClick={handleSubmitImage} disabled={!imageFile || !imageOwnership || uploadingImage} className="bg-emerald-600 hover:bg-emerald-700">
              {uploadingImage && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Submit Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddToStashModal open={showAddToStash} onOpenChange={setShowAddToStash} variety={v} plantType={plantType} />
    </div>
  );
}
