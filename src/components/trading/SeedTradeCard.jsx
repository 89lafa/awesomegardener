import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

export function SeedTradeCard({ trade, onAccept, onReject, onMessage, isInitiator }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">
              {isInitiator ? 'Trading To' : 'Trade From'}: {isInitiator ? trade.recipient_id : trade.initiator_id}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Proposed {format(new Date(trade.created_date), 'MMM d, yyyy')}
            </p>
          </div>
          <Badge className={getStatusColor(trade.status)}>
            {trade.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Offered Seeds */}
        <div>
          <h4 className="font-medium text-sm text-gray-900 mb-2">
            {isInitiator ? 'Offering' : 'Requesting'}
          </h4>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            {trade.initiator_seeds?.map((seed, idx) => (
              <div key={idx} className="text-gray-700">
                • {seed.variety_name || 'Variety'} ({seed.quantity})
              </div>
            ))}
          </div>
        </div>

        {/* Requested Seeds */}
        <div>
          <h4 className="font-medium text-sm text-gray-900 mb-2">
            {isInitiator ? 'Requesting' : 'Offering'}
          </h4>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            {trade.recipient_seeds?.map((seed, idx) => (
              <div key={idx} className="text-gray-700">
                • {seed.variety_name || 'Variety'} ({seed.quantity})
              </div>
            ))}
          </div>
        </div>

        {/* Message */}
        {trade.message && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">{trade.message}</p>
          </div>
        )}

        {/* Actions */}
        {trade.status === 'pending' && !isInitiator && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => onAccept?.(trade.id)}
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              Accept
            </Button>
            <Button
              onClick={() => onReject?.(trade.id)}
              variant="outline"
              className="flex-1 gap-2"
            >
              <XCircle className="w-4 h-4" />
              Decline
            </Button>
          </div>
        )}

        {(trade.status === 'accepted' || trade.status === 'pending') && (
          <Button
            onClick={() => onMessage?.(trade)}
            variant="outline"
            className="w-full gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Message
          </Button>
        )}
      </CardContent>
    </Card>
  );
}