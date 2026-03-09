import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronRight, ChevronLeft, Sprout, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

const STEPS = ['Select Crops', 'AI Analysis', 'Review & Confirm'];

export default function SuccessionPlannerWizard({ open, onOpenChange, seasonId, cropPlans = [], onSuccess }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);   // [{crop, label, rounds:[{label,offset_days}], reason}]
  const [creating, setCreating] = useState(false);
  const [confirmed, setConfirmed] = useState(new Set()); // suggestion indexes user wants to create

  // Reset on open
  useEffect(() => {
    if (open) { setStep(0); setSelected(new Set()); setSuggestions([]); setConfirmed(new Set()); }
  }, [open]);

  // ── Eligible crops: those with some harvest window or maturity data ──
  const eligible = cropPlans.filter(c => c.dtm_days || c.harvest_window_days || c.direct_seed_offset_days != null);

  const toggleCrop = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const toggleConfirm = (idx) => {
    const s = new Set(confirmed);
    s.has(idx) ? s.delete(idx) : s.add(idx);
    setConfirmed(s);
  };

  // ── Step 1→2: call AI ──
  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const crops = eligible.filter(c => selected.has(c.id));
      const cropSummaries = crops.map(c => ({
        id: c.id,
        label: c.label || c.plant_type_name || 'Crop',
        planting_method: c.planting_method || 'unknown',
        seed_offset_days: c.seed_offset_days,
        transplant_offset_days: c.transplant_offset_days,
        direct_seed_offset_days: c.direct_seed_offset_days,
        dtm_days: c.dtm_days,
        harvest_window_days: c.harvest_window_days || 21,
      }));

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a succession planting expert. Given these crop plans, suggest how many succession rounds and at what intervals to ensure a continuous harvest all season.

Crops: ${JSON.stringify(cropSummaries, null, 2)}

For each crop:
- Consider its days-to-maturity (dtm_days) and harvest window (harvest_window_days)
- Suggest 2-4 succession rounds spaced to create continuous harvests
- The offset_days values are relative to the season's last frost date
- Fast crops (radish, lettuce, spinach, beans) → every 2-3 weeks
- Medium crops (zucchini, cucumber, kale) → every 3-4 weeks
- Slow crops (tomatoes, peppers) → every 4-6 weeks if garden space allows

Return a JSON array (no markdown, just raw JSON) with this exact schema:
[{
  "crop_id": "...",
  "crop_label": "...",
  "reason": "short 1-sentence reason why succession helps",
  "rounds": [
    { "label": "Succession 1", "seed_offset_days": number, "transplant_offset_days": number_or_null, "direct_seed_offset_days": number_or_null }
  ]
}]

