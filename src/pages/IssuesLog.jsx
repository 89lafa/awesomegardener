import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Bug,
  Plus,
  AlertTriangle,
  Calendar as CalendarIcon,
  Loader2
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
import { useSearchParams } from 'react-router-dom';
import AIIdentifyButton from '@/components/issues/AIIdentifyButton';
import { cn } from '@/lib/utils';
import DiseaseIdentifier from '@/components/myplants/DiseaseIdentifier';
import { Sparkles } from 'lucide-react';

export default function IssuesLog() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterGarden, setFilterGarden] = useState('all');
  const [myPlants, setMyPlants] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [profiles, setProfiles] = useState({});
  
  const [formData, setFormData] = useState({
    garden_id: '',
    garden_season_id: '',
    plant_instance_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    issue_type: 'pest',
    severity: 'medium',
    description: '',
    actions_taken: '',
    outcome: '',
    status: 'open',
    images: []
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAIIdentify, setShowAIIdentify] = useState(false);

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
      window.history.replaceState({}, '', createPageUrl('IssuesLog') + `?plant=${plantParam}`);
    }
  }, [searchParams, myPlants]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      const [gardensData, issuesData, seasonsData, plantsData, profilesData] = await Promise.all([
        base44.entities.Garden.filter({ archived: false, created_by: userData.email }),
        base44.entities.IssueLog.filter({ created_by: userData.email }, '-created_date'),
        base44.entities.GardenSeason.filter({ created_by: userData.email }, '-year'),
        base44.entities.MyPlant.filter({ created_by: userData.email }),
        base44.entities.PlantProfile.list('variety_name', 500)
      ]);
      
      setUser(userData);
      setGardens(gardensData);
      setIssues(issuesData);
      setSeasons(seasonsData);
      setMyPlants(plantsData);
      
      const profilesMap = {};
      profilesData.forEach(p => { profilesMap[p.id] = p; });
      setProfiles(profilesMap);
      
      if (gardensData.length > 0) {
        setFormData({ ...formData, garden_id: gardensData[0].id });
      }
    } catch (error) {
      console.error('Error loading issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.garden_id || !formData.symptoms.trim() || saving) return;
    
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.IssueLog.update(editing.id, formData);
        setIssues(issues.map(i => i.id === editing.id ? { ...i, ...formData } : i));
        toast.success('Issue updated');
      } else {
        const issue = await base44.entities.IssueLog.create(formData);
        setIssues([issue, ...issues]);
        toast.success('Issue logged');
      }
      handleClose();
    } catch (error) {
      console.error('Error saving issue:', error);
      toast.error('Failed to save issue');
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
      date: format(new Date(), 'yyyy-MM-dd'),
      issue_type: 'pest',
      severity: 'medium',
      description: '',
      actions_taken: '',
      outcome: '',
      status: 'open',
      images: []
    });
    setUploadingPhoto(false);
    setShowAIIdentify(false);
  };

  const filteredIssues = issues.filter(i => {
    if (filterGarden !== 'all' && i.garden_id !== filterGarden) return false;
    if (filterType !== 'all' && i.issue_type !== filterType) return false;
    return true;
  });

  const severityColors = {
    low: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    medium: 'bg-orange-100 text-orange-800 border-orange-300',
    high: 'bg-red-100 text-red-800 border-red-300'
  };

  const typeIcons = {
    pest: Bug,
    disease: AlertTriangle,
    nutrient: AlertTriangle,
    weather: AlertTriangle,
    other: AlertTriangle
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
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Issues Log</h1>
          <p className="text-gray-600 mt-1">Track pests, diseases, and solutions</p>
        </div>
        <Button 
          onClick={() => setShowDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Log Issue
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
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pest">Pests</SelectItem>
            <SelectItem value="disease">Diseases</SelectItem>
            <SelectItem value="nutrient">Nutrient Issues</SelectItem>
            <SelectItem value="weather">Weather Damage</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Bug className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Issues Logged</h3>
            <p className="text-gray-600">Track pest problems and solutions here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue) => {
            const garden = gardens.find(g => g.id === issue.garden_id);
            const Icon = typeIcons[issue.issue_type] || Bug;
            return (
              <Card key={issue.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 capitalize">{issue.issue_type}</span>
                          <Badge className={cn('text-xs', severityColors[issue.severity])}>
                            {issue.severity}
                          </Badge>
                          {garden && (
                            <Badge variant="outline" className="text-xs">{garden.name}</Badge>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{format(new Date(issue.date), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditing(issue);
                        setFormData(issue);
                        setShowDialog(true);
                      }}>
                        Edit
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Description:</span>
                      <p className="text-gray-600 mt-1">{issue.description || issue.symptoms}</p>
                    </div>
                    {issue.actions_taken && (
                      <div>
                        <span className="font-medium text-gray-700">Actions Taken:</span>
                        <p className="text-gray-600 mt-1">{issue.actions_taken}</p>
                      </div>
                    )}
                    {issue.outcome && (
                      <div>
                        <span className="font-medium text-gray-700">Outcome:</span>
                        <p className="text-gray-600 mt-1">{issue.outcome}</p>
                      </div>
                    )}
                  </div>
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
            <DialogTitle>{editing ? 'Edit Issue' : 'Log New Issue'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select 
                  value={formData.issue_type} 
                  onValueChange={(v) => setFormData({ ...formData, issue_type: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pest">Pest</SelectItem>
                    <SelectItem value="disease">Disease</SelectItem>
                    <SelectItem value="nutrient">Nutrient Issue</SelectItem>
                    <SelectItem value="weather">Weather Damage</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity *</Label>
                <Select 
                  value={formData.severity} 
                  onValueChange={(v) => setFormData({ ...formData, severity: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe what you observed..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>
            
            {formData.issue_type === 'disease' && (
              <div>
                <Label>Disease Photo (optional but recommended)</Label>
                <div className="mt-2 space-y-2">
                  {formData.images && formData.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {formData.images.map((url, idx) => (
                        <div key={idx} className="relative group">
                          <img src={url} alt="Disease" className="w-full h-24 object-cover rounded-lg border" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              setFormData({ ...formData, images: formData.images.filter((_, i) => i !== idx) });
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
                    onClick={() => document.getElementById('disease-photo-upload').click()}
                    className="w-full"
                  >
                    {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Upload Photo
                  </Button>
                  <input
                    id="disease-photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingPhoto(true);
                      try {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setFormData({ ...formData, images: [...(formData.images || []), file_url] });
                        toast.success('Photo uploaded');
                      } catch (error) {
                        console.error('Error uploading:', error);
                        toast.error('Failed to upload photo');
                      } finally {
                        setUploadingPhoto(false);
                      }
                    }}
                    className="hidden"
                  />
                  {formData.images && formData.images.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAIIdentify(true);
                      }}
                      className="w-full gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
                    >
                      <Sparkles className="w-4 h-4" />
                      AI Identify Disease
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="actions">Actions Taken</Label>
              <Textarea
                id="actions"
                placeholder="What did you do to address it?"
                value={formData.actions_taken}
                onChange={(e) => setFormData({ ...formData, actions_taken: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="outcome">Outcome</Label>
              <Textarea
                id="outcome"
                placeholder="How did it turn out?"
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                className="mt-2"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.garden_id || !formData.description?.trim() || saving}
              className="bg-emerald-600 hover:bg-emerald-700 interactive-button"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? 'Update' : 'Log'} Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Disease Identifier */}
      <DiseaseIdentifier
        open={showAIIdentify}
        onOpenChange={setShowAIIdentify}
        imageUrl={formData.images?.[0]}
        plantCommonName={
          formData.plant_instance_id
            ? myPlants.find(p => p.id === formData.plant_instance_id)?.name || profiles[myPlants.find(p => p.id === formData.plant_instance_id)?.plant_profile_id]?.common_name
            : null
        }
        onSaveToIssues={(aiResult) => {
          const description = aiResult.issues?.map(issue => 
            `**${issue.name}** (${issue.confidence} confidence)\n` +
            (issue.symptoms ? `Symptoms: ${issue.symptoms}\n` : '') +
            (issue.recommendations?.length > 0 ? `Actions: ${issue.recommendations.join(', ')}` : '')
          ).join('\n\n') || aiResult.general_notes || 'AI identified potential disease';
          
          setFormData({ ...formData, description, identified_by: 'AI' });
          setShowAIIdentify(false);
          toast.success('AI analysis added to description');
        }}
      />
    </div>
  );
}