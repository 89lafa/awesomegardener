import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  TreeDeciduous, 
  Plus, 
  MoreVertical, 
  Share2, 
  Copy, 
  Trash2, 
  Archive,
  Lock,
  Globe,
  Link as LinkIcon,
  Eye,
  Edit,
  Loader2,
  Users,
  Sprout
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function Gardens() {
  const [searchParams] = useSearchParams();
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(searchParams.get('action') === 'new');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedGarden, setSelectedGarden] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', privacy: 'private' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGardens();
  }, []);

  const loadGardens = async () => {
    try {
      const data = await base44.entities.Garden.filter({ archived: false }, '-updated_date');
      setGardens(data);
    } catch (error) {
      console.error('Error loading gardens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || saving) return; // Prevent double-submit
    
    setSaving(true);
    try {
      const garden = await base44.entities.Garden.create({
        name: formData.name,
        description: formData.description,
        privacy: formData.privacy
      });
      
      // Create default plot
      await base44.entities.GardenPlot.create({
        garden_id: garden.id,
        width: 480, // 40 feet
        height: 720, // 60 feet
        units: 'ft',
        shape_type: 'RECTANGLE',
        grid_enabled: true,
        grid_size: 12
      });

      // Set as active garden for the user
      await base44.auth.updateMe({ active_garden_id: garden.id });

      setGardens([garden, ...gardens]);
      setShowNewDialog(false);
      setFormData({ name: '', description: '', privacy: 'private' });
      toast.success('Garden created!');
    } catch (error) {
      console.error('Error creating garden:', error);
      toast.error('Failed to create garden');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (garden) => {
    if (!confirm(`Delete "${garden.name}"? This cannot be undone.`)) return;
    try {
      await base44.entities.Garden.delete(garden.id);
      setGardens(gardens.filter(g => g.id !== garden.id));
      toast.success('Garden deleted');
    } catch (error) {
      console.error('Error deleting garden:', error);
      toast.error('Failed to delete garden');
    }
  };

  const handleArchive = async (garden) => {
    try {
      await base44.entities.Garden.update(garden.id, { archived: true });
      setGardens(gardens.filter(g => g.id !== garden.id));
      toast.success('Garden archived');
    } catch (error) {
      console.error('Error archiving garden:', error);
    }
  };

  const handleDuplicate = async (garden) => {
    try {
      const newGarden = await base44.entities.Garden.create({
        name: `${garden.name} (Copy)`,
        description: garden.description,
        privacy: 'private'
      });
      setGardens([newGarden, ...gardens]);
      toast.success('Garden duplicated');
    } catch (error) {
      console.error('Error duplicating garden:', error);
    }
  };

  const openShareDialog = (garden) => {
    setSelectedGarden(garden);
    setShowShareDialog(true);
  };

  const handleShare = async (privacy) => {
    if (!selectedGarden) return;
    try {
      await base44.entities.Garden.update(selectedGarden.id, { privacy });
      setGardens(gardens.map(g => g.id === selectedGarden.id ? { ...g, privacy } : g));
      toast.success('Sharing updated');
    } catch (error) {
      console.error('Error updating sharing:', error);
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/PublicGarden?id=${selectedGarden.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  const getPrivacyIcon = (privacy) => {
    switch (privacy) {
      case 'public': return <Globe className="w-4 h-4" />;
      case 'unlisted': return <LinkIcon className="w-4 h-4" />;
      default: return <Lock className="w-4 h-4" />;
    }
  };

  const getPrivacyLabel = (privacy) => {
    switch (privacy) {
      case 'public': return 'Public';
      case 'unlisted': return 'Unlisted';
      default: return 'Private';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">My Gardens</h1>
          <p className="text-gray-600 mt-1">Manage all your garden spaces</p>
        </div>
        <Button 
          onClick={() => setShowNewDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Garden
        </Button>
      </div>

      {/* Gardens Grid */}
      {gardens.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <TreeDeciduous className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No gardens yet</h3>
            <p className="text-gray-600 mb-6">Create your first garden to start planning</p>
            <Button 
              onClick={() => setShowNewDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Garden
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {gardens.map((garden, index) => (
              <motion.div
                key={garden.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
                  {/* Cover Image */}
                  <div className="aspect-video bg-gradient-to-br from-emerald-100 to-green-50 relative">
                    {garden.cover_image ? (
                      <img 
                        src={garden.cover_image} 
                        alt={garden.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <TreeDeciduous className="w-16 h-16 text-emerald-200" />
                      </div>
                    )}
                    
                    {/* Quick Actions Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <Link to={createPageUrl('MyGarden') + `?gardenId=${garden.id}`}>
                        <Button size="sm" className="bg-white text-gray-900 hover:bg-gray-100">
                          <Edit className="w-4 h-4 mr-1" />
                          Layout
                        </Button>
                      </Link>
                      <Link to={createPageUrl('GardenPlanting') + `?gardenId=${garden.id}`}>
                        <Button size="sm" variant="secondary">
                          <Sprout className="w-4 h-4 mr-1" />
                          Plant
                        </Button>
                      </Link>
                    </div>

                    {/* Privacy Badge */}
                    <Badge 
                      variant="secondary" 
                      className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm"
                    >
                      {getPrivacyIcon(garden.privacy)}
                      <span className="ml-1">{getPrivacyLabel(garden.privacy)}</span>
                    </Badge>
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{garden.name}</h3>
                        {garden.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">{garden.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Updated {format(new Date(garden.updated_date), 'MMM d, yyyy')}
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl('MyGarden') + `?gardenId=${garden.id}`}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Layout
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl('GardenPlanting') + `?gardenId=${garden.id}`}>
                              <Sprout className="w-4 h-4 mr-2" />
                              My Garden
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openShareDialog(garden)}>
                            <Share2 className="w-4 h-4 mr-2" />
                            Share Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(garden)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleArchive(garden)}>
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(garden)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* New Garden Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Garden</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Garden Name</Label>
              <Input
                id="name"
                placeholder="e.g., Backyard Garden"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What are you growing this season?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Privacy</Label>
              <Select 
                value={formData.privacy} 
                onValueChange={(v) => setFormData({ ...formData, privacy: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Private - Only you
                    </div>
                  </SelectItem>
                  <SelectItem value="unlisted">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      Unlisted - Anyone with link
                    </div>
                  </SelectItem>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Public - Discoverable
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreate} 
              disabled={!formData.name.trim() || saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Garden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share "{selectedGarden?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Privacy Setting</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {['private', 'unlisted', 'public'].map((privacy) => (
                  <button
                    key={privacy}
                    onClick={() => handleShare(privacy)}
                    className={`p-3 rounded-lg border-2 transition-colors text-center ${
                      selectedGarden?.privacy === privacy 
                        ? 'border-emerald-600 bg-emerald-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {getPrivacyIcon(privacy)}
                      <span className="text-sm font-medium capitalize">{privacy}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedGarden?.privacy !== 'private' && (
              <div>
                <Label>Share Link</Label>
                <div className="flex gap-2 mt-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}/PublicGarden?id=${selectedGarden?.id}`}
                    className="font-mono text-sm"
                  />
                  <Button onClick={copyShareLink} variant="outline">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span>Collaborator invites coming soon</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}