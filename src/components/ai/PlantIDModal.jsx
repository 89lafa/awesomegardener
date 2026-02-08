import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, Loader2, Leaf, Eye, Plus } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function PlantIDModal({ open, onOpenChange }) {
  const [step, setStep] = useState('capture');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handlePhotoUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setStep('analyzing');
      setAnalyzing(true);

      const { data } = await base44.functions.invoke('identifyPlant', {
        photo_url: file_url
      });

      setResult(data.result);
      setStep('results');
      toast.success('Plant identified!');
    } catch (error) {
      console.error('Plant ID error:', error);
      toast.error('Failed to identify plant: ' + error.message);
      setStep('capture');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoUpload(file);
    }
  };

  const getConfidenceBadge = (level) => {
    if (level >= 85) return <Badge className="bg-green-100 text-green-800">High Confidence</Badge>;
    if (level >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge className="bg-orange-100 text-orange-800">Low</Badge>;
  };

  const resetModal = () => {
    setStep('capture');
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-emerald-600" />
            What Plant Is This?
          </DialogTitle>
        </DialogHeader>

        {step === 'capture' && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                📸 Upload a clear photo showing leaves, flowers, or fruit for best results
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-32 flex-col gap-2"
                onClick={() => document.getElementById('photo-upload-id').click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                ) : (
                  <>
                    <Camera className="w-8 h-8" />
                    <span>Take Photo</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="h-32 flex-col gap-2"
                onClick={() => document.getElementById('photo-upload-id').click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                ) : (
                  <>
                    <Upload className="w-8 h-8" />
                    <span>Upload Photo</span>
                  </>
                )}
              </Button>
            </div>

            <input
              id="photo-upload-id"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Identifying plant...</p>
            <p className="text-sm text-gray-600 mt-2">This may take 5-10 seconds</p>
          </div>
        )}

        {step === 'results' && result && (
          <div className="space-y-6">
            {/* Primary ID */}
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{result.plant_type}</h3>
                  <p className="text-sm text-gray-700 mt-1">{result.reasoning}</p>
                </div>
                {getConfidenceBadge(result.confidence)}
              </div>
            </div>

            {/* Variety Matches */}
            {result.variety_matches?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Possible Varieties:</h4>
                <div className="space-y-3">
                  {result.variety_matches.map((variety, idx) => (
                    <Card key={idx} className="hover:shadow-md transition">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900">{variety.variety_name}</h5>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {variety.matching_characteristics?.map((char, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {char}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-800">
                            {variety.match_confidence}%
                          </Badge>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.href = createPageUrl('ViewVariety') + '?id=' + variety.variety_id}
                            className="gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={resetModal} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}