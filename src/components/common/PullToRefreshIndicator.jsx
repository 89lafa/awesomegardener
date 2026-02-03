import React from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PullToRefreshIndicator({ isPulling, pullDistance, isRefreshing }) {
  const visible = isPulling || isRefreshing;
  const threshold = 80;
  const triggered = pullDistance > threshold;

  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 transition-all duration-200 ease-out z-50",
        "bg-white rounded-full shadow-lg border-2 border-emerald-500",
        "w-12 h-12 flex items-center justify-center",
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      style={{
        top: visible ? `${Math.min(pullDistance * 0.5, 60)}px` : '-60px'
      }}
    >
      {isRefreshing ? (
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      ) : (
        <ArrowDown 
          className={cn(
            "w-6 h-6 transition-all",
            triggered ? "text-emerald-600 rotate-180" : "text-gray-400"
          )} 
        />
      )}
    </div>
  );
}