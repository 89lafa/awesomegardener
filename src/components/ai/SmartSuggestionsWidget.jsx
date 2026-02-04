import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, X, Calendar, Plus, Eye, Leaf, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function SmartSuggestionsWidget() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const active = await base44.entities.AISuggestion.filter({
        status: 'active'
      });

      const validSuggestions = active.filter(s => {
        if (!s.expires_date) return true;
        return new Date(s.expires_date) > new Date();
      });

      setSuggestions(validSuggestions.slice(0, 5));
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNew = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('generateDailySuggestions', {});
      toast.success('New suggestions generated!');
      await loadSuggestions();
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Failed to generate suggestions');
    } finally {
      setGenerating(false);
    }
  };

  const handleDismiss = async (suggestionId) => {
    try {
      await base44.entities.AISuggestion.update(suggestionId, {
        status: 'dismissed',
        dismissed_date: new Date().toISOString()
      });
      await loadSuggestions();
      toast.success('Suggestion dismissed');
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
      toast.error('Failed to dismiss');
    }
  };

  const handleAction = async (suggestion) => {
    try {
      // Execute suggested action
      switch (suggestion.suggested_action) {
        case 'view_variety':
          if (suggestion.related_variety_id) {
            window.location.href = createPageUrl('ViewVariety') + '?id=' + suggestion.related_variety_id;
          }
          break;
        case 'create_task':
          window.location.href = createPageUrl('CalendarTasks') + '?action=new';
          break;
        case 'add_to_grow_list':
          window.location.href = createPageUrl('GrowLists');
          break;
        case 'view_pest_library':
          window.location.href = createPageUrl('PestLibrary');
          break;
        default:
          toast.info('Action not yet implemented');
      }

      // Mark as acted
      await base44.entities.AISuggestion.update(suggestion.id, {
        status: 'acted',
        acted_date: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error handling action:', error);
      toast.error('Failed to perform action');
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || colors.medium;
  };

  const getActionIcon = (action) => {
    const icons = {
      add_to_grow_list: Plus,
      create_task: Calendar,
      view_variety: Eye,
      view_pest_library: Leaf
    };
    return icons[action] || Sparkles;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            Smart Suggestions
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateNew}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No suggestions right now.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateNew}
              disabled={generating}
              className="mt-3"
            >
              Generate Suggestions
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => {
              const ActionIcon = getActionIcon(suggestion.suggested_action);
              return (
                <div
                  key={suggestion.id}
                  className="border rounded-lg p-3 bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 relative"
                >
                  <button
                    onClick={() => handleDismiss(suggestion.id)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  <div className="mb-2">
                    <Badge className={getPriorityColor(suggestion.priority)}>
                      {suggestion.priority}
                    </Badge>
                  </div>

                  <h4 className="font-semibold text-gray-900 text-sm mb-1 pr-6">
                    {suggestion.title}
                  </h4>
                  <p className="text-xs text-gray-700 mb-3">
                    {suggestion.description}
                  </p>

                  <Button
                    size="sm"
                    onClick={() => handleAction(suggestion)}
                    className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                  >
                    <ActionIcon className="w-3 h-3" />
                    Take Action
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}