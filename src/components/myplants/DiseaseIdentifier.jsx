import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function DiseaseIdentifier({ open, onOpenChange, imageUrl, plantCommonName, onSaveToIssues }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  React.useEffect(() => {
    if (open && imageUrl && !result) {
      analyzeImage();
    }
  }, [open, imageUrl]);

  const analyzeImage = async () => {
    setAnalyzing(true);
    try {
      const response = await base44.functions.invoke('identifyDisease', {
        image_url: imageUrl,
        plant_common_name: plantCommonName
      });

      if (response.data.success) {
        setResult(response.data);
      } else {
        toast.error('Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze image');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Disease & Pest Identification</DialogTitle>
        </DialogHeader>

        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <AlertDescription className="text-sm text-yellow-800">
            This is AI-assisted advisory only. Always verify diagnoses with additional resources.
          </AlertDescription>
        </Alert>

        {analyzing && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
            <p className="text-gray-600">Analyzing image...</p>
          </div>
        )}

        {result && !analyzing && (
          <div className="space-y-4">
            <img src={imageUrl} alt="Plant" className="w-full rounded-lg border" />

            {result.is_healthy ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800">
                  Plant appears healthy! No obvious issues detected.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold">Potential Issues Detected:</h3>
                {result.issues?.map((issue, idx) => (
                  <Card key={idx}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{issue.name}</div>
                        <Badge variant={
                          issue.confidence === 'high' ? 'default' :
                          issue.confidence === 'medium' ? 'secondary' : 'outline'
                        }>
                          {issue.confidence} confidence
                        </Badge>
                      </div>
                      {issue.type && <p className="text-sm text-gray-600">{issue.type}</p>}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {issue.symptoms && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Symptoms:</p>
                          <p className="text-sm text-gray-600">{issue.symptoms}</p>
                        </div>
                      )}
                      {issue.recommendations && issue.recommendations.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Recommended Actions:</p>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {issue.recommendations.map((rec, i) => (
                              <li key={i}>• {rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {result.general_notes && (
              <div>
                <p className="text-sm font-medium text-gray-700">Additional Notes:</p>
                <p className="text-sm text-gray-600 mt-1">{result.general_notes}</p>
              </div>
            )}

            {onSaveToIssues && !result.is_healthy && (
              <Button
                onClick={() => {
                  onSaveToIssues(result);
                  handleClose();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                Save to Issues Log
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}