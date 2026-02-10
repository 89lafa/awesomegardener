import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Droplets, Sprout, RotateCw, Camera, Edit, MoreVertical,
  Loader2, Scissors, FileText, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CareGuideSection, { CareGuideRow } from '@/components/indoor/CareGuideSection';
import EnvironmentTab from '@/components/indoor/EnvironmentTab';
import PlantStatsTab from '@/components/indoor/PlantStatsTab';

export default function IndoorPlantDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plantId = searchParams.get('id');
  
  const [plant, setPlant] = useState(null);
  const [variety, setVariety] = useState(null);
  const [space, setSpace] = useState(null);
  const [tier, setTier] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logType, setLogType] = useState('note');
  const [logNotes, setLogNotes] = useState('');
  const [editData, setEditData] = useState({});
  const [varieties, setVarieties] = useState([]);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    if (plantId) {
      loadData();
    }
  }, [plantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const plantData = await base44.entities.IndoorPlant.filter({ id: plantId });
      if (plantData.length === 0) {
        toast.error('Plant not found');
        navigate(createPageUrl('MyIndoorPlants'));
        return;
      }

      const p = plantData[0];
      setPlant(p);

      const [varietyData, spaceData, tierData, logsData] = await Promise.all([
        p.variety_id ? base44.entities.Variety.filter({ id: p.variety_id }) : Promise.resolve([]),
        p.indoor_space_id ? base44.entities.IndoorSpace.filter({ id: p.indoor_space_id }) : Promise.resolve([]),
        p.tier_id ? base44.entities.IndoorSpaceTier.filter({ id: p.tier_id }) : Promise.resolve([]),
        base44.entities.IndoorPlantLog.filter({ indoor_plant_id: plantId }, '-log_date', 50)
      ]);

      if (varietyData.length > 0) setVariety(varietyData[0]);
      if (spaceData.length > 0) setSpace(spaceData[0]);
      if (tierData.length > 0) setTier(tierData[0]);
      setLogs(logsData);
      
      // Load indoor plant varieties
      const indoorVarieties = await base44.entities.Variety.filter(
        { 
          $or: [
            { care_difficulty: { $in: ['beginner', 'easy', 'moderate'] } },
            { light_requirement_indoor: { $exists: true } }
          ]
        },
        'variety_name',
        300
      );
      setVarieties(indoorVarieties);

      setEditData({
        nickname: p.nickname || '',
        variety_id: p.variety_id || '',
        health_status: p.health_status || 'healthy',
        special_notes: p.special_notes || ''
      });
    } catch (error) {
      console.error('Error loading plant:', error);
      toast.error('Failed to load plant');
    } finally {
      setLoading(false);
    }
  };

  const logCare = async (type, notes = '') => {
    try {
      await base44.entities.IndoorPlantLog.create({
        indoor_plant_id: plantId,
        log_type: type,
        log_date: new Date().toISOString(),
        notes: notes || undefined
      });

      const updates = {};
      if (type === 'watered') {
        updates.last_watered_date = new Date().toISOString();
      } else if (type === 'fertilized') {
        updates.last_fertilized_date = new Date().toISOString();
      } else if (type === 'rotated') {
        updates.last_rotated_date = new Date().toISOString();
      } else if (type === 'pruned') {
        updates.last_pruned_date = new Date().toISOString();
      }

      if (Object.keys(updates).length > 0) {
        await base44.entities.IndoorPlant.update(plantId, updates);
      }

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} logged!`);
      loadData();
    } catch (error) {
      console.error('Error logging care:', error);
      toast.error('Failed to log care');
    }
  };

  const handleCustomLog = async () => {
    await logCare(logType, logNotes);
    setShowLogModal(false);
    setLogNotes('');
  };

  const handleSaveEdit = async () => {
    try {
      await base44.entities.IndoorPlant.update(plantId, {
        nickname: editData.nickname || null,
        variety_id: editData.variety_id || null,
        health_status: editData.health_status || null,
        special_notes: editData.special_notes || null
      });
      toast.success('Plant updated!');
      setShowEditModal(false);
      loadData();
    } catch (error) {
      console.error('Error updating plant:', error);
      toast.error('Failed to update plant');
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    try {
      const uploadedUrls = [];
      
      for (let i = 0; i < Math.min(files.length, 3); i++) {
        const file = files[i];
        const result = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(result.file_url);
      }

      if (!plant.primary_photo_url && uploadedUrls.length > 0) {
        await base44.entities.IndoorPlant.update(plantId, {
          primary_photo_url: uploadedUrls[0]
        });
      }

      for (const url of uploadedUrls) {
        await base44.entities.IndoorPlantLog.create({
          indoor_plant_id: plantId,
          log_type: 'photo',
          log_date: new Date().toISOString(),
          photos: [url]
        });
      }

      toast.success(`${uploadedUrls.length} photo(s) uploaded!`);
      loadData();
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Failed to upload photos');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const days = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getNextDate = (lastDate, frequencyDays) => {
    if (!lastDate || !frequencyDays) return 'Not scheduled';
    const next = new Date(lastDate);
    next.setDate(next.getDate() + frequencyDays);
    const daysUntil = Math.ceil((next - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return 'Overdue';
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    return `in ${daysUntil} days`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!plant) return null;

  const daysSinceWatered = plant.last_watered_date 
    ? Math.floor((new Date() - new Date(plant.last_watered_date)) / (1000 * 60 * 60 * 24))
    : null;

  const ageInDays = Math.floor((new Date() - new Date(plant.acquisition_date)) / (1000 * 60 * 60 * 24));
  const years = Math.floor(ageInDays / 365);
  const months = Math.floor((ageInDays % 365) / 30);
  let ageDisplay = '';
  if (years > 0) ageDisplay += `${years}y `;
  if (months > 0 || years === 0) ageDisplay += `${months}m`;

  const isToxic = variety?.toxic_to_cats || variety?.toxic_to_dogs || variety?.toxic_to_humans;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('MyIndoorPlants'))}>
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowEditModal(true)}>
            <Edit className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Enhanced Plant Header */}
      <Card>
        <CardContent className="p-6 bg-gradient-to-br from-emerald-50 to-green-100">
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="w-48 h-48 bg-white rounded-lg shadow-md flex items-center justify-center overflow-hidden">
                {plant.primary_photo_url ? (
                  <img src={plant.primary_photo_url} className="w-full h-full object-cover" alt={plant.nickname} />
                ) : (
                  <div className="text-7xl">🌿</div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                className="w-full mt-2" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Add Photo
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-1">
                {plant.nickname ? `${variety?.variety_name || 'Plant'} "${plant.nickname}"` : (variety?.variety_name || 'Unnamed Plant')}
              </h1>
              {variety?.scientific_name && (
                <p className="text-sm text-gray-600 italic mb-2">{variety.scientific_name}</p>
              )}

              <div className="space-y-1.5 text-sm mb-4">
                {(space || tier) && (
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span>{space?.name}{tier ? ` · ${tier.label || `Tier ${tier.tier_number}`}` : ''}</span>
                  </div>
                )}

                {(space?.avg_temperature_f || space?.avg_humidity_percent) && (
                  <div className="flex items-center gap-3">
                    {space.avg_temperature_f && <span>🌡️ {space.avg_temperature_f}°F</span>}
                    {space.avg_humidity_percent && <span>💧 {space.avg_humidity_percent}% humidity</span>}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span>❤️</span>
                  <Badge className={
                    plant.health_status === 'thriving' ? 'bg-emerald-500' :
                    plant.health_status === 'healthy' ? 'bg-green-500' :
                    plant.health_status === 'struggling' ? 'bg-amber-500' :
                    plant.health_status === 'sick' ? 'bg-red-500' : 'bg-gray-500'
                  }>
                    {plant.health_status || 'healthy'}
                  </Badge>
                  <span>· {ageDisplay.trim()} old</span>
                </div>
              </div>

              {isToxic && (
                <div className="bg-red-50 border-l-4 border-red-500 px-4 py-3 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-semibold text-red-800">⚠️ Toxic to {[
                        variety.toxic_to_cats && 'cats',
                        variety.toxic_to_dogs && 'dogs', 
                        variety.toxic_to_humans && 'humans'
                      ].filter(Boolean).join(' & ')}</p>
                      {variety.toxicity_notes && (
                        <p className="text-xs text-red-700 mt-1">{variety.toxicity_notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => logCare('watered')} className="bg-blue-500 hover:bg-blue-600" size="sm">
                  <Droplets className="w-4 h-4 mr-1" />
                  Water
                </Button>
                <Button onClick={() => logCare('fertilized')} className="bg-green-500 hover:bg-green-600" size="sm">
                  <Sprout className="w-4 h-4 mr-1" />
                  Fertilize
                </Button>
                <Button onClick={() => logCare('pruned')} className="bg-purple-500 hover:bg-purple-600" size="sm">
                  <Scissors className="w-4 h-4 mr-1" />
                  Prune
                </Button>
                <Button onClick={() => setShowLogModal(true)} className="bg-gray-500 hover:bg-gray-600" size="sm">
                  <FileText className="w-4 h-4 mr-1" />
                  Log
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} className="bg-pink-500 hover:bg-pink-600" size="sm">
                  <Camera className="w-4 h-4 mr-1" />
                  Photo
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="care-guide">Care Guide</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Care Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💧</span>
                  <div>
                    <div className="font-medium">Water</div>
                    <div className="text-xs text-gray-500">
                      Last: {formatDate(plant.last_watered_date)}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {plant.watering_frequency_days ? `Next: ${getNextDate(plant.last_watered_date, plant.watering_frequency_days)}` : 'No schedule'}
                </div>
              </div>

              <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌱</span>
                  <div>
                    <div className="font-medium">Fertilize</div>
                    <div className="text-xs text-gray-500">
                      Last: {formatDate(plant.last_fertilized_date)}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {plant.fertilizing_frequency_weeks ? `Next: ${getNextDate(plant.last_fertilized_date, plant.fertilizing_frequency_weeks * 7)}` : 'No schedule'}
                </div>
              </div>

              {plant.last_repotted_date && (
                <div className="flex items-center justify-between bg-purple-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🪴</span>
                    <div>
                      <div className="font-medium">Repotted</div>
                      <div className="text-xs text-gray-500">
                        Last: {formatDate(plant.last_repotted_date)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {plant.last_pruned_date && (
                <div className="flex items-center justify-between bg-amber-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✂️</span>
                    <div>
                      <div className="font-medium">Pruned</div>
                      <div className="text-xs text-gray-500">
                        Last: {formatDate(plant.last_pruned_date)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(plant.current_height_inches || plant.current_width_inches) && (
                <div className="flex items-center gap-4 bg-emerald-50 rounded-lg p-3">
                  <span className="text-2xl">📏</span>
                  <div className="text-sm">
                    {plant.current_height_inches && <span className="font-medium">Height: {plant.current_height_inches}"</span>}
                    {plant.current_height_inches && plant.current_width_inches && <span className="mx-2">·</span>}
                    {plant.current_width_inches && <span className="font-medium">Width: {plant.current_width_inches}"</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {plant.window_direction && (
                <div className="flex items-center gap-2">
                  <span>🪟</span>
                  <span>
                    {plant.window_direction.charAt(0).toUpperCase() + plant.window_direction.slice(1)} window
                    {plant.distance_from_window && ` · ${plant.distance_from_window.replace(/_/g, ' ')}`}
                    {plant.daily_light_hours && ` · ~${plant.daily_light_hours}hr light`}
                  </span>
                </div>
              )}

              {plant.watering_method && (
                <div className="flex items-center gap-2">
                  <span>💧</span>
                  <span>
                    {plant.watering_method.charAt(0).toUpperCase() + plant.watering_method.slice(1)} water
                    {plant.soil_dryness_preference && ` · ${plant.soil_dryness_preference.replace(/_/g, ' ')}`}
                  </span>
                </div>
              )}

              {(variety?.temp_ideal_min_f || variety?.temp_ideal_max_f) && (
                <div className="flex items-center gap-2">
                  <span>🌡️</span>
                  <span>
                    {variety.temp_ideal_min_f || '??'}-{variety.temp_ideal_max_f || '??'}°F ideal
                    {variety.cold_draft_sensitive && ' · Draft sensitive'}
                  </span>
                </div>
              )}

              {variety?.humidity_preference && (
                <div className="flex items-center gap-2">
                  <span>💨</span>
                  <span>
                    {variety.humidity_preference.charAt(0).toUpperCase() + variety.humidity_preference.slice(1)} humidity
                    {variety.misting_beneficial && ' · Misting beneficial'}
                  </span>
                </div>
              )}

              {plant.soil_type && (
                <div className="flex items-center gap-2">
                  <span>🪴</span>
                  <span>
                    {plant.soil_type.replace(/_/g, ' ')}
                    {plant.current_pot_material && ` · ${plant.current_pot_material}`}
                    {plant.pot_has_drainage && ' · Has drainage'}
                  </span>
                </div>
              )}

              {(plant.fertilizer_type_used || plant.fertilizer_brand) && (
                <div className="flex items-center gap-2">
                  <span>🌱</span>
                  <span>
                    {plant.fertilizer_brand || plant.fertilizer_type_used || 'Fertilizer'}
                    {plant.fertilizing_frequency_weeks && ` · Every ${plant.fertilizing_frequency_weeks}w`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerts */}
          {(daysSinceWatered >= (plant.watering_frequency_days || 999) || plant.has_pests || plant.has_disease) && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-base">⚠️ Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {daysSinceWatered >= (plant.watering_frequency_days || 999) && (
                  <div className="flex items-center gap-2 text-blue-700">
                    <span>💧</span>
                    <span>Due for watering {daysSinceWatered > plant.watering_frequency_days ? 'now' : 'soon'}</span>
                  </div>
                )}
                {plant.has_pests && (
                  <div className="flex items-center gap-2 text-red-700">
                    <span>🐛</span>
                    <span>Pest issues detected</span>
                  </div>
                )}
                {plant.has_disease && (
                  <div className="flex items-center gap-2 text-red-700">
                    <span>🚨</span>
                    <span>Disease detected</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {plant.special_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap text-sm">{plant.special_notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CARE GUIDE TAB */}
        <TabsContent value="care-guide" className="space-y-4">
          {!variety ? (
            <Card className="py-12">
              <CardContent className="text-center text-gray-500">
                No variety data available. Set a plant type to see care guide.
              </CardContent>
            </Card>
          ) : (
            <>
              <CareGuideSection icon="☀️" title="Light Requirements">
                <CareGuideRow label="Light Level" value={variety.light_requirement_indoor?.replace(/_/g, ' ')} />
                <CareGuideRow label="Tolerance Range" value={variety.light_tolerance_range?.replace(/_/g, ' ')} />
                <CareGuideRow label="Min Light Hours" value={variety.min_light_hours && `${variety.min_light_hours} hrs/day`} />
                <CareGuideRow label="Max Light Hours" value={variety.max_light_hours && `${variety.max_light_hours} hrs/day`} />
                <CareGuideRow label="Grow Light Compatible" value={variety.grow_light_compatible ? 'Yes' : variety.grow_light_compatible === false ? 'No' : null} />
              </CareGuideSection>

              <CareGuideSection icon="💧" title="Watering">
                <CareGuideRow label="Frequency Range" value={variety.watering_frequency_range?.replace(/_/g, ' ')} />
                <CareGuideRow label="Preferred Method" value={variety.watering_method_preferred?.replace(/_/g, ' ')} />
                <CareGuideRow label="Soil Dryness Rule" value={variety.soil_dryness_rule?.replace(/_/g, ' ')} />
                <CareGuideRow label="Drought Tolerant" value={variety.drought_tolerant ? 'Yes' : variety.drought_tolerant === false ? 'No' : null} />
                <CareGuideRow label="Overwater Sensitivity" value={variety.overwater_sensitivity} />
              </CareGuideSection>

              <CareGuideSection icon="🌡️" title="Temperature">
                <CareGuideRow label="Ideal Range" value={variety.temp_ideal_min_f && variety.temp_ideal_max_f && `${variety.temp_ideal_min_f}-${variety.temp_ideal_max_f}°F`} />
                <CareGuideRow label="Min Temperature" value={variety.temp_min_f && `${variety.temp_min_f}°F (damage below)`} />
                <CareGuideRow label="Max Temperature" value={variety.temp_max_f && `${variety.temp_max_f}°F (stress above)`} />
                <CareGuideRow label="Draft Sensitive" value={variety.cold_draft_sensitive ? 'Yes - keep away from vents/doors' : variety.cold_draft_sensitive === false ? 'No' : null} />
              </CareGuideSection>

              <CareGuideSection icon="💨" title="Humidity" summary={variety.humidity_preference || 'Medium'}>
                <CareGuideRow label="Preference" value={variety.humidity_preference} badge />
                <CareGuideRow label="Support Method" value={variety.humidity_support_method?.replace(/_/g, ' ')} />
                <CareGuideRow label="Misting Beneficial" value={variety.misting_beneficial ? 'Yes' : variety.misting_beneficial === false ? 'No' : null} />
              </CareGuideSection>

              <CareGuideSection icon="🪴" title="Soil & Potting" summary={variety.soil_type_recommended?.replace(/_/g, ' ') || 'All-purpose'}>
                <CareGuideRow label="Recommended Soil" value={variety.soil_type_recommended?.replace(/_/g, ' ')} />
                <CareGuideRow label="Drainage Speed" value={variety.soil_drainage_speed} />
                <CareGuideRow label="Drainage Holes Required" value={variety.drainage_holes_required ? 'Yes' : variety.drainage_holes_required === false ? 'No' : null} badge={variety.drainage_holes_required} />
                <CareGuideRow label="Recommended Pot Type" value={variety.recommended_pot_type?.replace(/_/g, ' ')} />
              </CareGuideSection>

              <CareGuideSection icon="🌱" title="Fertilization" summary={variety.fertilizer_frequency?.replace(/_/g, ' ') || 'Monthly'}>
                <CareGuideRow label="Type" value={variety.fertilizer_type?.replace(/_/g, ' ')} />
                <CareGuideRow label="Frequency" value={variety.fertilizer_frequency?.replace(/_/g, ' ')} />
                <CareGuideRow label="Strength" value={variety.fertilizer_strength} badge />
                <CareGuideRow label="Feed During Dormancy" value={variety.dormant_season_feeding ? 'Yes' : variety.dormant_season_feeding === false ? 'No - skip winter' : null} />
              </CareGuideSection>

              <CareGuideSection icon="📏" title="Growth & Size" summary={variety.mature_indoor_height || 'Varies'}>
                <CareGuideRow label="Growth Pattern" value={variety.growth_pattern} badge />
                <CareGuideRow label="Mature Height" value={variety.mature_indoor_height} />
                <CareGuideRow label="Mature Width" value={variety.mature_indoor_width} />
                <CareGuideRow label="Growth Speed" value={variety.growth_speed} badge />
                <CareGuideRow label="Needs Support" value={variety.needs_support ? 'Yes (moss pole/trellis)' : variety.needs_support === false ? 'No' : null} />
                <CareGuideRow label="Pruning Needs" value={variety.pruning_needs} />
              </CareGuideSection>

              <CareGuideSection icon="🔄" title="Repotting" summary={variety.repot_frequency_years || '1-2 years'}>
                <CareGuideRow label="Frequency" value={variety.repot_frequency_years && `Every ${variety.repot_frequency_years} years`} />
                <CareGuideRow label="Rootbound Tolerance" value={variety.rootbound_tolerance} badge />
                <CareGuideRow label="Best Season" value={variety.best_repot_season?.replace(/_/g, ' ')} />
              </CareGuideSection>

              {isToxic && (
                <CareGuideSection icon="⚠️" title="Toxicity Warning" summary="Toxic to pets or humans" defaultOpen>
                  <CareGuideRow label="Toxic to Cats" value={variety.toxic_to_cats ? 'Yes' : 'No'} badge={variety.toxic_to_cats} />
                  <CareGuideRow label="Toxic to Dogs" value={variety.toxic_to_dogs ? 'Yes' : 'No'} badge={variety.toxic_to_dogs} />
                  <CareGuideRow label="Toxic to Humans" value={variety.toxic_to_humans ? 'Yes' : 'No'} badge={variety.toxic_to_humans} />
                  <CareGuideRow label="Sap Irritant" value={variety.sap_irritant ? 'Yes - wear gloves' : variety.sap_irritant === false ? 'No' : null} badge={variety.sap_irritant} />
                  {variety.toxicity_notes && (
                    <div className="pt-2 text-sm text-gray-700 bg-red-50 p-3 rounded-lg mt-2">
                      {variety.toxicity_notes}
                    </div>
                  )}
                </CareGuideSection>
              )}

              {(variety.common_pests || variety.pest_susceptibility) && (
                <CareGuideSection icon="🐛" title="Pests & Diseases" summary={`${variety.pest_susceptibility || 'moderate'} susceptibility`}>
                  <CareGuideRow label="Pest Susceptibility" value={variety.pest_susceptibility} badge />
                  {variety.common_pests && (
                    <div className="py-2">
                      <p className="text-xs text-gray-500 mb-2">Common Pests:</p>
                      <div className="flex flex-wrap gap-1">
                        {JSON.parse(variety.common_pests || '[]').map(pest => (
                          <Badge key={pest} variant="outline" className="text-xs">{pest.replace(/_/g, ' ')}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {variety.preventive_care_tips && (
                    <div className="pt-2 text-sm text-gray-700 bg-blue-50 p-3 rounded-lg mt-2">
                      <p className="font-medium mb-1">Prevention Tips:</p>
                      <p>{variety.preventive_care_tips}</p>
                    </div>
                  )}
                </CareGuideSection>
              )}

              {(variety.winter_dormancy || variety.reduced_winter_watering || variety.seasonal_notes) && (
                <CareGuideSection icon="❄️" title="Seasonal Care" summary="Winter adjustments needed">
                  <CareGuideRow label="Winter Dormancy" value={variety.winter_dormancy ? 'Yes' : variety.winter_dormancy === false ? 'No' : null} badge={variety.winter_dormancy} />
                  <CareGuideRow label="Reduced Winter Watering" value={variety.reduced_winter_watering ? 'Yes' : variety.reduced_winter_watering === false ? 'No' : null} />
                  <CareGuideRow label="Winter Leaf Drop" value={variety.winter_leaf_drop_normal ? 'Normal' : variety.winter_leaf_drop_normal === false ? 'Not normal' : null} />
                  {variety.seasonal_notes && (
                    <div className="pt-2 text-sm text-gray-700 bg-blue-50 p-3 rounded-lg mt-2">
                      {variety.seasonal_notes}
                    </div>
                  )}
                </CareGuideSection>
              )}

              {variety.propagation_methods && (
                <CareGuideSection icon="🌿" title="Propagation" summary={`${variety.propagation_difficulty || 'moderate'} difficulty`}>
                  <CareGuideRow label="Difficulty" value={variety.propagation_difficulty} badge />
                  <CareGuideRow label="Best Season" value={variety.propagation_best_season?.replace(/_/g, ' ')} />
                  {variety.propagation_methods && (
                    <div className="py-2">
                      <p className="text-xs text-gray-500 mb-2">Methods:</p>
                      <div className="flex flex-wrap gap-1">
                        {JSON.parse(variety.propagation_methods || '[]').map(method => (
                          <Badge key={method} variant="outline" className="text-xs">{method.replace(/_/g, ' ')}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {variety.propagation_notes && (
                    <div className="pt-2 text-sm text-gray-700 bg-green-50 p-3 rounded-lg mt-2">
                      {variety.propagation_notes}
                    </div>
                  )}
                </CareGuideSection>
              )}
            </>
          )}
        </TabsContent>

        {/* ENVIRONMENT TAB */}
        <TabsContent value="environment">
          <EnvironmentTab plant={plant} plantId={plantId} onUpdate={loadData} />
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Care History</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No logs yet</p>
              ) : (
                <div className="space-y-3">
                  {logs.map(log => {
                    const logIcons = {
                      watered: '💧',
                      fertilized: '🌱',
                      misted: '💨',
                      rotated: '🔄',
                      repotted: '🪴',
                      pruned: '✂️',
                      cleaned: '🧽',
                      moved: '📦',
                      photo: '📸',
                      milestone: '🏆',
                      problem: '⚠️',
                      note: '📝'
                    };
                    
                    return (
                      <div key={log.id} className="border-l-4 border-emerald-500 pl-4 py-2 hover:bg-gray-50 transition-colors rounded-r">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span>{logIcons[log.log_type] || '📝'}</span>
                            <span className="font-medium capitalize">{log.log_type.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        {log.notes && <p className="text-sm text-gray-600 mt-1">{log.notes}</p>}
                        {log.photos && log.photos.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {log.photos.map((url, i) => (
                              <img key={i} src={url} alt="Log photo" className="w-16 h-16 object-cover rounded border" />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* STATS TAB */}
        <TabsContent value="stats">
          <PlantStatsTab plant={plant} logs={logs} />
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {plant.nickname || variety?.variety_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Nickname</Label>
              <Input
                value={editData.nickname}
                onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                placeholder="e.g., Monica, Fred"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Plant Type/Variety</Label>
              <Select value={editData.variety_id} onValueChange={(v) => setEditData({ ...editData, variety_id: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select plant type" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {varieties.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.variety_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Health Status</Label>
              <Select value={editData.health_status} onValueChange={(v) => setEditData({ ...editData, health_status: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thriving">🌿 Thriving</SelectItem>
                  <SelectItem value="healthy">🌱 Healthy</SelectItem>
                  <SelectItem value="stable">✅ Stable</SelectItem>
                  <SelectItem value="struggling">⚠️ Struggling</SelectItem>
                  <SelectItem value="sick">🚨 Sick</SelectItem>
                  <SelectItem value="recovering">📈 Recovering</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={editData.special_notes}
                onChange={(e) => setEditData({ ...editData, special_notes: e.target.value })}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} className="bg-emerald-600 hover:bg-emerald-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Log Modal */}
      <Dialog open={showLogModal} onOpenChange={setShowLogModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Activity Type</Label>
              <Select value={logType} onValueChange={setLogType}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repotted">🪴 Repotted</SelectItem>
                  <SelectItem value="moved">📦 Moved</SelectItem>
                  <SelectItem value="cleaned">🧽 Cleaned Leaves</SelectItem>
                  <SelectItem value="milestone">🏆 Milestone</SelectItem>
                  <SelectItem value="problem">⚠️ Problem</SelectItem>
                  <SelectItem value="note">📝 Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="Add any details..."
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogModal(false)}>Cancel</Button>
            <Button onClick={handleCustomLog} className="bg-emerald-600 hover:bg-emerald-700">
              Save Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}