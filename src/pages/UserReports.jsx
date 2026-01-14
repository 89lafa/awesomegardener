import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function UserReports() {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
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

      const reportsData = await base44.entities.UserReport.filter(
        filterStatus === 'all' ? {} : { status: filterStatus },
        '-created_date'
      );

      setReports(reportsData);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (action) => {
    if (!selectedReport) return;

    setProcessing(true);
    try {
      const updateData = {
        status: action === 'dismiss' ? 'dismissed' : action === 'resolve' ? 'reviewed' : 'action_taken',
        admin_notes: adminNotes.trim() || null,
        resolved_by: user.email,
        resolved_at: new Date().toISOString()
      };

      await base44.entities.UserReport.update(selectedReport.id, updateData);

      toast.success(`Report ${action === 'dismiss' ? 'dismissed' : 'resolved'}`);
      setShowDialog(false);
      setSelectedReport(null);
      setAdminNotes('');
      loadData();
    } catch (error) {
      console.error('Error processing report:', error);
      toast.error('Failed to process report');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (report) => {
    if (!confirm('Delete this report? This cannot be undone.')) return;

    try {
      await base44.entities.UserReport.delete(report.id);
      setReports(reports.filter(r => r.id !== report.id));
      toast.success('Report deleted');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    reviewed: 'bg-blue-100 text-blue-800',
    action_taken: 'bg-green-100 text-green-800',
    dismissed: 'bg-gray-100 text-gray-800'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">User Reports</h1>
        <p className="text-gray-600 mt-1">Review and moderate reported content</p>
      </div>

      <div className="flex gap-4">
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
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports</h3>
            <p className="text-gray-600">
              {filterStatus === 'pending' ? 'No pending reports to review' : `No ${filterStatus} reports`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base capitalize">{report.report_type} Report</CardTitle>
                      <Badge className={statusColors[report.status]}>{report.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Reported by {report.reported_by} • {format(new Date(report.created_date), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedReport(report);
                        setShowDialog(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                    {report.status !== 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(report)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Item Type:</p>
                  <p className="text-sm text-gray-600">{report.reported_item_type}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Reason:</p>
                  <p className="text-sm text-gray-600 capitalize">{report.reason.replace('_', ' ')}</p>
                </div>
                {report.description && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Details:</p>
                    <p className="text-sm text-gray-600">{report.description}</p>
                  </div>
                )}
                {report.admin_notes && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900">Admin Notes:</p>
                    <p className="text-sm text-blue-800 mt-1">{report.admin_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Report Type:</p>
                  <p className="text-sm text-gray-600 capitalize">{selectedReport.report_type}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Status:</p>
                  <Badge className={statusColors[selectedReport.status]}>
                    {selectedReport.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700">Reported Item:</p>
                <p className="text-sm text-gray-600">
                  {selectedReport.reported_item_type} (ID: {selectedReport.reported_item_id})
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700">Reason:</p>
                <p className="text-sm text-gray-600 capitalize">{selectedReport.reason.replace('_', ' ')}</p>
              </div>

              {selectedReport.description && (
                <div>
                  <p className="text-sm font-semibold text-gray-700">Additional Details:</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedReport.description}</p>
                </div>
              )}

              <div>
                <Label htmlFor="notes">Admin Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about your action..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Close
            </Button>
            {selectedReport?.status === 'pending' && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => handleReview('dismiss')}
                  disabled={processing}
                  className="text-gray-600"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Dismiss
                </Button>
                <Button
                  onClick={() => handleReview('action_taken')}
                  disabled={processing}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                  Action Taken
                </Button>
                <Button
                  onClick={() => handleReview('resolve')}
                  disabled={processing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Mark Reviewed
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}