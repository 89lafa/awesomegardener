import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Lightbulb, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function CompanionSuggestions({ plantTypeId, onClose }) {
  const [suggestions, setSuggestions] = useState({ good: [], bad: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, [plantTypeId]);

  const loadSuggestions = async () => {
    if (!plantTypeId) return;
    
    try {
      // Load companion rules for this plant
      const rules = await base44.entities.CompanionRule.filter({ 
        plant_type_id: plantTypeId 
      });

      const goodCompanions = [];
      const badCompanions = [];

      // Get plant type names for companions
      const companionIds = rules.map(r => r.companion_plant_type_id).filter(Boolean);
      const plantTypes = await base44.entities.PlantType.filter({});
      
      for (const rule of rules) {
        const companion = plantTypes.find(pt => pt.id === rule.companion_plant_type_id);
        if (!companion) continue;

        const suggestion = {
          name: companion.common_name,
          icon: companion.icon || '🌱',
          notes: rule.notes,
          evidence: rule.evidence_level || 'C'
        };

        if (rule.companion_type === 'GOOD' || rule.companion_type === 'GOOD_CONDITIONAL') {
          goodCompanions.push(suggestion);
        } else if (rule.companion_type === 'BAD') {
          badCompanions.push(suggestion);
        }
      }

      setSuggestions({ good: goodCompanions, bad: badCompanions });
    } catch (error) {
      console.error('Error loading companion suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (suggestions.good.length === 0 && suggestions.bad.length === 0) return null;

  return (
    <Card className="absolute top-0 left-full ml-4 w-80 p-4 shadow-xl border-2 border-emerald-200 z-50 bg-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h4 className="font-semibold text-sm">Companion Planting Tips</h4>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {suggestions.good.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-green-700 mb-2">✓ Good Companions</p>
          <div className="space-y-2">
            {suggestions.good.map((item, idx) => (
              <div key={idx} className="p-2 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900">{item.name}</p>
                    {item.notes && (
                      <p className="text-xs text-green-700 mt-0.5">{item.notes}</p>
                    )}
                    <p className="text-[10px] text-green-600 mt-1">
                      Evidence: {item.evidence === 'A' ? 'Scientific' : item.evidence === 'B' ? 'Experienced' : 'Anecdotal'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.bad.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-700 mb-2">✗ Avoid Planting With</p>
          <div className="space-y-2">
            {suggestions.bad.map((item, idx) => (
              <div key={idx} className="p-2 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-900">{item.name}</p>
                    {item.notes && (
                      <p className="text-xs text-red-700 mt-0.5">{item.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3 pt-3 border-t">
        Plant these together for natural pest control and better growth
      </p>
    </Card>
  );
}