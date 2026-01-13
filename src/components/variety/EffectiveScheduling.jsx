import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function EffectiveScheduling({ variety, plantProfile, plantType }) {
  // Determine effective values with precedence
  const getEffectiveValue = (field, varietyField, profileField, typeField) => {
    if (variety && variety[varietyField] !== null && variety[varietyField] !== undefined) {
      return { value: variety[varietyField], source: 'Variety' };
    }
    if (plantProfile && plantProfile[profileField] !== null && plantProfile[profileField] !== undefined) {
      return { value: plantProfile[profileField], source: 'PlantProfile' };
    }
    if (plantType && plantType[typeField] !== null && plantType[typeField] !== undefined) {
      return { value: plantType[typeField], source: 'PlantType' };
    }
    return { value: null, source: 'None' };
  };

  const startIndoorsMin = getEffectiveValue(
    'start_indoors_min',
    'start_indoors_weeks_min',
    'start_indoors_weeks_before_last_frost_min',
    'default_start_indoors_weeks'
  );
  
  const startIndoorsMax = getEffectiveValue(
    'start_indoors_max',
    'start_indoors_weeks_max',
    'start_indoors_weeks_before_last_frost_max',
    'default_start_indoors_weeks'
  );

  const transplantMin = getEffectiveValue(
    'transplant_min',
    'transplant_weeks_after_last_frost_min',
    'transplant_weeks_after_last_frost_min',
    'default_transplant_weeks'
  );

  const transplantMax = getEffectiveValue(
    'transplant_max',
    'transplant_weeks_after_last_frost_max',
    'transplant_weeks_after_last_frost_max',
    'default_transplant_weeks'
  );

  const directSowMin = getEffectiveValue(
    'direct_sow_min',
    'direct_sow_weeks_min',
    'direct_sow_weeks_relative_to_last_frost_min',
    'default_direct_sow_weeks_min'
  );

  const directSowMax = getEffectiveValue(
    'direct_sow_max',
    'direct_sow_weeks_max',
    'direct_sow_weeks_relative_to_last_frost_max',
    'default_direct_sow_weeks_max'
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600" />
          Effective Scheduling Values
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-sm text-blue-800">
            These are the actual values the Calendar Planner will use. Values cascade: Variety → PlantProfile → PlantType defaults.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <SchedulingRow
            label="Start Indoors"
            min={startIndoorsMin}
            max={startIndoorsMax}
            unit="weeks before last frost"
            varietyId={variety?.id}
            plantTypeId={plantType?.id}
          />

          <SchedulingRow
            label="Transplant"
            min={transplantMin}
            max={transplantMax}
            unit="weeks after last frost"
            varietyId={variety?.id}
            plantTypeId={plantType?.id}
          />

          <SchedulingRow
            label="Direct Sow"
            min={directSowMin}
            max={directSowMax}
            unit="weeks relative to last frost"
            varietyId={variety?.id}
            plantTypeId={plantType?.id}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SchedulingRow({ label, min, max, unit, varietyId, plantTypeId }) {
  const hasValue = min.value !== null || max.value !== null;
  
  return (
    <div className="p-3 bg-gray-50 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{label}</span>
        {hasValue && (
          <Badge variant="outline" className="text-xs">
            {min.source === 'Variety' ? '✓ Variety Override' : 
             min.source === 'PlantProfile' ? 'PlantProfile' : 
             min.source === 'PlantType' ? 'PlantType Default' : 'Not Set'}
          </Badge>
        )}
      </div>
      
      {hasValue ? (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {min.value !== null && max.value !== null ? (
              <span className="font-semibold">{min.value} - {max.value}</span>
            ) : (
              <span className="font-semibold">{min.value || max.value}</span>
            )}
            <span className="text-gray-500 ml-1">{unit}</span>
          </div>
          <div className="flex gap-1">
            {varietyId && (
              <Link to={createPageUrl('EditVariety') + `?id=${varietyId}`}>
                <Button size="sm" variant="ghost" className="text-xs h-7">
                  Edit Variety <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
            {plantTypeId && (
              <Link to={createPageUrl('EditPlantType') + `?id=${plantTypeId}`}>
                <Button size="sm" variant="ghost" className="text-xs h-7">
                  Edit Type <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">Not set at any level</p>
      )}
    </div>
  );
}