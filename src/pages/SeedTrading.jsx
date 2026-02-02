import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeedTradeCard } from '@/components/trading/SeedTradeCard';
import { Plus, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SeedTrading() {
  const [user, setUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProposal, setShowProposal] = useState(false);

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const allTrades = await base44.entities.SeedTrade.filter({});
      const userTrades = allTrades.filter(t =>
        t.initiator_id === userData.id || t.recipient_id === userData.id
      );

      setTrades(userTrades);
    } catch (error) {
      console.error('Error loading trades:', error);
      toast.error('Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (tradeId) => {
    try {
      await base44.entities.SeedTrade.update(tradeId, {
        status: 'accepted',
        accepted_at: new Date().toISOString()
      });
      toast.success('Trade accepted!');
      loadTrades();
    } catch (error) {
      toast.error('Failed to accept trade');
    }
  };

  const handleReject = async (tradeId) => {
    try {
      await base44.entities.SeedTrade.update(tradeId, {
        status: 'rejected'
      });
      toast.success('Trade rejected');
      loadTrades();
    } catch (error) {
      toast.error('Failed to reject trade');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const incomingTrades = trades.filter(t => t.recipient_id === user?.id && t.status === 'pending');
  const outgoingTrades = trades.filter(t => t.initiator_id === user?.id);
  const completedTrades = trades.filter(t => ['accepted', 'completed'].includes(t.status));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seed Trading</h1>
          <p className="text-gray-600">Propose and manage seed trades with gardeners</p>
        </div>
        <Button
          onClick={() => setShowProposal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Propose Trade
        </Button>
      </div>

      <Tabs defaultValue="incoming">
        <TabsList className="w-full">
          <TabsTrigger value="incoming" className="flex-1">
            Incoming {incomingTrades.length > 0 && `(${incomingTrades.length})`}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="flex-1">
            Outgoing
          </TabsTrigger>
          <TabsTrigger value="active" className="flex-1">
            Active
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="mt-4 space-y-4">
          {incomingTrades.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500">No incoming trade proposals</p>
              </CardContent>
            </Card>
          ) : (
            incomingTrades.map(trade => (
              <SeedTradeCard
                key={trade.id}
                trade={trade}
                isInitiator={false}
                onAccept={handleAccept}
                onReject={handleReject}
                onMessage={(t) => window.location.href = `/Messages?trade=${t.id}`}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="mt-4 space-y-4">
          {outgoingTrades.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500">No outgoing proposals</p>
              </CardContent>
            </Card>
          ) : (
            outgoingTrades.map(trade => (
              <SeedTradeCard
                key={trade.id}
                trade={trade}
                isInitiator={true}
                onMessage={(t) => window.location.href = `/Messages?trade=${t.id}`}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-4 space-y-4">
          {completedTrades.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500">No active trades</p>
              </CardContent>
            </Card>
          ) : (
            completedTrades.map(trade => (
              <SeedTradeCard
                key={trade.id}
                trade={trade}
                isInitiator={trade.initiator_id === user?.id}
                onMessage={(t) => window.location.href = `/Messages?trade=${t.id}`}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}