import React, { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronDown, ChevronUp, Droplets, X, Snowflake, Sprout, Waves, Thermometer, AlertCircle, Sun, Shield, Wind, Skull, Eye, Flame, Leaf, Bug, Clock, Box, Zap, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Detects if a variety has ANY badges to show (care warnings OR info tags)
 */
export function hasSpecialCare(variety) {
  if (!variety) return false;
  return (
    // === CARNIVOROUS ===
    (variety.water_type_required && variety.water_type_required !== 'any') ||
    (variety.fertilizer_rule && variety.fertilizer_rule !== 'normal') ||
    (variety.dormancy_required && variety.dormancy_required !== 'none') ||
    (variety.soil_type_required && !['standard'].includes(variety.soil_type_required)) ||
    (variety.root_cooling_required === true) ||
    (variety.is_aquatic === true) ||
    (variety.care_warnings && variety.care_warnings.length > 0) ||
    // === CACTUS / SUCCULENT ===
    (variety.soil_type_recommended === 'cactus_succulent') ||
    (variety.soil_dryness_rule === 'fully_dry') ||
    (variety.overwater_sensitivity && ['high', 'extreme'].includes(variety.overwater_sensitivity)) ||
    (variety.drought_tolerant === true) ||
    // === HOUSEPLANT CARE ===
    (variety.toxic_to_cats === true || variety.toxic_to_dogs === true || variety.sap_irritant === true) ||
    (variety.pet_safe === true) ||
    (variety.air_purifying === true) ||
    (variety.humidity_preference && ['high', 'very_high'].includes(variety.humidity_preference)) ||
    (variety.light_requirement_indoor === 'low') ||
    (variety.light_requirement_indoor === 'bright_direct') ||
    (variety.soil_type_recommended && !['all_purpose', ''].includes(variety.soil_type_recommended)) ||
    (variety.needs_support === true) ||
    (variety.misting_beneficial === true) ||
    // === GARDEN INFO TAGS ===
    (variety.seed_line_type && !['unknown', ''].includes(variety.seed_line_type)) ||
    (variety.is_organic === true) ||
    (variety.container_friendly === true) ||
    (variety.trellis_required === true) ||
    (variety.season_timing && !['unknown', ''].includes(variety.season_timing)) ||
    (variety.care_difficulty && !['', 'moderate'].includes(variety.care_difficulty)) ||
    // Growth habit tags
    (variety.growth_habit && /indeterminate|determinate|vining|bush|dwarf|trailing|pole|climbing/i.test(variety.growth_habit)) ||
    // Disease resistance
    (variety.disease_resistance && /resist|toleran/i.test(variety.disease_resistance)) ||
    // Pepper heat
    (variety.scoville_max && Number(variety.scoville_max) > 0)
  );
}

/**
 * Generates ALL badges — care warnings AND info tags
 * Each badge has: icon, label, color, type ('warning' or 'info')
 */
export function getCareWarningBadges(variety) {
  if (!variety) return [];

  const badges = [];

  // ============================================
  // TIER 1: CARE BADGES (survival-critical)
  // ============================================

  // --- Carnivorous ---
  if (variety.water_type_required === 'distilled_only') {
    badges.push({ icon: Droplets, label: 'Distilled Water Only', color: 'blue', type: 'warning' });
  } else if (variety.water_type_required === 'distilled_preferred') {
    badges.push({ icon: Droplets, label: 'Distilled Water Preferred', color: 'sky', type: 'warning' });
  }

  if (variety.fertilizer_rule === 'none_ever') {
    badges.push({ icon: X, label: 'No Fertilizer', color: 'red', type: 'warning' });
  } else if (variety.fertilizer_rule === 'foliar_only_dilute') {
    badges.push({ icon: AlertTriangle, label: 'No Soil Fertilizer', color: 'amber', type: 'warning' });
  }

  if (variety.dormancy_required === 'required_cold') {
    badges.push({ icon: Snowflake, label: 'Cold Dormancy Required', color: 'indigo', type: 'warning' });
  } else if (variety.dormancy_required === 'turion_aquatic') {
    badges.push({ icon: Snowflake, label: 'Aquatic Dormancy (Turions)', color: 'indigo', type: 'warning' });
  } else if (variety.dormancy_required === 'succulent_phase') {
    badges.push({ icon: AlertCircle, label: 'Winter Phase Change', color: 'purple', type: 'warning' });
  } else if (variety.dormancy_required === 'optional_beneficial') {
    badges.push({ icon: Snowflake, label: 'Winter Rest Helpful', color: 'indigo', type: 'warning' });
  }

  if (variety.soil_type_required === 'carnivorous_mix') {
    badges.push({ icon: Sprout, label: 'Special Soil Required', color: 'orange', type: 'warning' });
  } else if (variety.soil_type_required === 'aquatic_none') {
    badges.push({ icon: Waves, label: 'Aquatic — No Soil', color: 'cyan', type: 'warning' });
  }

  if (variety.root_cooling_required === true) {
    badges.push({ icon: Thermometer, label: 'Root Cooling Required', color: 'blue', type: 'warning' });
  }

  if (variety.is_aquatic === true && variety.soil_type_required !== 'aquatic_none') {
    badges.push({ icon: Waves, label: 'Aquatic Plant', color: 'cyan', type: 'warning' });
  }

  // Difficulty
  if (variety.care_difficulty === 'expert') {
    badges.push({ icon: AlertTriangle, label: 'Expert Only', color: 'red', type: 'warning' });
  } else if (variety.care_difficulty === 'advanced') {
    badges.push({ icon: AlertTriangle, label: 'Advanced Care', color: 'orange', type: 'warning' });
  }

  // --- Cactus / Succulent ---
  if (variety.soil_type_recommended === 'cactus_succulent') {
    badges.push({ icon: Sprout, label: 'Cactus Mix', color: 'amber', type: 'warning' });
  }
  if (variety.soil_dryness_rule === 'fully_dry') {
    badges.push({ icon: Sun, label: 'Dry Between Waterings', color: 'orange', type: 'warning' });
  }
  if (variety.overwater_sensitivity && ['high', 'extreme'].includes(variety.overwater_sensitivity)) {
    badges.push({ icon: AlertTriangle, label: 'Overwatering Sensitive', color: 'red', type: 'warning' });
  }
  if (variety.drought_tolerant === true) {
    badges.push({ icon: Droplets, label: 'Drought Tolerant', color: 'sky', type: 'warning' });
  }

  // --- Toxicity ---
  if (variety.toxic_to_cats === true) {
    badges.push({ icon: Skull, label: 'Toxic to Cats', color: 'red', type: 'warning' });
  }
  if (variety.toxic_to_dogs === true) {
    badges.push({ icon: Skull, label: 'Toxic to Dogs', color: 'red', type: 'warning' });
  }
  if (variety.sap_irritant === true) {
    badges.push({ icon: AlertTriangle, label: 'Sap Irritant', color: 'amber', type: 'warning' });
  }

  // --- Humidity & Environment ---
  if (variety.humidity_preference === 'very_high') {
    badges.push({ icon: Droplets, label: 'Very High Humidity', color: 'blue', type: 'warning' });
  } else if (variety.humidity_preference === 'high') {
    badges.push({ icon: Droplets, label: 'High Humidity', color: 'sky', type: 'warning' });
  }
  if (variety.misting_beneficial === true) {
    badges.push({ icon: Droplets, label: 'Misting Helpful', color: 'sky', type: 'info' });
  }

  // --- Light ---
  if (variety.light_requirement_indoor === 'bright_direct') {
    badges.push({ icon: Sun, label: 'High Light', color: 'amber', type: 'warning' });
  } else if (variety.light_requirement_indoor === 'low') {
    badges.push({ icon: Eye, label: 'Low Light OK', color: 'purple', type: 'info' });
  }

  // --- Special Soil (non-carnivorous, non-cactus) ---
  if (variety.soil_type_recommended === 'chunky_aroid') {
    badges.push({ icon: Sprout, label: 'Aroid Mix', color: 'green', type: 'info' });
  } else if (variety.soil_type_recommended === 'orchid_bark') {
    badges.push({ icon: Sprout, label: 'Orchid Bark', color: 'orange', type: 'info' });
  } else if (variety.soil_type_recommended === 'peat_perlite') {
    badges.push({ icon: Sprout, label: 'Peat/Perlite Mix', color: 'green', type: 'info' });
  }

  // --- Support ---
  if (variety.needs_support === true) {
    badges.push({ icon: AlertCircle, label: 'Needs Support', color: 'purple', type: 'info' });
  }

  // ============================================
  // TIER 2: INFO BADGES (at-a-glance facts)
  // ============================================

  // --- Positive Traits ---
  if (variety.pet_safe === true) {
    badges.push({ icon: Shield, label: 'Pet Safe', color: 'green', type: 'info' });
  }
  if (variety.air_purifying === true) {
    badges.push({ icon: Wind, label: 'Air Purifying', color: 'green', type: 'info' });
  }
  if (variety.container_friendly === true) {
    badges.push({ icon: Box, label: 'Container Friendly', color: 'green', type: 'info' });
  }

  // --- Seed Type ---
  if (variety.seed_line_type === 'heirloom') {
    badges.push({ icon: Heart, label: 'Heirloom', color: 'purple', type: 'info' });
  } else if (variety.seed_line_type === 'hybrid') {
    badges.push({ icon: Zap, label: 'Hybrid F1', color: 'blue', type: 'info' });
  } else if (variety.seed_line_type === 'open_pollinated') {
    badges.push({ icon: Leaf, label: 'Open Pollinated', color: 'green', type: 'info' });
  }
  if (variety.is_organic === true) {
    badges.push({ icon: Leaf, label: 'Organic', color: 'green', type: 'info' });
  }

  // --- Growth Habit ---
  const habit = (variety.growth_habit || '').toLowerCase();
  if (/indeterminate/.test(habit)) {
    badges.push({ icon: Sprout, label: 'Indeterminate', color: 'blue', type: 'info' });
  } else if (/\bdeterminate\b/.test(habit) && !/indeterminate/.test(habit)) {
    badges.push({ icon: Sprout, label: 'Determinate', color: 'green', type: 'info' });
  }
  if (/vining|pole/.test(habit)) {
    badges.push({ icon: Leaf, label: 'Vining', color: 'blue', type: 'info' });
  } else if (/\bbush\b|compact/.test(habit) && !/indeterminate|determinate/.test(habit)) {
    badges.push({ icon: Sprout, label: 'Bush/Compact', color: 'green', type: 'info' });
  }
  if (/dwarf|micro/.test(habit)) {
    badges.push({ icon: Sprout, label: 'Dwarf', color: 'purple', type: 'info' });
  }
  if (/trailing/.test(habit)) {
    badges.push({ icon: Leaf, label: 'Trailing', color: 'sky', type: 'info' });
  }
  if (/climbing/.test(habit)) {
    badges.push({ icon: Leaf, label: 'Climbing', color: 'blue', type: 'info' });
  }

  // --- Trellis ---
  if (variety.trellis_required === true) {
    badges.push({ icon: AlertCircle, label: 'Trellis Required', color: 'amber', type: 'info' });
  }

  // --- Season Timing ---
  if (variety.season_timing === 'early') {
    badges.push({ icon: Clock, label: 'Early Season', color: 'green', type: 'info' });
  } else if (variety.season_timing === 'mid') {
    badges.push({ icon: Clock, label: 'Mid Season', color: 'amber', type: 'info' });
  } else if (variety.season_timing === 'late') {
    badges.push({ icon: Clock, label: 'Late Season', color: 'orange', type: 'info' });
  }

  // --- Disease Resistance ---
  const dr = (variety.disease_resistance || '').toLowerCase();
  if (dr && /resist/i.test(dr) && !/no known|none|unknown/i.test(dr)) {
    badges.push({ icon: Bug, label: 'Disease Resistant', color: 'green', type: 'info' });
  } else if (dr && /toleran/i.test(dr) && !/no known|none|unknown/i.test(dr)) {
    badges.push({ icon: Bug, label: 'Disease Tolerant', color: 'sky', type: 'info' });
  }

  // --- Beginner Friendly (care_difficulty) ---
  if (variety.care_difficulty === 'beginner' || variety.care_difficulty === 'easy') {
    badges.push({ icon: Sprout, label: 'Easy Care', color: 'green', type: 'info' });
  }

  // --- Pepper Heat Level ---
  const scovilleMax = Number(variety.scoville_max) || 0;
  if (scovilleMax > 0) {
    if (scovilleMax <= 1000) {
      badges.push({ icon: Flame, label: 'Mild', color: 'green', type: 'info' });
    } else if (scovilleMax <= 30000) {
      badges.push({ icon: Flame, label: 'Medium Heat', color: 'amber', type: 'info' });
    } else if (scovilleMax <= 100000) {
      badges.push({ icon: Flame, label: 'Hot', color: 'orange', type: 'info' });
    } else if (scovilleMax <= 350000) {
      badges.push({ icon: Flame, label: 'Very Hot', color: 'red', type: 'info' });
    } else {
      badges.push({ icon: Flame, label: 'Extreme Heat', color: 'red', type: 'info' });
    }
  }

  return badges;
}

/**
 * Returns ONLY info badges (no warnings) — useful for catalog cards, list views
 */
export function getInfoBadges(variety) {
  return getCareWarningBadges(variety).filter(b => b.type === 'info');
}

/**
 * Returns ONLY warning badges — useful for care-critical alerts
 */
export function getWarningBadges(variety) {
  return getCareWarningBadges(variety).filter(b => b.type === 'warning');
}

/**
 * Returns true if variety has care-critical warnings (not just info tags)
 */
export function hasCareWarnings(variety) {
  return getWarningBadges(variety).length > 0 || (variety?.care_warnings?.length > 0);
}

// Badge color map
const BADGE_COLORS = {
  blue: 'bg-blue-100 text-blue-800',
  sky: 'bg-sky-100 text-sky-800',
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800'
};

/**
 * Renders a row of badges — can be used standalone anywhere
 */
export function PlantBadges({ variety, showWarnings = true, showInfo = true, className }) {
  if (!variety) return null;

  const allBadges = getCareWarningBadges(variety);
  const filtered = allBadges.filter(b =>
    (showWarnings && b.type === 'warning') || (showInfo && b.type === 'info')
  );

  if (filtered.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {filtered.map((badge, idx) => {
        const Icon = badge.icon;
        return (
          <Badge key={idx} className={cn('gap-1 text-xs font-medium', BADGE_COLORS[badge.color] || 'bg-gray-100 text-gray-800')}>
            <Icon className="w-3 h-3" />
            {badge.label}
          </Badge>
        );
      })}
    </div>
  );
}

/**
 * SpecialCareWarnings component — full care alert with badges + warnings text
 * Shows the colored alert box for care-critical plants, plus info badges below
 */
export default function SpecialCareWarnings({ variety, className, collapsibleOnMobile = true, showInfoBadges = true }) {
  const [expanded, setExpanded] = useState(false);

  if (!variety) return null;

  const allBadges = getCareWarningBadges(variety);
  const warningBadges = allBadges.filter(b => b.type === 'warning');
  const infoBadges = allBadges.filter(b => b.type === 'info');
  const warnings = variety.care_warnings || [];

  const hasWarnings = warningBadges.length > 0 || warnings.length > 0;
  const hasInfo = infoBadges.length > 0;

  // If nothing to show at all, return null
  if (!hasWarnings && !hasInfo) return null;

  // Alert color based on difficulty
  const getAlertColor = () => {
    if (variety.care_difficulty === 'expert') return 'bg-red-50 border-red-200';
    if (variety.care_difficulty === 'advanced') return 'bg-orange-50 border-orange-200';
    if (warningBadges.some(b => b.color === 'red')) return 'bg-red-50 border-red-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getTextColor = () => {
    if (variety.care_difficulty === 'expert') return 'text-red-900';
    if (variety.care_difficulty === 'advanced') return 'text-orange-900';
    if (warningBadges.some(b => b.color === 'red')) return 'text-red-900';
    return 'text-blue-900';
  };

  const getIconColor = () => {
    if (variety.care_difficulty === 'expert') return 'text-red-600';
    if (variety.care_difficulty === 'advanced') return 'text-orange-600';
    if (warningBadges.some(b => b.color === 'red')) return 'text-red-600';
    return 'text-blue-600';
  };

  // Mobile: Show first 2 warnings only unless expanded
  const visibleWarnings = collapsibleOnMobile && !expanded ? warnings.slice(0, 2) : warnings;
  const hasMoreWarnings = collapsibleOnMobile && warnings.length > 2;

  return (
    <div className={cn('space-y-3', className)}>
      {/* === CARE WARNING ALERT (only if has warnings) === */}
      {hasWarnings && (
        <Alert className={cn(getAlertColor(), 'border-2')}>
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

                {/* Warning Badges */}
                {warningBadges.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {warningBadges.map((badge, idx) => {
                      const Icon = badge.icon;
                      return (
                        <Badge key={idx} className={cn('gap-1 text-xs', BADGE_COLORS[badge.color] || 'bg-gray-100 text-gray-800')}>
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
      )}

      {/* === INFO BADGES (below the alert, or standalone) === */}
      {showInfoBadges && hasInfo && (
        <div className="flex flex-wrap gap-1.5">
          {infoBadges.map((badge, idx) => {
            const Icon = badge.icon;
            return (
              <Badge key={idx} variant="outline" className={cn('gap-1 text-xs font-medium', BADGE_COLORS[badge.color] || 'bg-gray-100 text-gray-800')}>
                <Icon className="w-3 h-3" />
                {badge.label}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
