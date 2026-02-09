import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Droplet, Sprout, Scissors, FileText, Camera, Plus, Loader2,
  Sun, Thermometer, Droplets, Wind, Package, Zap, RefreshCw, AlertTriangle, MapPin,
  CheckCircle2, X, Edit, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

export default function IndoorPlantDetailV2() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plantId = searchParams.get('id');
  
  const [plant, setPlant] = useState(null);
  const [variety, setVariety] = useState(null);
  const [space, setSpace] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plantId) loadData();
  }, [plantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const plantData = await base44.entities.IndoorPlant.filter({ id: plantId });
      if (!plantData[0]) {
        toast.error('Plant not found');
        navigate(createPageUrl('MyIndoorPlants'));
        return;
      }
      
      const p = plantData[0];
      setPlant(p);
      setEditForm(p);

      if (p.variety_id) {
        const varietyData = await base44.entities.Variety.filter({ id: p.variety_id });
        setVariety(varietyData[0]);
      }

      if (p.indoor_space_id) {
        const spaceData = await base44.entities.IndoorSpace.filter({ id: p.indoor_space_id });
        setSpace(spaceData[0]);
      }

      const logsData = await base44.entities.IndoorPlantLog.filter(
        { indoor_plant_id: plantId },
        '-log_date',
        50
      );
      setLogs(logsData);
    } catch (error) {
      console.error('Error loading plant:', error);
      toast.error('Failed to load plant');
    } finally {
      setLoading(false);
    }
  };

  const logCareAction = async (logType, extraData = {}) => {
    try {
      await base44.entities.IndoorPlantLog.create({
        indoor_plant_id: plantId,
        log_type: logType,
        log_date: new Date().toISOString().split('T')[0],
        ...extraData
      });

      const updates = {};
      if (logType === 'watered') updates.last_watered_date = new Date().toISOString().split('T')[0];
      if (logType === 'fertilized') updates.last_fertilized_date = new Date().toISOString().split('T')[0];
      if (logType === 'pruned') updates.last_pruned_date = new Date().toISOString().split('T')[0];
      if (logType === 'repotted') updates.last_repotted_date = new Date().toISOString().split('T')[0];

      if (Object.keys(updates).length > 0) {
        await base44.entities.IndoorPlant.update(plantId, updates);
      }

      toast.success(`${logType.charAt(0).toUpperCase() + logType.slice(1)} logged!`);
      loadData();
    } catch (error) {
      console.error('Error logging action:', error);
      toast.error('Failed to log action');
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      await base44.entities.IndoorPlant.update(plantId, editForm);
      toast.success('Changes saved!');
      setEditMode(false);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!plant) return null;

  const age = plant.acquisition_date 
    ? formatDistanceToNow(new Date(plant.acquisition_date), { addSuffix: false })
    : 'Unknown';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('MyIndoorPlants'))}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{plant.nickname || variety?.variety_name || 'My Plant'}</h1>
          {plant.nickname && variety && (
            <p className="text-gray-600 italic">{variety.variety_name}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-600">
            {space && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {space.name}
              </span>
            )}
            {plant.health_status && (
              <Badge className={
                plant.health_status === 'thriving' ? 'bg-emerald-100 text-emerald-800' :
                plant.health_status === 'healthy' ? 'bg-green-100 text-green-800' :
                plant.health_status === 'struggling' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }>
                {plant.health_status}
              </Badge>
            )}
            <span>{age} old</span>
          </div>
        </div>
      </div>

      {(variety?.toxic_to_cats || variety?.toxic_to_dogs || variety?.toxic_to_humans) && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Toxic Plant Warning</p>
            <p className="text-sm text-red-800 mt-1">
              {variety.toxic_to_cats && 'Toxic to cats. '}
              {variety.toxic_to_dogs && 'Toxic to dogs. '}
              {variety.toxic_to_humans && 'Toxic to humans. '}
              {variety.toxicity_notes}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => logCareAction('watered')} className="bg-blue-600 hover:bg-blue-700">
          <Droplet className="w-4 h-4 mr-2" />
          Water
        </Button>
        <Button onClick={() => logCareAction('fertilized')} className="bg-green-600 hover:bg-green-700">
          <Sprout className="w-4 h-4 mr-2" />
          Fertilize
        </Button>
        <Button onClick={() => logCareAction('pruned')} className="bg-purple-600 hover:bg-purple-700">
          <Scissors className="w-4 h-4 mr-2" />
          Prune
        </Button>
        <Button onClick={() => logCareAction('note', { notes: prompt('Add a note:') })} variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Log Note
        </Button>
        <Button onClick={() => toast.info('Photo upload coming soon')} variant="outline">
          <Camera className="w-4 h-4 mr-2" />
          Add Photo
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="care">Care Guide</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab plant={plant} variety={variety} logs={logs} />
        </TabsContent>

        <TabsContent value="care" className="space-y-4">
          <CareGuideTab variety={variety} />
        </TabsContent>

        <TabsContent value="environment" className="space-y-4">
          <EnvironmentTab 
            plant={plant}
            editForm={editForm}
            setEditForm={setEditForm}
            editMode={editMode}
            setEditMode={setEditMode}
            saving={saving}
            saveChanges={saveChanges}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <HistoryTab logs={logs} />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <StatsTab plant={plant} logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ plant, variety, logs }) {
  const lastWatered = plant.last_watered_date 
    ? formatDistanceToNow(new Date(plant.last_watered_date), { addSuffix: true })
    : 'Never';
  const lastFertilized = plant.last_fertilized_date 
    ? formatDistanceToNow(new Date(plant.last_fertilized_date), { addSuffix: true })
    : 'Never';
  const lastRepotted = plant.last_repotted_date 
    ? formatDistanceToNow(new Date(plant.last_repotted_date), { addSuffix: true })
    : 'Never';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Care Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Droplet className="w-4 h-4 text-blue-600" />
              Last watered
            </span>
            <span className="font-medium">{lastWatered}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-green-600" />
              Last fertilized
            </span>
            <span className="font-medium">{lastFertilized}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-600" />
              Last repotted
            </span>
            <span className="font-medium">{lastRepotted}</span>
          </div>
          {plant.current_height_inches && (
            <div className="flex items-center justify-between border-t pt-3">
              <span>Height</span>
              <span className="font-medium">{plant.current_height_inches}"</span>
            </div>
          )}
          {plant.current_width_inches && (
            <div className="flex items-center justify-between">
              <span>Width</span>
              <span className="font-medium">{plant.current_width_inches}"</span>
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
            <p>🪟 {plant.window_direction.charAt(0).toUpperCase() + plant.window_direction.slice(1)} window • {plant.distance_from_window?.replace(/_/g, ' ')} • {plant.daily_light_hours || '?'}hr light</p>
          )}
          {plant.watering_method && (
            <p>💧 {plant.watering_method.charAt(0).toUpperCase() + plant.watering_method.slice(1)} water • {plant.soil_dryness_preference?.replace(/_/g, ' ')}</p>
          )}
          {variety?.temp_ideal_min_f && variety?.temp_ideal_max_f && (
            <p>🌡️ {variety.temp_ideal_min_f}-{variety.temp_ideal_max_f}°F ideal</p>
          )}
          {variety?.humidity_preference && (
            <p>💨 {variety.humidity_preference.charAt(0).toUpperCase() + variety.humidity_preference.slice(1)} humidity</p>
          )}
          {plant.soil_type && (
            <p>🪴 {plant.soil_type.replace(/_/g, ' ')} • {plant.pot_type || 'Unknown pot'} • {plant.has_drainage ? 'Has drainage' : 'No drainage'}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CareGuideTab({ variety }) {
  const [expanded, setExpanded] = useState({});

  const toggleSection = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!variety) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          No variety data available
        </CardContent>
      </Card>
    );
  }

  const sections = [
    {
      key: 'light',
      icon: Sun,
      title: '☀️ Light',
      summary: variety.light_requirement_indoor || 'Not specified',
      details: (
        <div className="space-y-2 text-sm">
          {variety.light_requirement_indoor && <p><strong>Requirement:</strong> {variety.light_requirement_indoor.replace(/_/g, ' ')}</p>}
          {variety.light_tolerance_range && <p><strong>Tolerance:</strong> {variety.light_tolerance_range}</p>}
          {variety.min_light_hours && <p><strong>Min hours:</strong> {variety.min_light_hours}hr/day</p>}
          {variety.max_light_hours && <p><strong>Max hours:</strong> {variety.max_light_hours}hr/day</p>}
          {variety.grow_light_compatible && <p>✓ Grow light compatible</p>}
        </div>
      )
    },
    {
      key: 'water',
      icon: Droplets,
      title: '💧 Watering',
      summary: variety.watering_frequency_range || 'Moderate',
      details: (
        <div className="space-y-2 text-sm">
          {variety.watering_frequency_range && <p><strong>Frequency:</strong> Every {variety.watering_frequency_range.replace(/_/g, '-')} days</p>}
          {variety.watering_method_preferred && <p><strong>Method:</strong> {variety.watering_method_preferred.replace(/_/g, ' ')}</p>}
          {variety.soil_dryness_rule && <p><strong>When to water:</strong> {variety.soil_dryness_rule.replace(/_/g, ' ')}</p>}
          {variety.overwater_sensitivity && <p><strong>Overwater sensitivity:</strong> {variety.overwater_sensitivity}</p>}
        </div>
      )
    },
    {
      key: 'temp',
      icon: Thermometer,
      title: '🌡️ Temperature',
      summary: variety.temp_ideal_min_f ? `${variety.temp_ideal_min_f}-${variety.temp_ideal_max_f}°F` : 'Room temp',
      details: (
        <div className="space-y-2 text-sm">
          {variety.temp_ideal_min_f && <p><strong>Ideal range:</strong> {variety.temp_ideal_min_f}-{variety.temp_ideal_max_f}°F</p>}
          {variety.temp_min_f && <p><strong>Min safe:</strong> {variety.temp_min_f}°F</p>}
          {variety.temp_max_f && <p><strong>Max safe:</strong> {variety.temp_max_f}°F</p>}
          {variety.cold_draft_sensitive && <p>⚠️ Sensitive to cold drafts</p>}
        </div>
      )
    },
    {
      key: 'humidity',
      icon: Droplets,
      title: '💨 Humidity',
      summary: variety.humidity_preference || 'Medium',
      details: (
        <div className="space-y-2 text-sm">
          {variety.humidity_preference && <p><strong>Preference:</strong> {variety.humidity_preference} (30-90%)</p>}
          {variety.humidity_support_method && <p><strong>Support:</strong> {variety.humidity_support_method.replace(/_/g, ' ')}</p>}
          {variety.misting_beneficial && <p>✓ Misting is beneficial</p>}
        </div>
      )
    },
    {
      key: 'fertilizer',
      icon: Zap,
      title: '🌱 Fertilization',
      summary: variety.fertilizer_frequency || 'Monthly',
      details: (
        <div className="space-y-2 text-sm">
          {variety.fertilizer_type && <p><strong>Type:</strong> {variety.fertilizer_type.replace(/_/g, ' ')}</p>}
          {variety.fertilizer_frequency && <p><strong>Frequency:</strong> {variety.fertilizer_frequency.replace(/_/g, ' ')}</p>}
          {variety.fertilizer_strength && <p><strong>Strength:</strong> {variety.fertilizer_strength}</p>}
          {variety.dormant_season_feeding === false && <p>⚠️ Skip feeding in winter</p>}
        </div>
      )
    },
    {
      key: 'growth',
      icon: RefreshCw,
      title: '📏 Growth',
      summary: variety.growth_pattern || 'Unknown',
      details: (
        <div className="space-y-2 text-sm">
          {variety.growth_pattern && <p><strong>Pattern:</strong> {variety.growth_pattern}</p>}
          {variety.mature_indoor_height && <p><strong>Height:</strong> {variety.mature_indoor_height}</p>}
          {variety.mature_indoor_width && <p><strong>Width:</strong> {variety.mature_indoor_width}</p>}
          {variety.growth_speed && <p><strong>Speed:</strong> {variety.growth_speed}</p>}
          {variety.needs_support && <p>⚠️ Needs support (moss pole/trellis)</p>}
          {variety.pruning_needs && <p><strong>Pruning:</strong> {variety.pruning_needs}</p>}
        </div>
      )
    },
    {
      key: 'repot',
      icon: Package,
      title: '🔄 Repotting',
      summary: variety.repot_frequency_years || 'Every 1-2 years',
      details: (
        <div className="space-y-2 text-sm">
          {variety.repot_frequency_years && <p><strong>Frequency:</strong> Every {variety.repot_frequency_years} year(s)</p>}
          {variety.rootbound_tolerance && <p><strong>Rootbound tolerance:</strong> {variety.rootbound_tolerance}</p>}
          {variety.best_repot_season && <p><strong>Best time:</strong> {variety.best_repot_season.replace(/_/g, ' ')}</p>}
        </div>
      )
    },
    {
      key: 'propagation',
      icon: Plus,
      title: '🌿 Propagation',
      summary: variety.propagation_difficulty || 'Unknown',
      details: (
        <div className="space-y-2 text-sm">
          {variety.propagation_methods && <p><strong>Methods:</strong> {JSON.parse(variety.propagation_methods || '[]').join(', ').replace(/_/g, ' ')}</p>}
          {variety.propagation_difficulty && <p><strong>Difficulty:</strong> {variety.propagation_difficulty}</p>}
          {variety.propagation_best_season && <p><strong>Best time:</strong> {variety.propagation_best_season.replace(/_/g, ' ')}</p>}
          {variety.propagation_notes && <p className="italic">{variety.propagation_notes}</p>}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-2">
      {sections.map(section => (
        <Card key={section.key}>
          <CardContent className="p-4">
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <section.icon className="w-5 h-5 text-emerald-600" />
                <div className="text-left">
                  <p className="font-semibold">{section.title}</p>
                  {!expanded[section.key] && (
                    <p className="text-sm text-gray-600">{section.summary}</p>
                  )}
                </div>
              </div>
              {expanded[section.key] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expanded[section.key] && (
              <div className="mt-4 pt-4 border-t">
                {section.details}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EnvironmentTab({ plant, editForm, setEditForm, editMode, setEditMode, saving, saveChanges }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Plant's Environment</h3>
        {!editMode ? (
          <Button onClick={() => setEditMode(true)} variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => setEditMode(false)} variant="ghost" size="sm">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={saveChanges} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700" size="sm">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>☀️ Light Setup</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {editMode ? (
            <>
              <div>
                <Label>Window Direction</Label>
                <Select value={editForm.window_direction || ''} onValueChange={(v) => setEditForm({...editForm, window_direction: v})}>
                  <SelectTrigger><SelectValue placeholder="Select direction" /></SelectTrigger>
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
                <Select value={editForm.distance_from_window || ''} onValueChange={(v) => setEditForm({...editForm, distance_from_window: v})}>
                  <SelectTrigger><SelectValue placeholder="Select distance" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_sill">On windowsill</SelectItem>
                    <SelectItem value="1-3ft">1-3 feet</SelectItem>
                    <SelectItem value="3-6ft">3-6 feet</SelectItem>
                    <SelectItem value="6ft_plus">6+ feet</SelectItem>
                    <SelectItem value="no_window">No window</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Daily Light Hours</Label>
                <Input type="number" value={editForm.daily_light_hours || ''} onChange={(e) => setEditForm({...editForm, daily_light_hours: parseInt(e.target.value)})} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editForm.has_grow_light || false} onChange={(e) => setEditForm({...editForm, has_grow_light: e.target.checked})} />
                <Label>Using grow light</Label>
              </div>
              {editForm.has_grow_light && (
                <>
                  <div>
                    <Label>Grow Light Hours</Label>
                    <Input type="number" value={editForm.grow_light_hours || ''} onChange={(e) => setEditForm({...editForm, grow_light_hours: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <Label>Grow Light Type</Label>
                    <Select value={editForm.grow_light_type || ''} onValueChange={(v) => setEditForm({...editForm, grow_light_type: v})}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="led_full_spectrum">LED Full Spectrum</SelectItem>
                        <SelectItem value="led_red_blue">LED Red/Blue</SelectItem>
                        <SelectItem value="fluorescent">Fluorescent</SelectItem>
                        <SelectItem value="t5">T5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p><strong>Window:</strong> {plant.window_direction || 'Not set'}</p>
              <p><strong>Distance:</strong> {plant.distance_from_window?.replace(/_/g, ' ') || 'Not set'}</p>
              <p><strong>Light hours:</strong> {plant.daily_light_hours || 'Not set'}</p>
              {plant.has_grow_light && (
                <>
                  <p><strong>Grow light:</strong> {plant.grow_light_type?.replace(/_/g, ' ')}</p>
                  <p><strong>Grow light hours:</strong> {plant.grow_light_hours}</p>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>💧 Watering Setup</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {editMode ? (
            <>
              <div>
                <Label>Method</Label>
                <Select value={editForm.watering_method || ''} onValueChange={(v) => setEditForm({...editForm, watering_method: v})}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top water</SelectItem>
                    <SelectItem value="bottom">Bottom water</SelectItem>
                    <SelectItem value="ice_cube">Ice cube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency (days)</Label>
                <Input type="number" value={editForm.watering_frequency_days || ''} onChange={(e) => setEditForm({...editForm, watering_frequency_days: parseInt(e.target.value)})} />
              </div>
              <div>
                <Label>Dryness Rule</Label>
                <Select value={editForm.soil_dryness_preference || ''} onValueChange={(v) => setEditForm({...editForm, soil_dryness_preference: v})}>
                  <SelectTrigger><SelectValue placeholder="Select rule" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep_moist">Keep moist</SelectItem>
                    <SelectItem value="top_inch_dry">Let top 1-2" dry</SelectItem>
                    <SelectItem value="top_half_dry">Let top half dry</SelectItem>
                    <SelectItem value="fully_dry">Fully dry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <p><strong>Method:</strong> {plant.watering_method || 'Not set'}</p>
              <p><strong>Frequency:</strong> Every {plant.watering_frequency_days || '?'} days</p>
              <p><strong>Dryness:</strong> {plant.soil_dryness_preference?.replace(/_/g, ' ') || 'Not set'}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>🪴 Pot & Soil</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {editMode ? (
            <>
              <div>
                <Label>Pot Material</Label>
                <Select value={editForm.current_pot_material || ''} onValueChange={(v) => setEditForm({...editForm, current_pot_material: v})}>
                  <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plastic">Plastic</SelectItem>
                    <SelectItem value="ceramic">Ceramic</SelectItem>
                    <SelectItem value="terracotta">Terracotta</SelectItem>
                    <SelectItem value="fabric">Fabric</SelectItem>
                    <SelectItem value="self_watering">Self-watering</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pot Size (inches)</Label>
                <Input type="number" value={editForm.pot_size_inches || ''} onChange={(e) => setEditForm({...editForm, pot_size_inches: parseInt(e.target.value)})} />
              </div>
              <div>
                <Label>Soil Type</Label>
                <Select value={editForm.soil_type || ''} onValueChange={(v) => setEditForm({...editForm, soil_type: v})}>
                  <SelectTrigger><SelectValue placeholder="Select soil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="potting_soil_general">All-purpose potting soil</SelectItem>
                    <SelectItem value="chunky_aroid">Chunky aroid mix</SelectItem>
                    <SelectItem value="cactus_mix">Cactus/succulent mix</SelectItem>
                    <SelectItem value="orchid_bark">Orchid bark</SelectItem>
                    <SelectItem value="tropical_mix">Tropical mix</SelectItem>
                    <SelectItem value="carnivorous_mix">Carnivorous mix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <p><strong>Material:</strong> {plant.current_pot_material || plant.pot_type || 'Not set'}</p>
              <p><strong>Size:</strong> {plant.pot_size_inches}" diameter</p>
              <p><strong>Soil:</strong> {plant.soil_type?.replace(/_/g, ' ') || 'Not set'}</p>
              <p><strong>Drainage:</strong> {plant.has_drainage ? 'Yes' : 'No'}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryTab({ logs }) {
  const iconMap = {
    watered: { icon: Droplet, color: 'text-blue-600' },
    fertilized: { icon: Sprout, color: 'text-green-600' },
    pruned: { icon: Scissors, color: 'text-purple-600' },
    repotted: { icon: Package, color: 'text-orange-600' },
    note: { icon: FileText, color: 'text-gray-600' },
    photo: { icon: Camera, color: 'text-pink-600' },
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          No care logs yet. Log your first care action!
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map(log => {
        const { icon: Icon, color } = iconMap[log.log_type] || { icon: CheckCircle2, color: 'text-gray-600' };
        return (
          <Card key={log.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 ${color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium capitalize">{log.log_type.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-gray-500">{format(new Date(log.log_date), 'MMM d, yyyy')}</p>
                  </div>
                  {log.notes && <p className="text-sm text-gray-600 mt-1">{log.notes}</p>}
                  {log.watering_amount && <p className="text-xs text-gray-500">Amount: {log.watering_amount}</p>}
                  {log.fertilizer_type && <p className="text-xs text-gray-500">Type: {log.fertilizer_type.replace(/_/g, ' ')}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StatsTab({ plant, logs }) {
  const wateringLogs = logs.filter(l => l.log_type === 'watered');
  const fertilizingLogs = logs.filter(l => l.log_type === 'fertilized');
  const repottingLogs = logs.filter(l => l.log_type === 'repotted');
  const photoLogs = logs.filter(l => l.log_type === 'photo');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>📊 Care Activity</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Total waterings:</span>
            <span className="font-bold">{wateringLogs.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Total fertilizations:</span>
            <span className="font-bold">{fertilizingLogs.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Times repotted:</span>
            <span className="font-bold">{repottingLogs.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Photos logged:</span>
            <span className="font-bold">{photoLogs.length}</span>
          </div>
        </CardContent>
      </Card>

      {plant.acquisition_date && (
        <Card>
          <CardHeader><CardTitle>🏅 Plant Milestones</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>🎂 Acquired {format(new Date(plant.acquisition_date), 'MMM d, yyyy')}</p>
            {plant.propagation_children_count > 0 && (
              <p>🌿 {plant.propagation_children_count} successful propagations</p>
            )}
            {wateringLogs.length >= 100 && <p>💧 100+ waterings milestone reached!</p>}
            {logs.length >= 50 && <p>📝 50+ care logs recorded!</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}