import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, ThumbsUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TipOfDayWidget() {
  const [tip, setTip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTip();
  }, []);

  const loadTip = async () => {
    try {
      const user = await base44.auth.me();
      const currentMonth = new Date().getMonth() + 1;

      // Get all active tips
      const tips = await base44.entities.GrowingTip.filter({ is_active: true });

      // Filter relevant tips
      const relevantTips = tips?.filter(tip => {
        const zoneMatch = !tip.applies_to_zones || 
                         tip.applies_to_zones.length === 0 ||
                         tip.applies_to_zones.includes('all') ||
                         (user?.growing_zone && tip.applies_to_zones.includes(user.growing_zone));
        
        const monthMatch = !tip.applies_to_months || 
                          tip.applies_to_months.length === 0 ||
                          tip.applies_to_months.includes(0) ||
                          tip.applies_to_months.includes(currentMonth);
        
        return zoneMatch && monthMatch;
      }) || [];

      // Random tip
      if (relevantTips.length > 0) {
        const randomTip = relevantTips[Math.floor(Math.random() * relevantTips.length)];
        setTip(randomTip);
      }
    } catch (error) {
      // Silently fail - don't break dashboard
      console.error('Error loading tip:', error);
    } finally {
      setLoading(false);
    }
  };

  const markHelpful = async () => {
    if (!tip) return;
    
    try {
      await base44.entities.GrowingTip.update(tip.id, {
        helpful_count: (tip.helpful_count || 0) + 1
      });
      setTip({ ...tip, helpful_count: (tip.helpful_count || 0) + 1 });
      toast.success('Thanks for the feedback!');
    } catch (error) {
      console.error('Error marking helpful:', error);
      toast.error('Failed to update');
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-emerald-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Tip of the Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tip) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-emerald-50 to-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          Tip of the Day
        </CardTitle>
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold mb-2">{tip.title}</h3>
        <p className="text-sm text-gray-700 mb-4">{tip.content}</p>
        
        {tip.image_url && (
          <img src={tip.image_url} alt={tip.title} className="w-full rounded-lg mb-4" />
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={markHelpful}
          className="gap-2"
        >
          <ThumbsUp className="w-4 h-4" />
          Helpful ({tip.helpful_count || 0})
        </Button>
      </CardContent>
    </Card>
  );
}