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
  Share2
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
          
          // Fetch linked Variety data for rich catalog info
          if (prof.variety_id) {
            const varietyData = await smartQuery(base44, 'Variety', { id: prof.variety_id });
            if (varietyData.length > 0) {
              const varietyRecord = varietyData[0];
              setVariety(varietyRecord);
              console.debug('[SeedStashDetail] Variety loaded', { id: varietyRecord.id, name: varietyRecord.variety_name });
              
              // Fetch PlantType
              if (varietyRecord.plant_type_id) {
                const typeData = await smartQuery(base44, 'PlantType', { id: varietyRecord.plant_type_id });
                if (typeData.length > 0) {
                  setPlantType(typeData[0]);
                  console.debug('[SeedStashDetail] PlantType loaded', typeData[0].common_name);
                }
              }
              
              // Fetch SubCategory
              if (varietyRecord.plant_subcategory_id) {
                const subcatData = await smartQuery(base44, 'PlantSubCategory', { id: varietyRecord.plant_subcategory_id });
                if (subcatData.length > 0) {
                  setSubCategory(subcatData[0]);
                  console.debug('[SeedStashDetail] SubCategory loaded', subcatData[0].name);
                }
              }
            }
          } else if (prof.plant_type_id) {
            // Fallback: fetch PlantType directly from profile
            const typeData = await smartQuery(base44, 'PlantType', { id: prof.plant_type_id });
            if (typeData.length > 0) {
              setPlantType(typeData[0]);
              console.debug('[SeedStashDetail] PlantType loaded (fallback)', typeData[0].common_name);
            }
          }
        } else {
          console.warn('[SeedStashDetail] PlantProfile not found for id', seedLot.plant_profile_id);
        }
      } else {
        console.warn('[SeedStashDetail] No plant_profile_id on SeedLot', seedLot.id);
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

  const catalogData = variety || plantType || {};
  const hasRichData = variety || plantType;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {!hasRichData && seed && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This seed isn't linked to a catalog variety yet. You can still track it here, but catalog details are unavailable.
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
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
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
            <p className="text-gray-600 mt-1 text-lg">{profile.common_name}</p>
          )}
        </div>
        <div className="flex gap-2">
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
        {/* Catalog Data Section */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">
              📖 Variety Profile 
              {variety && <span className="text-sm font-normal text-gray-500 ml-2">(Catalog)</span>}
              {!variety && profile && <span className="text-sm font-normal text-gray-500 ml-2">(Custom)</span>}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowEditProfile(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Details
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasRichData ? (
              <>
              {/* Variety Info Banner */}
              {variety && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {variety.variety_name && (
                      <div>
                        <span className="text-emerald-700 font-medium">Variety:</span>
                        <span className="ml-2 text-emerald-900 font-semibold">{variety.variety_name}</span>
                      </div>
                    )}
                    {plantType?.common_name && (
                      <div>
                        <span className="text-emerald-700 font-medium">Type:</span>
                        <span className="ml-2 text-emerald-900">{plantType.common_name}</span>
                      </div>
                    )}
                    {subCategory?.name && (
                      <div>
                        <span className="text-emerald-700 font-medium">Category:</span>
                        <span className="ml-2 text-emerald-900">{subCategory.name}</span>
                      </div>
                    )}
                    {variety.seed_line_type && (
                      <div>
                        <span className="text-emerald-700 font-medium">Seed Type:</span>
                        <span className="ml-2 text-emerald-900 capitalize">{variety.seed_line_type.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Key Growing Stats - Hero Section */}
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                {(profile?.days_to_maturity_seed || variety?.days_to_maturity) && (
                  <div className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <Calendar className="w-6 h-6 text-blue-600 mb-2" />
                    <p className="text-xs text-blue-700 mb-1">Days to Maturity</p>
                    <p className="text-2xl font-bold text-blue-900">{profile?.days_to_maturity_seed || variety?.days_to_maturity}</p>
                  </div>
                )}
                {(profile?.sun_requirement || variety?.sun_requirement) && (
                  <div className="flex flex-col items-center p-4 bg-gradient-to-br from-yellow-50 to-amber-100 rounded-xl border border-yellow-200">
                    <Sun className="w-6 h-6 text-yellow-600 mb-2" />
                    <p className="text-xs text-yellow-700 mb-1">Sun Exposure</p>
                    <p className="text-sm font-bold text-yellow-900 capitalize">
                      {(profile?.sun_requirement || variety?.sun_requirement).replace(/_/g, ' ')}
                    </p>
                  </div>
                )}
                {(profile?.spacing_in_min || profile?.spacing_in_max || variety?.spacing_recommended) && (
                  <div className="flex flex-col items-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
                    <Ruler className="w-6 h-6 text-green-600 mb-2" />
                    <p className="text-xs text-green-700 mb-1">Spacing</p>
                    <p className="text-lg font-bold text-green-900">
                      {profile?.spacing_in_min && profile?.spacing_in_max
                        ? `${profile.spacing_in_min}-${profile.spacing_in_max}"`
                        : variety?.spacing_recommended 
                          ? `${variety.spacing_recommended}"`
                          : `${profile?.spacing_in_min || profile?.spacing_in_max}"`}
                    </p>
                  </div>
                )}
                {(profile?.water_requirement || variety?.water_requirement) && (
                  <div className="flex flex-col items-center p-4 bg-gradient-to-br from-cyan-50 to-blue-100 rounded-xl border border-cyan-200">
                    <Droplets className="w-6 h-6 text-cyan-600 mb-2" />
                    <p className="text-xs text-cyan-700 mb-1">Water Needs</p>
                    <p className="text-sm font-bold text-cyan-900 capitalize">
                      {profile?.water_requirement || variety?.water_requirement}
                    </p>
                  </div>
                )}
              </div>

              {/* Extended Variety Data from Catalog */}
              {variety && (
                <div className="space-y-4">
                  {variety.description && (
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <p className="font-semibold text-gray-900 mb-2">Description</p>
                      <p className="text-gray-700 leading-relaxed">{variety.description}</p>
                    </div>
                  )}
                  
                  {(variety.flavor_profile || variety.uses || variety.fruit_color || variety.growth_habit) && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {variety.flavor_profile && (
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-xs font-semibold text-purple-700 mb-1">Flavor</p>
                          <p className="text-sm text-purple-900">{variety.flavor_profile}</p>
                        </div>
                      )}
                      {variety.uses && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Uses</p>
                          <p className="text-sm text-blue-900">{variety.uses}</p>
                        </div>
                      )}
                      {variety.fruit_color && (
                        <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                          <p className="text-xs font-semibold text-pink-700 mb-1">Fruit Color</p>
                          <p className="text-sm text-pink-900">{variety.fruit_color}</p>
                        </div>
                      )}
                      {variety.growth_habit && (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-xs font-semibold text-green-700 mb-1">Growth Habit</p>
                          <p className="text-sm text-green-900 capitalize">{variety.growth_habit}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {variety.breeder_or_origin && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Breeder / Origin</p>
                      <p className="text-sm text-amber-900">{variety.breeder_or_origin}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Details */}
              {(profile?.height_in_min || profile?.height_in_max || variety?.scoville_min || variety?.scoville_max) && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {(profile?.height_in_min || profile?.height_in_max) && (
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-gray-600" />
                        <p className="font-semibold text-gray-900">Plant Height</p>
                      </div>
                      <p className="text-lg text-gray-700">
                        {profile.height_in_min && profile.height_in_max
                          ? `${profile.height_in_min}-${profile.height_in_max} inches`
                          : `${profile.height_in_min || profile.height_in_max} inches`}
                      </p>
                    </div>
                  )}
                  {(variety?.scoville_min || variety?.scoville_max) && (
                    <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-2xl">🌶️</div>
                        <p className="font-semibold text-red-900">Heat Level</p>
                      </div>
                      <p className="text-lg font-bold text-red-700">
                        {variety.scoville_min && variety.scoville_max
                          ? `${variety.scoville_min.toLocaleString()}-${variety.scoville_max.toLocaleString()}`
                          : (variety.scoville_min || variety.scoville_max).toLocaleString()} SHU
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Growing Characteristics */}
              {(profile?.container_friendly || profile?.trellis_required || profile?.perennial || variety?.container_friendly || variety?.trellis_required) && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Growing Characteristics</p>
                  <div className="flex flex-wrap gap-2">
                    {(profile?.container_friendly || variety?.container_friendly) && (
                      <Badge className="bg-blue-100 text-blue-800 px-3 py-1">📦 Container Friendly</Badge>
                    )}
                    {(profile?.trellis_required || variety?.trellis_required) && (
                      <Badge className="bg-green-100 text-green-800 px-3 py-1">🌿 Needs Trellis</Badge>
                    )}
                    {(profile?.perennial || plantType?.is_perennial) && (
                      <Badge className="bg-purple-100 text-purple-800 px-3 py-1">🔄 Perennial</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Traits */}
              {((profile?.traits && Array.isArray(profile.traits) && profile.traits.length > 0) || variety?.traits) && (
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="font-semibold text-emerald-900 mb-3">Variety Traits</p>
                  <div className="flex flex-wrap gap-2">
                    {(profile?.traits || []).map((trait, idx) => (
                      <Badge key={idx} className="bg-emerald-600 text-white px-3 py-1">
                        {typeof trait === 'string' ? trait : trait.name || trait}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Growing Notes */}
              {(profile?.notes_public || variety?.grower_notes) && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="font-semibold text-gray-900 mb-2">Growing Notes</p>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{profile?.notes_public || variety?.grower_notes}</p>
                </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-900 mb-2">
                  This is a custom variety without catalog data. Add details using "Edit Details" above.
                </p>
                <div className="text-xs text-yellow-700 space-y-1">
                  <p>• Add description, days to maturity, spacing, etc.</p>
                  <p>• Your edits are private to your stash</p>
                  <p>• You can suggest this variety to the public catalog later</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lot Details Card */}
        <Card className="bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle className="text-xl">🔒 My Stash Info <span className="text-sm font-normal text-gray-500">(Private to me)</span></CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowEditLot(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {seed.quantity && (
              <div className="flex items-center justify-between py-3 px-4 bg-white rounded-lg border">
                <span className="text-gray-700 font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  Quantity
                </span>
                <Badge className="bg-emerald-600 text-white text-sm px-3 py-1">
                  {seed.quantity} {seed.unit}
                </Badge>
              </div>
            )}
            {seed.year_acquired && (
              <div className="flex items-center justify-between py-3 px-4 bg-white rounded-lg border">
                <span className="text-gray-700 font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Year Acquired
                </span>
                <span className="font-semibold text-gray-900">{seed.year_acquired}</span>
              </div>
            )}
            {seed.packed_for_year && (
              <div className="flex items-center justify-between py-3 px-4 bg-white rounded-lg border">
                <span className="text-gray-700 font-medium">Packed For</span>
                <span className="font-semibold text-gray-900">{seed.packed_for_year}</span>
              </div>
            )}
            {seed.source_vendor_name && (
              <div className="flex flex-col gap-2 py-3 px-4 bg-white rounded-lg border">
                <span className="text-gray-700 font-medium">Vendor</span>
                <div>
                  <p className="font-semibold text-gray-900">{seed.source_vendor_name}</p>
                  {seed.source_vendor_url && (
                    <a 
                      href={seed.source_vendor_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      Visit website <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            {seed.storage_location && (
              <div className="flex items-center justify-between py-3 px-4 bg-white rounded-lg border">
                <span className="text-gray-700 font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-600" />
                  Storage Location
                </span>
                <span className="font-semibold text-gray-900">{seed.storage_location}</span>
              </div>
            )}
            {age > 0 && (
              <div className="flex items-center justify-between py-3 px-4 bg-white rounded-lg border">
                <span className="text-gray-700 font-medium">Seed Age</span>
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
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📝 My Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{seed.lot_notes}</p>
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
                  value={profileForm.fruit_color || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, fruit_color: e.target.value })}
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