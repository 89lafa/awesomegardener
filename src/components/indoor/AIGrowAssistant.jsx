import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Check, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AIGrowAssistant({ onClose, context }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [input, setInput] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        setIsListening(false);
        processCommand(finalTranscript);
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      toast.error('Microphone error: ' + event.error);
    };

    return () => recognitionRef.current?.stop();
  }, []);

  const startListening = () => {
    setTranscript('');
    setAiResponse(null);
    setIsListening(true);
    recognitionRef.current?.start();
  };

  const stopListening = () => {
    setIsListening(false);
    recognitionRef.current?.stop();
  };

  const processCommand = async (text) => {
    setProcessing(true);
    
    try {
      // For now, show a simple response
      // In production, call an API endpoint that uses Claude to parse
      const response = {
        success: true,
        message: `Processing: "${text}"`,
        action: 'parse',
        details: ['Ready to execute this command'],
        confirmation: 'Command understood. Ready to proceed.'
      };
      
      setAiResponse(response);
    } catch (error) {
      setAiResponse({
        success: false,
        message: 'Sorry, I couldn\'t understand that command.',
        error: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleTextInput = (text) => {
    if (!text.trim()) return;
    processCommand(text);
    setInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-900">
            🤖 AI Grow Assistant
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Microphone Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={processing}
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center',
              'transition-all duration-300',
              isListening 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700',
              processing ? 'opacity-50' : ''
            )}
          >
            {processing ? (
              <Loader2 size={40} className="animate-spin" />
            ) : isListening ? (
              <MicOff size={40} />
            ) : (
              <Mic size={40} />
            )}
          </button>
        </div>

        <p className="text-center text-gray-700 mb-4">
          {isListening ? '🔴 Listening...' : processing ? '⏳ Processing...' : '👆 Tap to speak'}
        </p>

        {/* Transcript */}
        {transcript && (
          <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
            <p className="text-xs text-blue-700 mb-1 font-medium">You said:</p>
            <p className="font-medium text-gray-900">"{transcript}"</p>
          </div>
        )}

        {/* AI Response */}
        {aiResponse && (
          <div className={cn(
            'rounded-xl p-4 mb-4 border',
            aiResponse.success !== false 
              ? 'bg-emerald-50 border-emerald-300' 
              : 'bg-red-50 border-red-300'
          )}>
            <p className="text-sm font-medium text-gray-900 mb-2">{aiResponse.message}</p>
            
            {aiResponse.details && (
              <div className="text-xs text-gray-700 mb-3 space-y-1">
                {aiResponse.details.map((detail, i) => (
                  <div key={i}>✓ {detail}</div>
                ))}
              </div>
            )}

            {aiResponse.action && (
              <div className="flex gap-2">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <Check size={16} />
                  Confirm
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setAiResponse(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Text Input Alternative */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <p className="text-xs text-gray-700 font-medium mb-2">Or type a command:</p>
          <div className="flex gap-2">
            <Input
              placeholder="Plant 10 Cherokee Purple in Tray 5..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleTextInput(input);
                }
              }}
            />
            <Button 
              onClick={() => handleTextInput(input)}
              variant="outline"
              size="sm"
            >
              →
            </Button>
          </div>
        </div>

        {/* Example Commands */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-700 font-medium mb-2">Example commands:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Plant 10 Cherry Tomato in Tray 5',
              'Mark cells 3-8 as germinated',
              'What needs transplanting?'
            ].map((example, i) => (
              <button
                key={i}
                onClick={() => handleTextInput(example)}
                className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}