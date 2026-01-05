import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

export default function AdvancedFiltersPanel({ 
  open, 
  onOpenChange, 
  filters, 
  onFilterChange,
  onClearAll,
  availableFilters = {}
}) {
  const handleRangeChange = (field, subfield, value) => {
    onFilterChange({
      ...filters,
      [field]: {
        ...filters[field],
        [subfield]: value ? parseInt(value) : null
      }
    });
  };

  const handleMultiSelect = (field, value, checked) => {
    const current = filters[field] || [];
    const updated = checked 
      ? [...current, value]
      : current.filter(v => v !== value);
    onFilterChange({ ...filters, [field]: updated });
  };

  const handleBooleanToggle = (field) => {
    onFilterChange({
      ...filters,
      [field]: filters[field] === true ? null : true
    });
  };

  const activeFilterCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'subCategories') return false; // Handled separately
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object' && val !== null) {
      return val.min !== null || val.max !== null;
    }
    return val !== null && val !== undefined;
  }).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Advanced Filters</SheetTitle>
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Days to Maturity Range */}
          {availableFilters.daysToMaturity && (
            <div className="space-y-2">
              <Label className="font-semibold">Days to Maturity</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Min</Label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={filters.daysToMaturity?.min || ''}
                    onChange={(e) => handleRangeChange('daysToMaturity', 'min', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Max</Label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={filters.daysToMaturity?.max || ''}
                    onChange={(e) => handleRangeChange('daysToMaturity', 'max', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Spacing Range */}
          {availableFilters.spacing && (
            <div className="space-y-2">
              <Label className="font-semibold">Spacing (inches)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Min</Label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={filters.spacing?.min || ''}
                    onChange={(e) => handleRangeChange('spacing', 'min', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Max</Label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={filters.spacing?.max || ''}
                    onChange={(e) => handleRangeChange('spacing', 'max', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Heat Level (Peppers) */}
          {availableFilters.heatLevel && (
            <div className="space-y-2">
              <Label className="font-semibold">Heat Level (SHU)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Min</Label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={filters.heatLevel?.min || ''}
                    onChange={(e) => handleRangeChange('heatLevel', 'min', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Max</Label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={filters.heatLevel?.max || ''}
                    onChange={(e) => handleRangeChange('heatLevel', 'max', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Growth Habit */}
          {availableFilters.growthHabits?.length > 0 && (
            <div className="space-y-2">
              <Label className="font-semibold">Growth Habit</Label>
              <div className="space-y-2">
                {availableFilters.growthHabits.map((habit) => (
                  <label key={habit} className="flex items-center gap-2">
                    <Checkbox
                      checked={(filters.growthHabits || []).includes(habit)}
                      onCheckedChange={(checked) => handleMultiSelect('growthHabits', habit, checked)}
                    />
                    <span className="text-sm capitalize">{habit.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Fruit/Pod Colors */}
          {availableFilters.colors?.length > 0 && (
            <div className="space-y-2">
              <Label className="font-semibold">Fruit/Pod Color</Label>
              <div className="space-y-2">
                {availableFilters.colors.map((color) => (
                  <label key={color} className="flex items-center gap-2">
                    <Checkbox
                      checked={(filters.colors || []).includes(color)}
                      onCheckedChange={(checked) => handleMultiSelect('colors', color, checked)}
                    />
                    <span className="text-sm capitalize">{color}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Species */}
          {availableFilters.species?.length > 0 && (
            <div className="space-y-2">
              <Label className="font-semibold">Species</Label>
              <div className="space-y-2">
                {availableFilters.species.map((sp) => (
                  <label key={sp} className="flex items-center gap-2">
                    <Checkbox
                      checked={(filters.species || []).includes(sp)}
                      onCheckedChange={(checked) => handleMultiSelect('species', sp, checked)}
                    />
                    <span className="text-sm italic">{sp}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Boolean Toggles */}
          {availableFilters.booleans && (
            <div className="space-y-3 border-t pt-4">
              <Label className="font-semibold">Characteristics</Label>
              {availableFilters.booleans.containerFriendly && (
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.containerFriendly === true}
                    onCheckedChange={() => handleBooleanToggle('containerFriendly')}
                  />
                  <span className="text-sm">Container Friendly</span>
                </label>
              )}
              {availableFilters.booleans.trellisRequired && (
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.trellisRequired === true}
                    onCheckedChange={() => handleBooleanToggle('trellisRequired')}
                  />
                  <span className="text-sm">Needs Trellis</span>
                </label>
              )}
              {availableFilters.booleans.hasImage && (
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.hasImage === true}
                    onCheckedChange={() => handleBooleanToggle('hasImage')}
                  />
                  <span className="text-sm">Has Image</span>
                </label>
              )}
            </div>
          )}

          {/* Clear All Button */}
          {activeFilterCount > 0 && (
            <div className="border-t pt-4">
              <Button
                variant="outline"
                onClick={onClearAll}
                className="w-full gap-2"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}