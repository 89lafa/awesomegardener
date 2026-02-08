import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, Droplets, Sprout, Wind, RotateCw, Camera, Edit, MoreVertical,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';


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
  const [editData, setEditData] = useState({});

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

      const [varietyData, spaceData, logsData] = await Promise.all([
        p.variety_id ? base44.entities.Variety.filter({ id: p.variety_id }) : Promise.resolve([]),
        p.indoor_space_id ? base44.entities.IndoorSpace.filter({ id: p.indoor_space_id }) : Promise.resolve([]),
        base44.entities.IndoorPlantLog.filter({ indoor_plant_id: plantId }, '-log_date', 20)
      ]);

      if (varietyData.length > 0) setVariety(varietyData[0]);
      if (spaceData.length > 0) setSpace(spaceData[0]);
      setLogs(logsData);

      setEditData({
        nickname: p.nickname || '',
        watering_frequency_days: p.watering_frequency_days || '',
        pot_type: p.pot_type || 'plastic',
        pot_size_inches: p.pot_size_inches || '',
        special_notes: p.special_notes || ''
      });
    } catch (error) {
      console.error('Error loading plant:', error);
      toast.error('Failed to load plant');
    } finally {
      setLoading(false);
    }
  };

  const logCare = async (type) => {
    try {
      await base44.entities.IndoorPlantLog.create({
        indoor_plant_id: plantId,
        log_type: type,
        log_date: new Date().toISOString()
      });

      const updates = {};
      if (type === 'watered') {
        updates.last_watered_date = new Date().toISOString();
      } else if (type === 'fertilized') {
        updates.last_fertilized_date = new Date().toISOString();
      } else if (type === 'rotated') {
        updates.last_rotated_date = new Date().toISOString();
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
      await base44.entities.IndoorPlant.update(plantId, {
        nickname: editData.nickname || null,
        watering_frequency_days: editData.watering_frequency_days ? parseInt(editData.watering_frequency_days) : null,
        pot_type: editData.pot_type,
        pot_size_inches: editData.pot_size_inches ? parseFloat(editData.pot_size_inches) : null,
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
      recovering: '📈 Recovering'
    };
    return displays[status] || status;
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
              <Button variant="outline" className="w-full mt-2" size="sm">
                <Camera className="w-4 h-4 mr-2" />
                Add Photo
              </Button>
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {plant.nickname || variety?.variety_name || 'Unnamed Plant'}
              </h1>
              {plant.nickname && variety && (
                <p className="text-lg text-gray-600 italic mb-3">{variety.variety_name}</p>
              )}

              <div className="space-y-2 text-sm">
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

                <div className="flex items-center gap-2">
                  <span>💚</span>
                  <span>Health: {getHealthStatusDisplay(plant.health_status || 'healthy')}</span>
                </div>

                {space && (
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span>{space.name}</span>
                  </div>
                )}

                {daysSinceWatered !== null && (
                  <div className="flex items-center gap-2">
                    <span>💧</span>
                    <span>Last Watered: {daysSinceWatered} days ago</span>
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
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="care">Care</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Care Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plant.watering_frequency_days && (
                <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💧</span>
                    <div>
                      <div className="font-medium">Water</div>
                      <div className="text-xs text-gray-500">Every {plant.watering_frequency_days} days</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(plant.last_watered_date)}
                  </div>
                </div>
              )}

              {plant.fertilizing_frequency_weeks && (
                <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🌱</span>
                    <div>
                      <div className="font-medium">Fertilize</div>
                      <div className="text-xs text-gray-500">Every {plant.fertilizing_frequency_weeks} weeks</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(plant.last_fertilized_date)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Container</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {plant.pot_size_inches && (
                <div className="flex items-center gap-2">
                  <span>🪴</span>
                  <span>{plant.pot_size_inches}" {plant.pot_type || 'pot'}</span>
                  {plant.has_drainage && <span className="text-green-600">✓ Drainage</span>}
                </div>
              )}
              {plant.soil_type && (
                <div className="flex items-center gap-2">
                  <span>🌱</span>
                  <span>{plant.soil_type}</span>
                </div>
              )}
              {plant.last_repotted_date && (
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span>Last Repotted: {formatDate(plant.last_repotted_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {(plant.current_height_inches || plant.current_width_inches) && (
            <Card>
              <CardHeader>
                <CardTitle>Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  {plant.current_height_inches && (
                    <div className="bg-emerald-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-emerald-700">{plant.current_height_inches}"</div>
                      <div className="text-sm text-emerald-600">Height</div>
                    </div>
                  )}
                  {plant.current_width_inches && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-700">{plant.current_width_inches}"</div>
                      <div className="text-sm text-green-600">Width</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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

        <TabsContent value="care">
          <Card>
            <CardHeader>
              <CardTitle>Quick Care Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => logCare('watered')}
                  className="bg-blue-500 hover:bg-blue-600 text-white h-24 flex flex-col gap-2"
                >
                  <Droplets size={32} />
                  Log Watering
                </Button>

                <Button
                  onClick={() => logCare('fertilized')}
                  className="bg-green-500 hover:bg-green-600 text-white h-24 flex flex-col gap-2"
                >
                  <Sprout size={32} />
                  Log Fertilizing
                </Button>

                <Button
                  onClick={() => logCare('misted')}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white h-24 flex flex-col gap-2"
                >
                  <Wind size={32} />
                  Log Misting
                </Button>

                <Button
                  onClick={() => logCare('rotated')}
                  className="bg-purple-500 hover:bg-purple-600 text-white h-24 flex flex-col gap-2"
                >
                  <RotateCw size={32} />
                  Log Rotation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journal">
          <Card>
            <CardHeader>
              <CardTitle>Care History</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No logs yet</p>
              ) : (
                <div className="space-y-3">
                  {logs.map(log => (
                    <div key={log.id} className="border-l-4 border-emerald-500 pl-4 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium capitalize">{log.log_type}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.log_date).toLocaleDateString()}
                        </span>
                      </div>
                      {log.notes && <p className="text-sm text-gray-600">{log.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Coming soon: Growth charts and statistics</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {plant.nickname || variety?.variety_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nickname</Label>
              <Input
                value={editData.nickname}
                onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                placeholder="e.g., Monica, Fred"
                className="mt-2"
              />
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
    </div>
  );
}