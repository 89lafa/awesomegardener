import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ProposeTradeDialog({ open, onOpenChange, onSuccess }) {
  const [users, setUsers] = useState([]);
  const [recipientNickname, setRecipientNickname] = useState('');
  const [offering, setOffering] = useState([{ variety_name: '', quantity: '', notes: '' }]);
  const [requesting, setRequesting] = useState([{ variety_name: '', quantity: '', notes: '' }]);
  const [tradeNotes, setTradeNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const allUsers = await base44.entities.User.list();
      const currentUser = await base44.auth.me();
      // Filter out current user and users without nicknames
      const tradableUsers = allUsers.filter(u => 
        u.id !== currentUser.id && u.nickname
      );
      setUsers(tradableUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const addOfferingRow = () => {
    setOffering([...offering, { variety_name: '', quantity: '', notes: '' }]);
  };

  const removeOfferingRow = (index) => {
    setOffering(offering.filter((_, i) => i !== index));
  };

  const updateOffering = (index, field, value) => {
    const updated = [...offering];
    updated[index][field] = value;
    setOffering(updated);
  };

  const addRequestingRow = () => {
    setRequesting([...requesting, { variety_name: '', quantity: '', notes: '' }]);
  };

  const removeRequestingRow = (index) => {
    setRequesting(requesting.filter((_, i) => i !== index));
  };

  const updateRequesting = (index, field, value) => {
    const updated = [...requesting];
    updated[index][field] = value;
    setRequesting(updated);
  };

  const handleSubmit = async () => {
    if (!recipientNickname) {
      toast.error('Please select a gardener');
      return;
    }

    const validOffering = offering.filter(o => o.variety_name.trim());
    const validRequesting = requesting.filter(r => r.variety_name.trim());

    if (validOffering.length === 0) {
      toast.error('Please add at least one seed to offer');
      return;
    }

    if (validRequesting.length === 0) {
      toast.error('Please add at least one seed to request');
      return;
    }

    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      
      const isPublicTrade = recipientNickname === 'anybody';
      let recipient = null;
      
      if (!isPublicTrade) {
        recipient = users.find(u => u.nickname === recipientNickname);
        if (!recipient) {
          toast.error('Selected gardener not found');
          return;
        }
      }

      await base44.entities.SeedTrade.create({
        initiator_id: currentUser.id,
        initiator_nickname: currentUser.nickname,
        recipient_id: isPublicTrade ? null : recipient.id,
        recipient_nickname: isPublicTrade ? 'anybody' : recipient.nickname,
        offering_seeds: validOffering,
        requesting_seeds: validRequesting,
        trade_notes: tradeNotes,
        status: isPublicTrade ? 'public' : 'pending',
        is_public: isPublicTrade
      });

      toast.success(isPublicTrade ? 'Public trade posted!' : 'Trade proposal sent!');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error proposing trade:', error);
      toast.error('Failed to propose trade');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRecipientNickname('');
    setOffering([{ variety_name: '', quantity: '', notes: '' }]);
    setRequesting([{ variety_name: '', quantity: '', notes: '' }]);
    setTradeNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Propose Seed Trade</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Selection */}
          <div>
            <Label>Trade With</Label>
            <Select value={recipientNickname} onValueChange={setRecipientNickname}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={loadingUsers ? "Loading gardeners..." : "Select a gardener"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anybody">🌍 Anybody (Public Post)</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.nickname}>
                    {user.nickname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* What I'm Offering */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>I'm Offering</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addOfferingRow}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {offering.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <Input
                    placeholder="Variety name"
                    value={item.variety_name}
                    onChange={(e) => updateOffering(index, 'variety_name', e.target.value)}
                  />
                  <Input
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(e) => updateOffering(index, 'quantity', e.target.value)}
                  />
                  {offering.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOfferingRow(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* What I Want */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>I'm Looking For</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addRequestingRow}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {requesting.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <Input
                    placeholder="Variety name"
                    value={item.variety_name}
                    onChange={(e) => updateRequesting(index, 'variety_name', e.target.value)}
                  />
                  <Input
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(e) => updateRequesting(index, 'quantity', e.target.value)}
                  />
                  {requesting.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRequestingRow(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Additional Notes (Optional)</Label>
            <Textarea
              className="mt-2"
              placeholder="Any additional information about this trade..."
              value={tradeNotes}
              onChange={(e) => setTradeNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sending...
              </>
            ) : 'Send Proposal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}