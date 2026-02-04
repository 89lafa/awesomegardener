import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';

const ACTIVITIES = [
  { type: 'watered', icon: '💧', label: 'Watered' },
  { type: 'harvested', icon: '🍅', label: 'Harvested' },
  { type: 'planted', icon: '🌱', label: 'Planted' },
  { type: 'fertilized', icon: '🌿', label: 'Fertilized' },
  { type: 'problem', icon: '⚠️', label: 'Problem' },
  { type: 'note', icon: '📝', label: 'Update' },
  { type: 'milestone', icon: '🎉', label: 'Milestone' }
];

async function updateStreak(userId, base44) {
  const today = new Date().toISOString().split('T')[0];
  
  const streaks = await base44.entities.UserStreak.filter({ created_by: userId });
  const streak = streaks[0];
  
  if (!streak) {
    await base44.entities.UserStreak.create({
      current_streak: 1,
      longest_streak: 1,
      last_check_in_date: today,
      total_check_ins: 1,
      created_by: userId
    });
    return;
  }
  
  const lastCheckIn = streak.last_check_in_date;
  
  if (lastCheckIn === today) {
    await base44.entities.UserStreak.update(streak.id, {
      total_check_ins: streak.total_check_ins + 1
    });
    return;
  }
  
  const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
  const isConsecutive = lastCheckIn === yesterday;
  
  const newStreak = isConsecutive ? streak.current_streak + 1 : 1;
  const newLongest = Math.max(newStreak, streak.longest_streak);
  
  await base44.entities.UserStreak.update(streak.id, {
    current_streak: newStreak,
    longest_streak: newLongest,
    last_check_in_date: today,
    total_check_ins: streak.total_check_ins + 1
  });
  
  if (newStreak > streak.current_streak) {
    toast.success(`🔥 ${newStreak} day streak!`);
  }
}

export default function QuickCheckInModal({ open, onOpenChange, preselectedCropPlanIds }) {
  const [activity, setActivity] = useState(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhoto(file_url);
      toast.success('Photo added!');
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error('Failed to upload photo');
    }
  };

  const handleSubmit = async () => {
    if (!activity) return;

    setSubmitting(true);
    try {
      const user = await base44.auth.me();

      await base44.entities.ActivityLog.create({
        activity_type: activity,
        activity_date: new Date().toISOString(),
        crop_plan_ids: preselectedCropPlanIds || [],
        notes: note || null,
        photo_url: photo,
        is_public: false,
        created_by: user.email
      });

      await updateStreak(user.email, base44);

      const activityEmoji = ACTIVITIES.find(a => a.type === activity)?.icon || '✓';
      toast.success(`Checked in! ${activityEmoji}`);

      setActivity(null);
      setNote('');
      setPhoto(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Failed to check in');
    } finally {
      setSubmitting(false);
    }
  };

  const resetModal = () => {
    setActivity(null);
    setNote('');
    setPhoto(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetModal}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Check-In</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Activity Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {ACTIVITIES.map((act) => (
              <button
                key={act.type}
                onClick={() => setActivity(act.type)}
                className={`p-3 rounded-lg border-2 transition ${
                  activity === act.type 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-gray-200 hover:border-emerald-300'
                }`}
              >
                <div className="text-2xl mb-1">{act.icon}</div>
                <div className="text-xs text-gray-700">{act.label}</div>
              </button>
            ))}
          </div>

          {/* Photo Upload */}
          <div>
            <Button
              variant="outline"
              onClick={() => document.getElementById('checkin-photo').click()}
              className="w-full gap-2"
              size="sm"
            >
              <Camera className="w-4 h-4" />
              {photo ? 'Photo Added ✓' : 'Add Photo (Optional)'}
            </Button>
            <input
              id="checkin-photo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
              className="hidden"
            />
          </div>

          {/* Note */}
          <Textarea
            placeholder="Add a note... (optional, max 280 characters)"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 280))}
            className="resize-none"
            rows={3}
          />
          <p className="text-xs text-gray-500 text-right">{note.length}/280</p>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!activity || submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Check In'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}