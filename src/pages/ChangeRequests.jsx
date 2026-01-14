import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [varieties, setVarieties] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      if (userData.role !== 'admin' && !userData.is_moderator) {
        window.location.href = '/Dashboard';
        return;
      }

      const [requestsData, varietiesData] = await Promise.all([
        base44.entities.VarietyChangeRequest.filter({ status: 'pending' }, '-created_date'),
        base44.entities.Variety.list()
      ]);

      setRequests(requestsData);

      const varietiesMap = {};
      varietiesData.forEach(v => { varietiesMap[v.id] = v; });
      setVarieties(varietiesMap);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (approve) => {
    if (!selectedRequest) return;

    setReviewing(true);
    try {
      await base44.entities.VarietyChangeRequest.update(selectedRequest.id, {
        status: approve ? 'approved' : 'rejected',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      });

      if (approve) {
        // Apply changes to variety if approved
        if (selectedRequest.requested_changes && typeof selectedRequest.requested_changes === 'object') {
          await base44.entities.Variety.update(selectedRequest.variety_id, selectedRequest.requested_changes);
        }
      }

      toast.success(approve ? 'Request approved' : 'Request denied');
      setShowReviewDialog(false);
      setSelectedRequest(null);
      setReviewNotes('');
      loadData();
    } catch (error) {
      console.error('Error reviewing request:', error);
      toast.error('Failed to review request');
    } finally {
      setReviewing(false);
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Variety Change Requests</h1>
        <p className="text-gray-600 mt-1">Review and approve user-submitted changes</p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No pending change requests</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map(request => {
            const variety = varieties[request.variety_id];
            return (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {variety?.variety_name || 'Unknown Variety'}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        Requested by {request.created_by} • {format(new Date(request.created_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Badge>Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {request.reason && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Reason:</p>
                      <p className="text-sm text-gray-600 mt-1">{request.reason}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowReviewDialog(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Change Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Variety:</p>
              <p className="text-sm text-gray-600">
                {selectedRequest && varieties[selectedRequest.variety_id]?.variety_name}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Reason:</p>
              <p className="text-sm text-gray-600">{selectedRequest?.reason}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Review Notes (optional):</p>
              <Textarea
                placeholder="Add notes about your decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowReviewDialog(false);
                setReviewNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview(false)}
              disabled={reviewing}
            >
              {reviewing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Deny
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleReview(true)}
              disabled={reviewing}
            >
              {reviewing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}