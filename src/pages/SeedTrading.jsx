import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SeedTradeCard } from '@/components/trading/SeedTradeCard';
import { Plus, Search, MessageSquare } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SeedTrading() {
  const [user, setUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const allTrades = await base44.entities.SeedTrade.filter({}, '-created_date');
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
      loadData();
    } catch (error) {
      toast.error('Failed to accept trade');
    }
  };

  const handleReject = async (tradeId) => {
    try {
      await base44.entities.SeedTrade.update(tradeId, {
        status: 'rejected'
      });
      toast.success('Trade declined');
      loadData();
    } catch (error) {
      toast.error('Failed to decline trade');
    }
  };

  const handleMessage = (trade) => {
    const otherUserId = trade.initiator_id === user.id ? trade.recipient_id : trade.initiator_id;
    window.location.href = `/Messages?user=${otherUserId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const myInitiated = trades.filter(t => t.initiator_id === user.id);
  const myReceived = trades.filter(t => t.recipient_id === user.id && t.status === 'pending');
  const completed = trades.filter(t => t.status === 'completed' || t.status === 'accepted');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seed Trading</h1>
          <p className="text-gray-600">Browse and exchange seeds with other gardeners</p>
        </div>
        <Button 
          onClick={() => toast.info('Trade proposals coming soon! For now, connect with other gardeners via Messages.')}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Propose Trade
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Search gardeners..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1">
            Pending {myReceived.length > 0 && <Badge className="ml-2 bg-yellow-600">{myReceived.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="my-trades" className="flex-1">
            My Trades ({myInitiated.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">
            Completed ({completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {myReceived.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500">No pending trade requests</p>
              </CardContent>
            </Card>
          ) : (
            myReceived.map(trade => (
              <SeedTradeCard
                key={trade.id}
                trade={trade}
                onAccept={handleAccept}
                onReject={handleReject}
                onMessage={handleMessage}
                isInitiator={false}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="my-trades" className="space-y-4 mt-4">
          {myInitiated.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500">You haven't proposed any trades yet</p>
              </CardContent>
            </Card>
          ) : (
            myInitiated.map(trade => (
              <SeedTradeCard
                key={trade.id}
                trade={trade}
                onMessage={handleMessage}
                isInitiator={true}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-4">
          {completed.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500">No completed trades</p>
              </CardContent>
            </Card>
          ) : (
            completed.map(trade => (
              <SeedTradeCard
                key={trade.id}
                trade={trade}
                onMessage={handleMessage}
                isInitiator={trade.initiator_id === user.id}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}