import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CommunityInsights({ varietyId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, [varietyId]);

  const loadInsights = async () => {
    try {
      // Load anonymized aggregated data
      const [reviews, issues] = await Promise.all([
        base44.entities.VarietyReview.filter({ variety_id: varietyId }),
        base44.entities.IssueLog.filter({ variety_id: varietyId })
      ]);

      // Aggregate common issues
      const issueCounts = {};
      issues.forEach(issue => {
        const type = issue.issue_type || 'Other';
        issueCounts[type] = (issueCounts[type] || 0) + 1;
      });

      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

      setInsights({
        totalReviews: reviews.length,
        avgRating,
        commonIssues: Object.entries(issueCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        totalGrowers: new Set(reviews.map(r => r.user_email)).size
      });
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !insights || insights.totalReviews === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" />
          Community Insights
        </CardTitle>
        <p className="text-sm text-gray-600">
          Aggregated data from {insights.totalGrowers} grower{insights.totalGrowers !== 1 ? 's' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.avgRating && (
          <div>
            <Label className="text-sm font-medium">Average Rating</Label>
            <div className="flex items-center gap-2 mt-1">
              <div className="text-2xl font-bold text-yellow-600">{insights.avgRating.toFixed(1)}</div>
              <span className="text-sm text-gray-500">out of 5.0</span>
            </div>
          </div>
        )}

        {insights.commonIssues.length > 0 && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Most Common Issues Reported</Label>
            <div className="space-y-2">
              {insights.commonIssues.map(([issue, count]) => (
                <div key={issue} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{issue}</span>
                  <Badge variant="outline">{count} report{count !== 1 ? 's' : ''}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 italic">
          All data is anonymized and aggregated. Opt-in to contribute in Settings.
        </p>
      </CardContent>
    </Card>
  );
}