Only include crops where succession makes clear sense. Skip tomatoes/peppers if garden space is typically limited.`,
        response_json_schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  crop_id: { type: 'string' },
                  crop_label: { type: 'string' },
                  reason: { type: 'string' },
                  rounds: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string' },
                        seed_offset_days: { type: 'number' },
                        transplant_offset_days: { type: ['number', 'null'] },
                        direct_seed_offset_days: { type: ['number', 'null'] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const raw = result?.suggestions || [];
      // Attach original crop objects
      const enriched = raw.map(s => ({
        ...s,
        crop: crops.find(c => c.id === s.crop_id),
      })).filter(s => s.crop && s.rounds?.length > 0);

      setSuggestions(enriched);
      // Default: confirm all
      setConfirmed(new Set(enriched.map((_, i) => i)));
      setStep(2);
    } catch (err) {
      console.error('Succession analysis failed:', err);
      toast.error('AI analysis failed: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Step 3: create CropPlan entries ──
  const createSuccessions = async () => {
    setCreating(true);
    let created = 0;
    try {
      const toCreate = suggestions.filter((_, i) => confirmed.has(i));
      for (const sugg of toCreate) {
        const orig = sugg.crop;
        for (const round of sugg.rounds) {
          await base44.entities.CropPlan.create({
            garden_season_id:       orig.garden_season_id,
            plant_type_id:          orig.plant_type_id,
            plant_profile_id:       orig.plant_profile_id,
            variety_id:             orig.variety_id,
            label:                  `${orig.label || 'Crop'} – ${round.label}`,
            quantity_planned:       orig.quantity_planned || 1,
            quantity_scheduled:     0,
            quantity_planted:       0,
            status:                 'planned',
            color_hex:              orig.color_hex,
            planting_method:        orig.planting_method,
            date_mode:              orig.date_mode || 'relative',
            relative_anchor:        orig.relative_anchor || 'last_frost',
            seed_offset_days:       round.seed_offset_days ?? orig.seed_offset_days,
            transplant_offset_days: round.transplant_offset_days ?? orig.transplant_offset_days,
            direct_seed_offset_days:round.direct_seed_offset_days ?? orig.direct_seed_offset_days,
            dtm_days:               orig.dtm_days,
            harvest_window_days:    orig.harvest_window_days,
            succession_parent_id:   orig.id,
          });
          created++;
        }
      }
      toast.success(`Created ${created} succession crop plan${created !== 1 ? 's' : ''}!`);
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create successions:', err);
      toast.error('Failed to create: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Helpers ──
  const formatOffset = (days) => {
    if (days == null) return '—';
    if (days >= 0) return `+${days}d after last frost`;
    return `${days}d before last frost`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-emerald-600" />
            AI Succession Planner
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-2 flex-shrink-0 px-1">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                i === step ? 'bg-emerald-600 text-white' :
                i < step  ? 'bg-emerald-100 text-emerald-700' :
                'bg-gray-100 text-gray-400'
              }`}>{i + 1}. {s}</span>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* ═══ STEP 0: Select Crops ═══ */}
        {step === 0 && (
          <div className="flex-1 overflow-y-auto space-y-3">
            <p className="text-sm text-gray-500">
              Select the crops you want to succession-plant for a continuous harvest. Best for fast-growing crops like lettuce, beans, radishes, and greens.
            </p>
            {eligible.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No crops with timing data found. Add crops to your calendar first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {eligible.map(crop => {
                  const sel = selected.has(crop.id);
                  return (
                    <div
                      key={crop.id}
                      onClick={() => toggleCrop(crop.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        sel ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                        sel ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
                      }`}>
                        {sel && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: crop.color_hex || '#10b981' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{crop.label || 'Unnamed Crop'}</p>
                        <p className="text-xs text-gray-500">
                          {crop.dtm_days ? `${crop.dtm_days} days to maturity` : ''}
                          {crop.harvest_window_days ? ` · ${crop.harvest_window_days}d harvest window` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {crop.planting_method || 'unknown'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 1: Analyzing ═══ */}
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
            <p className="font-semibold text-gray-700">Analyzing your crops with AI…</p>
            <p className="text-sm text-gray-400">Calculating optimal succession intervals for continuous harvest</p>
          </div>
        )}

        {/* ═══ STEP 2: Review ═══ */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                <p className="text-sm text-gray-600 font-medium">No succession suggestions generated.</p>
                <p className="text-xs text-gray-400 mt-1">The selected crops may not benefit from succession planting, or try selecting different crops.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">Review AI suggestions below. Toggle entries on/off before creating.</p>
                {suggestions.map((sugg, si) => {
                  const active = confirmed.has(si);
                  return (
                    <div key={si} className={`border rounded-xl overflow-hidden transition-opacity ${active ? '' : 'opacity-50'}`}>
                      <div
                        className={`flex items-center gap-3 p-3 cursor-pointer ${active ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-gray-50'}`}
                        onClick={() => toggleConfirm(si)}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                          active ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
                        }`}>
                          {active && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sugg.crop?.color_hex || '#10b981' }} />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">{sugg.crop_label}</p>
                          <p className="text-xs text-gray-500 italic">{sugg.reason}</p>
                        </div>
                        <Badge className="text-xs bg-emerald-100 text-emerald-700">{sugg.rounds.length} rounds</Badge>
                      </div>
                      <div className="divide-y">
                        {sugg.rounds.map((r, ri) => (
                          <div key={ri} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                            <span className="text-xs font-semibold text-gray-500 w-24 flex-shrink-0">{r.label}</span>
                            <div className="flex-1 flex flex-wrap gap-2 text-xs text-gray-500">
                              {r.seed_offset_days != null && (
                                <span>🌱 Start seeds: <strong>{formatOffset(r.seed_offset_days)}</strong></span>
                              )}
                              {r.transplant_offset_days != null && (
                                <span>🪴 Transplant: <strong>{formatOffset(r.transplant_offset_days)}</strong></span>
                              )}
                              {r.direct_seed_offset_days != null && (
                                <span>🌾 Direct sow: <strong>{formatOffset(r.direct_seed_offset_days)}</strong></span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ─── Footer buttons ─── */}
        <div className="flex-shrink-0 flex justify-between items-center pt-3 border-t">
          <Button variant="outline" onClick={() => {
            if (step > 0 && step !== 1) setStep(step === 2 ? 0 : step - 1);
            else onOpenChange(false);
          }} disabled={step === 1 || creating}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>

          {step === 0 && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              disabled={selected.size === 0}
              onClick={() => { setStep(1); runAnalysis(); }}
            >
              Analyze with AI
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}

          {step === 2 && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              disabled={confirmed.size === 0 || creating || suggestions.length === 0}
              onClick={createSuccessions}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sprout className="w-4 h-4" />}
              Create {confirmed.size > 0 ? `${[...confirmed].reduce((n, i) => n + suggestions[i].rounds.length, 0)} Entries` : ''}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}