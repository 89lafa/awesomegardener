import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Thermometer, Droplets, Sun, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function IndoorEnvironment() {
  const [spaces, setSpaces] = useState([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [period, setPeriod] = useState(30);
  const [stats, setStats] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);

  useEffect(() => {
    loadSpaces();
  }, []);

  useEffect(() => {
    if (selectedSpaceId) {
      loadData();
    }
  }, [selectedSpaceId, period]);

  const loadSpaces = async () => {
    try {
      const data = await base44.entities.IndoorSpace.filter({ is_active: true });
      setSpaces(data);
      if (data.length > 0) {
        setSelectedSpaceId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading spaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!selectedSpaceId) return;
    
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const readingsData = await base44.entities.IndoorEnvironmentReading.filter({
        indoor_space_id: selectedSpaceId,
        reading_date: { $gte: startDate.toISOString() }
      }, 'reading_date');

      setReadings(readingsData);

      if (readingsData.length > 0) {
        const temps = readingsData.filter(r => r.temperature_f).map(r => r.temperature_f);
        const humidities = readingsData.filter(r => r.humidity_percent).map(r => r.humidity_percent);
        const lights = readingsData.filter(r => r.light_level_lux).map(r => r.light_level_lux);

        setStats({
          temperature: {
            current: temps[temps.length - 1] || 0,
            avg: temps.reduce((a, b) => a + b, 0) / temps.length || 0,
            min: Math.min(...temps) || 0,
            max: Math.max(...temps) || 0
          },
          humidity: {
            current: humidities[humidities.length - 1] || 0,
            avg: humidities.reduce((a, b) => a + b, 0) / humidities.length || 0,
            min: Math.min(...humidities) || 0,
            max: Math.max(...humidities) || 0
          },
          light: {
            current: lights[lights.length - 1] || 0,
            avg: lights.reduce((a, b) => a + b, 0) / lights.length || 0,
            min: Math.min(...lights) || 0,
            max: Math.max(...lights) || 0
          }
        });
      } else {
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load environment data');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = () => {
    if (!stats) return [];
    
    const recommendations = [];

    if (stats.humidity.avg < 60) {
      recommendations.push({
        icon: '💧',
        text: `Consider adding a humidifier. Current average (${Math.round(stats.humidity.avg)}%) is below ideal for most tropical plants (60-70%).`
      });
    }

    if (stats.temperature.max > 80) {
      recommendations.push({
        icon: '🌡️',
        text: `Some readings above 80°F. Consider adding ventilation or moving plants away from heat sources.`
      });
    }

    if (stats.light.avg < 100) {
      recommendations.push({
        icon: '☀️',
        text: `Low light levels. Consider supplementing with grow lights for better plant growth.`
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        icon: '✅',
        text: 'Environmental conditions are optimal for most indoor plants!'
      });
    }

    return recommendations;
  };

  const getStatusColor = (value, type) => {
    if (type === 'temperature') {
      if (value < 60 || value > 85) return 'border-red-500 bg-red-50';
      if (value < 65 || value > 80) return 'border-amber-500 bg-amber-50';
      return 'border-emerald-500 bg-emerald-50';
    }
    if (type === 'humidity') {
      if (value < 40 || value > 80) return 'border-amber-500 bg-amber-50';
      if (value >= 60) return 'border-emerald-500 bg-emerald-50';
      return 'border-amber-500 bg-amber-50';
    }
    return 'border-emerald-500 bg-emerald-50';
  };

  if (loading && !selectedSpaceId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">📊 Environment Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">Track environmental conditions for your indoor spaces</p>
        </div>
        
        <Button onClick={() => setShowLogModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Log Reading
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={selectedSpaceId || ''} onValueChange={setSelectedSpaceId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select space" />
          </SelectTrigger>
          <SelectContent>
            {spaces.map(space => (
              <SelectItem key={space.id} value={space.id}>
                📍 {space.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={period.toString()} onValueChange={(v) => setPeriod(parseInt(v))}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!stats ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Environment Data Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start tracking environmental conditions to optimize your indoor growing space.
            </p>
            <Button onClick={() => setShowLogModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Log First Reading
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={`border-2 ${getStatusColor(stats.temperature.current, 'temperature')}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Thermometer className="text-orange-500 w-8 h-8" />
                  <span className="text-sm font-medium">
                    {stats.temperature.current < 65 || stats.temperature.current > 80 ? '⚠️ Needs Attention' : '✅ Optimal'}
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-800 mb-1">{Math.round(stats.temperature.current)}°F</div>
                <div className="text-sm text-gray-600 mb-1">Temperature</div>
                <div className="text-xs text-gray-500">
                  {Math.round(stats.temperature.avg)}°F avg • Range: {Math.round(stats.temperature.min)}-{Math.round(stats.temperature.max)}°F
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 ${getStatusColor(stats.humidity.current, 'humidity')}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Droplets className="text-blue-500 w-8 h-8" />
                  <span className="text-sm font-medium">
                    {stats.humidity.current >= 60 ? '✅ Optimal' : '⚠️ Low'}
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-800 mb-1">{Math.round(stats.humidity.current)}%</div>
                <div className="text-sm text-gray-600 mb-1">Humidity</div>
                <div className="text-xs text-gray-500">
                  {Math.round(stats.humidity.avg)}% avg • Range: {Math.round(stats.humidity.min)}-{Math.round(stats.humidity.max)}%
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-emerald-500 bg-emerald-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Sun className="text-yellow-500 w-8 h-8" />
                  <span className="text-sm font-medium">✅ Good</span>
                </div>
                <div className="text-3xl font-bold text-gray-800 mb-1">{Math.round(stats.light.current)} lux</div>
                <div className="text-sm text-gray-600 mb-1">Light Level</div>
                <div className="text-xs text-gray-500">
                  {Math.round(stats.light.avg)} lux avg • Range: {Math.round(stats.light.min)}-{Math.round(stats.light.max)} lux
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <ChartSection title="🌡️ Temperature" data={readings} dataKey="temperature_f" color="#f59e0b" unit="°F" />
            <ChartSection title="💦 Humidity" data={readings} dataKey="humidity_percent" color="#3b82f6" unit="%" />
            <ChartSection title="☀️ Light Levels" data={readings} dataKey="light_level_lux" color="#fbbf24" unit=" lux" />
          </div>

          <Card className="bg-gradient-to-r from-emerald-50 to-green-50">
            <CardHeader>
              <CardTitle>📋 Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {getRecommendations().map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    <span>{rec.icon}</span>
                    <span className="text-sm">{rec.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      <LogReadingModal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        spaceId={selectedSpaceId}
        onSuccess={() => {
          setShowLogModal(false);
          loadData();
          toast.success('Reading logged successfully!');
        }}
      />
    </div>
  );
}

function ChartSection({ title, data, dataKey, color, unit }) {
  const chartData = data
    .filter(r => r[dataKey] != null)
    .map(r => ({
      date: format(new Date(r.reading_date), 'MMM d'),
      value: r[dataKey]
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center text-gray-500">
          No data available for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={value => `${value}${unit}`} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function LogReadingModal({ open, onClose, spaceId, onSuccess }) {
  const [formData, setFormData] = useState({
    temperature_f: '',
    humidity_percent: '',
    light_level_lux: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!spaceId) return;

    setSaving(true);
    try {
      await base44.entities.IndoorEnvironmentReading.create({
        indoor_space_id: spaceId,
        reading_date: new Date().toISOString(),
        reading_type: 'manual',
        temperature_f: formData.temperature_f ? parseFloat(formData.temperature_f) : null,
        humidity_percent: formData.humidity_percent ? parseFloat(formData.humidity_percent) : null,
        light_level_lux: formData.light_level_lux ? parseFloat(formData.light_level_lux) : null,
        notes: formData.notes || null
      });

      setFormData({ temperature_f: '', humidity_percent: '', light_level_lux: '', notes: '' });
      onSuccess();
    } catch (error) {
      console.error('Error logging reading:', error);
      toast.error('Failed to log reading');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Environment Reading</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>🌡️ Temperature (°F)</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="72"
              value={formData.temperature_f}
              onChange={(e) => setFormData({ ...formData, temperature_f: e.target.value })}
              className="mt-2"
            />
          </div>

          <div>
            <Label>💧 Humidity (%)</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="55"
              value={formData.humidity_percent}
              onChange={(e) => setFormData({ ...formData, humidity_percent: e.target.value })}
              className="mt-2"
            />
          </div>

          <div>
            <Label>☀️ Light Level (lux)</Label>
            <Input
              type="number"
              placeholder="200"
              value={formData.light_level_lux}
              onChange={(e) => setFormData({ ...formData, light_level_lux: e.target.value })}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use a light meter app or device. Most tropical plants need 100-300 lux.
            </p>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional observations..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Reading
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}