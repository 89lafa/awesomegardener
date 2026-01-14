import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ImageSubmissions() {
  const [user, setUser] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [varieties, setVarieties] = useState({});
  const [loading, setLoading] = useState(true);
  const [aiChecking, setAiChecking] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin' && !userData.is_moderator) {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);

      const [submissionsData, varietiesData] = await Promise.all([
        base44.entities.VarietyImageSubmission.filter({ status: 'pending' }, '-created_date'),
        base44.entities.Variety.list()
      ]);

      setSubmissions(submissionsData);
      
      const varietiesMap = {};
      varietiesData.forEach(v => {
        varietiesMap[v.id] = v;
      });
      setVarieties(varietiesMap);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submission) => {
    try {
      const variety = varieties[submission.variety_id];
      if (!variety) {
        toast.error('Variety not found');
        return;
      }

      // Add image to variety
      const currentImages = variety.images || [];
      await base44.entities.Variety.update(submission.variety_id, {
        images: [...currentImages, submission.image_url]
      });

      // Mark submission as approved
      await base44.entities.VarietyImageSubmission.update(submission.id, {
        status: 'approved',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      });

      setSubmissions(submissions.filter(s => s.id !== submission.id));
      toast.success('Image approved and added to variety');
    } catch (error) {
      console.error('Error approving image:', error);
      toast.error('Failed to approve image');
    }
  };

  const handleReject = async (submission) => {
    try {
      await base44.entities.VarietyImageSubmission.update(submission.id, {
        status: 'rejected',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString()
      });

      setSubmissions(submissions.filter(s => s.id !== submission.id));
      toast.success('Image rejected');
    } catch (error) {
      console.error('Error rejecting image:', error);
      toast.error('Failed to reject image');
    }
  };

  const handleAICheck = async (submission) => {
    setAiChecking({ ...aiChecking, [submission.id]: true });
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Review this image for content moderation. Is it appropriate for a gardening community app?
        
Check for:
- Inappropriate content (violence, nudity, offensive material)
- Spam or unrelated content
- Quality issues that make it unsuitable

Return ONLY:
- "PASS" if image is appropriate
- "FAIL" if image is inappropriate (provide brief reason)`,
        file_urls: [submission.image_url],
        response_json_schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["PASS", "FAIL"] },
            reason: { type: "string" }
          }
        }
      });

      await base44.entities.VarietyImageSubmission.update(submission.id, {
        ai_check_status: result.status,
        ai_check_reason: result.reason || null,
        ai_checked_at: new Date().toISOString()
      });

      setSubmissions(submissions.map(s => 
        s.id === submission.id 
          ? { ...s, ai_check_status: result.status, ai_check_reason: result.reason }
          : s
      ));

      toast.success(`AI Check: ${result.status}`);
    } catch (error) {
      console.error('Error running AI check:', error);
      toast.error('AI check failed');
    } finally {
      setAiChecking({ ...aiChecking, [submission.id]: false });
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
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Image Submissions</h1>
        <p className="text-gray-600 mt-1">Review user-submitted variety images</p>
      </div>

      {submissions.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Check className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-600">No pending image submissions</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {submissions.map((submission) => {
            const variety = varieties[submission.variety_id];
            return (
              <Card key={submission.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {variety?.variety_name || 'Unknown Variety'}
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Submitted by {submission.submitted_by} on {format(new Date(submission.created_date), 'MMM d, yyyy')}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <img 
                    src={submission.image_url} 
                    alt="Submission" 
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  
                  <div className="flex gap-2 flex-wrap">
                    {submission.ownership_confirmed && (
                      <Badge className="bg-green-100 text-green-800">
                        Ownership Confirmed
                      </Badge>
                    )}
                    {submission.ai_check_status && (
                      <Badge className={submission.ai_check_status === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        AI Check: {submission.ai_check_status}
                      </Badge>
                    )}
                  </div>
                  {submission.ai_check_reason && (
                    <p className="text-xs text-gray-600 mt-2">AI: {submission.ai_check_reason}</p>
                  )}

                  <div className="space-y-2">
                    {!submission.ai_check_status && (
                      <Button
                        onClick={() => handleAICheck(submission)}
                        disabled={aiChecking[submission.id]}
                        variant="outline"
                        className="w-full gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
                      >
                        {aiChecking[submission.id] ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            AI Checking...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            AI Check
                          </>
                        )}
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(submission)}
                        className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(submission)}
                        variant="outline"
                        className="flex-1 gap-2 text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}