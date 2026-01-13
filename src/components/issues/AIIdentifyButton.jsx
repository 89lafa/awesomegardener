import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import DiseaseIdentifier from '@/components/myplants/DiseaseIdentifier';

export default function AIIdentifyButton({ imageUrl, plantCommonName, onSaveIssue }) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Sparkles className="w-4 h-4" />
        AI Identify
      </Button>

      <DiseaseIdentifier
        open={showDialog}
        onOpenChange={setShowDialog}
        imageUrl={imageUrl}
        plantCommonName={plantCommonName}
        onSaveToIssues={onSaveIssue}
      />
    </>
  );
}