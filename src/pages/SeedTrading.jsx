import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SeedTradeCard } from '@/components/trading/SeedTradeCard';
import ProposeTradeDialog from '@/components/trading/ProposeTradeDialog';
import { Plus, Search, MessageSquare } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

export default function SeedTrading() {
  const [user, setUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProposeDialog, setShowProposeDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const allTrades = await base44.entities.SeedTrade.filter({}, '-created_date');
      setTrades(allTrades);
    } catch (error) {
      console.error('Error loading trades:', error);
      toast.error('Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  const handleInterest = async (tradeId) => {
    try {
      const trade = trades.find(t => t.id === tradeId);
      const interested = trade.interested_users || [];
      
      // Add current user to interested_users
      interested.push({
        user_id: user.id,
        user_nickname: user.full_name || user.email,
        message: '',
        timestamp: new Date().toISOString()
      });
      
      await base44.entities.SeedTrade.update(tradeId, {
        interested_users: interested,
        status: 'pending' // Move to pending so seller sees it
      });
      
      // Create notification for seller
      await base44.entities.Notification.create({
        user_id: trade.initiator_id,
        type: 'trade_interest',
        title: 'Trade Interest',
        message: `${user.full_name || user.email} is interested in your seed trade offer!`,
        link: createPageUrl('SeedTrading'),
        read: false
      });
      
      toast.success('Interest sent! The seller will review your request.');
      loadData();
    } catch (error) {
      console.error('Error expressing interest:', error);
      toast.error('Failed to send interest');
    }
  };

  const handleAcceptInterest = async (tradeId, interestedUserId) => {
    try {
      await base44.entities.SeedTrade.update(tradeId, {
        status: 'accepted',
        recipient_id: interestedUserId,
        accepted_at: new Date().toISOString()
      });
      
      // Notify the interested user
      await base44.entities.Notification.create({
        user_id: interestedUserId,
        type: 'trade_accepted',
        title: 'Trade Accepted',
        message: 'Your trade interest was accepted!',
        link: createPageUrl('SeedTrading'),
        read: false
      });
      
      toast.success('Trade accepted!');
      loadData();
    } catch (error) {
      console.error('Error accepting interest:', error);
      toast.error('Failed to accept trade');
    }
  };

  const handleRejectInterest = async (tradeId, interestedUserId) => {
    try {
      const trade = trades.find(t => t.id === tradeId);
      const interested = (trade.interested_users || []).filter(u => u.user_id !== interestedUserId);
      
      await base44.entities.SeedTrade.update(tradeId, {
        interested_users: interested,
        status: interested.length > 0 ? 'pending' : 'public' // Back to public if no interested users
      });
      
      toast.success('Interest declined');
      loadData();
    } catch (error) {
      console.error('Error declining interest:', error);
      toast.error('Failed to decline interest');
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
    window.location.href = createPageUrl('Messages') + `?user=${otherUserId}&trade_id=${trade.id}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const myInitiated = trades.filter(t => t.initiator_id === user.id);
  
  // Pending = trades where I'm the seller and someone expressed interest
  const myPendingAsSeller = trades.filter(t => 
    t.initiator_id === user.id && 
    t.status === 'pending' && 
    t.interested_users && 
    t.interested_users.length > 0
  );
  
  const completed = trades.filter(t => t.status === 'completed' || t.status === 'accepted');
  
  // Public offers = not initiated by me, and I haven't expressed interest yet
  const publicOffers = trades.filter(t => 
    t.is_public && 
    t.status === 'public' && 
    t.initiator_id !== user.id &&
    (!t.interested_users || !t.interested_users.some(u => u.user_id === user.id))
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seed Trading</h1>
          <p className="text-gray-600">Browse and exchange seeds with other gardeners</p>
        </div>
        <Button 
          onClick={() => setShowProposeDialog(true)}
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

      <Tabs defaultValue="public">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="public">
            Public Offers ({publicOffers.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending {myPendingAsSeller.length > 0 && <Badge className="ml-2 bg-yellow-600">{myPendingAsSeller.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="my-trades">
            My Trades ({myInitiated.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="public" className="space-y-4 mt-4">
          {publicOffers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500">No public offers available</p>
              </CardContent>
            </Card>
          ) : (
            publicOffers.map(trade => (
              <SeedTradeCard
                key={trade.id}
                trade={trade}
                onInterest={handleInterest}
                onMessage={handleMessage}
                currentUserId={user.id}
                showInterestButton={true}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {myPendingAsSeller.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500">No pending interest from buyers</p>
              </CardContent>
            </Card>
          ) : (
            myPendingAsSeller.map(trade => (
              <SeedTradeCard
                key={trade.id}
                trade={trade}
                onAcceptInterest={handleAcceptInterest}
                onRejectInterest={handleRejectInterest}
                onMessage={handleMessage}
                currentUserId={user.id}
                showInterestManagement={true}
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

      {/* Propose Trade Dialog */}
      <ProposeTradeDialog
        open={showProposeDialog}
        onOpenChange={setShowProposeDialog}
        onSuccess={loadData}
      />
    </div>
  );
}