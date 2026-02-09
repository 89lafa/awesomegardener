import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Droplets, Sprout, Wind, RotateCw, Camera, Edit, MoreVertical,
  Loader2, Scissors, AlertTriangle, FileText, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function IndoorPlantDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plantId = searchParams.get('id');
  
  const [plant, setPlant] = useState(null);
  const [variety, setVariety] = useState(null);
  const [space, setSpace] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [envData, setEnvData] = useState({});
  const [varieties, setVarieties] = useState([]);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = React.useRef(null);
  const [expandedSections, setExpandedSections] = useState({});

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

      const [varietyData, spaceData, logsData, varietiesData] = await Promise.all([
        p.variety_id ? base44.entities.Variety.filter({ id: p.variety_id }) : Promise.resolve([]),
        p.indoor_space_id ? base44.entities.IndoorSpace.filter({ id: p.indoor_space_id }) : Promise.resolve([]),
        base44.entities.IndoorPlantLog.filter({ indoor_plant_id: plantId }, '-log_date', 50),
        base44.entities.Variety.filter({ 
          $or: [
            { care_difficulty: { $in: ['beginner', 'easy', 'moderate'] } },
            { light_requirement_indoor: { $exists: true } }
          ]
        }, 'variety_name', 300)
      ]);

      if (varietyData.length > 0) setVariety(varietyData[0]);
      if (spaceData.length > 0) setSpace(spaceData[0]);
      setLogs(logsData);
      setVarieties(varietiesData);

      setEditData({
        nickname: p.nickname || '',
        variety_id: p.variety_id || '',
        watering_frequency_days: p.watering_frequency_days || '',
        pot_type: p.pot_type || 'plastic',
        pot_size_inches: p.pot_size_inches || '',
        soil_type: p.soil_type || '',
        health_status: p.health_status || 'healthy',
        special_notes: p.special_notes || ''
      });

      setEnvData({
        window_direction: p.window_direction || 'none',
        distance_from_window: p.distance_from_window || 'no_window',
        daily_light_hours: p.daily_light_hours || '',
        has_grow_light: p.has_grow_light || false,
        grow_light_hours: p.grow_light_hours || '',
        grow_light_type: p.grow_light_type || 'led_full_spectrum',
        watering_method: p.watering_method || 'top',
        soil_dryness_preference: p.soil_dryness_preference || 'top_inch_dry',
        draft_exposure: p.draft_exposure || false,
        humidity_support_method: p.humidity_support_method || 'none',
        fertilizer_type_used: p.fertilizer_type_used || '',
        fertilizer_brand: p.fertilizer_brand || '',
        current_pot_material: p.current_pot_material || 'plastic',
        pot_has_drainage: p.pot_has_drainage !== false
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
        notes: notes
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

      toast.success(`${type} logged!`);
      loadData();
    } catch (error) {
      console.error('Error logging care:', error);
      toast.error('Failed to log care');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const updates = {
        nickname: editData.nickname || null,
        variety_id: editData.variety_id || null,
        watering_frequency_days: editData.watering_frequency_days ? parseInt(editData.watering_frequency_days) : null,
        pot_type: editData.pot_type,
        pot_size_inches: editData.pot_size_inches ? parseFloat(editData.pot_size_inches) : null,
        soil_type: editData.soil_type || null,
        health_status: editData.health_status || null,
        special_notes: editData.special_notes || null
      };
      await base44.entities.IndoorPlant.update(plantId, updates);
      toast.success('Plant updated!');
      setShowEditModal(false);
      loadData();
    } catch (error) {
      console.error('Error updating plant:', error);
      toast.error('Failed to update plant');
    }
  };

  const handleSaveEnvironment = async () => {
    try {
      await base44.entities.IndoorPlant.update(plantId, envData);
      toast.success('Environment settings saved!');
      setShowEnvironmentModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving environment:', error);
      toast.error('Failed to save environment');
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

  const getHealthStatusDisplay = (status) => {
    const displays = {
      thriving: '🌿 Thriving',
      healthy: '🌱 Healthy',
      stable: '✅ Stable',
      struggling: '⚠️ Struggling',
      sick: '🚨 Sick',
      recovering: '📈 Recovering',
      dormant: '😴 Dormant'
    };
    return displays[status] || status;
  };

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
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

  const showToxicityWarning = variety && (variety.toxic_to_cats || variety.toxic_to_dogs || variety.toxic_to_humans);

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
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Header with Photo and Quick Info */}
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
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {plant.nickname || variety?.variety_name || 'Unnamed Plant'}
              </h1>
              {plant.nickname && variety && (
                <p className="text-lg text-gray-600 italic mb-1">{variety.variety_name}</p>
              )}
              {variety?.scientific_name && (
                <p className="text-sm text-gray-500 italic mb-3">{variety.scientific_name}</p>
              )}

              <div className="space-y-2 text-sm">
                {space && (
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span>{space.name} {space.room_name && `· ${space.room_name}`}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span>💚</span>
                  <span>Health: {getHealthStatusDisplay(plant.health_status || 'healthy')}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span>Acquired: {new Date(plant.acquisition_date).toLocaleDateString()} ({ageDisplay.trim()})</span>
                </div>

                {plant.acquired_from && (
                  <div className="flex items-center gap-2">
                    <span>🏪</span>
                    <span>From: {plant.acquired_from}</span>
                    {plant.purchase_price && <span>(${plant.purchase_price})</span>}
                  </div>
                )}

                {daysSinceWatered !== null && (
                  <div className="flex items-center gap-2">
                    <span>💧</span>
                    <span>Last Watered: {formatDate(plant.last_watered_date)}</span>
                    {plant.watering_frequency_days && daysSinceWatered >= plant.watering_frequency_days && (
                      <Badge className="bg-blue-600">⏰ Due!</Badge>
                    )}
                  </div>
                )}

                {plant.tags && plant.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>🏷️</span>
                    {plant.tags.map(tag => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {showToxicityWarning && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-semibold text-red-900">⚠️ Toxic Plant</div>
                      <div className="text-red-700">
                        {variety.toxic_to_cats && 'Cats '}
                        {variety.toxic_to_dogs && 'Dogs '}
                        {variety.toxic_to_humans && 'Humans'}
                        {variety.toxicity_notes && ` · ${variety.toxicity_notes}`}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-5 gap-2 mt-6">
            <Button
              onClick={() => logCare('watered')}
              className="bg-blue-500 hover:bg-blue-600 text-white flex flex-col gap-1 h-auto py-3"
              size="sm"
            >
              <Droplets size={20} />
              <span className="text-xs">Water</span>
            </Button>

            <Button
              onClick={() => logCare('fertilized')}
              className="bg-green-500 hover:bg-green-600 text-white flex flex-col gap-1 h-auto py-3"
              size="sm"
            >
              <Sprout size={20} />
              <span className="text-xs">Fertilize</span>
            </Button>

            <Button
              onClick={() => logCare('pruned')}
              className="bg-purple-500 hover:bg-purple-600 text-white flex flex-col gap-1 h-auto py-3"
              size="sm"
            >
              <Scissors size={20} />
              <span className="text-xs">Prune</span>
            </Button>

            <Button
              onClick={() => logCare('note')}
              className="bg-amber-500 hover:bg-amber-600 text-white flex flex-col gap-1 h-auto py-3"
              size="sm"
            >
              <FileText size={20} />
              <span className="text-xs">Log</span>
            </Button>

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="bg-pink-500 hover:bg-pink-600 text-white flex flex-col gap-1 h-auto py-3"
              size="sm"
            >
              <Camera size={20} />
              <span className="text-xs">Photo</span>
            </Button>
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
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Care Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plant.last_watered_date && (
                <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💧</span>
                    <div>
                      <div className="font-medium">Last watered</div>
                      <div className="text-xs text-gray-500">{formatDate(plant.last_watered_date)}</div>
                    </div>
                  </div>
                  {plant.watering_frequency_days && (
                    <div className="text-sm text-gray-600">
                      Next: in ~{Math.max(0, plant.watering_frequency_days - daysSinceWatered)} days
                    </div>
                  )}
                </div>
              )}

              {plant.last_fertilized_date && (
                <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🌱</span>
                    <div>
                      <div className="font-medium">Last fertilized</div>
                      <div className="text-xs text-gray-500">{formatDate(plant.last_fertilized_date)}</div>
                    </div>
                  </div>
                  {plant.fertilizing_frequency_weeks && (
                    <div className="text-sm text-gray-600">
                      Next: ~{plant.fertilizing_frequency_weeks} weeks
                    </div>
                  )}
                </div>
              )}

              {plant.last_repotted_date && (
                <div className="flex items-center justify-between bg-amber-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🪴</span>
                    <div>
                      <div className="font-medium">Last repotted</div>
                      <div className="text-xs text-gray-500">{formatDate(plant.last_repotted_date)}</div>
                    </div>
                  </div>
                </div>
              )}

              {plant.last_pruned_date && (
                <div className="flex items-center justify-between bg-purple-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✂️</span>
                    <div>
                      <div className="font-medium">Last pruned</div>
                      <div className="text-xs text-gray-500">{formatDate(plant.last_pruned_date)}</div>
                    </div>
                  </div>
                </div>
              )}

              {(plant.current_height_inches || plant.current_width_inches) && (
                <div className="bg-emerald-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📏</span>
                    <div>
                      <div className="font-medium">Size</div>
                      <div className="text-xs text-gray-500">
                        {plant.current_height_inches && `Height: ${plant.current_height_inches}"`}
                        {plant.current_height_inches && plant.current_width_inches && ' · '}
                        {plant.current_width_inches && `Width: ${plant.current_width_inches}"`}
                      </div>
                    </div>
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
              {plant.window_direction && plant.window_direction !== 'none' && (
                <div className="flex items-center gap-2">
                  <span>🪟</span>
                  <span>{plant.window_direction} window · {plant.distance_from_window?.replace(/_/g, ' ')}</span>
                  {plant.daily_light_hours && <span>· ~{plant.daily_light_hours}hr light</span>}
                </div>
              )}

              {plant.has_grow_light && (
                <div className="flex items-center gap-2">
                  <span>💡</span>
                  <span>Grow light: {plant.grow_light_type?.replace(/_/g, ' ')} · {plant.grow_light_hours}hr/day</span>
                </div>
              )}

              {plant.watering_method && (
                <div className="flex items-center gap-2">
                  <span>💧</span>
                  <span>{plant.watering_method} water · {plant.soil_dryness_preference?.replace(/_/g, ' ')}</span>
                </div>
              )}

              {plant.humidity_support_method && plant.humidity_support_method !== 'none' && (
                <div className="flex items-center gap-2">
                  <span>💨</span>
                  <span>Humidity: {plant.humidity_support_method?.replace(/_/g, ' ')}</span>
                </div>
              )}

              {plant.current_pot_material && (
                <div className="flex items-center gap-2">
                  <span>🪴</span>
                  <span>{plant.soil_type?.replace(/_/g, ' ')} · {plant.pot_size_inches}" {plant.current_pot_material}</span>
                  {plant.pot_has_drainage && <span className="text-green-600">✓ Drainage</span>}
                </div>
              )}

              {plant.fertilizer_brand && (
                <div className="flex items-center gap-2">
                  <span>🌱</span>
                  <span>{plant.fertilizer_brand}</span>
                  {plant.fertilizing_frequency_weeks && <span>· Every {plant.fertilizing_frequency_weeks} weeks</span>}
                </div>
              )}
            </CardContent>
          </Card>

          {plant.special_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{plant.special_notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CARE GUIDE TAB */}
        <TabsContent value="care-guide" className="space-y-3">
          {variety ? (
            <>
              <CareSection 
                icon="☀️" 
                title="Light Requirements" 
                expanded={expandedSections.light}
                onToggle={() => toggleSection('light')}
                summary={variety.light_requirement_indoor || 'Not specified'}
              >
                <div className="space-y-2 text-sm">
                  {variety.light_requirement_indoor && (
                    <div><strong>Requirement:</strong> {variety.light_requirement_indoor.replace(/_/g, ' ')}</div>
                  )}
                  {variety.light_tolerance_range && (
                    <div><strong>Tolerance:</strong> {variety.light_tolerance_range.replace(/_/g, ' ')}</div>
                  )}
                  {variety.min_light_hours && (
                    <div><strong>Light Hours:</strong> {variety.min_light_hours}-{variety.max_light_hours || '12'}hr/day</div>
                  )}
                  {variety.grow_light_compatible && (
                    <div className="text-emerald-600">✓ Grow light compatible</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="💧" 
                title="Watering" 
                expanded={expandedSections.water}
                onToggle={() => toggleSection('water')}
                summary={variety.watering_frequency_range || 'Moderate'}
              >
                <div className="space-y-2 text-sm">
                  {variety.watering_frequency_range && (
                    <div><strong>Frequency:</strong> Every {variety.watering_frequency_range.replace(/_/g, ' ')}</div>
                  )}
                  {variety.soil_dryness_rule && (
                    <div><strong>When to water:</strong> {variety.soil_dryness_rule.replace(/_/g, ' ')}</div>
                  )}
                  {variety.watering_method_preferred && (
                    <div><strong>Method:</strong> {variety.watering_method_preferred} water</div>
                  )}
                  {variety.drought_tolerant && (
                    <div className="text-emerald-600">✓ Drought tolerant</div>
                  )}
                  {variety.overwater_sensitivity && (
                    <div><strong>Overwater sensitivity:</strong> {variety.overwater_sensitivity}</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="🌡️" 
                title="Temperature" 
                expanded={expandedSections.temp}
                onToggle={() => toggleSection('temp')}
                summary={variety.temp_ideal_min_f && variety.temp_ideal_max_f ? `${variety.temp_ideal_min_f}-${variety.temp_ideal_max_f}°F ideal` : 'Standard room temp'}
              >
                <div className="space-y-2 text-sm">
                  {variety.temp_ideal_min_f && variety.temp_ideal_max_f && (
                    <div><strong>Ideal range:</strong> {variety.temp_ideal_min_f}-{variety.temp_ideal_max_f}°F</div>
                  )}
                  {variety.temp_min_f && (
                    <div><strong>Min safe temp:</strong> {variety.temp_min_f}°F (damage below)</div>
                  )}
                  {variety.temp_max_f && (
                    <div><strong>Max safe temp:</strong> {variety.temp_max_f}°F (stress above)</div>
                  )}
                  {variety.cold_draft_sensitive && (
                    <div className="text-amber-600">⚠️ Sensitive to cold drafts</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="💨" 
                title="Humidity" 
                expanded={expandedSections.humidity}
                onToggle={() => toggleSection('humidity')}
                summary={variety.humidity_preference || 'Moderate'}
              >
                <div className="space-y-2 text-sm">
                  {variety.humidity_preference && (
                    <div><strong>Preference:</strong> {variety.humidity_preference} humidity</div>
                  )}
                  {variety.humidity_support_method && (
                    <div><strong>Support method:</strong> {variety.humidity_support_method.replace(/_/g, ' ')}</div>
                  )}
                  {variety.misting_beneficial && (
                    <div className="text-emerald-600">✓ Benefits from misting</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="🪴" 
                title="Soil & Potting" 
                expanded={expandedSections.soil}
                onToggle={() => toggleSection('soil')}
                summary={variety.soil_type_recommended?.replace(/_/g, ' ') || 'All-purpose mix'}
              >
                <div className="space-y-2 text-sm">
                  {variety.soil_type_recommended && (
                    <div><strong>Soil:</strong> {variety.soil_type_recommended.replace(/_/g, ' ')}</div>
                  )}
                  {variety.soil_drainage_speed && (
                    <div><strong>Drainage:</strong> {variety.soil_drainage_speed} draining</div>
                  )}
                  {variety.recommended_pot_type && (
                    <div><strong>Pot type:</strong> {variety.recommended_pot_type.replace(/_/g, ' ')}</div>
                  )}
                  {variety.drainage_holes_required && (
                    <div className="text-red-600">⚠️ Drainage holes required</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="🌱" 
                title="Fertilization" 
                expanded={expandedSections.fert}
                onToggle={() => toggleSection('fert')}
                summary={variety.fertilizer_frequency?.replace(/_/g, ' ') || 'Monthly'}
              >
                <div className="space-y-2 text-sm">
                  {variety.fertilizer_type && (
                    <div><strong>Type:</strong> {variety.fertilizer_type.replace(/_/g, ' ')}</div>
                  )}
                  {variety.fertilizer_frequency && (
                    <div><strong>Frequency:</strong> {variety.fertilizer_frequency.replace(/_/g, ' ')}</div>
                  )}
                  {variety.fertilizer_strength && (
                    <div><strong>Strength:</strong> {variety.fertilizer_strength} strength</div>
                  )}
                  {variety.dormant_season_feeding === false && (
                    <div className="text-amber-600">⚠️ Stop feeding during winter dormancy</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="📏" 
                title="Growth & Size" 
                expanded={expandedSections.growth}
                onToggle={() => toggleSection('growth')}
                summary={variety.mature_indoor_height || 'Varies'}
              >
                <div className="space-y-2 text-sm">
                  {variety.growth_pattern && (
                    <div><strong>Pattern:</strong> {variety.growth_pattern}</div>
                  )}
                  {variety.mature_indoor_height && (
                    <div><strong>Mature height:</strong> {variety.mature_indoor_height}</div>
                  )}
                  {variety.mature_indoor_width && (
                    <div><strong>Mature width:</strong> {variety.mature_indoor_width}</div>
                  )}
                  {variety.growth_speed && (
                    <div><strong>Growth speed:</strong> {variety.growth_speed}</div>
                  )}
                  {variety.needs_support && (
                    <div className="text-blue-600">📍 Needs moss pole or trellis</div>
                  )}
                  {variety.pruning_needs && (
                    <div><strong>Pruning:</strong> {variety.pruning_needs}</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="🔄" 
                title="Repotting" 
                expanded={expandedSections.repot}
                onToggle={() => toggleSection('repot')}
                summary={variety.repot_frequency_years ? `Every ${variety.repot_frequency_years} years` : 'As needed'}
              >
                <div className="space-y-2 text-sm">
                  {variety.repot_frequency_years && (
                    <div><strong>Frequency:</strong> Every {variety.repot_frequency_years} years</div>
                  )}
                  {variety.rootbound_tolerance && (
                    <div><strong>Rootbound tolerance:</strong> {variety.rootbound_tolerance}</div>
                  )}
                  {variety.best_repot_season && (
                    <div><strong>Best season:</strong> {variety.best_repot_season.replace(/_/g, ' ')}</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="⚠️" 
                title="Toxicity" 
                expanded={expandedSections.toxic}
                onToggle={() => toggleSection('toxic')}
                summary={variety.pet_safe ? 'Pet safe' : showToxicityWarning ? 'Toxic' : 'Unknown'}
              >
                <div className="space-y-2 text-sm">
                  <div className={variety.toxic_to_cats ? 'text-red-600' : 'text-green-600'}>
                    {variety.toxic_to_cats ? '⚠️' : '✓'} Cats: {variety.toxic_to_cats ? 'Toxic' : 'Safe'}
                  </div>
                  <div className={variety.toxic_to_dogs ? 'text-red-600' : 'text-green-600'}>
                    {variety.toxic_to_dogs ? '⚠️' : '✓'} Dogs: {variety.toxic_to_dogs ? 'Toxic' : 'Safe'}
                  </div>
                  <div className={variety.toxic_to_humans ? 'text-red-600' : 'text-green-600'}>
                    {variety.toxic_to_humans ? '⚠️' : '✓'} Humans: {variety.toxic_to_humans ? 'Toxic' : 'Safe'}
                  </div>
                  {variety.sap_irritant && (
                    <div className="text-amber-600">⚠️ Sap causes skin irritation</div>
                  )}
                  {variety.toxicity_notes && (
                    <div className="mt-2 text-gray-600">{variety.toxicity_notes}</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="🐛" 
                title="Pests & Diseases" 
                expanded={expandedSections.pests}
                onToggle={() => toggleSection('pests')}
                summary={variety.pest_susceptibility || 'Monitor regularly'}
              >
                <div className="space-y-2 text-sm">
                  {variety.pest_susceptibility && (
                    <div><strong>Susceptibility:</strong> {variety.pest_susceptibility}</div>
                  )}
                  {variety.common_pests && (
                    <div><strong>Common pests:</strong> {JSON.parse(variety.common_pests || '[]').join(', ')}</div>
                  )}
                  {variety.common_diseases && (
                    <div><strong>Common diseases:</strong> {JSON.parse(variety.common_diseases || '[]').join(', ')}</div>
                  )}
                  {variety.preventive_care_tips && (
                    <div className="mt-2 text-gray-600">{variety.preventive_care_tips}</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="❄️" 
                title="Seasonal Care" 
                expanded={expandedSections.seasonal}
                onToggle={() => toggleSection('seasonal')}
                summary={variety.winter_dormancy ? 'Winter dormancy' : 'Year-round care'}
              >
                <div className="space-y-2 text-sm">
                  {variety.winter_dormancy && (
                    <div className="text-blue-600">❄️ Goes dormant in winter</div>
                  )}
                  {variety.reduced_winter_watering && (
                    <div>💧 Reduce watering in winter</div>
                  )}
                  {variety.winter_leaf_drop_normal && (
                    <div>🍂 Some leaf drop is normal in winter</div>
                  )}
                  {variety.seasonal_notes && (
                    <div className="mt-2 text-gray-600">{variety.seasonal_notes}</div>
                  )}
                </div>
              </CareSection>

              <CareSection 
                icon="🌿" 
                title="Propagation" 
                expanded={expandedSections.prop}
                onToggle={() => toggleSection('prop')}
                summary={variety.propagation_difficulty || 'Info available'}
              >
                <div className="space-y-2 text-sm">
                  {variety.propagation_methods && (
                    <div><strong>Methods:</strong> {JSON.parse(variety.propagation_methods || '[]').join(', ')}</div>
                  )}
                  {variety.propagation_difficulty && (
                    <div><strong>Difficulty:</strong> {variety.propagation_difficulty}</div>
                  )}
                  {variety.propagation_best_season && (
                    <div><strong>Best season:</strong> {variety.propagation_best_season.replace(/_/g, ' ')}</div>
                  )}
                  {variety.propagation_notes && (
                    <div className="mt-2 text-gray-600">{variety.propagation_notes}</div>
                  )}
                </div>
              </CareSection>

              {variety.care_difficulty && (
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-4 border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-gray-800">Overall Care Difficulty</div>
                      <div className="text-sm text-gray-600 capitalize">{variety.care_difficulty}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No variety selected. Edit plant to add variety for care information.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ENVIRONMENT TAB */}
        <TabsContent value="environment">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Plant's Environment</CardTitle>
              <Button size="sm" onClick={() => setShowEnvironmentModal(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold mb-3">☀️ Light Setup</h4>
                <div className="space-y-2 text-sm">
                  <div>Window: {plant.window_direction?.replace(/_/g, ' ') || 'Not set'}</div>
                  <div>Distance: {plant.distance_from_window?.replace(/_/g, ' ') || 'Not set'}</div>
                  <div>Light hours/day: {plant.daily_light_hours || 'Not set'}</div>
                  {plant.has_grow_light && (
                    <>
                      <div>Grow light: {plant.grow_light_type?.replace(/_/g, ' ')}</div>
                      <div>Grow light hours: {plant.grow_light_hours}/day</div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-3">💧 Watering Setup</h4>
                <div className="space-y-2 text-sm">
                  <div>Method: {plant.watering_method || 'Not set'}</div>
                  <div>Frequency: Every {plant.watering_frequency_days || '?'} days</div>
                  <div>Dryness rule: {plant.soil_dryness_preference?.replace(/_/g, ' ') || 'Not set'}</div>
                </div>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <h4 className="font-semibold mb-3">💨 Humidity</h4>
                <div className="space-y-2 text-sm">
                  <div>Support: {plant.humidity_support_method?.replace(/_/g, ' ') || 'None'}</div>
                  <div>Draft exposure: {plant.draft_exposure ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold mb-3">🌱 Fertilizer</h4>
                <div className="space-y-2 text-sm">
                  <div>Type: {plant.fertilizer_type_used || 'Not set'}</div>
                  <div>Brand: {plant.fertilizer_brand || 'Not set'}</div>
                  <div>Frequency: Every {plant.fertilizing_frequency_weeks || '?'} weeks</div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold mb-3">🪴 Pot & Soil</h4>
                <div className="space-y-2 text-sm">
                  <div>Material: {plant.current_pot_material || plant.pot_type || 'Not set'}</div>
                  <div>Size: {plant.pot_size_inches}"</div>
                  <div>Drainage: {plant.pot_has_drainage ? 'Yes ✓' : 'No'}</div>
                  <div>Soil: {plant.soil_type?.replace(/_/g, ' ') || 'Not set'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Care History ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No care logs yet</p>
              ) : (
                <div className="space-y-3">
                  {logs.map(log => {
                    const logIcons = {
                      watered: '💧',
                      fertilized: '🌱',
                      misted: '💨',
                      rotated: '🔄',
                      pruned: '✂️',
                      repotted: '🪴',
                      photo: '📸',
                      note: '📝',
                      milestone: '🏆',
                      problem: '⚠️',
                      moved: '📍',
                      clean_leaves: '🧽'
                    };

                    return (
                      <div key={log.id} className="border-l-4 border-emerald-500 pl-4 py-2 bg-gray-50 rounded-r-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{logIcons[log.log_type] || '📋'}</span>
                          <span className="font-medium capitalize">{log.log_type.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {new Date(log.log_date).toLocaleDateString()}
                          </span>
                        </div>
                        {log.notes && <p className="text-sm text-gray-600 mt-1">{log.notes}</p>}
                        {log.photos && log.photos.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {log.photos.map((url, i) => (
                              <img key={i} src={url} className="w-20 h-20 object-cover rounded-lg" alt="log photo" />
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
          <Card>
            <CardHeader>
              <CardTitle>Statistics & Milestones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-700">
                    {logs.filter(l => l.log_type === 'watered').length}
                  </div>
                  <div className="text-sm text-blue-600">Total Waterings</div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-green-700">
                    {logs.filter(l => l.log_type === 'fertilized').length}
                  </div>
                  <div className="text-sm text-green-600">Times Fertilized</div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-700">
                    {logs.filter(l => l.log_type === 'pruned').length}
                  </div>
                  <div className="text-sm text-purple-600">Times Pruned</div>
                </div>

                <div className="bg-pink-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-pink-700">
                    {logs.filter(l => l.log_type === 'photo').length}
                  </div>
                  <div className="text-sm text-pink-600">Photos Logged</div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h4 className="font-semibold mb-3">🏅 Milestones</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>🎂</span>
                    <span>{ageDisplay.trim()} old (since {new Date(plant.acquisition_date).toLocaleDateString()})</span>
                  </div>
                  {plant.propagation_children_count > 0 && (
                    <div className="flex items-center gap-2">
                      <span>🌿</span>
                      <span>{plant.propagation_children_count} successful propagations</span>
                    </div>
                  )}
                  {logs.filter(l => l.log_type === 'watered').length >= 50 && (
                    <div className="flex items-center gap-2">
                      <span>💧</span>
                      <span>{logs.filter(l => l.log_type === 'watered').length}+ waterings milestone!</span>
                    </div>
                  )}
                  {plant.current_height_inches && (
                    <div className="flex items-center gap-2">
                      <span>📏</span>
                      <span>Current size: {plant.current_height_inches}" tall</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center text-gray-500 text-sm py-4">
                📊 Growth charts and detailed analytics coming soon
              </div>
            </CardContent>
          </Card>
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
                  <SelectItem value="dormant">😴 Dormant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pot Type</Label>
                <Select value={editData.pot_type} onValueChange={(v) => setEditData({ ...editData, pot_type: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ceramic">Ceramic</SelectItem>
                    <SelectItem value="plastic">Plastic</SelectItem>
                    <SelectItem value="terracotta">Terracotta</SelectItem>
                    <SelectItem value="self_watering">Self-Watering</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pot Size (inches)</Label>
                <Input
                  type="number"
                  value={editData.pot_size_inches}
                  onChange={(e) => setEditData({ ...editData, pot_size_inches: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Soil Type</Label>
              <Select value={editData.soil_type} onValueChange={(v) => setEditData({ ...editData, soil_type: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select soil type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cactus_mix">Cactus Mix</SelectItem>
                  <SelectItem value="tropical_mix">Tropical Mix</SelectItem>
                  <SelectItem value="orchid_bark">Orchid Bark</SelectItem>
                  <SelectItem value="succulent_mix">Succulent Mix</SelectItem>
                  <SelectItem value="potting_soil_general">General Potting Soil</SelectItem>
                  <SelectItem value="chunky_aroid">Chunky Aroid</SelectItem>
                  <SelectItem value="carnivorous_mix">Carnivorous Mix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Watering Frequency (days)</Label>
              <Input
                type="number"
                value={editData.watering_frequency_days}
                onChange={(e) => setEditData({ ...editData, watering_frequency_days: e.target.value })}
                className="mt-2"
              />
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

      {/* Environment Edit Modal */}
      <Dialog open={showEnvironmentModal} onOpenChange={setShowEnvironmentModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Environment Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="space-y-4">
              <h4 className="font-semibold">☀️ Light Setup</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Window Direction</Label>
                  <Select value={envData.window_direction} onValueChange={(v) => setEnvData({ ...envData, window_direction: v })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="north">North</SelectItem>
                      <SelectItem value="east">East</SelectItem>
                      <SelectItem value="south">South</SelectItem>
                      <SelectItem value="west">West</SelectItem>
                      <SelectItem value="none">No window</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Distance from Window</Label>
                  <Select value={envData.distance_from_window} onValueChange={(v) => setEnvData({ ...envData, distance_from_window: v })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_sill">On windowsill</SelectItem>
                      <SelectItem value="1-3ft">1-3 feet</SelectItem>
                      <SelectItem value="3-6ft">3-6 feet</SelectItem>
                      <SelectItem value="6ft_plus">6+ feet</SelectItem>
                      <SelectItem value="no_window">No window</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Daily Light Hours</Label>
                <Input
                  type="number"
                  value={envData.daily_light_hours}
                  onChange={(e) => setEnvData({ ...envData, daily_light_hours: parseFloat(e.target.value) })}
                  className="mt-2"
                  placeholder="8"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={envData.has_grow_light}
                  onChange={(e) => setEnvData({ ...envData, has_grow_light: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label>Using grow light</Label>
              </div>

              {envData.has_grow_light && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div>
                    <Label>Grow Light Hours/Day</Label>
                    <Input
                      type="number"
                      value={envData.grow_light_hours}
                      onChange={(e) => setEnvData({ ...envData, grow_light_hours: parseFloat(e.target.value) })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Grow Light Type</Label>
                    <Select value={envData.grow_light_type} onValueChange={(v) => setEnvData({ ...envData, grow_light_type: v })}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="led_full_spectrum">LED Full Spectrum</SelectItem>
                        <SelectItem value="led_red_blue">LED Red/Blue</SelectItem>
                        <SelectItem value="fluorescent">Fluorescent</SelectItem>
                        <SelectItem value="t5">T5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">💧 Watering</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Method</Label>
                  <Select value={envData.watering_method} onValueChange={(v) => setEnvData({ ...envData, watering_method: v })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top water</SelectItem>
                      <SelectItem value="bottom">Bottom water</SelectItem>
                      <SelectItem value="ice_cube">Ice cube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Soil Dryness Preference</Label>
                  <Select value={envData.soil_dryness_preference} onValueChange={(v) => setEnvData({ ...envData, soil_dryness_preference: v })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep_moist">Keep moist</SelectItem>
                      <SelectItem value="top_inch_dry">Top 1" dry</SelectItem>
                      <SelectItem value="top_half_dry">Top half dry</SelectItem>
                      <SelectItem value="fully_dry">Fully dry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">💨 Humidity & Airflow</h4>
              <div>
                <Label>Humidity Support Method</Label>
                <Select value={envData.humidity_support_method} onValueChange={(v) => setEnvData({ ...envData, humidity_support_method: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="pebble_tray">Pebble tray</SelectItem>
                    <SelectItem value="grouping">Plant grouping</SelectItem>
                    <SelectItem value="misting">Regular misting</SelectItem>
                    <SelectItem value="humidifier">Humidifier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={envData.draft_exposure}
                  onChange={(e) => setEnvData({ ...envData, draft_exposure: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label>Near vent, door, or drafty window</Label>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">🌱 Fertilizer</h4>
              <div>
                <Label>Fertilizer Type Used</Label>
                <Input
                  value={envData.fertilizer_type_used}
                  onChange={(e) => setEnvData({ ...envData, fertilizer_type_used: e.target.value })}
                  placeholder="e.g., Balanced 10-10-10"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Brand</Label>
                <Input
                  value={envData.fertilizer_brand}
                  onChange={(e) => setEnvData({ ...envData, fertilizer_brand: e.target.value })}
                  placeholder="e.g., Schultz, Miracle-Gro"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">🪴 Pot & Soil</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pot Material</Label>
                  <Select value={envData.current_pot_material} onValueChange={(v) => setEnvData({ ...envData, current_pot_material: v })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plastic">Plastic</SelectItem>
                      <SelectItem value="ceramic">Ceramic</SelectItem>
                      <SelectItem value="terracotta">Terracotta</SelectItem>
                      <SelectItem value="fabric">Fabric</SelectItem>
                      <SelectItem value="self_watering">Self-watering</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <input
                    type="checkbox"
                    checked={envData.pot_has_drainage}
                    onChange={(e) => setEnvData({ ...envData, pot_has_drainage: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label>Has drainage holes</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnvironmentModal(false)}>Cancel</Button>
            <Button onClick={handleSaveEnvironment} className="bg-emerald-600 hover:bg-emerald-700">
              Save Environment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CareSection({ icon, title, expanded, onToggle, summary, children }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50 transition-colors py-3"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <span className="font-semibold">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{summary}</span>
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
}