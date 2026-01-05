import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sprout, Plus, Loader2, Image as ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'seed', label: '🌰 Seed', color: 'bg-gray-100 text-gray-800' },
  { value: 'sprout', label: '🌱 Sprout', color: 'bg-green-100 text-green-800' },
  { value: 'seedling', label: '🌿 Seedling', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'transplanted', label: '🪴 Transplanted', color: 'bg-blue-100 text-blue-800' },
  { value: 'flowering', label: '🌸 Flowering', color: 'bg-pink-100 text-pink-800' },
  { value: 'fruiting', label: '🍅 Fruiting', color: 'bg-orange-100 text-orange-800' },
  { value: 'harvested', label: '✂️ Harvested', color: 'bg-purple-100 text-purple-800' },
  { value: 'done', label: '✓ Done', color: 'bg-gray-200 text-gray-600' }
];

export default function MyPlants() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [myPlants, setMyPlants] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [newPlant, setNewPlant] = useState({
    plant_profile_id: '',
    name: '',
    status: 'seed',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeSeason) {
      loadMyPlants();
    }
  }, [activeSeason]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const [gardensData, profilesData] = await Promise.all([
        base44.entities.Garden.filter({
          archived: false,
          created_by: userData.email
        }, '-updated_date'),
        base44.entities.PlantProfile.list('variety_name', 500)
      ]);

      setGardens(gardensData);

      const profilesMap = {};
      profilesData.forEach(p => { profilesMap[p.id] = p; });
      setProfiles(profilesMap);

      if (gardensData.length > 0) {
        const garden = gardensData[0];
        setActiveGarden(garden);

        const seasonsData = await base44.entities.GardenSeason.filter({
          garden_id: garden.id
        }, '-year');

        if (seasonsData.length > 0) {
          setSeasons(seasonsData);
          setActiveSeason(seasonsData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyPlants = async () => {
    try {
      const plants = await base44.entities.MyPlant.filter({
        garden_season_id: activeSeason.id,
        created_by: user.email
      }, '-updated_date');
      setMyPlants(plants);
    } catch (error) {
      console.error('Error loading plants:', error);
    }
  };

  const handleAddPlant = async () => {
    if (!newPlant.plant_profile_id) {
      toast.error('Please select a plant variety');
      return;
    }

    try {
      await base44.entities.MyPlant.create({
        garden_season_id: activeSeason.id,
        plant_profile_id: newPlant.plant_profile_id,
        name: newPlant.name,
        status: newPlant.status,
        notes: newPlant.notes
      });

      await loadMyPlants();
      setShowAddPlant(false);
      setNewPlant({ plant_profile_id: '', name: '', status: 'seed', notes: '' });
      toast.success('Plant added!');
    } catch (error) {
      console.error('Error adding plant:', error);
      toast.error('Failed to add plant');
    }
  };

  const handleUpdateStatus = async (plant, newStatus) => {
    try {
      const updateData = { status: newStatus };
      
      // Auto-set milestone dates
      if (newStatus === 'sprout' && !plant.germination_date) {
        updateData.germination_date = new Date().toISOString().split('T')[0];
      }
      if (newStatus === 'transplanted' && !plant.transplant_date) {
        updateData.transplant_date = new Date().toISOString().split('T')[0];
      }
      if (newStatus === 'harvested' && !plant.first_harvest_date) {
        updateData.first_harvest_date = new Date().toISOString().split('T')[0];
      }

      await base44.entities.MyPlant.update(plant.id, updateData);
      await loadMyPlants();
      toast.success('Status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlant) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const existingPhotos = selectedPlant.photos || [];
      await base44.entities.MyPlant.update(selectedPlant.id, {
        photos: [...existingPhotos, {
          url: file_url,
          caption: '',
          taken_at: new Date().toISOString()
        }]
      });

      await loadMyPlants();
      const updatedPlant = myPlants.find(p => p.id === selectedPlant.id);
      setSelectedPlant(updatedPlant);
      toast.success('Photo added!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const filteredPlants = myPlants.filter(plant => {
    if (statusFilter !== 'all' && plant.status !== statusFilter) return false;
    if (searchQuery) {
      const profile = profiles[plant.plant_profile_id];
      const searchStr = `${plant.name || ''} ${profile?.variety_name || ''} ${profile?.common_name || ''}`.toLowerCase();
      if (!searchStr.includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  // Group by status
  const plantsByStatus = STATUS_OPTIONS.reduce((acc, status) => {
    acc[status.value] = filteredPlants.filter(p => p.status === status.value);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!activeSeason) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No active season</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sprout className="w-6 h-6 text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900">My Plants</h1>
        </div>
        <Button
          onClick={() => setShowAddPlant(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Plant
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Search plants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {gardens.length > 1 && (
          <Select value={activeGarden?.id} onValueChange={(id) => {
            const garden = gardens.find(g => g.id === id);
            setActiveGarden(garden);
          }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gardens.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={activeSeason?.id} onValueChange={(id) => setActiveSeason(seasons.find(s => s.id === id))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seasons.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.year} {s.season}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plants by Status */}
      <div className="space-y-6">
        {STATUS_OPTIONS.map(statusOpt => {
          const plants = plantsByStatus[statusOpt.value] || [];
          if (plants.length === 0) return null;

          return (
            <div key={statusOpt.value}>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                {statusOpt.label}
                <Badge variant="outline">{plants.length}</Badge>
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {plants.map(plant => {
                  const profile = profiles[plant.plant_profile_id];
                  const mainPhoto = plant.photos?.[0];
                  
                  return (
                    <Card 
                      key={plant.id} 
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedPlant(plant)}
                    >
                      {mainPhoto && (
                        <div className="h-48 overflow-hidden rounded-t-lg">
                          <img
                            src={mainPhoto.url}
                            alt={plant.name || profile?.variety_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {plant.name || profile?.variety_name || 'Unnamed Plant'}
                        </CardTitle>
                        <p className="text-sm text-gray-600">{profile?.common_name}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Badge className={STATUS_OPTIONS.find(s => s.value === plant.status)?.color}>
                            {STATUS_OPTIONS.find(s => s.value === plant.status)?.label}
                          </Badge>
                          {plant.germination_date && (
                            <p className="text-xs text-gray-500">
                              Germinated: {format(new Date(plant.germination_date), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {filteredPlants.length === 0 && (
        <div className="text-center py-12">
          <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No plants yet</p>
          <Button
            onClick={() => setShowAddPlant(true)}
            variant="outline"
            className="mt-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Plant
          </Button>
        </div>
      )}

      {/* Add Plant Modal */}
      <Dialog open={showAddPlant} onOpenChange={setShowAddPlant}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Plant to Track</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Variety</Label>
              <Select
                value={newPlant.plant_profile_id}
                onValueChange={(v) => {
                  const profile = profiles[v];
                  setNewPlant({ 
                    ...newPlant, 
                    plant_profile_id: v,
                    name: profile?.variety_name || ''
                  });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select variety" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Object.values(profiles).slice(0, 100).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.variety_name} ({p.common_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Custom Name (optional)</Label>
              <Input
                value={newPlant.name}
                onChange={(e) => setNewPlant({ ...newPlant, name: e.target.value })}
                placeholder="e.g., Cherry Tom #1"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Current Status</Label>
              <Select
                value={newPlant.status}
                onValueChange={(v) => setNewPlant({ ...newPlant, status: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={newPlant.notes}
                onChange={(e) => setNewPlant({ ...newPlant, notes: e.target.value })}
                placeholder="Add notes..."
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPlant(false)}>Cancel</Button>
            <Button
              onClick={handleAddPlant}
              disabled={!newPlant.plant_profile_id}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Add Plant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plant Detail Modal */}
      {selectedPlant && (
        <Dialog open={!!selectedPlant} onOpenChange={() => setSelectedPlant(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedPlant.name || profiles[selectedPlant.plant_profile_id]?.variety_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={selectedPlant.status}
                  onValueChange={(v) => handleUpdateStatus(selectedPlant, v)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Photos</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('photo-upload-input').click()}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Add Photo
                  </Button>
                  <input
                    id="photo-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>
                {selectedPlant.photos && selectedPlant.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {selectedPlant.photos.map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo.url}
                        alt={photo.caption || 'Plant photo'}
                        className="w-full h-24 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
                {(!selectedPlant.photos || selectedPlant.photos.length === 0) && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No photos yet</p>
                  </div>
                )}
              </div>

              {selectedPlant.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{selectedPlant.notes}</p>
                </div>
              )}

              {/* Milestones */}
              <div>
                <Label>Milestones</Label>
                <div className="space-y-2 mt-2 text-sm">
                  {selectedPlant.germination_date ? (
                    <p className="text-gray-600">
                      🌱 Germinated: {format(new Date(selectedPlant.germination_date), 'MMM d, yyyy')}
                    </p>
                  ) : (
                    <p className="text-gray-400">🌱 Not germinated yet</p>
                  )}
                  {selectedPlant.transplant_date ? (
                    <p className="text-gray-600">
                      🪴 Transplanted: {format(new Date(selectedPlant.transplant_date), 'MMM d, yyyy')}
                    </p>
                  ) : (
                    <p className="text-gray-400">🪴 Not transplanted yet</p>
                  )}
                  {selectedPlant.first_harvest_date ? (
                    <p className="text-gray-600">
                      ✂️ First Harvest: {format(new Date(selectedPlant.first_harvest_date), 'MMM d, yyyy')}
                    </p>
                  ) : (
                    <p className="text-gray-400">✂️ Not harvested yet</p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}