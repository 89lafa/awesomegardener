import React from 'react';
import { format, differenceInDays } from 'date-fns';

export function GanttTimeline({ cropPlans, startDate, endDate }) {
  const totalDays = differenceInDays(endDate, startDate);
  const pxPerDay = 600 / totalDays;

  const getTaskPosition = (task) => {
    const start = differenceInDays(new Date(task.start_date), startDate);
    const end = differenceInDays(new Date(task.end_date || task.start_date), startDate);
    return {
      left: start * pxPerDay,
      width: Math.max((end - start + 1) * pxPerDay, 20)
    };
  };

  const getTaskColor = (type) => {
    const colors = {
      seed: '#3b82f6',
      transplant: '#10b981',
      harvest: '#f59e0b',
      cultivate: '#8b5cf6'
    };
    return colors[type] || '#6b7280';
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Timeline Header */}
          <div className="mb-4 pl-40">
            <div className="flex text-xs text-gray-600">
              {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, week) => (
                <div key={week} style={{ width: `${pxPerDay * 7}px` }} className="border-l border-gray-300 pl-2">
                  Week {week + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Gantt Bars */}
          {cropPlans.map(plan => (
            <div key={plan.id} className="mb-4 flex items-center h-10">
              <div className="w-40 pr-4 text-sm font-medium text-gray-900 truncate">
                {plan.plant_type_name}
              </div>
              <div className="relative flex-1 h-8 bg-gray-50 border border-gray-200 rounded">
                {/* Seed Phase */}
                {plan.sow_date && (
                  <div
                    className="absolute h-full rounded hover:opacity-80 transition-opacity cursor-pointer"
                    style={{
                      ...getTaskPosition({
                        start_date: plan.sow_date,
                        end_date: plan.expected_transplant_date || plan.sow_date
                      }),
                      backgroundColor: getTaskColor('seed'),
                      opacity: 0.7
                    }}
                    title="Seed to Transplant"
                  />
                )}

                {/* Growing Phase */}
                {plan.expected_transplant_date && plan.expected_harvest_date && (
                  <div
                    className="absolute h-full rounded hover:opacity-80 transition-opacity cursor-pointer"
                    style={{
                      ...getTaskPosition({
                        start_date: plan.expected_transplant_date,
                        end_date: plan.expected_harvest_date
                      }),
                      backgroundColor: getTaskColor('harvest'),
                      opacity: 0.7
                    }}
                    title="Grow to Harvest"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: getTaskColor('seed') }} />
          <span className="text-gray-700">Seed Phase</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: getTaskColor('harvest') }} />
          <span className="text-gray-700">Growing Phase</span>
        </div>
      </div>
    </div>
  );
}