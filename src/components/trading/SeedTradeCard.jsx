import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, MessageSquare, Package } from 'lucide-react';
import { format } from 'date-fns';

export function SeedTradeCard({ trade, onAccept, onReject, onMessage, isInitiator }) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {isInitiator ? `Trade with ${trade.recipient_nickname}` : `Trade from ${trade.initiator_nickname}`}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {format(new Date(trade.created_date), 'MMM d, yyyy')}
            </p>
          </div>
          <Badge className={statusColors[trade.status]}>
            {trade.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Offering */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
            <Package className="w-4 h-4" />
            {isInitiator ? "You're Offering" : "They're Offering"}
          </h4>
          <div className="space-y-1">
            {trade.offering_seeds?.map((seed, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                <span className="text-sm">{seed.variety_name}</span>
                <span className="text-sm text-gray-600">{seed.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Requesting */}
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
            <Package className="w-4 h-4" />
            {isInitiator ? "You're Looking For" : "They're Looking For"}
          </h4>
          <div className="space-y-1">
            {trade.requesting_seeds?.map((seed, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                <span className="text-sm">{seed.variety_name}</span>
                <span className="text-sm text-gray-600">{seed.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {trade.trade_notes && (
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-sm text-gray-700">{trade.trade_notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {!isInitiator && trade.status === 'pending' && (
            <>
              <Button
                onClick={() => onAccept(trade.id)}
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
              >
                <Check className="w-4 h-4" />
                Accept Trade
              </Button>
              <Button
                onClick={() => onReject(trade.id)}
                variant="outline"
                className="flex-1 text-red-600 border-red-300 hover:bg-red-50 gap-2"
              >
                <X className="w-4 h-4" />
                Decline
              </Button>
            </>
          )}
          {trade.is_public && trade.status === 'public' && !isInitiator && (
            <Button
              onClick={() => onAccept(trade.id)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Check className="w-4 h-4" />
              I'm Interested
            </Button>
          )}
          {(trade.status === 'accepted' || trade.status === 'pending') && (
            <Button
              onClick={() => onMessage(trade)}
              variant="outline"
              className="flex-1 gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Send Private Message
            </Button>
          )}
          {trade.is_public && trade.status === 'public' && isInitiator && (
            <Badge className="bg-blue-100 text-blue-800 px-3 py-1">
              Public - waiting for interest
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}