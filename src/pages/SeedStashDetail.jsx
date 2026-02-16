import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  Calendar,
  MapPin,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Star,
  Sun,
  Ruler,
  Plus,
  TrendingUp,
  Droplets,
  Share2,
  Sprout,
  Clock,
  Scissors,
  Leaf
} from 'lucide-react';
import SuggestVarietyButton from '@/components/seedstash/SuggestVarietyButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ShareButton from '@/components/common/ShareButton';
import { smartQuery } from '@/components/utils/smartQuery';

/* ═══════════════════════════════════════════════════════════════
   HELPER: Resolve a field from profile first, then variety fallback
   This is the KEY change — profile data is always the primary source.
   ═══════════════════════════════════════════════════════════════ */
function resolve(profile, variety, ...keys) {
  for (const k of keys) {
    if (profile?.[k] != null && profile[k] !== '') return profile[k];
    if (variety?.[k] != null && variety[k] !== '') return variety[k];
  }
  return null;
}

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
  
  console.debug('[SeedStashDetail] Component mounted, seedId=', seedId);
  const [settings, setSettings] = useState({ aging_threshold_years: 2, old_threshold_years: 3 });
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditLot, setShowEditLot] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [lotForm, setLotForm] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (seedId) {
      loadSeed();
    } else {
      setNotFound(true);
      setLoading(false);
    }
  }, [seedId]);

  const loadSeed = async () => {
    try {
      const user = await base44.auth.me();
      const [seedData, userSettings] = await Promise.all([
        base44.entities.SeedLot.filter({ 
          id: seedId,
          created_by: user.email 
        }),
        base44.entities.UserSettings.filter({ created_by: user.email })
      ]);

      if (seedData.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (userSettings.length > 0 && userSettings[0].aging_threshold_years) {
        setSettings({
          aging_threshold_years: userSettings[0].aging_threshold_years,
          old_threshold_years: userSettings[0].old_threshold_years || 3
        });
      }

      const seedLot = seedData[0];
      setSeed(seedLot);
      setLotForm(seedLot);
      
      console.debug('[SeedStashDetail] SeedLot loaded', { 
        id: seedLot.id,
        plant_profile_id: seedLot.plant_profile_id,
        from_catalog: seedLot.from_catalog
      });

      if (seedLot.plant_profile_id) {
        const profileData = await smartQuery(base44, 'PlantProfile', { id: seedLot.plant_profile_id });
        if (profileData.length > 0) {
          const prof = profileData[0];
          setProfile(prof);
          setProfileForm(prof);
          
          console.debug('[SeedStashDetail] PlantProfile loaded', { 
            id: prof.id,
            variety_id: prof.variety_id,
            plant_type_id: prof.plant_type_id
          });
          
          if (prof.variety_id) {
            const varietyData = await smartQuery(base44, 'Variety', { id: prof.variety_id });
            if (varietyData.length > 0) {
              const varietyRecord = varietyData[0];
              setVariety(varietyRecord);
              
              if (varietyRecord.plant_type_id) {
                const typeData = await smartQuery(base44, 'PlantType', { id: varietyRecord.plant_type_id });
                if (typeData.length > 0) setPlantType(typeData[0]);
              }
              
              if (varietyRecord.plant_subcategory_id) {
                const subcatData = await smartQuery(base44, 'PlantSubCategory', { id: varietyRecord.plant_subcategory_id });
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
    const currentYear = new Date().getFullYear();
    const year = seed.packed_for_year || seed.year_acquired;
    return year ? currentYear - year : 0;
  };

  const getAgeStatus = () => {
    const age = getAge();
    if (age >= settings.old_threshold_years) return { status: 'OLD', color: 'red', icon: Star };
    if (age >= settings.aging_threshold_years) return { status: 'AGING', color: 'amber', icon: AlertTriangle };
    return { status: 'OK', color: 'green', icon: null };
  };

  const handleSaveProfile = async () => {
    try {
      await base44.entities.PlantProfile.update(profile.id, profileForm);
      setProfile(profileForm);
      setShowEditProfile(false);
      toast.success('Variety attributes updated');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update attributes');
    }
  };

  const handleSaveLot = async () => {
    try {
      await base44.entities.SeedLot.update(seed.id, lotForm);
      setSeed(lotForm);
      setShowEditLot(false);
      toast.success('Lot info updated');
    } catch (error) {
      console.error('Error updating lot:', error);
      toast.error('Failed to update lot');
    }
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
      setLotForm({ ...lotForm, lot_images: updatedImages });
      toast.success('Photo added');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoUrl) => {
    try {
      const updatedImages = seed.lot_images.filter(url => url !== photoUrl);
      await base44.entities.SeedLot.update(seed.id, { lot_images: updatedImages });
      setSeed({ ...seed, lot_images: updatedImages });
      setLotForm({ ...lotForm, lot_images: updatedImages });
      toast.success('Photo removed');
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${profile?.variety_name || seed?.custom_label}"?`)) return;
    
    try {
      await base44.entities.SeedLot.delete(seed.id);
      toast.success('Seed deleted');
      window.location.href = createPageUrl('SeedStash');
    } catch (error) {
      console.error('Error deleting seed:', error);
      toast.error('Failed to delete seed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (notFound || !seed) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Seed Not Found</h2>
            <p className="text-gray-600 mb-6">This seed doesn't exist or you don't have access to it.</p>
            <Link to={createPageUrl('SeedStash')}>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                Back to Seed Stash
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ageStatus = getAgeStatus();
  const age = getAge();

  /* ═══════════════════════════════════════════════════════════════
     KEY FIX: Resolve display data from profile FIRST, variety second.
     This means imported CSV data shows up even without catalog link.
     ═══════════════════════════════════════════════════════════════ */
  const r = (key) => resolve(profile, variety, key);
  const isFromCatalog = !!variety;
  
  // Resolved display values — profile takes priority
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
  const podSize = r('pod_size');
  const growthHabit = r('growth_habit');
  const uses = resolve(variety, profile, 'uses');
  const breeder = r('breeder') || r('breeder_or_origin');
  const countryOfOrigin = r('country_of_origin');
  const scovilleMin = r('heat_scoville_min') || r('scoville_min');
  const scovilleMax = r('heat_scoville_max') || r('scoville_max');
  const containerFriendly = r('container_friendly');
  const trellisRequired = r('trellis_required');
  const perennial = r('perennial') || plantType?.is_perennial;
  const growingNotes = r('notes_public') || resolve(variety, null, 'grower_notes');
  const seedLineType = resolve(variety, profile, 'seed_line_type');
  const startIndoorsWeeks = r('start_indoors_weeks_before_last_frost_min') || r('start_indoors_weeks');
  const transplantMin = r('transplant_weeks_after_last_frost_min');
  const transplantMax = r('transplant_weeks_after_last_frost_max');
  const directSowMin = r('direct_sow_weeks_relative_to_last_frost_min');
  const directSowMax = r('direct_sow_weeks_relative_to_last_frost_max');
  const tomatoSize = r('tomato_size');
  const tomatoColor = r('tomato_color');
  const plantGrowth = r('plant_growth');
  const leafChar = r('leaf_characteristics');
  const diseaseResistance = resolve(variety, profile, 'disease_resistance');
  const traits = profile?.traits || (variety?.traits ? (typeof variety.traits === 'string' ? variety.traits.split(',').map(t => t.trim()) : variety.traits) : null);

  // ★ FIX: hasRichData is true if PROFILE has any data — not just catalog
  const hasAnyDisplayData = !!(
    daysToMaturity || sunReq || waterReq || spacingMin || spacingMax || spacingRec ||
    description || flavorProfile || fruitColor || growthHabit || scovilleMin || scovilleMax ||
    heightMin || heightMax || breeder || countryOfOrigin || startIndoorsWeeks ||
    containerFriendly || trellisRequired || perennial
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Only show "not linked" notice if profile truly has NO data */}
      {!hasAnyDisplayData && !isFromCatalog && seed && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This seed doesn't have variety details yet. Use "Edit Details" to add description, maturity, spacing, etc.
          </p>
        </div>
      )}
      
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('SeedStash')}>
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Seed Stash
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {profile?.variety_name || seed.custom_label || 'Unknown Seed'}
            </h1>
            {ageStatus.status !== 'OK' && (
              <Badge variant="outline" className={cn(
                ageStatus.status === 'AGING' && "border-amber-500 text-amber-700 bg-amber-50",
                ageStatus.status === 'OLD' && "border-red-500 text-red-700 bg-red-50"
              )}>
                {ageStatus.icon && <ageStatus.icon className="w-4 h-4 mr-1" />}
                {ageStatus.status} ({age} years)
              </Badge>
            )}
          </div>
          {profile?.common_name && (
            <p className="mt-1 text-lg" style={{ color: 'var(--text-secondary)' }}>{profile.common_name}</p>
          )}
          {/* Tag badges row */}
          <div className="flex flex-wrap gap-2 mt-2">
            {isFromCatalog && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">📚 Catalog Linked</Badge>
            )}
            {!isFromCatalog && profile && (
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">📝 Custom / Imported</Badge>
            )}
            {seedLineType && (
              <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 capitalize">
                {seedLineType === 'open_pollinated' ? '🌿 Open-Pollinated' : seedLineType === 'hybrid' ? '🔬 Hybrid (F1)' : `🌱 ${seedLineType.replace(/_/g, ' ')}`}
              </Badge>
            )}
            {scovilleMax && parseInt(scovilleMax) > 100000 && (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">🔥 Extreme Heat</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {variety && (
            <Link to={createPageUrl('ViewVariety') + `?id=${variety.id}`}>
              <Button variant="outline" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                View in Catalog
              </Button>
            </Link>
          )}
          {profile && (
            <>
              <ShareButton
                title={`${profile.variety_name} - Seed Stash`}
                text={`Check out this ${profile.common_name} variety!`}
                url={`${window.location.origin}${createPageUrl('PublicSeed')}?id=${seed.id}`}
                imageUrl={seed.lot_images?.[0]}
              />
              {!seed.from_catalog && (
                <SuggestVarietyButton profile={profile} seedLot={seed} />
              )}
            </>
          )}
          <Button 
            variant="outline" 
            onClick={handleDelete}
            className="gap-2 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Photo Gallery */}
      {seed.lot_images && seed.lot_images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {seed.lot_images.map((url, idx) => (
            <div key={idx} className="relative group aspect-square">
              <img 
                src={url} 
                alt="Variety photo" 
                className="w-full h-full object-cover rounded-xl shadow-md"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDeletePhoto(url)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <button
            onClick={() => document.getElementById('photo-upload-main').click()}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-emerald-600"
          >
            {uploadingPhoto ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <Plus className="w-8 h-8" />
                <span className="text-sm font-medium">Add Photo</span>
              </>
            )}
          </button>
          <input
            id="photo-upload-main"
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ═══════════════════════════════════════════════
            LEFT: Variety Profile — ALWAYS shows rich data
            ═══════════════════════════════════════════════ */}
        <Card 
          className="lg:col-span-2 hover:shadow-lg transition-all duration-300"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)'
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl" style={{ color: 'var(--text-primary)' }}>
              📖 Variety Profile 
              {isFromCatalog && <span className="text-sm font-normal text-gray-500 ml-2">(Catalog)</span>}
              {!isFromCatalog && profile && <span className="text-sm font-normal text-gray-500 ml-2">(Custom)</span>}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowEditProfile(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Details
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasAnyDisplayData ? (
              <>
                {/* Variety Info Banner */}
                {(variety || plantType || subCategory || seedLineType || profile?.common_name) && (
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 rounded-lg border border-emerald-200 dark:border-emerald-700/50">
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      {(variety?.variety_name || profile?.variety_name) && (
                        <div>
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Variety:</span>
                          <span className="ml-2 text-emerald-900 dark:text-emerald-200 font-semibold">{variety?.variety_name || profile?.variety_name}</span>
                        </div>
                      )}
                      {(plantType?.common_name || profile?.common_name) && (
                        <div>
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Type:</span>
                          <span className="ml-2 text-emerald-900 dark:text-emerald-200">{plantType?.common_name || profile?.common_name}</span>
                        </div>
                      )}
                      {subCategory?.name && (
                        <div>
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Category:</span>
                          <span className="ml-2 text-emerald-900 dark:text-emerald-200">{subCategory.name}</span>
                        </div>
                      )}
                      {seedLineType && (
                        <div>
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Seed Type:</span>
                          <span className="ml-2 text-emerald-900 dark:text-emerald-200 capitalize">{seedLineType.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              
                {/* Key Growing Stats — Hero Cards */}
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {daysToMaturity && (
                    <div className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl border border-blue-200 dark:border-blue-700/50">
                      <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
                      <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">Days to Maturity</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{daysToMaturity}</p>
                    </div>
                  )}
                  {sunReq && (
                    <div className="flex flex-col items-center p-4 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-800/30 rounded-xl border border-yellow-200 dark:border-yellow-700/50">
                      <Sun className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mb-2" />
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-1">Sun Exposure</p>
                      <p className="text-sm font-bold text-yellow-900 dark:text-yellow-200 capitalize">
                        {sunReq.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                  {(spacingMin || spacingMax || spacingRec) && (
                    <div className="flex flex-col items-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-800/30 rounded-xl border border-green-200 dark:border-green-700/50">
                      <Ruler className="w-6 h-6 text-green-600 dark:text-green-400 mb-2" />
                      <p className="text-xs text-green-700 dark:text-green-400 mb-1">Spacing</p>
                      <p className="text-lg font-bold text-green-900 dark:text-green-200">
                        {spacingMin && spacingMax
                          ? `${spacingMin}-${spacingMax}"`
                          : spacingRec 
                            ? `${spacingRec}"`
                            : `${spacingMin || spacingMax}"`}
                      </p>
                    </div>
                  )}
                  {waterReq && (
                    <div className="flex flex-col items-center p-4 bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-cyan-900/30 dark:to-blue-800/30 rounded-xl border border-cyan-200 dark:border-cyan-700/50">
                      <Droplets className="w-6 h-6 text-cyan-600 dark:text-cyan-400 mb-2" />
                      <p className="text-xs text-cyan-700 dark:text-cyan-400 mb-1">Water Needs</p>
                      <p className="text-sm font-bold text-cyan-900 dark:text-cyan-200 capitalize">
                        {waterReq}
                      </p>
                    </div>
                  )}
                </div>

                {/* Growth Habit + Plant Growth + Leaf Characteristics */}
                {(growthHabit || plantGrowth || leafChar) && (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {growthHabit && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700/50">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Growth Habit</p>
                        <p className="text-sm font-medium text-green-900 dark:text-green-300 capitalize">{growthHabit}</p>
                      </div>
                    )}
                    {plantGrowth && (
                      <div className="p-3 bg-lime-50 dark:bg-lime-900/20 rounded-lg border border-lime-200 dark:border-lime-700/50">
                        <p className="text-xs font-semibold text-lime-700 dark:text-lime-400 mb-1">Plant Growth</p>
                        <p className="text-sm font-medium text-lime-900 dark:text-lime-300 capitalize">{plantGrowth}</p>
                      </div>
                    )}
                    {leafChar && (
                      <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-700/50">
                        <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 mb-1">Leaf Type</p>
                        <p className="text-sm font-medium text-teal-900 dark:text-teal-300 capitalize">{leafChar}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Scoville / Heat Level */}
                {(scovilleMin || scovilleMax) && (
                  <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 rounded-xl border border-red-200 dark:border-red-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-2xl">🌶️</div>
                      <p className="font-semibold text-red-900 dark:text-red-200">Heat Level</p>
                    </div>
                    <p className="text-lg font-bold text-red-700 dark:text-red-400">
                      {scovilleMin && scovilleMax
                        ? `${Number(scovilleMin).toLocaleString()}-${Number(scovilleMax).toLocaleString()}`
                        : Number(scovilleMin || scovilleMax).toLocaleString()} SHU
                    </p>
                  </div>
                )}

                {/* Planting Timeline */}
                {(startIndoorsWeeks || transplantMin || directSowMin) && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    {startIndoorsWeeks && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700/50">
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Start Indoors</p>
                        <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">{startIndoorsWeeks} weeks before frost</p>
                      </div>
                    )}
                    {(transplantMin || transplantMax) && (
                      <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-700/50">
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1">Transplant</p>
                        <p className="text-sm font-medium text-violet-900 dark:text-violet-300">
                          {transplantMin && transplantMax ? `${transplantMin}-${transplantMax}` : transplantMin || transplantMax} weeks after frost
                        </p>
                      </div>
                    )}
                    {(directSowMin || directSowMax) && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Direct Sow</p>
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                          {directSowMin && directSowMax ? `${directSowMin}-${directSowMax}` : directSowMin || directSowMax} weeks after frost
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                {description && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border dark:border-gray-700/50">
                    <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Description</p>
                    <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
                  </div>
                )}
                
                {/* Flavor / Uses / Color / Fruit details */}
                {(flavorProfile || uses || fruitColor || fruitShape || fruitSize || tomatoSize || tomatoColor || podColor || podShape || podSize) && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {flavorProfile && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700/50">
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1">Flavor</p>
                        <p className="text-sm text-purple-900 dark:text-purple-300 capitalize">{flavorProfile}</p>
                      </div>
                    )}
                    {uses && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700/50">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Uses</p>
                        <p className="text-sm text-blue-900 dark:text-blue-300">{uses}</p>
                      </div>
                    )}
                    {(fruitColor || tomatoColor) && (
                      <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-700/50">
                        <p className="text-xs font-semibold text-pink-700 dark:text-pink-400 mb-1">Fruit/Pod Color</p>
                        <p className="text-sm text-pink-900 dark:text-pink-300 capitalize">{fruitColor || tomatoColor}</p>
                      </div>
                    )}
                    {(fruitShape || podShape) && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700/50">
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1">Shape</p>
                        <p className="text-sm text-orange-900 dark:text-orange-300 capitalize">{fruitShape || podShape}</p>
                      </div>
                    )}
                    {(fruitSize || tomatoSize || podSize) && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-700/50">
                        <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">Size</p>
                        <p className="text-sm text-rose-900 dark:text-rose-300 capitalize">{fruitSize || tomatoSize || podSize}</p>
                      </div>
                    )}
                    {(podColor && podColor !== fruitColor) && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700/50">
                        <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Pod Color</p>
                        <p className="text-sm text-red-900 dark:text-red-300 capitalize">{podColor}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Plant Height */}
                {(heightMin || heightMax) && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border dark:border-gray-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Plant Height</p>
                    </div>
                    <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                      {heightMin && heightMax
                        ? `${heightMin}-${heightMax} inches`
                        : `${heightMin || heightMax} inches`}
                    </p>
                  </div>
                )}

                {/* Breeder / Origin */}
                {(breeder || countryOfOrigin) && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Breeder / Origin</p>
                    <p className="text-sm text-amber-900 dark:text-amber-300">
                      {[breeder, countryOfOrigin].filter(Boolean).join(' — ')}
                    </p>
                  </div>
                )}

                {/* Disease Resistance */}
                {diseaseResistance && (
                  <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-700/50">
                    <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 mb-1">Disease Resistance</p>
                    <p className="text-sm text-sky-900 dark:text-sky-300">{diseaseResistance}</p>
                  </div>
                )}

                {/* Growing Characteristics Badges */}
                {(containerFriendly || trellisRequired || perennial) && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Growing Characteristics</p>
                    <div className="flex flex-wrap gap-2">
                      {containerFriendly && (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1">📦 Container Friendly</Badge>
                      )}
                      {trellisRequired && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-3 py-1">🌿 Needs Trellis</Badge>
                      )}
                      {perennial && (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 px-3 py-1">🔄 Perennial</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Traits */}
                {traits && Array.isArray(traits) && traits.length > 0 && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-700/50">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200 mb-3">Variety Traits</p>
                    <div className="flex flex-wrap gap-2">
                      {traits.map((trait, idx) => (
                        <Badge key={idx} className="bg-emerald-600 text-white px-3 py-1">
                          {typeof trait === 'string' ? trait : trait.name || trait}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Growing Notes */}
                {growingNotes && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border dark:border-gray-700/50">
                    <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Growing Notes</p>
                    <p className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{growingNotes}</p>
                  </div>
                )}
              </>
            ) : (
              /* Only shown when profile has truly NO displayable data */
              <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                <Sprout className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-yellow-900 mb-2">
                  No variety details yet
                </p>
                <p className="text-xs text-yellow-700 mb-4">
                  Add description, days to maturity, spacing, and more using the Edit button above.
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowEditProfile(true)} className="gap-2">
                  <Edit className="w-4 h-4" /> Add Details
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════
            RIGHT: Lot Details Card (unchanged logic)
            ═══════════════════════════════════════════════ */}
        <Card 
          className="hover:shadow-lg transition-all duration-300"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)'
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle className="text-xl" style={{ color: 'var(--text-primary)' }}>🔒 My Stash Info <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>(Private to me)</span></CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowEditLot(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {seed.quantity && (
              <div className="flex items-center justify-between py-3 px-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <span className="font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Package className="w-4 h-4 text-emerald-600" />
                  Quantity
                </span>
                <Badge className="bg-emerald-600 text-white text-sm px-3 py-1">
                  {seed.quantity} {seed.unit}
                </Badge>
              </div>
            )}
            {seed.year_acquired && (
              <div className="flex items-center justify-between py-3 px-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <span className="font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Year Acquired
                </span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{seed.year_acquired}</span>
              </div>
            )}
            {seed.packed_for_year && (
              <div className="flex items-center justify-between py-3 px-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Packed For</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{seed.packed_for_year}</span>
              </div>
            )}
            {seed.source_vendor_name && (
              <div className="flex flex-col gap-2 py-3 px-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Vendor</span>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{seed.source_vendor_name}</p>
                  {seed.source_vendor_url && (
                    <a 
                      href={seed.source_vendor_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      Visit website <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            {seed.storage_location && (
              <div className="flex items-center justify-between py-3 px-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <span className="font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <MapPin className="w-4 h-4 text-red-600" />
                  Storage Location
                </span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{seed.storage_location}</span>
              </div>
            )}
            {age > 0 && (
              <div className="flex items-center justify-between py-3 px-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Seed Age</span>
                <Badge className={cn(
                  "px-3 py-1 text-sm",
                  ageStatus.status === 'OK' && "bg-green-100 text-green-800",
                  ageStatus.status === 'AGING' && "bg-amber-100 text-amber-800",
                  ageStatus.status === 'OLD' && "bg-red-100 text-red-800"
                )}>
                  {ageStatus.icon && <ageStatus.icon className="w-4 h-4 mr-1" />}
                  {age} year{age !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {seed.lot_notes && (
        <Card 
          className="lg:col-span-3 hover:shadow-lg transition-all duration-300"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)'
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              📝 My Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{seed.lot_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Variety Attributes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Days to Maturity (seed)</Label>
                <Input
                  type="number"
                  value={profileForm.days_to_maturity_seed || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, days_to_maturity_seed: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Days to Maturity (transplant)</Label>
                <Input
                  type="number"
                  value={profileForm.days_to_maturity_transplant || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, days_to_maturity_transplant: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Spacing Min (inches)</Label>
                <Input
                  type="number"
                  value={profileForm.spacing_in_min || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, spacing_in_min: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Spacing Max (inches)</Label>
                <Input
                  type="number"
                  value={profileForm.spacing_in_max || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, spacing_in_max: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Height Min (inches)</Label>
                <Input
                  type="number"
                  value={profileForm.height_in_min || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, height_in_min: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Height Max (inches)</Label>
                <Input
                  type="number"
                  value={profileForm.height_in_max || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, height_in_max: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Sun Requirement</Label>
              <Select 
                value={profileForm.sun_requirement || ''} 
                onValueChange={(v) => setProfileForm({ ...profileForm, sun_requirement: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select sun exposure" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_sun">Full Sun</SelectItem>
                  <SelectItem value="partial_sun">Partial Sun</SelectItem>
                  <SelectItem value="partial_shade">Partial Shade</SelectItem>
                  <SelectItem value="full_shade">Full Shade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profileForm.container_friendly || false}
                  onChange={(e) => setProfileForm({ ...profileForm, container_friendly: e.target.checked })}
                  className="rounded"
                />
                <span>Container Friendly</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profileForm.trellis_required || false}
                  onChange={(e) => setProfileForm({ ...profileForm, trellis_required: e.target.checked })}
                  className="rounded"
                />
                <span>Trellis Required</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profileForm.perennial || false}
                  onChange={(e) => setProfileForm({ ...profileForm, perennial: e.target.checked })}
                  className="rounded"
                />
                <span>Perennial</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Scoville Min (peppers)</Label>
                <Input
                  type="number"
                  value={profileForm.heat_scoville_min || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, heat_scoville_min: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Scoville Max</Label>
                <Input
                  type="number"
                  value={profileForm.heat_scoville_max || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, heat_scoville_max: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={profileForm.description || ''}
                onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                placeholder="Describe this variety..."
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Flavor Profile</Label>
                <Input
                  value={profileForm.flavor_profile || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, flavor_profile: e.target.value })}
                  placeholder="e.g., Sweet, tangy"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Fruit/Pod Color</Label>
                <Input
                  value={profileForm.color_notes || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, color_notes: e.target.value })}
                  placeholder="e.g., Red, Green"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Growing Notes</Label>
              <Textarea
                value={profileForm.notes_public || ''}
                onChange={(e) => setProfileForm({ ...profileForm, notes_public: e.target.value })}
                placeholder="Tips for growing this variety..."
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProfile(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} className="bg-emerald-600 hover:bg-emerald-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lot Dialog */}
      <Dialog open={showEditLot} onOpenChange={setShowEditLot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stash Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={lotForm.quantity || ''}
                  onChange={(e) => setLotForm({ ...lotForm, quantity: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select 
                  value={lotForm.unit || 'seeds'} 
                  onValueChange={(v) => setLotForm({ ...lotForm, unit: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seeds">Seeds</SelectItem>
                    <SelectItem value="grams">Grams</SelectItem>
                    <SelectItem value="packets">Packets</SelectItem>
                    <SelectItem value="ounces">Ounces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Year Acquired</Label>
                <Input
                  type="number"
                  value={lotForm.year_acquired || ''}
                  onChange={(e) => setLotForm({ ...lotForm, year_acquired: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Packed For Year</Label>
                <Input
                  type="number"
                  value={lotForm.packed_for_year || ''}
                  onChange={(e) => setLotForm({ ...lotForm, packed_for_year: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Vendor/Source</Label>
              <Input
                value={lotForm.source_vendor_name || ''}
                onChange={(e) => setLotForm({ ...lotForm, source_vendor_name: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Vendor URL</Label>
              <Input
                type="url"
                value={lotForm.source_vendor_url || ''}
                onChange={(e) => setLotForm({ ...lotForm, source_vendor_url: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Storage Location</Label>
              <Input
                value={lotForm.storage_location || ''}
                onChange={(e) => setLotForm({ ...lotForm, storage_location: e.target.value })}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Available for Trade</Label>
                <Input
                  type="number"
                  value={lotForm.quantity_available_trade || ''}
                  onChange={(e) => setLotForm({ ...lotForm, quantity_available_trade: parseInt(e.target.value) || null })}
                  placeholder="0"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Available for Sale</Label>
                <Input
                  type="number"
                  value={lotForm.quantity_available_sale || ''}
                  onChange={(e) => setLotForm({ ...lotForm, quantity_available_sale: parseInt(e.target.value) || null })}
                  placeholder="0"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={lotForm.lot_notes || ''}
                onChange={(e) => setLotForm({ ...lotForm, lot_notes: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>

            <div>
              <Label>Photos</Label>
              <div className="mt-2 space-y-2">
                {seed.lot_images?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {seed.lot_images.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="Seed lot" className="w-full h-24 object-cover rounded-lg" />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeletePhoto(url);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingPhoto}
                  onClick={() => document.getElementById('photo-upload').click()}
                  className="w-full"
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Photo
                </Button>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditLot(false)}>Cancel</Button>
            <Button onClick={handleSaveLot} className="bg-emerald-600 hover:bg-emerald-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
