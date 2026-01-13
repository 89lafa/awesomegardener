import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CARE_TYPES = {
  soil: { label: 'Soil', icon: '🌱', color: 'bg-amber-100 text-amber-800' },
  fertilizer: { label: 'Fertilizer', icon: '💧', color: 'bg-green-100 text-green-800' },
  pest: { label: 'Pest Control', icon: '🐛', color: 'bg-red-100 text-red-800' }
};

export default function GardenCare() {
  const [activeTab, setActiveTab] = useState('soil');
  const [gardens, setGardens] = useState([]);
  const [careLogs, setCareLogs] = useState([]);
  const [myPlants, setMyPlants] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterGarden, setFilterGarden] = useState('all');

  const [formData, setFormData] = useState({
    garden_id: '',
    plant_instance_id: '',
    care_type: 'soil',
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
    product_used: '',
    quantity_applied: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      const [gardensData, careData, plantsData, profilesData] = await Promise.all([
        base44.entities.Garden.filter({ archived: false, created_by: userData.email }),
        base44.entities.CareLog.filter({ created_by: userData.email }, '-date'),
        base44.entities.MyPlant.filter({ created_by: userData.email }),
        base44.entities.PlantProfile.list('variety_name', 500)
      ]);

      setGardens(gardensData);
      setCareLogs(careData);
      setMyPlants(plantsData);

      const profilesMap = {};
      profilesData.forEach(p => { profilesMap[p.id] = p; });
      setProfiles(profilesMap);

      if (gardensData.length > 0) {
        setFormData(prev => ({ ...prev, garden_id: gardensData[0].id }));
      }
    } catch (error) {
      console.error('Error loading care logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.garden_id || !formData.date || !formData.title || saving) return;

    setSaving(true);
    try {
      const data = { ...formData };

      if (editing) {
        await base44.entities.CareLog.update(editing.id, data);
        setCareLogs(careLogs.map(c => c.id === editing.id ? { ...c, ...data } : c));
        toast.success('Care log updated');
      } else {
        const log = await base44.entities.CareLog.create(data);
        setCareLogs([log, ...careLogs]);
        toast.success('Care log added!');
      }
      handleClose();
    } catch (error) {
      console.error('Error saving care log:', error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (log) => {
    if (!confirm('Delete this care log?')) return;

    try {
      await base44.entities.CareLog.delete(log.id);
      setCareLogs(careLogs.filter(c => c.id !== log.id));
      toast.success('Deleted');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditing(null);
    setFormData({
      garden_id: gardens[0]?.id || '',
      plant_instance_id: '',
      care_type: activeTab,
      date: format(new Date(), 'yyyy-MM-dd'),
      title: '',
      description: '',
      product_used: '',
      quantity_applied: ''
    });
  };

  const openAddDialog = (type) => {
    setFormData({ ...formData, care_type: type });
    setShowDialog(true);
  };

  const getPlantName = (plantId) => {
    const plant = myPlants.find(p => p.id === plantId);
    if (!plant) return null;
    const profile = profiles[plant.plant_profile_id];
    return plant.name || profile?.variety_name || 'Unknown';
  };

  const filteredLogs = careLogs.filter(log => {
    if (log.care_type !== activeTab) return false;
    if (filterGarden !== 'all' && log.garden_id !== filterGarden) return false;
    return true;
  });

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
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Garden Care</h1>
          <p className="text-gray-600 mt-1">Track soil amendments, fertilizing, and pest control</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="soil" className="gap-2">
            🌱 Soil
          </TabsTrigger>
          <TabsTrigger value="fertilizer" className="gap-2">
            💧 Fertilizer
          </TabsTrigger>
          <TabsTrigger value="pest" className="gap-2">
            🐛 Pest Control
          </TabsTrigger>
        </TabsList>

        {['soil', 'fertilizer', 'pest'].map(type => (
          <TabsContent key={type} value={type} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
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
              </div>
              <Button
                onClick={() => openAddDialog(type)}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <Plus className="w-4 h-4" />
                Add {CARE_TYPES[type].label} Log
              </Button>
            </div>

            {filteredLogs.length === 0 ? (
              <Card className="py-16">
                <CardContent className="text-center">
                  <div className="text-6xl mb-4">{CARE_TYPES[type].icon}</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No {CARE_TYPES[type].label} Logs</h3>
                  <p className="text-gray-600 mb-6">Start tracking your {CARE_TYPES[type].label.toLowerCase()} care activities</p>
                  <Button
                    onClick={() => openAddDialog(type)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Add First Log
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map(log => {
                  const garden = gardens.find(g => g.id === log.garden_id);
                  const plantName = log.plant_instance_id ? getPlantName(log.plant_instance_id) : null;

                  return (
                    <Card key={log.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${CARE_TYPES[type].color}`}>
                              <span className="text-xl">{CARE_TYPES[type].icon}</span>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{log.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-500">
                                  {format(new Date(log.date), 'MMM d, yyyy')}
                                </span>
                                {garden && (
                                  <Badge variant="outline" className="text-xs">{garden.name}</Badge>
                                )}
                                {plantName && (
                                  <Badge className="text-xs bg-emerald-600">{plantName}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditing(log);
                              setFormData(log);
                              setShowDialog(true);
                            }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(log)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {log.product_used && (
                          <p className="text-sm text-gray-700 mb-2">
                            <strong>Product:</strong> {log.product_used}
                            {log.quantity_applied && ` (${log.quantity_applied})`}
                          </p>
                        )}

                        {log.description && (
                          <p className="text-sm text-gray-700">{log.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{CARE_TYPES[formData.care_type].icon}</span>
              {editing ? 'Edit' : 'Add'} {CARE_TYPES[formData.care_type].label} Log
            </DialogTitle>
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
                  <SelectValue placeholder="All plants / garden-wide" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={null}>All plants / garden-wide</SelectItem>
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
            </div>

            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder={
                  formData.care_type === 'soil' ? 'e.g., Added compost to bed 1' :
                  formData.care_type === 'fertilizer' ? 'e.g., Applied fish emulsion' :
                  'e.g., Sprayed neem oil for aphids'
                }
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="product">Product/Amendment Used</Label>
              <Input
                id="product"
                placeholder={
                  formData.care_type === 'soil' ? 'e.g., Organic compost' :
                  formData.care_type === 'fertilizer' ? 'e.g., Fish emulsion 5-1-1' :
                  'e.g., Neem oil spray'
                }
                value={formData.product_used}
                onChange={(e) => setFormData({ ...formData, product_used: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="quantity">Quantity Applied</Label>
              <Input
                id="quantity"
                placeholder="e.g., 2 cups, 10ml, 1 gallon"
                value={formData.quantity_applied}
                onChange={(e) => setFormData({ ...formData, quantity_applied: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="description">Notes</Label>
              <Textarea
                id="description"
                placeholder="Additional details, observations, results..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!formData.garden_id || !formData.date || !formData.title || saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? 'Update' : 'Add'} Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}