import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, Sparkles, Calendar, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function FrostDateLookup({ zip, city, state, currentZone, currentLastFrost, currentFirstFrost, onApply, autoSave = false }) {
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleLookup = async () => {
    if (!zip && !city) {
      toast.error('Please provide a ZIP code or city');
      return;
    }
    
    setOpen(true);
    setAnalyzing(true);
    setError(null);
    setResult(null);
    
    console.debug('[AI_FROST] Request sent', { zip, city, state });
    
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a gardening expert providing USDA zone and frost date information.

Location: ${zip ? `ZIP ${zip}` : `${city}, ${state}`}

Provide the following information for this location in the United States:
1. USDA Hardiness Zone (e.g., 7b, 8a)
2. Average Last Spring Frost Date (32°F / 0°C) - format as MM-DD
3. Average First Fall Frost Date (32°F / 0°C) - format as MM-DD
4. Confidence level (high/medium/low)
5. Brief explanation of how you determined these values (mention source if possible, e.g., USDA maps, historical data)

Return ONLY the structured data, no preamble.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            usda_zone: { type: "string" },
            last_frost_date_mmdd: { type: "string" },
            first_frost_date_mmdd: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            source_explanation: { type: "string" }
          }
        }
      });
      
      console.debug('[AI_FROST] Response received', response);
      
      if (response && response.usda_zone) {
        // Convert MM-DD to current year ISO dates for storage
        const currentYear = new Date().getFullYear();
        const lastFrostISO = response.last_frost_date_mmdd ? `${currentYear}-${response.last_frost_date_mmdd}` : null;
        const firstFrostISO = response.first_frost_date_mmdd ? `${currentYear}-${response.first_frost_date_mmdd}` : null;
        
        setResult({
          zone: response.usda_zone,
          lastFrost: lastFrostISO,
          firstFrost: firstFrostISO,
          confidence: response.confidence || 'medium',
          source: response.source_explanation || 'AI analysis based on USDA data and historical weather patterns'
        });
      } else {
        setError('Could not determine frost dates for this location');
      }
    } catch (err) {
      console.error('[AI_FROST] Error:', err);
      setError(err.message || 'Failed to lookup frost dates');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async () => {
    if (!result) return;
    
    console.debug('[FROST_AI] apply_clicked', { 
      zone: result.zone, 
      lastFrost: result.lastFrost, 
      firstFrost: result.firstFrost 
    });
    
    if (autoSave) {
      // Save directly to user profile (used in Onboarding/standalone contexts)
      setSaving(true);
      try {
        console.debug('[FROST_AI] saving_to_fields', { 
          usda_zone: result.zone,
          last_frost_date: result.lastFrost,
          first_frost_date: result.firstFrost,
          last_frost_override: result.lastFrost,
          first_frost_override: result.firstFrost
        });
        
        await base44.auth.updateMe({
          usda_zone: result.zone,
          usda_zone_override: result.zone,
          last_frost_date: result.lastFrost,
          last_frost_override: result.lastFrost,
          first_frost_date: result.firstFrost,
          first_frost_override: result.firstFrost
        });
        
        console.debug('[FROST_AI] save_success');
        
        // Force user state refresh
        const refreshedUser = await base44.auth.me();
        console.debug('[FROST_AI] user_state_refreshed', refreshedUser);
        
        toast.success('Profile updated with AI frost dates!');
        setOpen(false);
        setResult(null);
        
        // Trigger callback if provided (for parent component refresh)
        if (onApply) {
          onApply({
            usda_zone: result.zone,
            last_frost_date: result.lastFrost,
            first_frost_date: result.firstFrost
          });
        }
      } catch (err) {
        console.error('[FROST_AI] save_error', err);
        toast.error('Failed to save: ' + err.message);
      } finally {
        setSaving(false);
      }
    } else {
      // Just update form state (used in Settings where user clicks Save button)
      console.debug('[FROST_AI] updating_form_state_only (parent will save)');
      onApply({
        usda_zone: result.zone,
        last_frost_date: result.lastFrost,
        last_frost_override: result.lastFrost,
        first_frost_date: result.firstFrost,
        first_frost_override: result.firstFrost
      });
      setOpen(false);
      setResult(null);
      toast.success('Frost dates applied! Click Save Changes to persist.');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setError(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleLookup}
        className="gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
      >
        <Sparkles className="w-4 h-4" />
        AI Auto-Detect
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AI Frost Date & Zone Lookup</DialogTitle>
            <DialogDescription>
              Using your location to determine USDA zone and frost dates
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              AI estimates are based on historical data. Always verify with local extension services for critical decisions.
            </AlertDescription>
          </Alert>

          {analyzing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
              <p className="text-gray-600">Analyzing location data...</p>
            </div>
          )}

          {error && !analyzing && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-sm text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {result && !analyzing && (
            <div className="space-y-4">
              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold text-purple-900">USDA Zone</span>
                    </div>
                    <Badge className="bg-purple-600 text-white text-lg px-4 py-1">
                      {result.zone}
                    </Badge>
                  </div>

                  <div className="pt-3 border-t border-purple-200 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-700 font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Last Spring Frost
                      </span>
                      <span className="font-semibold text-purple-900">
                        {result.lastFrost ? format(new Date(result.lastFrost), 'MMM d') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-700 font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        First Fall Frost
                      </span>
                      <span className="font-semibold text-purple-900">
                        {result.firstFrost ? format(new Date(result.firstFrost), 'MMM d') : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      {result.confidence === 'high' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      <span className="text-xs font-semibold text-purple-800">
                        Confidence: {result.confidence.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-purple-700 leading-relaxed">{result.source}</p>
                  </div>
                </CardContent>
              </Card>

              <Alert className="bg-amber-50 border-amber-200">
                <AlertDescription className="text-sm text-amber-800">
                  <strong>Review before applying:</strong> These are average dates. Your specific microclimate may vary. You can edit manually after applying.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {result ? 'Cancel' : 'Close'}
            </Button>
            {result && (
              <Button 
                onClick={handleApply} 
                disabled={saving}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  autoSave ? 'Save to Profile' : 'Apply to Form'
                )}
              </Button>
            )}
            {error && (
              <Button onClick={handleLookup} variant="outline">
                Retry
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}