import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, differenceInDays } from 'date-fns';

export function GanttChart({ cropPlans, seasonStart }) {
  if (!seasonStart) return null;

  const seasonStartDate = new Date(seasonStart);
  const getPosition = (date) => {
    if (!date) return 0;
    const days = differenceInDays(new Date(date), seasonStartDate);
    return Math.max(0, days * 4); // 4px per day
  };

  const getWidth = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const days = differenceInDays(new Date(endDate), new Date(startDate));
    return Math.max(20, days * 4);
  };

  const colors = {
    seed: 'bg-blue-500',
    transplant: 'bg-yellow-500',
    growing: 'bg-green-500',
    harvest: 'bg-orange-500'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Timeline View</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-max">
          {/* Month headers */}
          <div className="flex text-sm text-gray-600 mb-4">
            <div className="w-48 flex-shrink-0" />
            <div className="flex gap-1">
              {Array.from({ length: 12 }).map((_, idx) => {
                const date = new Date(seasonStartDate);
                date.setMonth(date.getMonth() + idx);
                return (
                  <div key={idx} className="w-24 text-center text-xs">
                    {format(date, 'MMM')}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Crops */}
          <div className="space-y-3">
            {cropPlans.map((plan) => (
              <div key={plan.id} className="flex items-center gap-4">
                <div className="w-48 flex-shrink-0">
                  <p className="font-medium text-sm truncate">{plan.variety_name}</p>
                  <p className="text-xs text-gray-500">{plan.quantity} plants</p>
                </div>

                <div className="relative h-8 bg-gray-100 rounded flex-1 min-w-max">
                  {/* Seed bar */}
                  {plan.planned_sow_date && (
                    <div
                      className={`${colors.seed} absolute h-full rounded flex items-center px-2 text-white text-xs font-medium`}
                      style={{
                        left: `${getPosition(plan.planned_sow_date)}px`,
                        width: `${Math.max(40, getWidth(plan.planned_sow_date, plan.planned_transplant_date))}px`
                      }}
                    >
                      Seed
                    </div>
                  )}

                  {/* Transplant bar */}
                  {plan.planned_transplant_date && (
                    <div
                      className={`${colors.transplant} absolute h-full rounded flex items-center px-2 text-white text-xs font-medium`}
                      style={{
                        left: `${getPosition(plan.planned_transplant_date)}px`,
                        width: `${Math.max(40, getWidth(plan.planned_transplant_date, plan.expected_harvest_date))}px`
                      }}
                    >
                      Growing
                    </div>
                  )}

                  {/* Harvest bar */}
                  {plan.expected_harvest_date && (
                    <div
                      className={`${colors.harvest} absolute h-full rounded-r flex items-center px-2 text-white text-xs font-medium`}
                      style={{
                        left: `${getPosition(plan.expected_harvest_date)}px`,
                        width: '60px'
                      }}
                    >
                      Harvest
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex gap-6 mt-6 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded" />
              Seeding
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded" />
              Transplant
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded" />
              Growing
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded" />
              Harvest
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}