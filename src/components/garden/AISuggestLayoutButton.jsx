import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function AISuggestLayoutButton({ garden, plot, crops, onApply }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      // Gather context
      const plotItems = await base44.entities.PlotItem.filter({ garden_id: garden.id, plot_id: plot.id });
      const companionRules = await base44.entities.CompanionRule.list();
      
      const cropDetails = crops.map(c => ({
        label: c.label,
        plant_type_id: c.plant_type_id,
        quantity: c.quantity_planned || 1,
        spacing: c.spacing_recommended || 12
      }));

      const prompt = `You are a garden layout expert. Given these growing spaces and crops, suggest optimal placement.

GROWING SPACES:
${plotItems.map(item => `- ${item.label} (${item.width}" x ${item.height}", type: ${item.item_type})`).join('\n')}

CROPS TO PLANT:
${cropDetails.map(c => `- ${c.label} (qty: ${c.quantity}, spacing: ${c.spacing}")`).join('\n')}

COMPANION RULES:
${companionRules.slice(0, 20).map(r => `${r.plant_type_id} + ${r.companion_plant_type_id}: ${r.companion_type}`).join('\n')}

Provide placement suggestions considering:
1. Companion planting (good neighbors together, bad apart)
2. Sun requirements (tall plants don't shade short ones)
3. Spacing needs
4. Maximize space efficiency

Return JSON with this schema:
{
  "placements": [
    {
      "crop_label": "Tomato 1",
      "plot_item_label": "Raised Bed 1",
      "position": "north side",
      "reasoning": "Full sun, away from competing roots"
    }
  ],
  "warnings": [
    {
      "message": "Cucumbers and tomatoes both need heavy feeding",
      "severity": "low"
    }
  ]
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            placements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  crop_label: { type: 'string' },
                  plot_item_label: { type: 'string' },
                  position: { type: 'string' },
                  reasoning: { type: 'string' }
                }
              }
            },
            warnings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  severity: { type: 'string' }
                }
              }
            }
          }
        }
      });

      setSuggestions(response);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!suggestions) {
      generateSuggestions();
    }
  };

  const handleApply = () => {
    if (suggestions?.placements) {
      onApply?.(suggestions.placements);
      toast.success('Review the suggestions and manually place crops');
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="outline"
        className="gap-2 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:from-purple-100 hover:to-pink-100"
      >
        <Sparkles className="w-4 h-4 text-purple-600" />
        AI Suggest Layout
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Garden Layout Suggestions
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
              <p className="text-sm text-gray-600">Analyzing your crops and companion relationships...</p>
            </div>
          ) : suggestions ? (
            <div className="space-y-4">
              {/* Warnings */}
              {suggestions.warnings?.length > 0 && (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Considerations
                    </h4>
                    {suggestions.warnings.map((warning, idx) => (
                      <p key={idx} className="text-sm text-amber-800">{warning.message}</p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Placements */}
              <div className="space-y-2">
                <h4 className="font-semibold">Suggested Placements:</h4>
                {suggestions.placements?.map((placement, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-emerald-600">{placement.crop_label}</Badge>
                            <span className="text-sm">→</span>
                            <Badge variant="outline">{placement.plot_item_label}</Badge>
                          </div>
                          <p className="text-sm text-gray-700 mb-1">📍 {placement.position}</p>
                          <p className="text-xs text-gray-600">{placement.reasoning}</p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                ℹ️ These are suggestions only. Review and manually drag crops to the recommended locations in Plot Layout.
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Click generate to get AI placement suggestions
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            {suggestions && !loading && (
              <Button
                onClick={handleApply}
                className="bg-purple-600 hover:bg-purple-700 gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Got It - Review Suggestions
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}