import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import QuickCheckInModal from '@/components/ai/QuickCheckInModal';

export default function QuickCheckInWidget({ loadDelay = 0 }) {
  const [checkInOpen, setCheckInOpen] = useState(false);

  return (
    <>
      <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => setCheckInOpen(true)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Quick Check-In
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Log today's garden activities in seconds
          </p>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
            Check In Now
          </Button>
        </CardContent>
      </Card>

      <QuickCheckInModal
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
      />
    </>
  );
}