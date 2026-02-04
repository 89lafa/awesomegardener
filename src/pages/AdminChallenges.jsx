import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Edit, Trash2, Target } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const all = await base44.asServiceRole.entities.Challenge.list('-created_date');
      setChallenges(all);
    } catch (error) {
      console.error('Error loading challenges:', error);
      toast.error('Failed to load challenges');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingChallenge?.id) {
        await base44.asServiceRole.entities.Challenge.update(editingChallenge.id, data);
        toast.success('Challenge updated!');
      } else {
        await base44.asServiceRole.entities.Challenge.create(data);
        toast.success('Challenge created!');
      }
      setShowDialog(false);
      setEditingChallenge(null);
      await loadChallenges();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this challenge?')) return;
    try {
      await base44.asServiceRole.entities.Challenge.delete(id);
      toast.success('Deleted');
      await loadChallenges();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete');
    }
  };

  const openEditDialog = (challenge = null) => {
    setEditingChallenge(challenge);
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
          <h1 className="text-3xl font-bold text-gray-900">Manage Challenges</h1>
          <p className="text-gray-600 mt-1">Create and edit challenges for users</p>
        </div>
        <Button onClick={() => openEditDialog()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />
          New Challenge
        </Button>
      </div>

      <div className="grid gap-4">
        {challenges.map((challenge) => (
          <Card key={challenge.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Target className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-semibold text-lg text-gray-900">{challenge.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">{challenge.challenge_type}</span>
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">{challenge.reward_points} pts</span>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">{challenge.participant_count || 0} participants</span>
                    {!challenge.is_active && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">Inactive</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(challenge)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(challenge.id)}
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

      <ChallengeEditDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        challenge={editingChallenge}
        onSave={handleSave}
      />
    </div>
  );
}

function ChallengeEditDialog({ open, onOpenChange, challenge, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    icon: '🎯',
    challenge_type: 'weekly',
    requirement: { action: 'harvest', count: 5 },
    reward_points: 50,
    start_date: new Date().toISOString(),
    end_date: null,
    is_active: true
  });

  useEffect(() => {
    if (challenge) {
      setFormData(challenge);
    } else {
      setFormData({
        title: '',
        description: '',
        icon: '🎯',
        challenge_type: 'weekly',
        requirement: { action: 'harvest', count: 5 },
        reward_points: 50,
        start_date: new Date().toISOString(),
        end_date: null,
        is_active: true
      });
    }
  }, [challenge, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{challenge ? 'Edit Challenge' : 'New Challenge'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Harvest 10 Tomatoes"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select
                value={formData.challenge_type}
                onValueChange={(v) => setFormData({ ...formData, challenge_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="special">Special</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reward Points</Label>
              <Input
                type="number"
                value={formData.reward_points}
                onChange={(e) => setFormData({ ...formData, reward_points: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <Label>Icon (Emoji)</Label>
            <Input
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="🎯"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="datetime-local"
                value={formData.start_date ? new Date(formData.start_date).toISOString().slice(0, 16) : ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
            <div>
              <Label>End Date (optional)</Label>
              <Input
                type="datetime-local"
                value={formData.end_date ? new Date(formData.end_date).toISOString().slice(0, 16) : ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => onSave(formData)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {challenge ? 'Update' : 'Create'} Challenge
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