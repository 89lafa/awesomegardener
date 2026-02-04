import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bug, Loader2, AlertTriangle, Shield, Eye } from 'lucide-react';

export default function PestDetail() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pestId = params.get('id');

  const [pest, setPest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pestId) {
      loadPest();
    }
  }, [pestId]);

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
    </div>
  );
}