import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Lightbulb, 
  Plus, 
  ThumbsUp,
  MessageSquare,
  CheckCircle2,
  Clock,
  Hammer,
  XCircle,
  Loader2,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
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

export default function FeatureRequests() {
  const [requests, setRequests] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('votes');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [requestsData, userData] = await Promise.all([
        base44.entities.FeatureRequest.list('-vote_count'),
        base44.auth.me()
      ]);
      setRequests(requestsData);
      setUser(userData);
    } catch (error) {
      console.error('Error loading feature requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const request = await base44.entities.FeatureRequest.create({
        ...formData,
        status: 'submitted',
        vote_count: 1,
        voters: [user.email]
      });
      setRequests([request, ...requests]);
      setShowAddDialog(false);
      setFormData({ title: '', description: '', category: 'other' });
      toast.success('Feature request submitted!');
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    }
  };

  const handleVote = async (request) => {
    if (!user) {
      toast.error('Please sign in to vote');
      return;
    }

    const hasVoted = request.voters?.includes(user.email);
    const newVoters = hasVoted
      ? request.voters.filter(v => v !== user.email)
      : [...(request.voters || []), user.email];
    const newVoteCount = newVoters.length;

    try {
      await base44.entities.FeatureRequest.update(request.id, {
        voters: newVoters,
        vote_count: newVoteCount
      });
      setRequests(requests.map(r => 
        r.id === request.id 
          ? { ...r, voters: newVoters, vote_count: newVoteCount }
          : r
      ));
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const filteredRequests = requests
    .filter(r => filterStatus === 'all' || r.status === filterStatus)
    .filter(r => filterCategory === 'all' || r.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'votes') return (b.vote_count || 0) - (a.vote_count || 0);
      return new Date(b.created_date) - new Date(a.created_date);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Feature Requests</h1>
          <p className="text-gray-600 mt-1">Help us build what you need</p>
        </div>
        <Button 
          onClick={() => setShowAddDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Submit Request
        </Button>
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
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="votes">Most Votes</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Lightbulb className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No requests yet</h3>
            <p className="text-gray-600 mb-6">Be the first to suggest a feature</p>
            <Button 
              onClick={() => setShowAddDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Submit Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredRequests.map((request, index) => {
              const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.submitted;
              const hasVoted = request.voters?.includes(user?.email);
              const category = CATEGORIES.find(c => c.value === request.category);

              return (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex gap-4">
                        {/* Vote Button */}
                        <button
                          onClick={() => handleVote(request)}
                          className={cn(
                            "flex flex-col items-center justify-center min-w-[60px] p-3 rounded-xl transition-colors",
                            hasVoted 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                        >
                          <ChevronUp className={cn("w-5 h-5", hasVoted && "fill-current")} />
                          <span className="font-bold text-lg">{request.vote_count || 0}</span>
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{request.title}</h3>
                            <Badge className={statusConfig.color}>
                              <statusConfig.icon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                            {category && (
                              <Badge variant="outline">{category.label}</Badge>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm line-clamp-2">{request.description}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            Submitted {format(new Date(request.created_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Submit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Feature Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of your idea"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Explain your idea in detail. What problem does it solve? How should it work?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-2 min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.title.trim() || !formData.description.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}