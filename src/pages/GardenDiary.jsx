import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { BookText, Plus, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';

const DIARY_TAGS = ['pests', 'fertilizer', 'weather', 'harvest', 'success', 'failure', 'watering', 'planting'];

export default function GardenDiary() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterGarden, setFilterGarden] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [filterSeason, setFilterSeason] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [myPlants, setMyPlants] = useState([]);
  const [indoorPlants, setIndoorPlants] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [entryType, setEntryType] = useState('outdoor');
  
  const [formData, setFormData] = useState({
    garden_id: '',
    garden_season_id: '',
    plant_instance_id: '',
    indoor_plant_id: '',
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    entry_text: '',
    title: '',
    tags: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      const plantParam = searchParams.get('plant');
      
      const [gardensData, entriesData, seasonsData, plantsData, indoorPlantsData, profilesData, indoorLogsData] = await Promise.all([
        base44.entities.Garden.filter({ archived: false, created_by: userData.email }),
        base44.entities.GardenDiary.filter({ created_by: userData.email }, '-entry_date'),
        base44.entities.GardenSeason.filter({ created_by: userData.email }, '-year'),
        base44.entities.MyPlant.filter({ created_by: userData.email }),
        base44.entities.IndoorPlant.filter({ is_active: true }),
        base44.entities.PlantProfile.list('variety_name', 500),
        base44.entities.IndoorPlantLog.filter({
          log_type: { $in: ['photo', 'milestone', 'note'] }
        }, '-log_date')
      ]);
      
      setUser(userData);
      setGardens(gardensData);
      setSeasons(seasonsData);
      setMyPlants(plantsData);
      setIndoorPlants(indoorPlantsData);
      
      const profilesMap = {};
      profilesData.forEach(p => { profilesMap[p.id] = p; });
      setProfiles(profilesMap);

      const allEntries = [
        ...entriesData.map(e => ({ ...e, source: 'garden', date: e.entry_date })),
        ...indoorLogsData.map(e => ({ ...e, source: 'indoor', date: e.log_date }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setEntries(allEntries);
      
      if (gardensData.length > 0 && !formData.garden_id) {
        setFormData(prev => ({ ...prev, garden_id: gardensData[0].id }));
      }
    } catch (error) {
      console.error('Error loading diary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if ((!formData.garden_id && entryType === 'outdoor') || !formData.entry_date || saving) return;
    if (entryType === 'indoor' && !formData.indoor_plant_id) return;
    
    setSaving(true);
    try {
      if (entryType === 'indoor') {
        await base44.entities.IndoorPlantLog.create({
          indoor_plant_id: formData.indoor_plant_id,
          log_type: 'note',
          log_date: formData.entry_date,
          notes: formData.entry_text
        });
      } else {
        if (editing) {
          await base44.entities.GardenDiary.update(editing.id, formData);
        } else {
          await base44.entities.GardenDiary.create(formData);
        }
      }
      
      toast.success('Entry saved');
      handleClose();
      loadData();
    } catch (error) {
      console.error('Error saving entry:', error);
      toast.error('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!confirm('Delete this diary entry?')) return;
    
    try {
      if (entry.source === 'indoor') {
        await base44.entities.IndoorPlantLog.delete(entry.id);
      } else {
        await base44.entities.GardenDiary.delete(entry.id);
      }
      setEntries(entries.filter(e => e.id !== entry.id));
      toast.success('Entry deleted');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const handleEdit = (entry) => {
    if (entry.source === 'indoor') {
      toast.info('Indoor plant logs can only be edited from plant detail page');
      return;
    }
    setEditing(entry);
    setFormData({
      garden_id: entry.garden_id,
      garden_season_id: entry.garden_season_id || '',
      plant_instance_id: entry.plant_instance_id || '',
      indoor_plant_id: '',
      entry_date: entry.entry_date,
      title: entry.title || '',
      entry_text: entry.entry_text || entry.notes || '',
      tags: entry.tags || []
    });
    setShowDialog(true);
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditing(null);
    setEntryType('outdoor');
    setFormData({
      garden_id: gardens[0]?.id || '',
      garden_season_id: '',
      plant_instance_id: '',
      indoor_plant_id: '',
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      entry_text: '',
      title: '',
      tags: []
    });
  };

  const toggleTag = (tag) => {
    const newTags = formData.tags.includes(tag)
      ? formData.tags.filter(t => t !== tag)
      : [...formData.tags, tag];
    setFormData({ ...formData, tags: newTags });
  };

  const filteredEntries = entries.filter(e => {
    if (filterCategory === 'outdoor' && e.source !== 'garden') return false;
    if (filterCategory === 'indoor' && e.source !== 'indoor') return false;
    if (filterGarden !== 'all' && e.garden_id !== filterGarden) return false;
    if (filterTag !== 'all' && !e.tags?.includes(filterTag)) return false;
    if (filterSeason !== 'all' && e.garden_season_id !== filterSeason) return false;
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
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Garden Diary</h1>
          <p className="text-gray-600 mt-1">Track your gardening journey</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />
          New Entry
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entries</SelectItem>
            <SelectItem value="outdoor">🌱 Garden</SelectItem>
            <SelectItem value="indoor">🪴 Indoor Plants</SelectItem>
          </SelectContent>
        </Select>

        {gardens.length > 1 && (
          <Select value={filterGarden} onValueChange={setFilterGarden}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Gardens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Gardens</SelectItem>
              {gardens.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {DIARY_TAGS.map(tag => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredEntries.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <BookText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Diary Entries</h3>
            <p className="text-gray-600 mb-6">Start documenting your garden journey</p>
            <Button onClick={() => setShowDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Create First Entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => {
            const garden = gardens.find(g => g.id === entry.garden_id);
            const isIndoor = entry.source === 'indoor';
            const indoorPlant = isIndoor ? indoorPlants.find(p => p.id === entry.indoor_plant_id) : null;

            return (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {format(new Date(entry.date), 'MMMM d, yyyy')}
                        </span>
                        {isIndoor && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">🪴 Indoor</Badge>
                        )}
                        {garden && !isIndoor && (
                          <Badge variant="outline" className="text-xs">{garden.name}</Badge>
                        )}
                        {entry.log_type === 'milestone' && (
                          <Badge className="bg-yellow-100 text-yellow-700 text-xs">🎉 Milestone</Badge>
                        )}
                      </div>
                      {entry.title && (
                        <h3 className="font-semibold text-lg text-gray-900">{entry.title}</h3>
                      )}
                      {isIndoor && indoorPlant && (
                        <Link to={createPageUrl('IndoorPlantDetail') + `?id=${indoorPlant.id}`} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                          🌿 {indoorPlant.nickname || 'Plant'}
                        </Link>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(entry)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  {entry.photos && entry.photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {entry.photos.map((photo, i) => (
                        <img key={i} src={photo} className="w-full aspect-square object-cover rounded-lg" alt="" />
                      ))}
                    </div>
                  )}

                  {entry.health_observation && (
                    <div className="mb-3 text-sm">
                      <span className="font-medium text-gray-700">Observation: </span>
                      <span className="text-gray-600 capitalize">{entry.health_observation.replace(/_/g, ' ')}</span>
                    </div>
                  )}

                  {(entry.height_inches || entry.width_inches || entry.new_leaves_count) && (
                    <div className="flex gap-4 mb-3 text-sm">
                      {entry.height_inches && <span className="text-gray-600">📏 {entry.height_inches}" tall</span>}
                      {entry.width_inches && <span className="text-gray-600">↔️ {entry.width_inches}" wide</span>}
                      {entry.new_leaves_count && <span className="text-gray-600">🌿 {entry.new_leaves_count} new leaves</span>}
                    </div>
                  )}

                  {(entry.entry_text || entry.notes) && (
                    <p className="text-gray-700 whitespace-pre-wrap mb-3">{entry.entry_text || entry.notes}</p>
                  )}

                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {entry.mood && (
                    <div className="mt-3 text-sm text-gray-500">
                      Feeling: {entry.mood === 'excited' ? '😃' : entry.mood === 'satisfied' ? '😊' : entry.mood === 'concerned' ? '😟' : '😰'} {entry.mood}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Entry' : 'New Diary Entry'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editing && (
              <div>
                <Label>Entry Type</Label>
                <Select value={entryType} onValueChange={setEntryType}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outdoor">🌱 Garden Entry</SelectItem>
                    <SelectItem value="indoor">🪴 Indoor Plant Entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {entryType === 'outdoor' ? (
              <>
                <div>
                  <Label>Garden *</Label>
                  <Select value={formData.garden_id} onValueChange={(v) => setFormData({ ...formData, garden_id: v })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select garden" />
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
                  <Select value={formData.plant_instance_id || ''} onValueChange={(v) => setFormData({ ...formData, plant_instance_id: v || null })}>
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
                </div>
              </>
            ) : (
              <div>
                <Label>Indoor Plant *</Label>
                <Select value={formData.indoor_plant_id} onValueChange={(v) => setFormData({ ...formData, indoor_plant_id: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select plant" />
                  </SelectTrigger>
                  <SelectContent>
                    {indoorPlants.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nickname || 'Plant'} {p.variety_id && `- Variety`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g., First tomato harvest!"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="notes">Entry Text *</Label>
              <Textarea
                id="notes"
                placeholder="What happened today?"
                value={formData.entry_text}
                onChange={(e) => setFormData({ ...formData, entry_text: e.target.value })}
                className="mt-2"
                rows={6}
              />
            </div>

            {entryType === 'outdoor' && (
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DIARY_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        formData.tags.includes(tag)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.entry_text?.trim() || saving || (entryType === 'outdoor' && !formData.garden_id) || (entryType === 'indoor' && !formData.indoor_plant_id)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Update' : 'Save'} Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}