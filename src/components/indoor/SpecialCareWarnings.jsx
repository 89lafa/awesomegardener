import React, { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronDown, ChevronUp, Droplets, X, Snowflake, Sprout, Waves, Thermometer, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Detects if a variety has special care requirements
 */
export function hasSpecialCare(variety) {
  if (!variety) return false;
  return (
    (variety.water_type_required && variety.water_type_required !== 'any') ||
    (variety.fertilizer_rule && variety.fertilizer_rule !== 'normal') ||
    (variety.dormancy_required && variety.dormancy_required !== 'none') ||
    (variety.soil_type_required && !['standard'].includes(variety.soil_type_required)) ||
    (variety.root_cooling_required === true) ||
    (variety.is_aquatic === true) ||
    (variety.care_warnings && variety.care_warnings.length > 0)
  );
}

/**
 * Generates care warning badges based on variety data
 */
export function getCareWarningBadges(variety) {
  if (!variety) return [];
  
  const badges = [];

  // Water type
  if (variety.water_type_required === 'distilled_only') {
    badges.push({ icon: Droplets, label: 'Distilled Water Only', color: 'blue' });
  } else if (variety.water_type_required === 'distilled_preferred') {
    badges.push({ icon: Droplets, label: 'Distilled Water Preferred', color: 'sky' });
  }

  // Fertilizer
  if (variety.fertilizer_rule === 'none_ever') {
    badges.push({ icon: X, label: 'No Fertilizer', color: 'red' });
  } else if (variety.fertilizer_rule === 'foliar_only_dilute') {
    badges.push({ icon: AlertTriangle, label: 'No Soil Fertilizer', color: 'amber' });
  }

  // Dormancy
  if (variety.dormancy_required === 'required_cold') {
    badges.push({ icon: Snowflake, label: 'Cold Dormancy Required', color: 'indigo' });
  } else if (variety.dormancy_required === 'turion_aquatic') {
    badges.push({ icon: Snowflake, label: 'Aquatic Dormancy (Turions)', color: 'indigo' });
  } else if (variety.dormancy_required === 'succulent_phase') {
    badges.push({ icon: AlertCircle, label: 'Winter Phase Change', color: 'purple' });
  }

  // Soil
  if (variety.soil_type_required === 'carnivorous_mix') {
    badges.push({ icon: Sprout, label: 'Special Soil Required', color: 'orange' });
  } else if (variety.soil_type_required === 'aquatic_none') {
    badges.push({ icon: Waves, label: 'Aquatic — No Soil', color: 'cyan' });
  }

  // Root cooling
  if (variety.root_cooling_required === true) {
    badges.push({ icon: Thermometer, label: 'Root Cooling Required', color: 'blue' });
  }

  // Aquatic
  if (variety.is_aquatic === true && variety.soil_type_required !== 'aquatic_none') {
    badges.push({ icon: Waves, label: 'Aquatic Plant', color: 'cyan' });
  }

  // Difficulty
  if (variety.care_difficulty === 'expert') {
    badges.push({ icon: AlertTriangle, label: 'Expert Only', color: 'red' });
  } else if (variety.care_difficulty === 'advanced') {
    badges.push({ icon: AlertTriangle, label: 'Advanced', color: 'orange' });
  }

  return badges;
}

/**
 * SpecialCareWarnings component - displays critical care alerts for specialty plants
 */
export default function SpecialCareWarnings({ variety, className, collapsibleOnMobile = true }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!hasSpecialCare(variety)) return null;

  const badges = getCareWarningBadges(variety);
  const warnings = variety.care_warnings || [];
  
  // Alert color based on difficulty
  const getAlertColor = () => {
    if (variety.care_difficulty === 'expert') return 'bg-red-50 border-red-200';
    if (variety.care_difficulty === 'advanced') return 'bg-orange-50 border-orange-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getTextColor = () => {
    if (variety.care_difficulty === 'expert') return 'text-red-900';
    if (variety.care_difficulty === 'advanced') return 'text-orange-900';
    return 'text-blue-900';
  };

  const getIconColor = () => {
    if (variety.care_difficulty === 'expert') return 'text-red-600';
    if (variety.care_difficulty === 'advanced') return 'text-orange-600';
    return 'text-blue-600';
  };

  const getBadgeColor = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-800',
      sky: 'bg-sky-100 text-sky-800',
      red: 'bg-red-100 text-red-800',
      amber: 'bg-amber-100 text-amber-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      purple: 'bg-purple-100 text-purple-800',
      orange: 'bg-orange-100 text-orange-800',
      cyan: 'bg-cyan-100 text-cyan-800'
    };
    return colors[color] || 'bg-gray-100 text-gray-800';
  };

  // Mobile: Show first 2 warnings only unless expanded
  const visibleWarnings = collapsibleOnMobile && !expanded ? warnings.slice(0, 2) : warnings;
  const hasMoreWarnings = collapsibleOnMobile && warnings.length > 2;

  return (
    <Alert className={cn(getAlertColor(), 'border-2', className)}>
      <AlertTriangle className={cn('w-5 h-5', getIconColor())} />
      <AlertDescription className={getTextColor()}>
        <div className="space-y-3">
          {/* Header */}
          <div>
            <p className="font-bold text-base mb-2">
              {variety.is_aquatic && '🌊 Aquatic Plant'}
              {variety.care_difficulty === 'expert' && !variety.is_aquatic && '⚠️ Expert Only'}
              {variety.care_difficulty === 'advanced' && !variety.is_aquatic && '⚠️ Advanced Care'}
              {variety.care_difficulty !== 'expert' && variety.care_difficulty !== 'advanced' && !variety.is_aquatic && '⚠️ Special Care Required'}
            </p>
            
            {/* Badges */}
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {badges.map((badge, idx) => {
                  const Icon = badge.icon;
                  return (
                    <Badge key={idx} className={cn('gap-1 text-xs', getBadgeColor(badge.color))}>
                      <Icon className="w-3 h-3" />
                      {badge.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Warnings List */}
          {warnings.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {visibleWarnings.map((warning, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-inherit">•</span>
                  <span className="flex-1">{warning}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Show More/Less for Mobile */}
          {hasMoreWarnings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs p-0 h-auto hover:bg-transparent"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Show all {warnings.length} warnings
                </>
              )}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}