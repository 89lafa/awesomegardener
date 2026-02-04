import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Camera, Bug, MessageCircle, Lightbulb, ArrowRight, Leaf, MapPin } from 'lucide-react';
import { createPageUrl } from '@/utils';
import DiagnosisModal from '@/components/ai/DiagnosisModal';
import SmartSuggestionsWidget from '@/components/ai/SmartSuggestionsWidget';
import PlantIDModal from '@/components/ai/PlantIDModal';
import ZoneFrostDetector from '@/components/ai/ZoneFrostDetector';

export default function AIAssistants() {
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [plantIdOpen, setPlantIdOpen] = useState(false);

  const features = [
    {
      icon: Camera,
      title: 'Photo Diagnosis',
      description: 'Upload a photo and get instant AI-powered disease and pest identification',
      action: () => setDiagnosisOpen(true),
      buttonText: 'Diagnose Plant',
      color: 'emerald'
    },
    {
      icon: Leaf,
      title: 'Plant Identification',
      description: 'Upload a photo of any plant to identify the type and possible varieties',
      action: () => setPlantIdOpen(true),
      buttonText: 'Identify Plant',
      color: 'green'
    },
    {
      icon: Bug,
      title: 'Pest & Disease Library',
      description: 'Browse common garden problems with photos, symptoms, and treatments',
      action: () => window.location.href = createPageUrl('PestLibrary'),
      buttonText: 'Browse Library',
      color: 'blue'
    },
    {
      icon: Lightbulb,
      title: 'Smart Suggestions',
      description: 'Get proactive AI recommendations based on your garden and season',
      action: null,
      buttonText: 'View Below',
      color: 'amber'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Assistants</h1>
        <p className="text-gray-600 mt-2">
          Powered by advanced AI to help you grow better
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title} className="hover:shadow-lg transition">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-${feature.color}-100`}>
                    <Icon className={`w-6 h-6 text-${feature.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {feature.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={feature.action}
                  disabled={!feature.action}
                  className="w-full gap-2"
                  variant={feature.action ? 'default' : 'outline'}
                >
                  {feature.buttonText}
                  {feature.action && <ArrowRight className="w-4 h-4" />}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Zone & Frost Detection */}
      <ZoneFrostDetector />

      {/* Smart Suggestions Widget */}
      <SmartSuggestionsWidget />

      {/* Quick Help Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            Quick Help Widget
          </CardTitle>
          <CardDescription>
            Look for the "Need Help?" button in the bottom-left corner on any page for instant context-aware assistance
          </CardDescription>
        </CardHeader>
      </Card>

      <DiagnosisModal
        open={diagnosisOpen}
        onOpenChange={setDiagnosisOpen}
      />

      <PlantIDModal
        open={plantIdOpen}
        onOpenChange={setPlantIdOpen}
      />
    </div>
  );
}