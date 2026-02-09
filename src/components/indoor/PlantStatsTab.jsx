import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function PlantStatsTab({ plant, logs }) {
  const wateringLogs = logs.filter(l => l.log_type === 'watered');
  const fertilizeLogs = logs.filter(l => l.log_type === 'fertilized');
  const repottingLogs = logs.filter(l => l.log_type === 'repotted');
  const photoLogs = logs.filter(l => l.log_type === 'photo');
  const growthLogs = logs.filter(l => l.height_inches);

  // Calculate average watering interval
  const wateringIntervals = [];
  for (let i = 1; i < wateringLogs.length; i++) {
    const days = Math.floor((new Date(wateringLogs[i-1].log_date) - new Date(wateringLogs[i].log_date)) / (1000 * 60 * 60 * 24));
    if (days > 0 && days < 60) wateringIntervals.push(days);
  }
  const avgWateringDays = wateringIntervals.length > 0 
    ? (wateringIntervals.reduce((a, b) => a + b, 0) / wateringIntervals.length).toFixed(1)
    : 'N/A';

  // Growth over time data
  const growthData = growthLogs.slice(0, 10).reverse().map(log => ({
    date: new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    height: log.height_inches
  }));

  const ageInDays = Math.floor((new Date() - new Date(plant.acquisition_date)) / (1000 * 60 * 60 * 24));
  const years = Math.floor(ageInDays / 365);

  // Calculate milestones
  const milestones = [];
  if (years >= 1) milestones.push({ icon: '🎂', text: `${years} year${years > 1 ? 's' : ''} old` });
  if (plant.current_height_inches && growthLogs.length > 0) {
    const firstHeight = growthLogs[growthLogs.length - 1]?.height_inches;
    if (firstHeight && plant.current_height_inches >= firstHeight * 2) {
      milestones.push({ icon: '📏', text: 'Doubled in height' });
    }
  }
  if (plant.propagation_children_count > 0) {
    milestones.push({ icon: '🌿', text: `${plant.propagation_children_count} successful propagation${plant.propagation_children_count > 1 ? 's' : ''}` });
  }
  if (wateringLogs.length >= 100) {
    milestones.push({ icon: '💧', text: `${wateringLogs.length}+ waterings logged` });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📊 Care Activity Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-700">{wateringLogs.length}</div>
              <div className="text-xs text-blue-600 mt-1">Waterings</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-700">{fertilizeLogs.length}</div>
              <div className="text-xs text-green-600 mt-1">Fertilizations</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-700">{repottingLogs.length}</div>
              <div className="text-xs text-purple-600 mt-1">Repottings</div>
            </div>
            <div className="text-center p-4 bg-pink-50 rounded-lg">
              <div className="text-3xl font-bold text-pink-700">{photoLogs.length}</div>
              <div className="text-xs text-pink-600 mt-1">Photos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {wateringIntervals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">💧 Watering Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Average interval: <span className="font-bold text-gray-800">{avgWateringDays} days</span></p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={wateringIntervals.slice(0, 10).reverse().map((days, i) => ({ name: `#${i+1}`, days }))}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="days" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {growthData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📏 Growth Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={growthData}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="height" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            {plant.current_height_inches && growthData.length > 0 && (
              <p className="text-sm text-gray-600 mt-3">
                Started: {growthData[0].height}" → Now: {plant.current_height_inches}" 
                ({(((plant.current_height_inches - growthData[0].height) / growthData[0].height) * 100).toFixed(0)}% growth)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🏅 Plant Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {milestones.map((milestone, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg">
                  <span className="text-2xl">{milestone.icon}</span>
                  <span className="font-medium text-gray-800">{milestone.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {logs.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-500">No data yet - start logging care activities to see stats!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}