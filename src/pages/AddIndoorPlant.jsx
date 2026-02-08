import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createPageUrl } from '@/utils';

export default function AddIndoorPlant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const spaceId = searchParams.get('spaceId');

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(spaceId ? createPageUrl('IndoorSpaceDetail') + `?id=${spaceId}` : createPageUrl('MyIndoorPlants'))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-800">Add New Indoor Plant</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🌱 Coming Soon!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            This page will soon allow you to add new indoor plants to your collection.
            For now, you can go back to your plants or spaces.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => navigate(createPageUrl('MyIndoorPlants'))}>
              View My Plants
            </Button>
            {spaceId && (
              <Button onClick={() => navigate(createPageUrl('IndoorSpaceDetail') + `?id=${spaceId}`)} variant="outline">
                Back to Space
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}