import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Filter,
  Loader2,
  ChevronDown,
  User,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function EditorReviewQueue() {
  const [user, setUser] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [filterType, setFilterType] = useState('all');
  const [reviewingSuggestion, setReviewingSuggestion] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadSuggestions();
    }
  }, [user, filterStatus, filterType]);

  const checkAuth = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData?.role !== 'admin' && !userData?.is_editor) {
        window.location.href = '/';
        return;
      }
      setUser(userData);
    } catch (error) {
      window.location.href = '/';
    }
  };

  const loadSuggestions = async () => {
    try {
      let query = {};
      if (filterStatus !== 'all') {
        query.status = filterStatus;
      }
      if (filterType !== 'all') {
        query.object_type = filterType;
      }

      const data = await base44.entities.TaxonomyChangeSuggestion.filter(query, '-created_date', 100);
      setSuggestions(data);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (suggestion, action) => {
    setReviewingSuggestion(suggestion);
    setReviewAction(action);
    setReviewNotes('');
  };

  const submitReview = async () => {
    if (!reviewingSuggestion || !reviewAction) return;

    try {
      const newStatus = reviewAction === 'approve' ? 'APPROVED' : 'DENIED';

      // Update suggestion
      await base44.entities.TaxonomyChangeSuggestion.update(reviewingSuggestion.id, {
        status: newStatus,
        reviewed_by_user_id: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      });

      // If approved, apply the change
      if (newStatus === 'APPROVED') {
        const entityName = reviewingSuggestion.object_type;
        const payload = reviewingSuggestion.proposed_payload;

        if (reviewingSuggestion.change_type === 'CREATE') {
          const created = await base44.entities[entityName].create(payload);
          
          // Audit log
          await base44.entities.TaxonomyAuditLog.create({
            actor_user_id: user.id,
            actor_email: user.email,
            action: `APPROVED CREATE ${entityName}`,
            object_type: entityName,
            object_id: created.id,
            before_payload: {},
            after_payload: payload
          });
        } else if (reviewingSuggestion.change_type === 'UPDATE') {
          await base44.entities[entityName].update(reviewingSuggestion.target_id, payload);
          
          await base44.entities.TaxonomyAuditLog.create({
            actor_user_id: user.id,
            actor_email: user.email,
            action: `APPROVED UPDATE ${entityName}`,
            object_type: entityName,
            object_id: reviewingSuggestion.target_id,
            after_payload: payload
          });
        } else if (reviewingSuggestion.change_type === 'DELETE') {
          await base44.entities[entityName].delete(reviewingSuggestion.target_id);
          
          await base44.entities.TaxonomyAuditLog.create({
            actor_user_id: user.id,
            actor_email: user.email,
            action: `APPROVED DELETE ${entityName}`,
            object_type: entityName,
            object_id: reviewingSuggestion.target_id
          });
        }
      }

      // Refresh list
      setSuggestions(suggestions.filter(s => s.id !== reviewingSuggestion.id));
      setReviewingSuggestion(null);
      setReviewAction(null);
      setReviewNotes('');
      
      toast.success(newStatus === 'APPROVED' ? 'Change approved and applied!' : 'Change denied');
    } catch (error) {
      console.error('Error reviewing suggestion:', error);
      toast.error('Failed to process review');
    }
  };

  const getChangeTypeColor = (type) => {
    switch (type) {
      case 'CREATE': return 'bg-green-100 text-green-700';
      case 'UPDATE': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'DENIED': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Taxonomy Review Queue</h1>
        <p className="text-gray-600 mt-1">Review and approve user-submitted changes</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="DENIED">Denied</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="PlantType">Plant Type</SelectItem>
            <SelectItem value="Variety">Variety</SelectItem>
            <SelectItem value="FacetGroup">Facet Group</SelectItem>
            <SelectItem value="Facet">Facet</SelectItem>
            <SelectItem value="TraitDefinition">Trait Definition</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Suggestions List */}
      {suggestions.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No suggestions</h3>
            <p className="text-gray-600">All caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card>
                <Collapsible>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getChangeTypeColor(suggestion.change_type)}>
                            {suggestion.change_type}
                          </Badge>
                          <Badge variant="outline">{suggestion.object_type}</Badge>
                          <Badge className={getStatusColor(suggestion.status)}>
                            {suggestion.status}
                          </Badge>
                        </div>
                        
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {suggestion.proposed_payload?.common_name || 
                           suggestion.proposed_payload?.variety_name || 
                           suggestion.proposed_payload?.name ||
                           suggestion.proposed_payload?.label ||
                           'Change Request'}
                        </h3>
                        
                        <p className="text-sm text-gray-600 mb-2">{suggestion.rationale}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {suggestion.created_by}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(suggestion.created_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>

                      {suggestion.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReview(suggestion, 'approve')}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReview(suggestion, 'deny')}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Deny
                          </Button>
                        </div>
                      )}
                    </div>

                    <CollapsibleTrigger className="w-full mt-3 pt-3 border-t">
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                        <span>View proposed changes</span>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(suggestion.proposed_payload, null, 2)}
                        </pre>
                      </div>
                      {suggestion.review_notes && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-900 mb-1">Review Notes:</p>
                          <p className="text-sm text-gray-700">{suggestion.review_notes}</p>
                        </div>
                      )}
                    </CollapsibleContent>
                  </CardContent>
                </Collapsible>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewingSuggestion} onOpenChange={() => setReviewingSuggestion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Deny'} Change Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900 mb-2">
                {reviewingSuggestion?.change_type} {reviewingSuggestion?.object_type}
              </p>
              <p className="text-sm text-gray-600">{reviewingSuggestion?.rationale}</p>
            </div>
            
            <div>
              <Label htmlFor="notes">Review Notes {reviewAction === 'deny' && '(required)'}</Label>
              <Textarea
                id="notes"
                placeholder="Explain your decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingSuggestion(null)}>Cancel</Button>
            <Button
              onClick={submitReview}
              disabled={reviewAction === 'deny' && !reviewNotes.trim()}
              className={reviewAction === 'approve' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'}
            >
              {reviewAction === 'approve' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve & Apply
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Deny
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}