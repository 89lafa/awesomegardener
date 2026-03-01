import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, AlertTriangle, Shield, Eye, Edit, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// ─────────────────────────────────────────────
// Must match exactly what's in AdminPestLibrary
// ─────────────────────────────────────────────
const CONFUSED_MARKER = '\n\n__CONFUSED_WITH__\n';

function encodeLifecycle(lifecycle, confusedWith) {
  const cleanLifecycle = (lifecycle || '').split(CONFUSED_MARKER)[0].trimEnd();
  if (!confusedWith || confusedWith.length === 0) return cleanLifecycle;
  return cleanLifecycle + CONFUSED_MARKER + confusedWith.join('\n');
}

function decodeLifecycle(rawLifecycle) {
  const raw = rawLifecycle || '';
  const parts = raw.split(CONFUSED_MARKER);
  return {
    lifecycle: parts[0] || '',
    confused_with: parts[1] ? parts[1].split('\n').map(s => s.trim()).filter(Boolean) : []
  };
}

// ─────────────────────────────────────────────
export default function PestDetail() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pestId = params.get('id');

  const [pest, setPest] = useState(null);
  const [decoded, setDecoded] = useState({ lifecycle: '', confused_with: [] });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (pestId) loadPest();
  }, [pestId]);

  const loadPest = async () => {
    try {
      const [userData, results] = await Promise.all([
        base44.auth.me(),
        base44.entities.PestLibrary.filter({ id: pestId })
      ]);
      setUser(userData);
      if (results.length > 0) {
        const p = results[0];
        setPest(p);
        // Decode lifecycle → separate lifecycle text + confused_with array
        setDecoded(decodeLifecycle(p.lifecycle));
        await base44.entities.PestLibrary.update(pestId, {
          view_count: (p.view_count || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error loading pest:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditData({
      common_name: pest.common_name || '',
      scientific_name: pest.scientific_name || '',
      category: pest.category || 'insect',
      appearance: pest.appearance || '',
      symptoms: pest.symptoms?.join('\n') || '',
      lifecycle_text: decoded.lifecycle,
      confused_with_text: decoded.confused_with.join('\n'),
      organic_treatments: pest.organic_treatments?.join('\n') || '',
      chemical_treatments: pest.chemical_treatments?.join('\n') || '',
      prevention_tips: pest.prevention_tips?.join('\n') || '',
      primary_photo_url: pest.primary_photo_url || '',
      severity_potential: pest.severity_potential || 'medium',
      spread_rate: pest.spread_rate || 'moderate'
    });
    setShowEdit(true);
  };

  const handleSave = async () => {
    try {
      // Re-encode lifecycle + confused_with back into one field
      const confusedArray = (editData.confused_with_text || '')
        .split('\n').map(s => s.trim()).filter(Boolean);
      const encodedLifecycle = encodeLifecycle(editData.lifecycle_text, confusedArray);

      const updateData = {
        common_name: editData.common_name,
        scientific_name: editData.scientific_name,
        category: editData.category,
        appearance: editData.appearance,
        severity_potential: editData.severity_potential,
        spread_rate: editData.spread_rate,
        primary_photo_url: editData.primary_photo_url,
        lifecycle: encodedLifecycle,   // ← encoded into this existing field
        symptoms: editData.symptoms.split('\n').map(s => s.trim()).filter(Boolean),
        organic_treatments: editData.organic_treatments.split('\n').map(s => s.trim()).filter(Boolean),
        chemical_treatments: editData.chemical_treatments.split('\n').map(s => s.trim()).filter(Boolean),
        prevention_tips: editData.prevention_tips.split('\n').map(s => s.trim()).filter(Boolean)
      };

      await base44.entities.PestLibrary.update(pestId, updateData);
      await loadPest();
      setShowEdit(false);
      toast.success('Pest entry updated!');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save changes');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditData(prev => ({ ...prev, primary_photo_url: file_url }));
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return colors[severity] || colors.medium;
  };

  const getSpreadRateColor = (rate) => {
    const colors = {
      none: 'bg-gray-100 text-gray-600',
      slow: 'bg-green-100 text-green-800',
      moderate: 'bg-yellow-100 text-yellow-800',
      fast: 'bg-red-100 text-red-800'
    };
    return colors[rate] || colors.slow;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!pest) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Pest or disease not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* Hero Image */}
      {pest.primary_photo_url && (
        <div className="h-64 lg:h-96 rounded-xl overflow-hidden">
          <img
            src={pest.primary_photo_url}
            alt={pest.common_name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{pest.common_name}</h1>
          {pest.scientific_name && (
            <p className="text-lg italic text-gray-600 mt-1">{pest.scientific_name}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 items-end">
          <Badge className="capitalize">{pest.category}</Badge>
          <Badge className={getSeverityColor(pest.severity_potential)}>
            {capitalize(pest.severity_potential)} Severity
          </Badge>
          {pest.spread_rate && pest.spread_rate !== 'none' && (
            <Badge className={getSpreadRateColor(pest.spread_rate)}>
              Spread: {capitalize(pest.spread_rate)}
            </Badge>
          )}
          {pest.spread_rate === 'none' && (
            <Badge className={getSpreadRateColor('none')}>
              Not Contagious
            </Badge>
          )}
          {user?.role === 'admin' && (
            <Button onClick={handleEdit} size="sm" className="gap-2">
              <Edit className="w-3 h-3" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* Identification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" /> Identification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Appearance:</h4>
            <p className="text-gray-700">{pest.appearance}</p>
          </div>

          {pest.symptoms?.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Symptoms to Look For:</h4>
              <ul className="list-disc list-inside space-y-1">
                {pest.symptoms.map((symptom, idx) => (
                  <li key={idx} className="text-gray-700">{symptom}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Show clean lifecycle text (without the encoded confused_with portion) */}
          {decoded.lifecycle && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Lifecycle:</h4>
              <p className="text-gray-700">{decoded.lifecycle}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ Don't Confuse With — only renders when data exists */}
      {decoded.confused_with.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              Don't Confuse With
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 mb-3">
              These conditions are commonly mistaken for <strong>{pest.common_name}</strong>.
              Look carefully before treating:
            </p>
            <ul className="space-y-2">
              {decoded.confused_with.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-amber-900">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-300 flex items-center justify-center text-xs font-bold text-amber-900 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Treatment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Treatment Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="organic">
            <TabsList className="w-full">
              <TabsTrigger value="organic" className="flex-1">🌿 Organic</TabsTrigger>
              <TabsTrigger value="chemical" className="flex-1">⚗️ Chemical</TabsTrigger>
            </TabsList>
            <TabsContent value="organic" className="mt-4">
              {pest.organic_treatments?.length > 0 ? (
                <ul className="list-disc list-inside space-y-2">
                  {pest.organic_treatments.map((t, idx) => (
                    <li key={idx} className="text-gray-700">{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No organic treatments listed</p>
              )}
            </TabsContent>
            <TabsContent value="chemical" className="mt-4">
              {pest.chemical_treatments?.length > 0 ? (
                <ul className="list-disc list-inside space-y-2">
                  {pest.chemical_treatments.map((t, idx) => (
                    <li key={idx} className="text-gray-700">{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No chemical treatments listed</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Prevention */}
      {pest.prevention_tips?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" /> Prevention Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2">
              {pest.prevention_tips.map((tip, idx) => (
                <li key={idx} className="text-gray-700">{tip}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Photo Gallery */}
      {pest.photos?.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Photo Gallery</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {pest.photos.map((photo, idx) => (
                <div key={idx} className="aspect-square rounded-lg overflow-hidden border">
                  <img src={photo} alt={`${pest.common_name} ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Edit Dialog (admin only) ── */}
      {user?.role === 'admin' && (
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Pest Entry</DialogTitle>
            </DialogHeader>

            {editData && (
              <div className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Common Name</Label>
                    <Input
                      value={editData.common_name}
                      onChange={(e) => setEditData(prev => ({ ...prev, common_name: e.target.value }))}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Scientific Name</Label>
                    <Input
                      value={editData.scientific_name}
                      onChange={(e) => setEditData(prev => ({ ...prev, scientific_name: e.target.value }))}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={editData.category} onValueChange={(v) => setEditData(prev => ({ ...prev, category: v }))}>
                      <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="insect">Insect</SelectItem>
                        <SelectItem value="disease">Disease</SelectItem>
                        <SelectItem value="fungus">Fungus</SelectItem>
                        <SelectItem value="bacteria">Bacteria</SelectItem>
                        <SelectItem value="virus">Virus</SelectItem>
                        <SelectItem value="deficiency">Deficiency</SelectItem>
                        <SelectItem value="environmental">Environmental</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Severity</Label>
                    <Select value={editData.severity_potential} onValueChange={(v) => setEditData(prev => ({ ...prev, severity_potential: v }))}>
                      <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Spread Rate</Label>
                    <Select value={editData.spread_rate} onValueChange={(v) => setEditData(prev => ({ ...prev, spread_rate: v }))}>
                      <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Not Contagious)</SelectItem>
                        <SelectItem value="slow">Slow</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="fast">Fast</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Hero Image */}
                <div>
                  <Label>Hero Image</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-3">
                      <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={imageUploading} className="flex-1" />
                      {imageUploading && <Loader2 className="w-5 h-5 animate-spin text-emerald-600 shrink-0" />}
                    </div>
                    {editData.primary_photo_url && !imageUploading && (
                      <div className="mt-2">
                        <img src={editData.primary_photo_url} alt="Preview" className="h-32 object-cover rounded border" />
                        <p className="text-xs text-green-600 mt-1">✓ Image ready</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Appearance Description</Label>
                  <Textarea value={editData.appearance} onChange={(e) => setEditData(prev => ({ ...prev, appearance: e.target.value }))} rows={3} className="mt-2" />
                </div>

                <div>
                  <Label>Symptoms (one per line)</Label>
                  <Textarea value={editData.symptoms} onChange={(e) => setEditData(prev => ({ ...prev, symptoms: e.target.value }))} rows={4} className="mt-2" />
                </div>

                <div>
                  <Label>Lifecycle / Notes</Label>
                  <Textarea value={editData.lifecycle_text} onChange={(e) => setEditData(prev => ({ ...prev, lifecycle_text: e.target.value }))} rows={2} className="mt-2" />
                </div>

                {/* ✅ Confused With in edit dialog */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <Label className="text-amber-900 font-semibold text-sm flex items-center gap-1">
                    <HelpCircle className="w-4 h-4" /> Confused With (one per line)
                  </Label>
                  <p className="text-xs text-amber-700">
                    Each line appears as a numbered item in the "Don't Confuse With" section on the detail page.
                  </p>
                  <Textarea
                    value={editData.confused_with_text}
                    onChange={(e) => setEditData(prev => ({ ...prev, confused_with_text: e.target.value }))}
                    rows={4}
                    className="bg-white"
                    placeholder="Early Blight — similar dark spots but with concentric rings&#10;Nutrient deficiency — yellowing without spots or lesions"
                  />
                </div>

                <div>
                  <Label>Organic Treatments (one per line)</Label>
                  <Textarea value={editData.organic_treatments} onChange={(e) => setEditData(prev => ({ ...prev, organic_treatments: e.target.value }))} rows={4} className="mt-2" />
                </div>

                <div>
                  <Label>Chemical Treatments (one per line)</Label>
                  <Textarea value={editData.chemical_treatments} onChange={(e) => setEditData(prev => ({ ...prev, chemical_treatments: e.target.value }))} rows={4} className="mt-2" />
                </div>

                <div>
                  <Label>Prevention Tips (one per line)</Label>
                  <Textarea value={editData.prevention_tips} onChange={(e) => setEditData(prev => ({ ...prev, prevention_tips: e.target.value }))} rows={4} className="mt-2" />
                </div>

              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={imageUploading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {imageUploading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                  : 'Save Changes'
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
