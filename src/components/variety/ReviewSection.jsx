import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, Send, ThumbsUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ReviewSection({ varietyId, plantProfileId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReviews();
    loadUser();
  }, [varietyId]);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadReviews = async () => {
    try {
      const data = await base44.entities.VarietyReview.filter({
        variety_id: varietyId,
        is_public: true,
        status: 'approved'
      }, '-created_date');
      setReviews(data);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!comment.trim() || !user) return;

    setSubmitting(true);
    try {
      await base44.entities.VarietyReview.create({
        variety_id: varietyId,
        plant_profile_id: plantProfileId,
        user_nickname: user.nickname || user.full_name,
        rating,
        comment: comment.trim(),
        grow_year: new Date().getFullYear()
      });

      toast.success('Review submitted!');
      setComment('');
      setRating(5);
      setShowForm(false);
      await loadReviews();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-900">{averageRating}</div>
          <div className="flex gap-0.5 justify-center mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <div className="text-sm text-gray-500 mt-1">{reviews.length} reviews</div>
        </div>

        {user && !showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Write a Review
          </Button>
        )}
      </div>

      {/* Review Form */}
      {showForm && user && (
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="text-lg">Share Your Experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rating</label>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setRating(i + 1)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Your Review</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your growing experience with this variety..."
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={!comment.trim() || submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Review
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowForm(false);
                  setComment('');
                  setRating(5);
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No reviews yet. Be the first to share your experience!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700">
                      {review.user_nickname?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{review.user_nickname}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          {review.grow_year && (
                            <Badge variant="outline" className="text-xs">
                              {review.grow_year}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {format(new Date(review.created_date), 'MMM d, yyyy')}
                      </p>
                    </div>

                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.comment}</p>

                    {review.location_zone && (
                      <p className="text-xs text-gray-500 mt-2">Zone {review.location_zone}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}