import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Camera, Upload, Loader2, CheckCircle2, AlertTriangle, Leaf, Database } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

export default function DiagnosisModal({ open, onOpenChange, varietyId, plantTypeId, cropPlanId, plantContext }) {
  const [step, setStep] = useState('capture');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [addToDatabase, setAddToDatabase] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);

  const handlePhotoUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
      
      setStep('analyzing');
      setAnalyzing(true);

      const { data } = await base44.functions.invoke('diagnosePlant', {
        photo_url: file_url,
        variety_id: varietyId,
        plant_type_id: plantTypeId,
        crop_plan_id: cropPlanId,
        plant_context: plantContext
      });

      setDiagnosis(data.diagnosis);
      setStep('results');
      toast.success('Diagnosis complete!');
    } catch (error) {
      console.error('Diagnosis error:', error);
      toast.error('Failed to analyze photo: ' + error.message);
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
    if (level >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Medium Confidence</Badge>;
    return <Badge className="bg-orange-100 text-orange-800">Low Confidence</Badge>;
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[severity] || colors.medium}>{severity?.toUpperCase()}</Badge>;
  };

  const handleSaveToDatabase = async () => {
    if (!diagnosis || !addToDatabase) return;
    
    try {
      // Check if this pest/disease already exists
      const existing = await base44.entities.PestLibrary.filter({
        common_name: diagnosis.issue_name
      });
      
      if (existing.length > 0) {
        // Add photo to existing entry
        const pest = existing[0];
        const updatedPhotos = [...(pest.photos || []), photoUrl].filter(Boolean);
        await base44.entities.PestLibrary.update(pest.id, {
          photos: updatedPhotos
        });
        toast.success('Photo added to pest library!');
      } else {
        // Create new entry as "pending_review" for admin approval
        const userData = await base44.auth.me();
        await base44.entities.PestLibrary.create({
          common_name: diagnosis.issue_name,
          scientific_name: diagnosis.scientific_name || '',
          category: diagnosis.category || 'disease',
          appearance: diagnosis.diagnosis_description || '',
          symptoms: diagnosis.symptoms_observed || [],
          primary_photo_url: photoUrl,
          photos: [photoUrl],
          organic_treatments: diagnosis.organic_treatments || [],
          chemical_treatments: diagnosis.chemical_treatments || [],
          prevention_tips: diagnosis.prevention_tips || [],
          severity_potential: diagnosis.severity || 'medium',
          status: 'pending_review',
          suggested_by: userData?.email || null
        });
        toast.success('New pest entry submitted for admin review!');
      }
    } catch (error) {
      console.error('Error saving to database:', error);
      toast.error('Failed to save to database');
    }
  };

  const resetModal = () => {
    setStep('capture');
    setDiagnosis(null);
    setTreatmentNotes('');
    setAddToDatabase(false);
    setPhotoUrl(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-emerald-600" />
            Plant Health Diagnosis
          </DialogTitle>
        </DialogHeader>

        {step === 'capture' && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                📸 Upload a clear photo showing the problem area. Better photos = more accurate diagnosis!
              </p>
            </div>

            <label className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-100 transition-colors">
              <Checkbox
                checked={addToDatabase}
                onCheckedChange={setAddToDatabase}
                className="border-emerald-300 data-[state=checked]:bg-emerald-600"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-900 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Add to Pest Library Database
                </p>
                <p className="text-xs text-emerald-700">
                  Help grow our community database with your photo
                </p>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-32 flex-col gap-2"
                onClick={() => document.getElementById('photo-upload-diagnosis').click()}
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
                onClick={() => document.getElementById('photo-upload-diagnosis').click()}
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
              id="photo-upload-diagnosis"
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
            <p className="text-lg font-medium text-gray-900">Analyzing plant photo...</p>
            <p className="text-sm text-gray-600 mt-2">This may take 5-10 seconds</p>
          </div>
        )}

        {step === 'results' && diagnosis && (
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{diagnosis.issue_name}</h3>
                  {diagnosis.scientific_name && (
                    <p className="text-sm italic text-gray-600">{diagnosis.scientific_name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {getConfidenceBadge(diagnosis.confidence_level)}
                  {getSeverityBadge(diagnosis.severity)}
                </div>
              </div>
              <p className="text-sm text-gray-700">{diagnosis.diagnosis_description}</p>
            </div>

            {/* Symptoms */}
            {diagnosis.symptoms_observed?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Symptoms Observed:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {diagnosis.symptoms_observed.map((symptom, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{symptom}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Treatment Options */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Treatment Options:</h4>
              <Tabs defaultValue="organic">
                <TabsList className="w-full">
                  <TabsTrigger value="organic" className="flex-1">🌿 Organic</TabsTrigger>
                  <TabsTrigger value="chemical" className="flex-1">⚗️ Chemical</TabsTrigger>
                </TabsList>
                <TabsContent value="organic" className="mt-3">
                  {diagnosis.organic_treatments?.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {diagnosis.organic_treatments.map((treatment, idx) => (
                        <li key={idx} className="text-sm text-gray-700">{treatment}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No organic treatments specified</p>
                  )}
                </TabsContent>
                <TabsContent value="chemical" className="mt-3">
                  {diagnosis.chemical_treatments?.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {diagnosis.chemical_treatments.map((treatment, idx) => (
                        <li key={idx} className="text-sm text-gray-700">{treatment}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No chemical treatments specified</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Prevention */}
            {diagnosis.prevention_tips?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">🛡️ Prevention Tips:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {diagnosis.prevention_tips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Treatment Notes */}
            <div>
              <Label htmlFor="treatment-notes">Treatment Notes (Optional)</Label>
              <Textarea
                id="treatment-notes"
                placeholder="What treatment did you apply?"
                value={treatmentNotes}
                onChange={(e) => setTreatmentNotes(e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={async () => {
                  await handleSaveToDatabase();
                  resetModal();
                }} 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}