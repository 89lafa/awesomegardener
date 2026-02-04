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

const TIER_COLORS = {
  bronze: 'bg-amber-600 text-white',
  silver: 'bg-gray-400 text-white',
  gold: 'bg-yellow-500 text-white',
  platinum: 'bg-purple-600 text-white'
};

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
      const allAchievements = await base44.asServiceRole.entities.Achievement.list('-sort_order');
      setAchievements(allAchievements);
    } catch (error) {
      console.error('Error loading achievements:', error);
      toast.error('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (achievementData) => {
    try {
      if (editingAchievement?.id) {
        await base44.asServiceRole.entities.Achievement.update(editingAchievement.id, achievementData);
        toast.success('Achievement updated!');
      } else {
        await base44.asServiceRole.entities.Achievement.create(achievementData);
        toast.success('Achievement created!');
      }
      setShowDialog(false);
      setEditingAchievement(null);
      await loadAchievements();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save achievement');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this achievement?')) return;
    try {
      await base44.asServiceRole.entities.Achievement.delete(id);
      toast.success('Achievement deleted');
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
          <p className="text-gray-600 mt-1">Create and edit achievement badges</p>
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
                    <span className="text-3xl">{achievement.icon || '🏆'}</span>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">{achievement.title}</h3>
                      <p className="text-sm text-gray-600">{achievement.code}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded ${TIER_COLORS[achievement.tier]}`}>
                      {achievement.tier}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">{achievement.category}</span>
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
    category: 'planting',
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
        category: 'planting',
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
            <Label>Code (unique identifier)</Label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
              placeholder="FIRST_PLANT"
            />
          </div>

          <div>
            <Label>Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="First Plant"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Plant your first crop"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Icon (emoji)</Label>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🏆"
              />
            </div>
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
                  <SelectItem value="bronze">🥉 Bronze</SelectItem>
                  <SelectItem value="silver">🥈 Silver</SelectItem>
                  <SelectItem value="gold">🥇 Gold</SelectItem>
                  <SelectItem value="platinum">💎 Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Requirement (JSON)</Label>
            <Textarea
              value={JSON.stringify(formData.requirement, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData({ ...formData, requirement: parsed });
                } catch (err) {}
              }}
              placeholder='{"type": "plant_count", "value": 10}'
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Example: {"{"}"type": "plant_count", "value": 10{"}"}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Points</Label>
              <Input
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="is_active">Active</Label>
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