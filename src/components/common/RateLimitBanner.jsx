import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function RateLimitBanner({ retryInMs, onRetry, retrying = false }) {
  const seconds = Math.ceil((retryInMs || 0) / 1000);
  
  return (
    <Alert className="bg-amber-50 border-amber-300">
      <AlertCircle className="w-4 h-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div>
          <span className="font-medium text-amber-900">We're getting a lot of requests.</span>
          <span className="text-amber-800"> Retrying automatically in {seconds} second{seconds !== 1 ? 's' : ''}...</span>
        </div>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={retrying}
            className="border-amber-400 text-amber-700 hover:bg-amber-100 flex-shrink-0"
          >
            {retrying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Retry Now
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}