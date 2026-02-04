import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Edit, Trash2, Award } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAchievements() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      const all = await base44.asServiceRole.entities.Achievement.list('-sort_order');
      setAchievements(all);
    } catch (error) {
      console.error('Error loading achievements:', error);
      toast.error('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingAchievement?.id) {
        await base44.asServiceRole.entities.Achievement.update(editingAchievement.id, data);
        toast.success('Achievement updated!');
      } else {
        await base44.asServiceRole.entities.Achievement.create(data);
        toast.success('Achievement created!');
      }
      setShowDialog(false);
      setEditingAchievement(null);
      await loadAchievements();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this achievement?')) return;
    try {
      await base44.asServiceRole.entities.Achievement.delete(id);
      toast.success('Deleted');
      await loadAchievements();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete');
    }
  };

  const openEditDialog = (achievement = null) => {
    setEditingAchievement(achievement);
    setShowDialog(true);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Achievements</h1>
          <p className="text-gray-600 mt-1">Create and edit badges/achievements</p>
        </div>
        <Button onClick={() => openEditDialog()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />
          New Achievement
        </Button>
      </div>

      <div className="grid gap-4">
        {achievements.map((achievement) => (
          <Card key={achievement.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{achievement.icon}</span>
                    <h3 className="font-semibold text-lg text-gray-900">{achievement.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">{achievement.category}</span>
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded capitalize">{achievement.tier}</span>
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">{achievement.points} pts</span>
                    {!achievement.is_active && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">Inactive</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(achievement)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(achievement.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AchievementEditDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        achievement={editingAchievement}
        onSave={handleSave}
      />
    </div>
  );
}

function AchievementEditDialog({ open, onOpenChange, achievement, onSave }) {
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    icon: '🏆',
    category: 'milestone',
    tier: 'bronze',
    points: 10,
    requirement: { type: 'plant_count', value: 1 },
    is_active: true,
    sort_order: 0
  });

  useEffect(() => {
    if (achievement) {
      setFormData(achievement);
    } else {
      setFormData({
        code: '',
        title: '',
        description: '',
        icon: '🏆',
        category: 'milestone',
        tier: 'bronze',
        points: 10,
        requirement: { type: 'plant_count', value: 1 },
        is_active: true,
        sort_order: 0
      });
    }
  }, [achievement, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{achievement ? 'Edit Achievement' : 'New Achievement'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Code (Unique ID)</Label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
              placeholder="FIRST_HARVEST"
            />
          </div>

          <div>
            <Label>Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="First Harvest"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planting">Planting</SelectItem>
                  <SelectItem value="harvesting">Harvesting</SelectItem>
                  <SelectItem value="streak">Streak</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="knowledge">Knowledge</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tier</Label>
              <Select
                value={formData.tier}
                onValueChange={(v) => setFormData({ ...formData, tier: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bronze">Bronze</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Icon (Emoji)</Label>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🏆"
              />
            </div>
            <div>
              <Label>Points</Label>
              <Input
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => onSave(formData)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {achievement ? 'Update' : 'Create'} Achievement
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}