import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function VarietyReviewQueue() {
  const [user, setUser] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [checkingAI, setCheckingAI] = useState({});
  const [checkingAI, setCheckingAI] = useState({});

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (user) {
      loadSuggestions();
    }
  }, [filterStatus, user]);

  const checkAccess = async () => {
    try {
      const userData = await base44.auth.me();
      if (!userData || (userData.role !== 'admin' && userData.role !== 'editor')) {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);
    } catch (error) {
      console.error('Error checking access:', error);
      window.location.href = '/Dashboard';
    }
  };

  const loadSuggestions = async () => {
    try {
      const filter = filterStatus === 'all' ? {} : { status: filterStatus };
      const data = await base44.entities.VarietySuggestion.filter(filter, '-created_date');
      setSuggestions(data);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (suggestion, action) => {
    setReviewing(true);
    try {
      if (action === 'approve') {
        // Create the variety
        await base44.entities.Variety.create({
          plant_type_id: suggestion.plant_type_id,
          plant_type_name: suggestion.plant_type_name,
          variety_name: suggestion.variety_name,
          synonyms: suggestion.synonyms || [],
          days_to_maturity: suggestion.days_to_maturity,
          spacing_recommended: suggestion.spacing_recommended,
          plant_height_typical: suggestion.plant_height_typical,
          sun_requirement: suggestion.sun_requirement,
          water_requirement: suggestion.water_requirement,
          trellis_required: suggestion.trellis_required,
          grower_notes: suggestion.grower_notes,
          source_attribution: suggestion.source_url || 'User Suggestion',
          status: 'active',
          is_custom: true
        });

        // Update suggestion status
        await base44.entities.VarietySuggestion.update(suggestion.id, {
          status: 'approved',
          reviewed_by: user.email,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes
        });

        toast.success('Variety approved and added to catalog!');
      } else {
        // Reject
        await base44.entities.VarietySuggestion.update(suggestion.id, {
          status: 'rejected',
          reviewed_by: user.email,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes
        });

        toast.success('Suggestion rejected');
      }

      setSuggestions(suggestions.filter(s => s.id !== suggestion.id));
      setSelectedSuggestion(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Error reviewing suggestion:', error);
      toast.error('Failed to review suggestion');
    } finally {
      setReviewing(false);
    }
  };

  const handleAICheck = async (suggestion) => {
    setCheckingAI({ ...checkingAI, [suggestion.id]: true });
    try {
      const textToCheck = `${suggestion.variety_name}\n${suggestion.grower_notes || ''}\n${suggestion.submitter_notes || ''}`;
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this text for inappropriate content:

"${textToCheck}"

Check for profanity, offensive language, or hateful content. Return assessment.`,
        response_json_schema: {
          type: "object",
          properties: {
            is_appropriate: { type: "boolean" },
            issues_found: { type: "array", items: { type: "string" } },
            confidence: { type: "string" }
          }
        }
      });

      const aiResult = response.is_appropriate ? 'pass' : 'fail';
      await base44.entities.VarietySuggestion.update(suggestion.id, {
        ai_check_result: aiResult,
        ai_check_details: JSON.stringify(response)
      });

      setSuggestions(suggestions.map(s => 
        s.id === suggestion.id ? { ...s, ai_check_result: aiResult, ai_check_details: JSON.stringify(response) } : s
      ));

      toast.success(`AI Check: ${aiResult === 'pass' ? 'PASS ✓' : 'FAIL ✗'}`);
    } catch (error) {
      console.error('AI check error:', error);
      toast.error('AI check failed');
    } finally {
      setCheckingAI({ ...checkingAI, [suggestion.id]: false });
    }
  };

  const handleAICheck = async (suggestion) => {
    setCheckingAI({ ...checkingAI, [suggestion.id]: true });
    try {
      const textToCheck = `Variety Name: ${suggestion.variety_name}\nDescription: ${suggestion.grower_notes || ''}\nNotes: ${suggestion.submitter_notes || ''}`;
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a content moderation AI. Check this plant variety submission for inappropriate content:

${textToCheck}

Check for:
- Profanity or offensive language
- Hateful or discriminatory content
- Spam or promotional content

Return PASS if safe, FAIL if inappropriate.`,
        response_json_schema: {
          type: "object",
          properties: {
            result: { type: "string", enum: ["PASS", "FAIL"] },
            reason: { type: "string" }
          }
        }
      });

      await base44.entities.VarietySuggestion.update(suggestion.id, {
        ai_check_result: result.result,
        ai_check_reason: result.reason
      });

      setSuggestions(suggestions.map(s => 
        s.id === suggestion.id 
          ? { ...s, ai_check_result: result.result, ai_check_reason: result.reason }
          : s
      ));

      toast.success(`AI Check: ${result.result}`);
    } catch (error) {
      console.error('Error running AI check:', error);
      toast.error('AI check failed');
    } finally {
      setCheckingAI({ ...checkingAI, [suggestion.id]: false });
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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Variety Suggestions</h1>
        <p className="text-gray-600 mt-1">Review community-submitted varieties</p>
      </div>

      <div className="flex items-center gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{suggestions.length} suggestions</Badge>
      </div>

      {suggestions.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No suggestions</h3>
            <p className="text-gray-600">
              {filterStatus === 'pending' ? 'All caught up!' : `No ${filterStatus} suggestions`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{suggestion.variety_name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{suggestion.plant_type_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Submitted by {suggestion.created_by} • {format(new Date(suggestion.created_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge className={
                    suggestion.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    suggestion.status === 'approved' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }>
                    {suggestion.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {suggestion.duplicate_warning && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      Similar variety detected during submission
                    </p>
                  </div>
                )}

                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  {suggestion.days_to_maturity && (
                    <div>
                      <span className="text-gray-500">Days to Maturity:</span>
                      <span className="ml-2 font-medium">{suggestion.days_to_maturity}</span>
                    </div>
                  )}
                  {suggestion.spacing_recommended && (
                    <div>
                      <span className="text-gray-500">Spacing:</span>
                      <span className="ml-2 font-medium">{suggestion.spacing_recommended}"</span>
                    </div>
                  )}
                  {suggestion.plant_height_typical && (
                    <div>
                      <span className="text-gray-500">Height:</span>
                      <span className="ml-2 font-medium">{suggestion.plant_height_typical}</span>
                    </div>
                  )}
                </div>

                {suggestion.grower_notes && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{suggestion.grower_notes}</p>
                  </div>
                )}

                {suggestion.submitter_notes && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium mb-1">Submitter's rationale:</p>
                    <p className="text-sm text-blue-900">{suggestion.submitter_notes}</p>
                  </div>
                )}

                {suggestion.source_url && (
                  <a 
                    href={suggestion.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    Source Reference <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {suggestion.status === 'pending' && (
                  <div className="space-y-2 pt-2">
                    {!suggestion.ai_check_result && (
                      <Button
                        onClick={() => handleAICheck(suggestion)}
                        disabled={checkingAI[suggestion.id]}
                        variant="outline"
                        className="w-full gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
                        size="sm"
                      >
                        {checkingAI[suggestion.id] ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />Checking...</>
                        ) : (
                          <><Sparkles className="w-4 h-4" />Run AI Check</>
                        )}
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => setSelectedSuggestion(suggestion)}
                        className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setSelectedSuggestion(suggestion);
                          setReviewNotes('');
                        }}
                        className="text-red-600 gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {suggestion.status !== 'pending' && suggestion.reviewed_by && (
                  <div className="pt-2 border-t text-xs text-gray-500">
                    Reviewed by {suggestion.reviewed_by} on {format(new Date(suggestion.reviewed_at), 'MMM d, yyyy')}
                    {suggestion.review_notes && (
                      <p className="mt-1 text-gray-600">{suggestion.review_notes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      {selectedSuggestion && (
        <Dialog open={!!selectedSuggestion} onOpenChange={() => setSelectedSuggestion(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Suggestion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-900">{selectedSuggestion.variety_name}</p>
                <p className="text-sm text-gray-600">{selectedSuggestion.plant_type_name}</p>
              </div>
              <div>
                <Label htmlFor="reviewNotes">Review Notes (optional)</Label>
                <Textarea
                  id="reviewNotes"
                  placeholder="Add notes for the submitter or other reviewers..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedSuggestion(null)}>Cancel</Button>
              <Button 
                variant="outline"
                onClick={() => handleReview(selectedSuggestion, 'reject')}
                disabled={reviewing}
                className="text-red-600"
              >
                {reviewing ? 'Rejecting...' : 'Reject'}
              </Button>
              <Button 
                onClick={() => handleReview(selectedSuggestion, 'approve')}
                disabled={reviewing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {reviewing ? 'Approving...' : 'Approve & Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}