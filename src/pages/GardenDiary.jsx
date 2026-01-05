import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { 
  BookText,
  Plus,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  Tag,
  Loader2,
  Filter
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
  
  const [formData, setFormData] = useState({
    garden_id: '',
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    notes: '',
    tags: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      const [gardensData, entriesData] = await Promise.all([
        base44.entities.Garden.filter({ archived: false, created_by: userData.email }),
        base44.entities.GardenDiary.filter({ created_by: userData.email }, '-entry_date')
      ]);
      
      setUser(userData);
      setGardens(gardensData);
      setEntries(entriesData);
      
      if (gardensData.length > 0 && !formData.garden_id) {
        setFormData({ ...formData, garden_id: gardensData[0].id });
      }
    } catch (error) {
      console.error('Error loading diary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.garden_id || !formData.entry_date || saving) return;
    
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.GardenDiary.update(editing.id, formData);
        setEntries(entries.map(e => e.id === editing.id ? { ...e, ...formData } : e));
        toast.success('Entry updated');
      } else {
        const entry = await base44.entities.GardenDiary.create(formData);
        setEntries([entry, ...entries]);
        toast.success('Entry added');
      }
      handleClose();
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
      await base44.entities.GardenDiary.delete(entry.id);
      setEntries(entries.filter(e => e.id !== entry.id));
      toast.success('Entry deleted');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const handleEdit = (entry) => {
    setEditing(entry);
    setFormData({
      garden_id: entry.garden_id,
      entry_date: entry.entry_date,
      title: entry.title || '',
      notes: entry.notes || '',
      tags: entry.tags || []
    });
    setShowDialog(true);
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditing(null);
    setFormData({
      garden_id: gardens[0]?.id || '',
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      title: '',
      notes: '',
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
    if (filterGarden !== 'all' && e.garden_id !== filterGarden) return false;
    if (filterTag !== 'all' && !e.tags?.includes(filterTag)) return false;
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
        <Button 
          onClick={() => setShowDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </Button>
      </div>

      {/* Filters */}
      {gardens.length > 1 && (
        <div className="flex gap-4">
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
      )}

      {/* Entries */}
      {filteredEntries.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <BookText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Diary Entries</h3>
            <p className="text-gray-600 mb-6">Start documenting your garden journey</p>
            <Button 
              onClick={() => setShowDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => {
            const garden = gardens.find(g => g.id === entry.garden_id);
            return (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {format(new Date(entry.entry_date), 'MMMM d, yyyy')}
                        </span>
                        {garden && (
                          <Badge variant="outline" className="text-xs">
                            {garden.name}
                          </Badge>
                        )}
                      </div>
                      {entry.title && (
                        <h3 className="font-semibold text-lg text-gray-900">{entry.title}</h3>
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
                  {entry.notes && (
                    <p className="text-gray-700 whitespace-pre-wrap mb-3">{entry.notes}</p>
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
            <DialogTitle>{editing ? 'Edit Entry' : 'New Diary Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Garden *</Label>
              <Select 
                value={formData.garden_id} 
                onValueChange={(v) => setFormData({ ...formData, garden_id: v })}
              >
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
              <Label htmlFor="notes">Notes *</Label>
              <Textarea
                id="notes"
                placeholder="What happened in the garden today?"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-2"
                rows={6}
              />
            </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.garden_id || !formData.notes.trim() || saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? 'Update' : 'Save'} Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}