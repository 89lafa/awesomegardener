import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  ArrowLeft,
  Loader2,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Messages() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newThreadData, setNewThreadData] = useState({
    recipient_email: '',
    subject: '',
    body: ''
  });

  useEffect(() => {
    loadData();
    
    // Check URL params for pre-filled recipient
    const urlParams = new URLSearchParams(window.location.search);
    const recipientParam = urlParams.get('to');
    if (recipientParam) {
      setNewThreadData(prev => ({ ...prev, recipient_email: recipientParam }));
      setShowNewMessage(true);
    }
  }, []);

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread);
    }
  }, [selectedThread]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // Load all messages where user is sender or recipient
      const allMessages = await base44.entities.Message.filter({});
      
      const userMessages = allMessages.filter(m => 
        (m.sender_email === userData.email && !m.deleted_by_sender) ||
        (m.recipient_email === userData.email && !m.deleted_by_recipient)
      );

      // Group by thread_id
      const threadMap = new Map();
      userMessages.forEach(msg => {
        const threadId = msg.thread_id;
        if (!threadMap.has(threadId)) {
          threadMap.set(threadId, []);
        }
        threadMap.get(threadId).push(msg);
      });

      // Create thread objects
      const threadsList = Array.from(threadMap.entries()).map(([threadId, msgs]) => {
        const sorted = msgs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        const latest = sorted[0];
        const otherUser = latest.sender_email === userData.email ? latest.recipient_email : latest.sender_email;
        const unreadCount = msgs.filter(m => !m.is_read && m.recipient_email === userData.email).length;

        return {
          thread_id: threadId,
          latest_message: latest,
          other_user: otherUser,
          subject: latest.subject || 'No subject',
          unread_count: unreadCount,
          message_count: msgs.length,
          updated_date: latest.created_date
        };
      });

      threadsList.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
      setThreads(threadsList);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (thread) => {
    try {
      const allMessages = await base44.entities.Message.filter({ thread_id: thread.thread_id });
      const sorted = allMessages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setMessages(sorted);

      // Mark as read
      const unreadMessages = sorted.filter(m => !m.is_read && m.recipient_email === user.email);
      for (const msg of unreadMessages) {
        await base44.entities.Message.update(msg.id, { 
          is_read: true, 
          read_at: new Date().toISOString() 
        });
      }

      // Update thread unread count
      setThreads(threads.map(t => 
        t.thread_id === thread.thread_id ? { ...t, unread_count: 0 } : t
      ));
    } catch (error) {
      console.error('Error loading thread messages:', error);
    }
  };

  const handleSendReply = async () => {
    if (!newMessage.trim() || !selectedThread) return;

    setSending(true);
    try {
      const latest = messages[messages.length - 1];
      const recipientEmail = latest.sender_email === user.email ? latest.recipient_email : latest.sender_email;

      const message = await base44.entities.Message.create({
        thread_id: selectedThread.thread_id,
        sender_email: user.email,
        recipient_email: recipientEmail,
        subject: selectedThread.subject,
        body: newMessage,
        is_admin_message: user.role === 'admin' || recipientEmail === 'admin'
      });

      // Create notification for recipient
      await base44.entities.Notification.create({
        user_email: recipientEmail,
        type: 'message',
        title: `New message from ${user.nickname || user.email}`,
        body: newMessage.substring(0, 100),
        link_url: `/Messages?thread=${selectedThread.thread_id}`,
        related_id: message.id,
        related_type: 'message'
      });

      setMessages([...messages, message]);
      setNewMessage('');
      toast.success('Message sent');
      loadData();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleNewThread = async () => {
    if (!newThreadData.body.trim() || !newThreadData.recipient_email) {
      toast.error('Please fill in recipient and message');
      return;
    }

    setSending(true);
    try {
      let recipientEmail = newThreadData.recipient_email.trim();
      
      // Check if input is a nickname (no @ symbol)
      if (!recipientEmail.includes('@')) {
        const { data: nicknameResult } = await base44.functions.invoke('findUserByNickname', { 
          nickname: recipientEmail 
        });
        
        if (!nicknameResult.found) {
          toast.error('User with that nickname not found');
          setSending(false);
          return;
        }
        
        recipientEmail = nicknameResult.email;
      }
      
      // Check if recipient allows messages (unless they're admin)
      const recipients = await base44.entities.User.filter({ email: recipientEmail });
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

      const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const message = await base44.entities.Message.create({
        thread_id: threadId,
        sender_email: user.email,
        recipient_email: recipientEmail,
        subject: newThreadData.subject || 'No subject',
        body: newThreadData.body,
        is_admin_message: user.role === 'admin' || recipientEmail === 'admin'
      });

      // Create notification
      await base44.entities.Notification.create({
        user_email: recipientEmail,
        type: 'message',
        title: `New message from ${user.nickname || user.email}`,
        body: newThreadData.body.substring(0, 100),
        link_url: `/Messages?thread=${threadId}`,
        related_id: message.id,
        related_type: 'message'
      });

      setShowNewMessage(false);
      setNewThreadData({ recipient_email: '', subject: '', body: '' });
      toast.success('Message sent');
      await loadData();
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteThread = async (thread) => {
    if (!confirm('Delete this conversation?')) return;

    try {
      const threadMessages = await base44.entities.Message.filter({ thread_id: thread.thread_id });
      for (const msg of threadMessages) {
        const updateData = msg.sender_email === user.email 
          ? { deleted_by_sender: true }
          : { deleted_by_recipient: true };
        await base44.entities.Message.update(msg.id, updateData);
      }

      setThreads(threads.filter(t => t.thread_id !== thread.thread_id));
      if (selectedThread?.thread_id === thread.thread_id) {
        setSelectedThread(null);
      }
      toast.success('Conversation deleted');
    } catch (error) {
      console.error('Error deleting thread:', error);
      toast.error('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600">Connect with other gardeners and admins</p>
        </div>
        <Button 
          onClick={() => setShowNewMessage(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Send className="w-4 h-4" />
          New Message
        </Button>
      </div>

      <div className="grid lg:grid-cols-[350px_1fr] gap-6">
        {/* Threads List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-280px)]">
              {threads.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No messages yet</p>
              ) : (
                <div className="space-y-2">
                  {threads.map(thread => (
                    <button
                      key={thread.thread_id}
                      onClick={() => setSelectedThread(thread)}
                      className={cn(
                        "w-full p-3 rounded-lg border-2 text-left transition-colors",
                        selectedThread?.thread_id === thread.thread_id
                          ? "bg-emerald-50 border-emerald-500"
                          : "bg-white border-gray-200 hover:border-emerald-300"
                      )}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {thread.latest_message.is_admin_message && (
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          )}
                          <p className="font-semibold text-sm truncate">{thread.other_user}</p>
                        </div>
                        {thread.unread_count > 0 && (
                          <Badge className="bg-emerald-600">{thread.unread_count}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 truncate mb-1">{thread.subject}</p>
                      <p className="text-xs text-gray-500">{format(new Date(thread.updated_date), 'MMM d, h:mm a')}</p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Thread View */}
        <Card>
          {selectedThread ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedThread(null)}
                      className="mb-2 -ml-2"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    <CardTitle className="text-lg">{selectedThread.subject}</CardTitle>
                    <p className="text-sm text-gray-600">
                      with {selectedThread.other_user}
                      {selectedThread.latest_message.is_admin_message && (
                        <Badge variant="outline" className="ml-2">Admin</Badge>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteThread(selectedThread)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-420px)] p-6">
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isOwnMessage = msg.sender_email === user.email;
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex gap-3",
                            isOwnMessage ? "justify-end" : "justify-start"
                          )}
                        >
                          {!isOwnMessage && (
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <UserIcon className="w-4 h-4 text-emerald-600" />
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[70%] rounded-lg p-3",
                              isOwnMessage
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 text-gray-900"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                            <p className={cn(
                              "text-xs mt-2",
                              isOwnMessage ? "text-emerald-100" : "text-gray-500"
                            )}>
                              {format(new Date(msg.created_date), 'MMM d, h:mm a')}
                            </p>
                          </div>
                          {isOwnMessage && (
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                              <UserIcon className="w-4 h-4 text-gray-600" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      className="flex-1 min-h-[80px]"
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={sending || !newMessage.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[calc(100vh-280px)]">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a conversation to view messages</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* New Message Dialog */}
      <Dialog open={showNewMessage} onOpenChange={setShowNewMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">To (nickname or email)</label>
              <Input
                placeholder="Enter nickname (e.g., 'john123') or email"
                value={newThreadData.recipient_email}
                onChange={(e) => setNewThreadData({ ...newThreadData, recipient_email: e.target.value })}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                You can send to a user's nickname or email address
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input
                placeholder="What's this about?"
                value={newThreadData.subject}
                onChange={(e) => setNewThreadData({ ...newThreadData, subject: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Type your message..."
                value={newThreadData.body}
                onChange={(e) => setNewThreadData({ ...newThreadData, body: e.target.value })}
                className="mt-2"
                rows={6}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowNewMessage(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleNewThread}
              disabled={sending || !newThreadData.body.trim() || !newThreadData.recipient_email}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Message'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}