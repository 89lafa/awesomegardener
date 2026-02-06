import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Minimize2, Loader2, MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

const PAGE_SUGGESTIONS = {
  '/Dashboard': [
    'When should I start seeds indoors?',
    'What can I plant now in my zone?',
    'How to plan my first garden?',
    'Best vegetables for beginners?'
  ],
  '/SeedStash': [
    'How should I store seeds long-term?',
    'How to test if old seeds are good?',
    "What's the best seed starting mix?",
    'When do seeds expire?'
  ],
  '/MyPlants': [
    'Why are my leaves turning yellow?',
    'How often should I water tomatoes?',
    'When is the best time to fertilize?',
    'How to identify plant diseases?'
  ],
  '/Calendar': [
    'How do I calculate frost dates?',
    'What is succession planting?',
    'When to start seeds indoors vs direct sow?',
    'How to plan year-round harvest?'
  ],
  '/GardenPlanting': [
    'What spacing between plants?',
    'Which plants grow well together?',
    'How to design efficient layout?',
    'Square foot gardening guidelines?'
  ]
};

export default function QuickHelpWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const location = useLocation();

  const suggestions = PAGE_SUGGESTIONS[location.pathname] || [
    'Ask me anything about gardening!',
    'Need help with planning?',
    'Questions about plants?',
    'Troubleshooting an issue?'
  ];

  const handleSuggestionClick = async (question) => {
    setIsLoading(true);
    setAnswer(null);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Answer this gardening question briefly (under 150 words): ${question}`
      });

      // InvokeLLM returns a string directly when no response_json_schema is provided
      const answerText = typeof response === 'string' ? response : response.data;
      
      if (!answerText || answerText.trim() === '') {
        toast.error('Received empty response from AI');
        return;
      }

      setAnswer({ question, response: answerText });
    } catch (error) {
      console.error('Quick help error:', error);
      toast.error('Failed to get answer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomQuestion = async () => {
    if (!customQuestion.trim()) return;
    await handleSuggestionClick(customQuestion);
    setCustomQuestion('');
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-6 right-6 z-30 hidden lg:block">
        <Button
          onClick={() => setIsExpanded(true)}
          className="bg-white shadow-lg rounded-full px-4 py-3 flex items-center gap-2 hover:shadow-xl transition border border-emerald-200"
          variant="outline"
        >
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <span className="font-medium text-gray-900">Need Help?</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-30 w-96 hidden lg:block">
      <div className="bg-white shadow-2xl rounded-lg overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-emerald-600 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold">Quick Help</span>
          </div>
          <button onClick={() => setIsExpanded(false)} className="hover:opacity-80">
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {!answer ? (
            <>
              <p className="text-sm text-gray-600 mb-3">Quick answers for this page:</p>
              <div className="space-y-2">
                {suggestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(q)}
                    disabled={isLoading}
                    className="w-full text-left text-sm p-3 rounded-lg bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 transition disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t">
                <Label className="text-xs text-gray-600">Or ask your own:</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Type your question..."
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomQuestion()}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleCustomQuestion} disabled={!customQuestion.trim() || isLoading}>
                    Ask
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  {answer.question}
                </p>
                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border">
                  {answer.response}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAnswer(null)}
                className="w-full"
              >
                ← Ask another question
              </Button>
            </>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Thinking...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 bg-gray-50 text-center">
          <a
            href="/AIAssistants"
            className="text-sm text-emerald-600 hover:underline flex items-center justify-center gap-1 mx-auto"
          >
            <MessageCircle className="w-3 h-3" />
            Open full AI Assistants for more help
          </a>
        </div>
      </div>
    </div>
  );
}