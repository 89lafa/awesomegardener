import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RuleFields({ rule, onUpdate }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Grid Cols (width in ft)</Label>
          <Input
            type="number" min="1"
            value={rule.grid_cols}
            onChange={(e) => onUpdate(rule.id, { grid_cols: parseInt(e.target.value) || 1 })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Grid Rows (height in ft)</Label>
          <Input
            type="number" min="1"
            value={rule.grid_rows}
            onChange={(e) => onUpdate(rule.id, { grid_rows: parseInt(e.target.value) || 1 })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Plants Per Slot</Label>
          <Input
            type="number" min="1"
            value={rule.plants_per_grid_slot}
            onChange={(e) => onUpdate(rule.id, { plants_per_grid_slot: parseInt(e.target.value) || 1 })}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Input
          value={rule.notes || ''}
          onChange={(e) => onUpdate(rule.id, { notes: e.target.value })}
          placeholder="e.g., Cherry tomato 1×1, beefsteak 2×2"
          className="mt-1"
        />
      </div>
    </div>
  );
}