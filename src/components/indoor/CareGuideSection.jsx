import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CareGuideSection({ icon, title, summary, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="mb-3">
      <CardContent className="p-0">
        <button
          onClick={() => setOpen(!open)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">{title}</h3>
              {!open && summary && (
                <p className="text-sm text-gray-600 mt-0.5">{summary}</p>
              )}
            </div>
          </div>
          {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </button>
        
        {open && (
          <div className="px-4 pb-4 pt-2 border-t bg-gray-50/50">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CareGuideRow({ label, value, badge = false }) {
  if (!value) return null;
  
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right ml-2">{value}</span>
    </div>
  );
}