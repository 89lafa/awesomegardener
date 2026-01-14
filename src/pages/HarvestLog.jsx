import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import { 
  Apple,
  Plus,
  Calendar as CalendarIcon,
  Loader2,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';

export default function HarvestLog() {
  const [searchParams] = useSearchParams();
  const [gardens, setGardens] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterGarden, setFilterGarden] = useState('all');
  const [filterSeason, setFilterSeason] = useState('all');
  const [myPlants, setMyPlants] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [seasons, setSeasons] = useState([]);
  
  const [formData, setFormData] = useState({
    garden_id: '',
    garden_season_id: '',
    plant_instance_id: '',
    harvest_date: format(new Date(), 'yyyy-MM-dd'),
    quantity: '',
    unit: 'lbs',
    plant_part: 'fruit',
    quality_rating: 5,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  // Pre-open dialog with plant if coming from My Plants
  useEffect(() => {
    const plantParam = searchParams.get('plant');
    const newParam = searchParams.get('new');
    if (plantParam && newParam === 'true' && myPlants.length > 0) {
      setFormData(prev => ({ ...prev, plant_instance_id: plantParam }));
      setShowDialog(true);
      window.history.replaceState({}, '', createPageUrl('HarvestLog') + `?plant=${plantParam}`);
    }
  }, [searchParams, myPlants]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      const [gardensData, harvestsData, plantingsData, plantsData, profilesData, seasonsData] = await Promise.all([
        base44.entities.Garden.filter({ archived: false, created_by: userData.email }),
        base44.entities.HarvestLog.filter({ created_by: userData.email }, '-harvest_date'),
        base44.entities.PlantInstance.filter({ created_by: userData.email }, 'display_name'),
        base44.entities.MyPlant.filter({ created_by: userData.email }),
        base44.entities.PlantProfile.list('variety_name', 500),
        base44.entities.GardenSeason.filter({ created_by: userData.email }, '-year')
      ]);
      
      setGardens(gardensData);
      setHarvests(harvestsData);
      setPlantings(plantingsData);
      setMyPlants(plantsData);
      setSeasons(seasonsData);
      
      const profilesMap = {};
      profilesData.forEach(p => { profilesMap[p.id] = p; });
      setProfiles(profilesMap);
      
      if (gardensData.length > 0) {
        setFormData({ ...formData, garden_id: gardensData[0].id });
      }
    } catch (error) {
      console.error('Error loading harvests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.garden_id || !formData.harvest_date || saving) return;
    
    setSaving(true);
    try {
      const data = {
        ...formData,
        quantity: formData.quantity ? parseFloat(formData.quantity) : null
      };
      
      if (editing) {
        await base44.entities.HarvestLog.update(editing.id, data);
        setHarvests(harvests.map(h => h.id === editing.id ? { ...h, ...data } : h));
        toast.success('Harvest updated');
      } else {
        const harvest = await base44.entities.HarvestLog.create(data);
        setHarvests([harvest, ...harvests]);
        toast.success('Harvest logged!');
      }
      handleClose();
    } catch (error) {
      console.error('Error saving harvest:', error);
      toast.error('Failed to save harvest');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditing(null);
    setFormData({
      garden_id: gardens[0]?.id || '',
      garden_season_id: '',
      plant_instance_id: '',
      harvest_date: format(new Date(), 'yyyy-MM-dd'),
      quantity: '',
      unit: 'lbs',
      plant_part: 'fruit',
      quality_rating: 5,
      notes: ''
    });
  };

  const filteredHarvests = harvests.filter(h => {
    if (filterGarden !== 'all' && h.garden_id !== filterGarden) return false;
    if (filterSeason !== 'all' && h.garden_season_id !== filterSeason) return false;
    return true;
  });

  const getPlantingName = (plantingId) => {
    const planting = plantings.find(p => p.id === plantingId);
    return planting?.display_name || 'Unknown plant';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Harvest Log</h1>
          <p className="text-gray-600 mt-1">Record your harvests and yields</p>
        </div>
        <Button 
          onClick={() => setShowDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Log Harvest
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        {gardens.length > 1 && (
          <Select value={filterGarden} onValueChange={setFilterGarden}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Gardens</SelectItem>
              {gardens.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterSeason} onValueChange={setFilterSeason}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Seasons</SelectItem>
            {seasons.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.year} {s.season_type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Harvests List */}
      {filteredHarvests.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Apple className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Harvests Logged</h3>
            <p className="text-gray-600 mb-6">Start tracking your yields</p>
            <Button 
              onClick={() => setShowDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Log First Harvest
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredHarvests.map((harvest) => {
            const garden = gardens.find(g => g.id === harvest.garden_id);
            return (
              <Card key={harvest.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Apple className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {harvest.plant_instance_id && (
                            <span className="font-medium text-gray-900">{getPlantingName(harvest.plant_instance_id)}</span>
                          )}
                          {garden && (
                            <Badge variant="outline" className="text-xs">{garden.name}</Badge>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{format(new Date(harvest.harvest_date), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditing(harvest);
                      setFormData(harvest);
                      setShowDialog(true);
                    }}>
                      Edit
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {harvest.plant_part && (
                      <Badge className="bg-blue-100 text-blue-800 capitalize">
                        {harvest.plant_part === 'fruit' ? '🍅' : 
                         harvest.plant_part === 'leaf' ? '🥬' :
                         harvest.plant_part === 'root' ? '🥕' :
                         harvest.plant_part === 'flower' ? '🌸' :
                         harvest.plant_part === 'seed' ? '🌾' :
                         harvest.plant_part === 'whole_plant' ? '🌿' : '📦'} {harvest.plant_part.replace('_', ' ')}
                      </Badge>
                    )}
                    {harvest.quantity && (
                      <div>
                        <span className="font-semibold text-emerald-700 text-lg">
                          {harvest.quantity} {harvest.unit}
                        </span>
                      </div>
                    )}
                    {harvest.quality_rating && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star 
                            key={idx} 
                            className={`w-4 h-4 ${idx < harvest.quality_rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {harvest.notes && (
                    <p className="text-gray-700 mt-3 text-sm">{harvest.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Harvest' : 'Log Harvest'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Garden *</Label>
              <Select 
                value={formData.garden_id} 
                onValueChange={(v) => setFormData({ ...formData, garden_id: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gardens.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plant (optional)</Label>
              <Select 
                value={formData.plant_instance_id || ''} 
                onValueChange={(v) => setFormData({ ...formData, plant_instance_id: v || null })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select plant" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={null}>None</SelectItem>
                  {myPlants.map(p => {
                    const profile = profiles[p.plant_profile_id];
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name || profile?.variety_name || 'Unknown'} - {p.location_name || 'No location'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Link this harvest to a specific plant</p>
            </div>
            <div>
              <Label htmlFor="date">Harvest Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.harvest_date}
                onChange={(e) => setFormData({ ...formData, harvest_date: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Plant Part</Label>
              <Select 
                value={formData.plant_part} 
                onValueChange={(v) => setFormData({ ...formData, plant_part: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fruit">🍅 Fruit</SelectItem>
                  <SelectItem value="leaf">🥬 Leaf</SelectItem>
                  <SelectItem value="root">🥕 Root</SelectItem>
                  <SelectItem value="flower">🌸 Flower</SelectItem>
                  <SelectItem value="seed">🌾 Seed</SelectItem>
                  <SelectItem value="whole_plant">🌿 Whole Plant</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.1"
                  placeholder="5.5"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(v) => setFormData({ ...formData, unit: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                    <SelectItem value="oz">Ounces (oz)</SelectItem>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Quality Rating</Label>
              <div className="flex gap-2 mt-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormData({ ...formData, quality_rating: idx + 1 })}
                  >
                    <Star 
                      className={`w-6 h-6 transition-colors ${
                        idx < formData.quality_rating 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-gray-300 hover:text-yellow-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="How was the taste, appearance, etc.?"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.garden_id || !formData.harvest_date || saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? 'Update' : 'Log'} Harvest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}