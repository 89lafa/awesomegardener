import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bug, Loader2, AlertTriangle, Shield, Eye, Edit, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function PestDetail() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pestId = params.get('id');

  const [pest, setPest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadUser();
    if (pestId) {
      loadPest();
    }
  }, [pestId]);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadPest = async () => {
    try {
      const results = await base44.entities.PestLibrary.filter({ id: pestId });
      if (results.length > 0) {
        setPest(results[0]);
        
        // Increment view count
        await base44.entities.PestLibrary.update(pestId, {
          view_count: (results[0].view_count || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error loading pest:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return colors[severity] || colors.medium;
  };

  const handleEdit = () => {
    setEditData({
      common_name: pest.common_name || '',
      scientific_name: pest.scientific_name || '',
      category: pest.category || 'insect',
      appearance: pest.appearance || '',
      symptoms: pest.symptoms?.join('\n') || '',
      lifecycle: pest.lifecycle || '',
      severity_potential: pest.severity_potential || 'medium',
      spread_rate: pest.spread_rate || 'moderate',
      organic_treatments: pest.organic_treatments?.join('\n') || '',
      chemical_treatments: pest.chemical_treatments?.join('\n') || '',
      prevention_tips: pest.prevention_tips?.join('\n') || '',
      primary_photo_url: pest.primary_photo_url || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const updateData = {
        common_name: editData.common_name,
        scientific_name: editData.scientific_name,
        category: editData.category,
        appearance: editData.appearance,
        symptoms: editData.symptoms.split('\n').filter(s => s.trim()),
        lifecycle: editData.lifecycle,
        severity_potential: editData.severity_potential,
        spread_rate: editData.spread_rate,
        organic_treatments: editData.organic_treatments.split('\n').filter(t => t.trim()),
        chemical_treatments: editData.chemical_treatments.split('\n').filter(t => t.trim()),
        prevention_tips: editData.prevention_tips.split('\n').filter(t => t.trim()),
        primary_photo_url: editData.primary_photo_url
      };

      await base44.entities.PestLibrary.update(pestId, updateData);
      setPest({ ...pest, ...updateData });
      setIsEditing(false);
      toast.success('Pest info updated!');
    } catch (error) {
      console.error('Error updating pest:', error);
      toast.error('Failed to update');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditData({ ...editData, primary_photo_url: file_url });
      toast.success('Image uploaded!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
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
      <div>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{pest.common_name}</h1>
            {pest.scientific_name && (
              <p className="text-lg italic text-gray-600 mt-1">{pest.scientific_name}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Badge className="capitalize">{pest.category}</Badge>
            <Badge className={getSeverityColor(pest.severity_potential)}>
              {pest.severity_potential} severity
            </Badge>
            {user?.role === 'admin' && (
              <Button
                onClick={handleEdit}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                size="sm"
              >
                <Edit className="w-3 h-3" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Identification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Identification
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

          {pest.lifecycle && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Lifecycle:</h4>
              <p className="text-gray-700">{pest.lifecycle}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Treatment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Treatment Options
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
                  {pest.organic_treatments.map((treatment, idx) => (
                    <li key={idx} className="text-gray-700">{treatment}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No organic treatments listed</p>
              )}
            </TabsContent>
            <TabsContent value="chemical" className="mt-4">
              {pest.chemical_treatments?.length > 0 ? (
                <ul className="list-disc list-inside space-y-2">
                  {pest.chemical_treatments.map((treatment, idx) => (
                    <li key={idx} className="text-gray-700">{treatment}</li>
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
              <Shield className="w-5 h-5" />
              Prevention Tips
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
          <CardHeader>
            <CardTitle>Photo Gallery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {pest.photos.map((photo, idx) => (
                <div key={idx} className="aspect-square rounded-lg overflow-hidden border">
                  <img
                    src={photo}
                    alt={`${pest.common_name} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {user?.role === 'admin' && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Pest/Disease Entry</DialogTitle>
            </DialogHeader>
            {editData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Common Name *</Label>
                    <Input
                      value={editData.common_name}
                      onChange={(e) => setEditData({ ...editData, common_name: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Scientific Name</Label>
                    <Input
                      value={editData.scientific_name}
                      onChange={(e) => setEditData({ ...editData, scientific_name: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={editData.category} onValueChange={(v) => setEditData({ ...editData, category: v })}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
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
                    <Select value={editData.severity_potential} onValueChange={(v) => setEditData({ ...editData, severity_potential: v })}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Spread Rate</Label>
                    <Select value={editData.spread_rate} onValueChange={(v) => setEditData({ ...editData, spread_rate: v })}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow">Slow</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="fast">Fast</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Hero Image</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={editData.primary_photo_url}
                      onChange={(e) => setEditData({ ...editData, primary_photo_url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('pest-image-upload').click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </Button>
                    <input
                      id="pest-image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                  {editData.primary_photo_url && (
                    <img src={editData.primary_photo_url} alt="Preview" className="mt-2 h-32 rounded-lg object-cover" />
                  )}
                </div>

                <div>
                  <Label>Appearance Description</Label>
                  <Textarea
                    value={editData.appearance}
                    onChange={(e) => setEditData({ ...editData, appearance: e.target.value })}
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Lifecycle</Label>
                  <Textarea
                    value={editData.lifecycle}
                    onChange={(e) => setEditData({ ...editData, lifecycle: e.target.value })}
                    className="mt-2"
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Symptoms (one per line)</Label>
                  <Textarea
                    value={editData.symptoms}
                    onChange={(e) => setEditData({ ...editData, symptoms: e.target.value })}
                    className="mt-2"
                    rows={4}
                    placeholder="Yellowing leaves&#10;Wilting&#10;Spots on fruit"
                  />
                </div>

                <div>
                  <Label>Organic Treatments (one per line)</Label>
                  <Textarea
                    value={editData.organic_treatments}
                    onChange={(e) => setEditData({ ...editData, organic_treatments: e.target.value })}
                    className="mt-2"
                    rows={4}
                    placeholder="Neem oil spray&#10;Companion planting&#10;Hand picking"
                  />
                </div>

                <div>
                  <Label>Chemical Treatments (one per line)</Label>
                  <Textarea
                    value={editData.chemical_treatments}
                    onChange={(e) => setEditData({ ...editData, chemical_treatments: e.target.value })}
                    className="mt-2"
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Prevention Tips (one per line)</Label>
                  <Textarea
                    value={editData.prevention_tips}
                    onChange={(e) => setEditData({ ...editData, prevention_tips: e.target.value })}
                    className="mt-2"
                    rows={4}
                    placeholder="Crop rotation&#10;Remove infected plants&#10;Maintain good airflow"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}