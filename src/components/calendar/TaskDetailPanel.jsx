import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

const TASK_TYPE_LABELS = {
  bed_prep: 'Bed Preparation',
  seed: 'Seeding (Indoors)',
  direct_seed: 'Direct Seeding',
  transplant: 'Transplanting',
  cultivate: 'Cultivation',
  harvest: 'Harvesting'
};

export default function TaskDetailPanel({ task, onClose }) {
  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-white border-l shadow-lg z-50 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-lg">Task Details</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <Badge className="mb-2">{TASK_TYPE_LABELS[task.task_type] || task.task_type}</Badge>
          <h2 className="text-xl font-bold">{task.title}</h2>
          <p className="text-sm text-gray-600 mt-2">
            {format(new Date(task.start_date), 'MMM d, yyyy')}
            {task.end_date && task.end_date !== task.start_date && (
              <> - {format(new Date(task.end_date), 'MMM d, yyyy')}</>
            )}
          </p>
        </div>
        
        {task.how_to_content && (
          <Card className="p-4">
            <ReactMarkdown className="prose prose-sm max-w-none">
              {task.how_to_content}
            </ReactMarkdown>
          </Card>
        )}
        
        {!task.how_to_content && (
          <Card className="p-4">
            <h4 className="font-semibold mb-2">What to do</h4>
            <p className="text-sm text-gray-600">
              Complete the {TASK_TYPE_LABELS[task.task_type]?.toLowerCase() || task.task_type} task for this crop.
            </p>
          </Card>
        )}
        
        {task.notes && (
          <Card className="p-4">
            <h4 className="font-semibold mb-2">Notes</h4>
            <p className="text-sm text-gray-600">{task.notes}</p>
          </Card>
        )}
      </div>
    </div>
  );
}