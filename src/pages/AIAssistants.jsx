import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bot, Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export default function AIAssistants() {
  const [activeAgent, setActiveAgent] = useState('indoor_grow_assistant');
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user && activeAgent) {
      loadOrCreateConversation();
    }
  }, [user, activeAgent]);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const loadOrCreateConversation = async () => {
    try {
      // Try to find existing conversation
      const conversations = await base44.agents.listConversations({
        agent_name: activeAgent
      });

      if (conversations.length > 0) {
        const conv = await base44.agents.getConversation(conversations[0].id);
        setConversation(conv);
        setMessages(conv.messages || []);
      } else {
        // Create new conversation
        const newConv = await base44.agents.createConversation({
          agent_name: activeAgent,
          metadata: {
            name: 'Indoor Grow Session',
            description: 'AI-assisted indoor growing'
          }
        });
        setConversation(newConv);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Failed to load conversation');
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !conversation || loading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    try {
      // Add user message to UI immediately
      const newUserMessage = {
        role: 'user',
        content: userMessage
      };
      setMessages(prev => [...prev, newUserMessage]);

      // Send to agent
      await base44.agents.addMessage(conversation, newUserMessage);

      // Subscribe to updates for streaming response
      const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
        setMessages(data.messages);
      });

      // Wait a bit for the response to come through
      await new Promise(resolve => setTimeout(resolve, 2000));
      unsubscribe();

      // Refresh conversation to get final state
      const updated = await base44.agents.getConversation(conversation.id);
      setMessages(updated.messages || []);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const agents = [
    {
      id: 'indoor_grow_assistant',
      name: 'Indoor Grow Assistant',
      description: 'Plant seeds, manage trays, organize containers',
      icon: '🌱',
      color: 'bg-green-100 text-green-800'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">AI Assistants</h1>
        <p className="text-gray-600">Get help from specialized AI assistants for different gardening tasks</p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Agent Selection */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-gray-700 mb-3">Available Assistants</h3>
          {agents.map(agent => (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-all ${
                activeAgent === agent.id ? 'ring-2 ring-emerald-500 shadow-md' : 'hover:shadow-md'
              }`}
              onClick={() => setActiveAgent(agent.id)}
            >
              <CardHeader className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{agent.icon}</span>
                  <Badge className={agent.color}>Active</Badge>
                </div>
                <CardTitle className="text-sm">{agent.name}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {agent.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Chat Interface */}
        <div className="md:col-span-3">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {agents.find(a => a.id === activeAgent)?.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    AI-powered gardening assistant
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <Sparkles className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                    <p className="text-gray-600 mb-2">Start a conversation</p>
                    <p className="text-sm text-gray-500">
                      Try: "Plant all hot pepper seeds in Rack 1 Shelf 1 Tray 1"
                    </p>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300/30">
                          <p className="text-xs opacity-75">
                            🛠️ Used {msg.tool_calls.length} tool{msg.tool_calls.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask me anything about your indoor grow space..."
                  className="resize-none"
                  rows={3}
                  disabled={loading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || loading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}