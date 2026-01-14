import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ReportButton({ reportType, targetId, targetPreview }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const handleReport = async () => {
    setReporting(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.ContentReport.create({
        report_type: reportType,
        target_id: targetId,
        target_preview: targetPreview?.substring(0, 200),
        reason: reason.trim() || null,
        reporter_email: user.email,
        status: 'open'
      });
      
      toast.success('Content reported to moderators');
      setOpen(false);
      setReason('');
    } catch (error) {
      console.error('Error reporting:', error);
      toast.error('Failed to submit report');
    } finally {
      setReporting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1 text-gray-500 hover:text-red-600"
      >
        <AlertCircle className="w-3 h-3" />
        Report
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will alert moderators to review this content.
            </p>
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Why are you reporting this?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleReport}
              disabled={reporting}
              className="bg-red-600 hover:bg-red-700"
            >
              {reporting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}