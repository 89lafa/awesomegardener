import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, Calendar, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function ZoneFrostDetector() {
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleDetect = async () => {
    if (!zipCode || zipCode.length < 5) {
      toast.error('Please enter a valid ZIP code');
      return;
    }

    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('detectZoneAndFrost', {
        zip_code: zipCode
      });

      setResult(data.data);
      toast.success('Zone and frost dates detected!');
    } catch (error) {
      console.error('Detection error:', error);
      toast.error('Failed to detect zone: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToProfile = async () => {
    try {
      await base44.auth.updateMe({
        zone: result.zone,
        last_frost_date: result.last_frost_date,
        first_frost_date: result.first_frost_date,
        location_zip: zipCode
      });
      toast.success('Saved to your profile!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          AI Auto-Detect Zone & Frost Dates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Enter your ZIP code and AI will automatically determine your USDA zone and frost dates
        </p>

        <div>
          <Label htmlFor="zip">ZIP Code</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="zip"
              placeholder="Enter ZIP code"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              maxLength={5}
              className="flex-1"
            />
            <Button
              onClick={handleDetect}
              disabled={loading || !zipCode}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Detect'
              )}
            </Button>
          </div>
        </div>

        {result && (
          <div className="space-y-3 pt-4 border-t">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-gray-900">{result.location_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">USDA Zone</p>
                  <p className="font-bold text-emerald-600 text-lg">{result.zone}</p>
                </div>
                <div>
                  <p className="text-gray-600">Growing Season</p>
                  <p className="font-bold text-gray-900">{result.growing_season_days} days</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">Last Frost</span>
                </div>
                <p className="text-blue-600 font-bold">
                  {new Date(result.last_frost_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <span className="font-semibold text-gray-900">First Frost</span>
                </div>
                <p className="text-orange-600 font-bold">
                  {new Date(result.first_frost_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>

            <Button
              onClick={handleSaveToProfile}
              variant="outline"
              className="w-full"
            >
              Save to My Profile
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}