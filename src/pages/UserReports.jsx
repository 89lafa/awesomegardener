import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, CheckCircle, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function UserReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);

      const filter = filterStatus === 'all' ? {} : { status: filterStatus };
      const reportsData = await base44.entities.UserReport.filter(filter, '-created_date');
      setReports(reportsData);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (newStatus) => {
    if (!selectedReport) return;

    setReviewing(true);
    try {
      await base44.entities.UserReport.update(selectedReport.id, {
        status: newStatus,
        admin_notes: adminNotes,
        resolved_by: user.email,
        resolved_at: new Date().toISOString()
      });

      toast.success(`Report marked as ${newStatus}`);
      setShowReviewDialog(false);
      setSelectedReport(null);
      setAdminNotes('');
      loadData();
    } catch (error) {
      console.error('Error reviewing report:', error);
      toast.error('Failed to update report');
    } finally {
      setReviewing(false);
    }
  };

  const handleDelete = async (reportedItemId, reportedItemType) => {
    if (!confirm(`Delete this ${reportedItemType}? This action cannot be undone.`)) return;

    try {
      await base44.entities[reportedItemType].delete(reportedItemId);
      toast.success(`${reportedItemType} deleted successfully`);
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
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
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">User Reports</h1>
          <p className="text-gray-600 mt-1">Review community-reported content</p>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="action_taken">Action Taken</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reports.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
            <p className="text-gray-600">No {filterStatus === 'all' ? '' : filterStatus} reports</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <Card key={report.id} className={report.status === 'pending' ? 'border-red-300' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={
                        report.status === 'pending' ? 'bg-red-100 text-red-800' :
                        report.status === 'action_taken' ? 'bg-green-100 text-green-800' :
                        report.status === 'dismissed' ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                      }>
                        {report.status}
                      </Badge>
                      <Badge variant="outline">{report.report_type}</Badge>
                      <Badge variant="outline">{report.reported_item_type}</Badge>
                    </div>
                    <CardTitle className="text-base">Reported by {report.reported_by}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {format(new Date(report.created_date), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Reason:</p>
                  <p className="text-sm text-gray-600 capitalize">{report.reason}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Description:</p>
                  <p className="text-sm text-gray-600">{report.description}</p>
                </div>
                {report.admin_notes && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Admin Notes:</p>
                    <p className="text-sm text-gray-600">{report.admin_notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedReport(report);
                      setShowReviewDialog(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Review
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(report.reported_item_id, report.reported_item_type)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Report Type:</p>
              <p className="text-sm text-gray-600 capitalize">{selectedReport?.report_type}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Reason:</p>
              <p className="text-sm text-gray-600 capitalize">{selectedReport?.reason}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Description:</p>
              <p className="text-sm text-gray-600">{selectedReport?.description}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Admin Notes:</p>
              <Textarea
                placeholder="Add your notes..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button
              variant="outline"
              onClick={() => handleReview('dismissed')}
              disabled={reviewing}
            >
              {reviewing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Dismiss
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleReview('reviewed')}
              disabled={reviewing}
            >
              Mark Reviewed
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleReview('action_taken')}
              disabled={reviewing}
            >
              Action Taken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}