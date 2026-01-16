import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pin, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import UserSignature from './UserSignature';
import ReportButton from './ReportButton';
import ShareButton from './ShareButton';

export default function TopicHeader({ topic, author }) {
  const authorEmail = topic.author_email || topic.created_by;
  const displayName = author?.nickname || author?.full_name || authorEmail?.split('@')[0] || 'Unknown User';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        {topic.pinned && <Pin className="w-5 h-5 text-emerald-600" />}
        {topic.status === 'locked' && <Lock className="w-5 h-5 text-gray-400" />}
        <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
      </div>
      
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>by {displayName}</span>
        <span>•</span>
        <span>{formatDistanceToNow(new Date(topic.created_date), { addSuffix: true })}</span>
        <span>•</span>
        <span>{topic.view_count || 0} views</span>
      </div>

      {topic.body && (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-end gap-2 mb-3">
              <ShareButton type="topic" id={topic.id} title={topic.title} />
              <ReportButton
                reportType="forum_topic"
                targetId={topic.id}
                targetPreview={topic.body}
              />
            </div>
            <div className="prose prose-sm max-w-none mb-4">
              <ReactMarkdown>{topic.body}</ReactMarkdown>
            </div>
            {author && <UserSignature user={author} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}