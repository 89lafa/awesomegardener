import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, Plus, ThumbsUp, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ReviewsSection({ varietyId }) {
  const [reviews, setReviews] = useState([]);
  const [user, setUser] = useState(null);
  const [showAddReview, setShowAddReview] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [varietyId]);

  const loadData = async () => {
    try {
      const [userData, reviewsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.VarietyReview.filter({ 
          variety_id: varietyId,
          moderation_status: 'approved'
        }, '-created_date')
      ]);
      setUser(userData);
      setReviews(reviewsData);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    try {
      await base44.entities.VarietyReview.create({
        variety_id: varietyId,
        user_email: user.email,
        rating,
        review_text: reviewText
      });

      toast.success('Review submitted!');
      setShowAddReview(false);
      setRating(0);
      setReviewText('');
      await loadData();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    }
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Reviews ({reviews.length})</h3>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${star <= avgRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600">{avgRating} average</span>
            </div>
          )}
        </div>
        {user && (
          <Button onClick={() => setShowAddReview(true)} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Write Review
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {reviews.map(review => (
          <Card key={review.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-3 h-3 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  {review.growing_zone && (
                    <Badge variant="outline" className="text-xs">Zone {review.growing_zone}</Badge>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {format(new Date(review.created_date), 'MMM d, yyyy')}
                </span>
              </div>
              {review.review_text && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.review_text}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {reviews.length === 0 && !loading && (
        <p className="text-center text-gray-500 py-8">No reviews yet. Be the first!</p>
      )}

      <Dialog open={showAddReview} onOpenChange={setShowAddReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-8 h-8 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Your Experience (optional)</Label>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your growing experience with this variety..."
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddReview(false)}>Cancel</Button>
            <Button onClick={handleSubmitReview} disabled={rating === 0}>
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}