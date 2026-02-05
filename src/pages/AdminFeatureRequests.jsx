import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Lightbulb, 
  Loader2,
  MessageSquare,
  CheckCircle2,
  Clock,
  Hammer,
  XCircle,
  User,
  Calendar,
  Edit2,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'garden_builder', label: 'Garden Builder' },
  { value: 'plant_catalog', label: 'Plant Catalog' },
  { value: 'seed_stash', label: 'Seed Stash' },
  { value: 'calendar', label: 'Calendar & Tasks' },
  { value: 'sharing', label: 'Sharing' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', icon: MessageSquare, color: 'bg-gray-100 text-gray-700' },
  planned: { label: 'Planned', icon: Clock, color: 'bg-blue-100 text-blue-700' },
  building: { label: 'Building', icon: Hammer, color: 'bg-yellow-100 text-yellow-700' },
  shipped: { label: 'Shipped', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', icon: XCircle, color: 'bg-red-100 text-red-700' },
};

export default function AdminFeatureRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [editingNotes, setEditingNotes] = useState({});
  const [savingNotes, setSavingNotes] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const requestsData = await base44.entities.FeatureRequest.list('-created_date');
      setRequests(requestsData);
    } catch (error) {
      console.error('Error loading feature requests:', error);
      toast.error('Failed to load feature requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      await base44.entities.FeatureRequest.update(requestId, { status: newStatus });
      setRequests(requests.map(r => 
        r.id === requestId ? { ...r, status: newStatus } : r
      ));
      toast.success('Status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleSaveNotes = async (requestId) => {
    setSavingNotes({ ...savingNotes, [requestId]: true });
    try {
      const notes = editingNotes[requestId] || '';
      await base44.entities.FeatureRequest.update(requestId, { admin_notes: notes });
      setRequests(requests.map(r => 
        r.id === requestId ? { ...r, admin_notes: notes } : r
      ));
      toast.success('Notes saved');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes({ ...savingNotes, [requestId]: false });
    }
  };

  const filteredRequests = requests
    .filter(r => filterStatus === 'all' || r.status === filterStatus)
    .filter(r => filterCategory === 'all' || r.category === filterCategory);

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
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Manage Feature Requests</h1>
        <p className="text-gray-600 mt-1">Review and manage all submitted feature requests</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Lightbulb className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No feature requests</h3>
            <p className="text-gray-600">No requests match your current filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.submitted;
            const category = CATEGORIES.find(c => c.value === request.category);
            const isEditingNotes = editingNotes[request.id] !== undefined;
            const currentNotes = isEditingNotes ? editingNotes[request.id] : (request.admin_notes || '');

            return (
              <Card key={request.id}>
                <CardContent className="p-6 space-y-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg text-gray-900">{request.title}</h3>
                        <Badge className={statusConfig.color}>
                          <statusConfig.icon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                        {category && (
                          <Badge variant="outline">{category.label}</Badge>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{request.submitted_by || 'Unknown'}</span>
                        </div>
                        <span className="hidden sm:inline">•</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(request.created_date), 'MMM d, yyyy')}</span>
                        </div>
                        <span className="hidden sm:inline">•</span>
                        <span>{request.vote_count || 0} votes</span>
                      </div>
                    </div>
                    
                    {/* Status Dropdown */}
                    <Select 
                      value={request.status} 
                      onValueChange={(v) => handleStatusChange(request.id, v)}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <config.icon className="w-4 h-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Description:</h4>
                    <p className="text-gray-900 whitespace-pre-wrap">{request.description}</p>
                  </div>

                  {/* Admin Notes */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-blue-900">Admin Notes (Internal)</h4>
                      {isEditingNotes ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            handleSaveNotes(request.id);
                            setEditingNotes({ ...editingNotes, [request.id]: undefined });
                          }}
                          disabled={savingNotes[request.id]}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {savingNotes[request.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingNotes({ 
                            ...editingNotes, 
                            [request.id]: request.admin_notes || '' 
                          })}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                    {isEditingNotes ? (
                      <Textarea
                        value={currentNotes}
                        onChange={(e) => setEditingNotes({ 
                          ...editingNotes, 
                          [request.id]: e.target.value 
                        })}
                        placeholder="Add internal notes about this request..."
                        className="min-h-[100px] bg-white"
                      />
                    ) : (
                      <p className="text-blue-900 whitespace-pre-wrap">
                        {request.admin_notes || 'No notes yet'}
                      </p>
                    )}
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