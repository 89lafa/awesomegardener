import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Send, Search, Loader2, Mail, MailOpen, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newThread, setNewThread] = useState({
    recipient_email: '',
    subject: '',
    body: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const threadId = searchParams.get('threadId');
    if (threadId && threads.length > 0) {
      const thread = threads.find(t => t.id === threadId);
      if (thread) {
        selectThread(thread);
      }
    }
  }, [searchParams, threads]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // Load all messages where user is sender or recipient
      const [sent, received] = await Promise.all([
        base44.entities.Message.filter({ 
          sender_email: userData.email,
          deleted_by_sender: false
        }, '-created_date'),
        base44.entities.Message.filter({ 
          recipient_email: userData.email,
          deleted_by_recipient: false
        }, '-created_date')
      ]);

      // Group into threads
      const allMessages = [...sent, ...received];
      const threadMap = new Map();

      allMessages.forEach(msg => {
        if (!msg.thread_id) return;
        
        if (!threadMap.has(msg.thread_id)) {
          threadMap.set(msg.thread_id, {
            id: msg.thread_id,
            subject: msg.subject || 'No Subject',
            last_message: msg,
            unread_count: 0,
            messages: []
          });
        }
        
        const thread = threadMap.get(msg.thread_id);
        thread.messages.push(msg);
        
        // Update last message
        if (new Date(msg.created_date) > new Date(thread.last_message.created_date)) {
          thread.last_message = msg;
        }
        
        // Count unread
        if (msg.recipient_email === userData.email && !msg.is_read) {
          thread.unread_count++;
        }
      });

      const threadsList = Array.from(threadMap.values()).sort((a, b) => 
        new Date(b.last_message.created_date) - new Date(a.last_message.created_date)
      );

      setThreads(threadsList);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const selectThread = async (thread) => {
    setSelectedThread(thread);
    setMessages(thread.messages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));

    // Mark messages as read
    const unreadMessages = thread.messages.filter(m => 
      m.recipient_email === user.email && !m.is_read
    );

    for (const msg of unreadMessages) {
      try {
        await base44.entities.Message.update(msg.id, { 
          is_read: true,
          read_at: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }

    // Update local state
    setThreads(threads.map(t => 
      t.id === thread.id ? { ...t, unread_count: 0 } : t
    ));
  };

  const sendReply = async () => {
    if (!newMessage.trim() || !selectedThread) return;

    setSending(true);
    try {
      const lastMsg = selectedThread.last_message;
      const recipientEmail = lastMsg.sender_email === user.email 
        ? lastMsg.recipient_email 
        : lastMsg.sender_email;

      const msg = await base44.entities.Message.create({
        thread_id: selectedThread.id,
        sender_email: user.email,
        recipient_email: recipientEmail,
        subject: selectedThread.subject,
        body: newMessage,
        is_admin_message: user.role === 'admin'
      });

      // Create notification for recipient
      await base44.entities.Notification.create({
        user_email: recipientEmail,
        type: 'message',
        title: 'New message',
        body: `${user.full_name} sent you a message`,
        link_url: `/Messages?threadId=${selectedThread.id}`,
        related_id: msg.id,
        related_type: 'message'
      });

      setMessages([...messages, msg]);
      setNewMessage('');
      toast.success('Message sent');
      await loadData();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const startNewThread = async () => {
    if (!newThread.recipient_email || !newThread.body.trim()) {
      toast.error('Recipient and message are required');
      return;
    }

    setSending(true);
    try {
      // Check if recipient allows messages (unless admin)
      if (user.role !== 'admin') {
        const recipients = await base44.entities.User.filter({ email: newThread.recipient_email });
        if (recipients.length === 0) {
          toast.error('User not found');
          setSending(false);
          return;
        }
        
        const recipient = recipients[0];
        if (recipient.allow_messages === false && recipient.role !== 'admin') {
          toast.error('This user has disabled messages');
          setSending(false);
          return;
        }
      }

      const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const msg = await base44.entities.Message.create({
        thread_id: threadId,
        sender_email: user.email,
        recipient_email: newThread.recipient_email,
        subject: newThread.subject || 'No Subject',
        body: newThread.body,
        is_admin_message: user.role === 'admin'
      });

      // Create notification
      await base44.entities.Notification.create({
        user_email: newThread.recipient_email,
        type: 'message',
        title: 'New message',
        body: `${user.full_name} sent you a message`,
        link_url: `/Messages?threadId=${threadId}`,
        related_id: msg.id,
        related_type: 'message'
      });

      setShowNewDialog(false);
      setNewThread({ recipient_email: '', subject: '', body: '' });
      toast.success('Message sent');
      await loadData();
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getOtherParty = (thread) => {
    const lastMsg = thread.last_message;
    return lastMsg.sender_email === user.email 
      ? lastMsg.recipient_email 
      : lastMsg.sender_email;
  };

  const filteredThreads = threads.filter(thread => {
    if (!searchQuery) return true;
    const otherParty = getOtherParty(thread);
    return otherParty.toLowerCase().includes(searchQuery.toLowerCase()) ||
           thread.subject.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <Button onClick={() => setShowNewDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" />
          New Message
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Threads List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {filteredThreads.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredThreads.map(thread => (
                    <button
                      key={thread.id}
                      onClick={() => selectThread(thread)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-gray-50 transition-colors",
                        selectedThread?.id === thread.id && "bg-emerald-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {thread.unread_count > 0 ? (
                              <Mail className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <MailOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            )}
                            <p className={cn(
                              "text-sm truncate",
                              thread.unread_count > 0 ? "font-semibold" : "font-medium"
                            )}>
                              {getOtherParty(thread)}
                            </p>
                            {thread.last_message.is_admin_message && (
                              <ShieldCheck className="w-3 h-3 text-blue-600 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-600 truncate mt-1">{thread.subject}</p>
                          <p className="text-xs text-gray-500 truncate mt-1">
                            {thread.last_message.body.substring(0, 50)}...
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {moment(thread.last_message.created_date).fromNow()}
                          </span>
                          {thread.unread_count > 0 && (
                            <Badge className="bg-emerald-600">{thread.unread_count}</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="lg:col-span-2">
          {selectedThread ? (
            <>
              <CardHeader>
                <CardTitle>{selectedThread.subject}</CardTitle>
                <p className="text-sm text-gray-600">with {getOtherParty(selectedThread)}</p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[450px] mb-4">
                  <div className="space-y-4 pr-4">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={cn(
                          "p-4 rounded-lg max-w-[80%]",
                          msg.sender_email === user.email
                            ? "ml-auto bg-emerald-100"
                            : "bg-gray-100"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs font-semibold text-gray-700">{msg.sender_email}</p>
                          {msg.is_admin_message && (
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                          )}
                          <span className="text-xs text-gray-500 ml-auto">
                            {moment(msg.created_date).format('MMM D, h:mm A')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    className="flex-1 min-h-[80px]"
                  />
                  <Button
                    onClick={sendReply}
                    disabled={sending || !newMessage.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[600px]">
              <div className="text-center text-gray-500">
                <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Select a message to view</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* New Message Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>To (email) *</Label>
              <Input
                placeholder="user@example.com"
                value={newThread.recipient_email}
                onChange={(e) => setNewThread({ ...newThread, recipient_email: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                placeholder="Optional subject"
                value={newThread.subject}
                onChange={(e) => setNewThread({ ...newThread, subject: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                placeholder="Type your message..."
                value={newThread.body}
                onChange={(e) => setNewThread({ ...newThread, body: e.target.value })}
                className="mt-2"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button 
              onClick={startNewThread}
              disabled={sending || !newThread.recipient_email || !newThread.body.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}