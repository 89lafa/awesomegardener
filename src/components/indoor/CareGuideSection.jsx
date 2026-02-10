import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CareGuideSection({ icon, title, summary, children, defaultOpen = false }) {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
            <div className="text-sm text-gray-700 space-y-1">
              {children}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CareGuideRow({ label, value, badge = false }) {
  if (!value) return null;
  
  return (
    <div className="text-sm">
      <span className="text-gray-600">{label}: </span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}