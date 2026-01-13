import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { 
  Loader2, 
  Upload, 
  MapPin, 
  Calendar as CalendarIcon,
  ExternalLink,
  BookOpen,
  AlertTriangle,
  Apple,
  Share2
} from 'lucide-react';
import ShareButton from '@/components/common/ShareButton';
import DiseaseIdentifier from '@/components/myplants/DiseaseIdentifier';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'seed', label: '🌰 Seed' },
  { value: 'sprout', label: '🌱 Sprout' },
  { value: 'seedling', label: '🌿 Seedling' },
  { value: 'transplanted', label: '🪴 Transplanted' },
  { value: 'flowering', label: '🌸 Flowering' },
  { value: 'fruiting', label: '🍅 Fruiting' },
  { value: 'harvested', label: '✂️ Harvested' },
  { value: 'done', label: '✓ Done' }
];

export default function PlantDetailModal({ plantId, open, onOpenChange, onUpdate }) {
  const [plant, setPlant] = useState(null);
  const [profile, setProfile] = useState(null);
  const [seedLot, setSeedLot] = useState(null);
  const [cropPlan, setCropPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [issues, setIssues] = useState([]);
  const [showDiseaseId, setShowDiseaseId] = useState(false);
  const [diseaseIdImage, setDiseaseIdImage] = useState(null);

  useEffect(() => {
    if (open && plantId) {
      console.log('[PlantDetailModal] Loading plant ID:', plantId);
      loadPlantData();
    }
  }, [open, plantId]);

  const loadPlantData = async () => {
    setLoading(true);
    try {
      // Fetch fresh data by ID
      const plants = await base44.entities.MyPlant.filter({ id: plantId });
      if (plants.length === 0) {
        toast.error('Plant not found');
        onOpenChange(false);
        return;
      }
      
      const freshPlant = plants[0];
      console.log('[PlantDetailModal] Loaded plant:', freshPlant.name, 'Status:', freshPlant.status);
      setPlant(freshPlant);

      // Load profile and crop plan
      if (freshPlant.plant_profile_id) {
        const profiles = await base44.entities.PlantProfile.filter({ id: freshPlant.plant_profile_id });
        if (profiles.length > 0) setProfile(profiles[0]);

        // Load seed lot if exists
        const user = await base44.auth.me();
        const lots = await base44.entities.SeedLot.filter({
          plant_profile_id: freshPlant.plant_profile_id,
          created_by: user.email
        });
        if (lots.length > 0) setSeedLot(lots[0]);
      }

      // Load crop plan if exists (for Planner Stage)
      if (freshPlant.crop_plan_id) {
        const plans = await base44.entities.CropPlan.filter({ id: freshPlant.crop_plan_id });
        if (plans.length > 0) setCropPlan(plans[0]);
      }

      // Load related activity
      const [diaryData, harvestData, issueData] = await Promise.all([
        base44.entities.GardenDiary.filter({ 
          plant_instance_id: plantId 
        }, '-entry_date', 3),
        base44.entities.HarvestLog.filter({ 
          plant_instance_id: plantId 
        }, '-harvest_date', 3),
        base44.entities.IssueLog.filter({ 
          plant_instance_id: plantId,
          status: 'open'
        }, '-created_date', 3)
      ]);

      setDiaryEntries(diaryData);
      setHarvests(harvestData);
      setIssues(issueData);
    } catch (error) {
      console.error('[PlantDetailModal] Error loading:', error);
      toast.error('Failed to load plant details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    console.log('[PlantDetailModal] Changing status from', plant.status, 'to', newStatus);
    
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
      
      // Reload fresh data
      const updated = await base44.entities.MyPlant.filter({ id: plant.id });
      if (updated.length > 0) {
        setPlant(updated[0]);
        console.log('[PlantDetailModal] Status updated and reloaded:', updated[0].status);
      }
      
      onUpdate?.(); // Refresh parent list
      toast.success('Status updated');
    } catch (error) {
      console.error('[PlantDetailModal] Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const existingPhotos = plant.photos || [];
      await base44.entities.MyPlant.update(plant.id, {
        photos: [...existingPhotos, {
          url: file_url,
          caption: '',
          taken_at: new Date().toISOString()
        }]
      });

      // Reload
      const updated = await base44.entities.MyPlant.filter({ id: plant.id });
      if (updated.length > 0) setPlant(updated[0]);
      
      onUpdate?.();
      toast.success('Photo added!');
    } catch (error) {
      console.error('[PlantDetailModal] Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!open) return null;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!plant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">
                {plant.name || profile?.variety_name || 'Plant Details'}
              </DialogTitle>
              <p className="text-sm text-gray-600">{profile?.common_name}</p>
            </div>
            <ShareButton
              title={`${plant.name || profile?.variety_name} - AwesomeGardener`}
              text={`Check out my ${profile?.common_name || 'plant'}!`}
              url={`${window.location.origin}/PublicPlant?id=${plant.id}`}
              imageUrl={plant.photos?.[0]?.url}
            />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Planner Stage vs Observed Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500">
                Planner Stage {cropPlan ? '(auto from calendar)' : '(no plan)'}
              </Label>
              {cropPlan ? (
                <Badge className="mt-1 bg-blue-100 text-blue-800">
                  {cropPlan.status || 'planned'}
                </Badge>
              ) : (
                <Badge className="mt-1 bg-gray-100 text-gray-600">
                  Not scheduled
                </Badge>
              )}
              <p className="text-xs text-gray-500 mt-1">From crop calendar</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Observed Stage (manual)</Label>
              <Badge className="mt-1 bg-emerald-100 text-emerald-800">
                {STATUS_OPTIONS.find(s => s.value === plant.status)?.label || plant.status}
              </Badge>
              <p className="text-xs text-gray-500 mt-1">Your observation</p>
            </div>
          </div>

          <Separator />

          {/* CropPlan Linkage */}
          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-gray-500">Linked to Crop Plan</Label>
                <p className="text-sm font-medium">
                  {cropPlan ? `✓ Yes (${cropPlan.label})` : '✗ No crop plan linked'}
                </p>
              </div>
              {!cropPlan && (
                <Button size="sm" variant="outline" onClick={async () => {
                  // Allow user to link to a CropPlan
                  const plans = await base44.entities.CropPlan.filter({ garden_season_id: plant.garden_season_id });
                  if (plans.length === 0) {
                    toast.error('No crop plans in this season');
                    return;
                  }
                  const selection = prompt(`Select crop plan:\n${plans.map((p, i) => `${i+1}. ${p.label}`).join('\n')}\n\nEnter number:`);
                  if (selection) {
                    const plan = plans[parseInt(selection) - 1];
                    if (plan) {
                      await base44.entities.MyPlant.update(plant.id, { crop_plan_id: plan.id });
                      toast.success('Linked to crop plan');
                      loadPlantData();
                    }
                  }
                }}>
                  Fix Link
                </Button>
              )}
            </div>
          </div>

          {/* Identification & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500">Season</Label>
              <p className="text-sm font-medium">{plant.season_year || 'Current'}</p>
            </div>
            {plant.location_name && (
              <div>
                <Label className="text-xs text-gray-500">Location</Label>
                <Link 
                  to={createPageUrl('GardenPlanting') + `?garden=${plant.garden_id}`}
                  className="text-sm font-medium text-emerald-600 hover:underline flex items-center gap-1 interactive-button"
                >
                  <MapPin className="w-3 h-3" />
                  {plant.location_name}
                </Link>
              </div>
            )}
          </div>

          {/* Health Status */}
          {plant.health_status && (
            <div>
              <Label className="text-xs text-gray-500">Plant Health</Label>
              <Badge className={
                plant.health_status === 'thriving' ? 'bg-green-100 text-green-800' :
                plant.health_status === 'struggling' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }>
                {plant.health_status}
              </Badge>
            </div>
          )}

          {/* Status Section */}
          <div>
            <Label>Observed Stage (manual)</Label>
            <Select
              value={plant.status || 'seed'}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Your manual lifecycle tracking for this plant
            </p>
          </div>

          {/* Milestones */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Milestones</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Germinated</p>
                <p className="text-sm font-medium">
                  {plant.germination_date ? format(new Date(plant.germination_date), 'MMM d') : '—'}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Transplanted</p>
                <p className="text-sm font-medium">
                  {plant.transplant_date ? format(new Date(plant.transplant_date), 'MMM d') : '—'}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">First Harvest</p>
                <p className="text-sm font-medium">
                  {plant.first_harvest_date ? format(new Date(plant.first_harvest_date), 'MMM d') : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Photos ({plant.photos?.length || 0})</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('plant-photo-upload').click()}
                disabled={uploadingPhoto}
                className="gap-2"
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Add Photo
              </Button>
              <input
                id="plant-photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            {plant.photos && plant.photos.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {plant.photos.map((photo, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Plant photo'}
                      className="w-full h-24 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs h-6 px-2 bg-white hover:bg-gray-50 border rounded shadow-sm pointer-events-auto z-10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('AI_ID_CLICKED', photo.url);
                        setDiseaseIdImage(photo.url);
                        setShowDiseaseId(true);
                      }}
                    >
                      🔍 ID
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">No photos yet</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Related Activity */}
          <div className="space-y-4">
            <h3 className="font-semibold">Related Activity</h3>
            
            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = createPageUrl('GardenDiary') + `?plant=${plantId}&new=true`;
                }}
                className="flex-1 interactive-button"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Add Entry
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = createPageUrl('HarvestLog') + `?plant=${plantId}&new=true`;
                }}
                className="flex-1 interactive-button"
              >
                <Apple className="w-4 h-4 mr-2" />
                + Harvest
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = createPageUrl('IssuesLog') + `?plant=${plantId}&new=true`;
                }}
                className="flex-1 interactive-button"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                + Issue
              </Button>
            </div>

            {/* Diary */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = createPageUrl('GardenDiary') + `?plant=${plantId}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-sm">Diary Entries ({diaryEntries.length})</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </div>
                {diaryEntries.length > 0 ? (
                  <div className="space-y-2">
                    {diaryEntries.map(entry => (
                      <div key={entry.id} className="text-sm">
                        <p className="text-xs text-gray-500">{format(new Date(entry.entry_date), 'MMM d, yyyy')}</p>
                        <p className="text-gray-700 line-clamp-2">{entry.entry_text || entry.notes}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No diary entries yet</p>
                )}
              </CardContent>
            </Card>

            {/* Issues */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = createPageUrl('IssuesLog') + `?plant=${plantId}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="font-medium text-sm">Open Issues ({issues.length})</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </div>
                {issues.length > 0 ? (
                  <div className="space-y-2">
                    {issues.map(issue => (
                      <div key={issue.id} className="text-sm flex items-center justify-between">
                        <span className="text-gray-700 capitalize">{issue.issue_type}</span>
                        <Badge variant="outline" className="text-xs capitalize">{issue.severity}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No open issues</p>
                )}
              </CardContent>
            </Card>

            {/* Harvests */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = createPageUrl('HarvestLog') + `?plant=${plantId}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Apple className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-sm">Harvests ({harvests.length})</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </div>
                {harvests.length > 0 ? (
                  <div className="space-y-2">
                    {harvests.map(harvest => (
                      <div key={harvest.id} className="text-sm flex items-center justify-between">
                        <span className="text-xs text-gray-500">{format(new Date(harvest.harvest_date), 'MMM d')}</span>
                        <span className="font-medium text-emerald-700">
                          {harvest.quantity} {harvest.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No harvests yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Variety Details (Read-Only) */}
          {profile && (
            <div>
              <h3 className="font-semibold mb-3">Variety Info</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {profile.days_to_maturity_seed && (
                  <div>
                    <span className="text-gray-500">Days to Maturity:</span>
                    <span className="ml-2 font-medium">{profile.days_to_maturity_seed}</span>
                  </div>
                )}
                {profile.spacing_in_min && (
                  <div>
                    <span className="text-gray-500">Spacing:</span>
                    <span className="ml-2 font-medium">{profile.spacing_in_min}-{profile.spacing_in_max || profile.spacing_in_min}"</span>
                  </div>
                )}
                {profile.sun_requirement && (
                  <div>
                    <span className="text-gray-500">Sun:</span>
                    <span className="ml-2 font-medium capitalize">{profile.sun_requirement.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {profile.container_friendly && (
                  <Badge variant="outline" className="text-xs">Container Friendly</Badge>
                )}
                {profile.trellis_required && (
                  <Badge variant="outline" className="text-xs">Needs Trellis</Badge>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                {profile.variety_id && (
                  <Link to={createPageUrl('ViewVariety') + `?id=${profile.variety_id}`}>
                    <Button size="sm" variant="outline" className="gap-1">
                      View in Catalog <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Seed Stash Info (Read-Only) */}
          {seedLot && (
            <div>
              <h3 className="font-semibold mb-3">Seed Stash Info</h3>
              <div className="space-y-2 text-sm">
                {seedLot.source_vendor_name && (
                  <div>
                    <span className="text-gray-500">Source:</span>
                    <span className="ml-2 font-medium">{seedLot.source_vendor_name}</span>
                  </div>
                )}
                {seedLot.year_acquired && (
                  <div>
                    <span className="text-gray-500">Year Acquired:</span>
                    <span className="ml-2 font-medium">{seedLot.year_acquired}</span>
                  </div>
                )}
                {seedLot.lot_notes && (
                  <div>
                    <span className="text-gray-500">Notes:</span>
                    <p className="text-gray-700 mt-1">{seedLot.lot_notes}</p>
                  </div>
                )}
              </div>
              <Link to={createPageUrl('SeedStashDetail') + `?id=${seedLot.id}`} className="mt-3 inline-block">
                <Button size="sm" variant="outline" className="gap-1">
                  View in Seed Stash <ExternalLink className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </DialogContent>
      
      {/* Disease Identifier Modal */}
      <DiseaseIdentifier
        open={showDiseaseId}
        onOpenChange={setShowDiseaseId}
        imageUrl={diseaseIdImage}
        plantCommonName={profile?.common_name}
        onSaveToIssues={async (aiResult) => {
          console.log('AI_ID_SAVE_ISSUE_CREATING', aiResult);
          try {
            // Build issue description from AI result
            const issueDescription = aiResult.issues?.map(issue => 
              `**${issue.name}** (${issue.confidence} confidence)\n` +
              (issue.symptoms ? `Symptoms: ${issue.symptoms}\n` : '') +
              (issue.recommendations?.length > 0 ? `Actions: ${issue.recommendations.join(', ')}` : '')
            ).join('\n\n') || aiResult.general_notes || 'AI identified potential disease';
            
            await base44.entities.IssueLog.create({
              garden_id: plant.garden_season_id,
              garden_season_id: plant.garden_season_id,
              plant_instance_id: plant.id,
              date: new Date().toISOString().split('T')[0],
              issue_type: 'disease',
              severity: 'medium',
              description: issueDescription,
              identified_by: 'AI',
              images: [diseaseIdImage],
              status: 'open'
            });
            
            console.log('AI_ID_SAVE_ISSUE_CREATED');
            toast.success('Saved to Issues Log');
            onUpdate?.();
          } catch (error) {
            console.error('Error saving to issues:', error);
            toast.error('Failed to save to Issues Log');
          }
        }}
      />
    </Dialog>
  );
}