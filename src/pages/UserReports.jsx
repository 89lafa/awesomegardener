import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Trash2, CheckCircle2, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function UserReports() {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [viewContent, setViewContent] = useState(null);
  const [contentCreators, setContentCreators] = useState({});

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);
      loadReports();
    } catch (error) {
      window.location.href = '/Dashboard';
    }
  };

  const loadReports = async () => {
    try {
      const data = await base44.entities.ContentReport.list('-created_date');
      setReports(data);
      
      // Load content creators for each report
      const creatorsMap = {};
      for (const report of data) {
        try {
          let content = null;
          if (report.report_type === 'forum_post') {
            const posts = await base44.entities.ForumPost.filter({ id: report.target_id });
            content = posts[0];
          } else if (report.report_type === 'forum_topic') {
            const topics = await base44.entities.ForumTopic.filter({ id: report.target_id });
            content = topics[0];
          } else if (report.report_type === 'forum_comment') {
            const comments = await base44.entities.ForumComment.filter({ id: report.target_id });
            content = comments[0];
          } else if (report.report_type === 'variety_suggestion') {
            const suggestions = await base44.entities.VarietySuggestion.filter({ id: report.target_id });
            content = suggestions[0];
          } else if (report.report_type === 'image_submission') {
            const submissions = await base44.entities.VarietyImageSubmission.filter({ id: report.target_id });
            content = submissions[0];
          }
          
          if (content) {
            creatorsMap[report.id] = content.created_by || content.submitted_by || 'Unknown';
          }
        } catch (error) {
          console.error('Error loading content creator:', error);
        }
      }
      setContentCreators(creatorsMap);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContent = async (report) => {
    try {
      let content = null;
      if (report.report_type === 'forum_post') {
        const posts = await base44.entities.ForumPost.filter({ id: report.target_id });
        content = posts[0];
      } else if (report.report_type === 'forum_topic') {
        const topics = await base44.entities.ForumTopic.filter({ id: report.target_id });
        content = topics[0];
      } else if (report.report_type === 'forum_comment') {
        const comments = await base44.entities.ForumComment.filter({ id: report.target_id });
        content = comments[0];
      }
      setViewContent(content);
    } catch (error) {
      toast.error('Failed to load content');
    }
  };

  const handleDeleteContent = async (report) => {
    if (!confirm('Delete this content? This will soft-delete it.')) return;

    try {
      if (report.report_type === 'forum_post') {
        await base44.entities.ForumPost.update(report.target_id, { deleted_at: new Date().toISOString() });
      } else if (report.report_type === 'forum_topic') {
        await base44.entities.ForumTopic.update(report.target_id, { deleted_at: new Date().toISOString() });
      } else if (report.report_type === 'forum_comment') {
        await base44.entities.ForumComment.update(report.target_id, { deleted_at: new Date().toISOString() });
      }
      
      // Mark report as resolved
      await base44.entities.ContentReport.update(report.id, {
        status: 'resolved',
        resolved_by: user.email,
        resolved_at: new Date().toISOString(),
        admin_notes: 'Content deleted'
      });
      
      setReports(reports.map(r => r.id === report.id ? { ...r, status: 'resolved' } : r));
      toast.success('Content deleted and report resolved');
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  };

  const handleResolve = async (report) => {
    try {
      await base44.entities.ContentReport.update(report.id, {
        status: 'resolved',
        resolved_by: user.email,
        resolved_at: new Date().toISOString()
      });
      
      setReports(reports.map(r => r.id === report.id ? { ...r, status: 'resolved' } : r));
      toast.success('Report marked as resolved');
    } catch (error) {
      console.error('Error resolving:', error);
      toast.error('Failed to resolve report');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const openReports = reports.filter(r => r.status === 'open');
  const resolvedReports = reports.filter(r => r.status === 'resolved');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">User Reports</h1>
        <p className="text-gray-600 mt-1">Review and moderate reported content</p>
      </div>

      <div className="flex gap-4">
        <Badge className="bg-red-100 text-red-800">{openReports.length} Open</Badge>
        <Badge variant="secondary">{resolvedReports.length} Resolved</Badge>
      </div>

      {/* Open Reports */}
      {openReports.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Open Reports</h2>
          {openReports.map((report) => (
            <Card key={report.id} className="border-red-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800 capitalize">
                        {report.report_type.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {format(new Date(report.created_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="grid gap-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-700">Reported by:</span>{' '}
                        <span className="font-medium">{report.reporter_email}</span>
                      </p>
                      {contentCreators[report.id] && (
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold text-gray-700">Original Author:</span>{' '}
                          <span className="font-medium text-red-600">{contentCreators[report.id]}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {report.target_preview && (
                  <div className="p-3 bg-gray-50 rounded-lg mb-3">
                    <p className="text-sm text-gray-700 line-clamp-3">{report.target_preview}</p>
                  </div>
                )}

                {report.reason && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Reason:</p>
                    <p className="text-sm text-gray-700">{report.reason}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewContent(report)}
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Full
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteContent(report)}
                    className="gap-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Content
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleResolve(report)}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Resolved
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {openReports.length === 0 && (
        <Card className="py-16">
          <CardContent className="text-center">
            <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-600">No open reports</p>
          </CardContent>
        </Card>
      )}

      {/* Resolved Reports */}
      {resolvedReports.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-500">Resolved Reports</h2>
          {resolvedReports.slice(0, 10).map((report) => (
            <Card key={report.id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="secondary" className="capitalize mb-1">
                      {report.report_type.replace('_', ' ')}
                    </Badge>
                    <p className="text-sm text-gray-600">
                      Resolved by {report.resolved_by} on {format(new Date(report.resolved_at), 'MMM d')}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Resolved</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Content Dialog */}
      {viewContent && (
        <Dialog open={!!viewContent} onOpenChange={() => setViewContent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Full Content</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {viewContent.body || viewContent.title || 'No content'}
                </p>
              </div>
              {viewContent.created_by && (
                <p className="text-xs text-gray-500">Created by: {viewContent.created_by}</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setViewContent(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}