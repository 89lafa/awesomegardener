import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Cloud, AlertTriangle, CloudRain, Wind, Droplets } from 'lucide-react';
import { toast } from 'sonner';

export function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    try {
      const user = await base44.auth.me();
      const userSettings = await base44.entities.UserSettings.filter({
        created_by: user.email
      }).then(results => results[0]);

      if (!userSettings?.zip_code) {
        setError('Set your ZIP code in Settings to see weather');
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Check cache
      const cached = await base44.entities.WeatherCache.filter({
        zip_code: userSettings.zip_code,
        date: today
      }).then(results => results[0]);

      if (cached && new Date(cached.expires_at) > new Date()) {
        setWeather(cached);
        setLoading(false);
        return;
      }

      // Fetch from wttr.in (free weather API)
      const response = await fetch(`https://wttr.in/${userSettings.zip_code}?format=j1`);
      const data = await response.json();
      
      const current = data.current_condition?.[0];
      const forecast = data.weather?.[0];
      
      const weatherData = {
        zip_code: userSettings.zip_code,
        date: today,
        high_temp: parseInt(forecast?.maxtempF),
        low_temp: parseInt(forecast?.mintempF),
        current_temp: parseInt(current?.temp_F),
        conditions: current?.weatherDesc?.[0]?.value || 'Unknown',
        conditions_icon: getWeatherIcon(current?.weatherCode),
        precipitation_chance: parseInt(forecast?.hourly?.[0]?.chanceofrain) || 0,
        wind_speed_mph: parseInt(current?.windspeedMiles) || 0,
        humidity_percent: parseInt(current?.humidity) || 0,
        frost_warning: parseInt(forecast?.mintempF) <= 32,
        heat_warning: parseInt(forecast?.maxtempF) >= 95
      };

      // Save to cache
      if (cached) {
        await base44.entities.WeatherCache.update(cached.id, weatherData);
      } else {
        await base44.entities.WeatherCache.create(weatherData);
      }

      setWeather(weatherData);
    } catch (err) {
      console.error('Weather fetch failed:', err);
      setError('Could not load weather');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="bg-gradient-to-br from-emerald-100 to-blue-100 rounded-xl p-6 animate-pulse h-40" />;
  }

  if (error) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <Cloud className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-6 text-white relative overflow-hidden"
      style={{
        background: weather.frost_warning
          ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
          : weather.heat_warning
          ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
          : 'linear-gradient(135deg, #10b981, #059669)'
      }}
    >
      <div className="absolute -right-6 -top-6 text-8xl opacity-20">{weather.conditions_icon}</div>

      <div className="relative z-10">
        <div className="text-sm opacity-90 mb-1">Today's Weather</div>

        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-5xl font-bold">{weather.current_temp}°</span>
          <div className="text-sm opacity-80">
            <div>H: {weather.high_temp}°</div>
            <div>L: {weather.low_temp}°</div>
          </div>
        </div>

        <div className="text-sm opacity-90 mb-4">{weather.conditions}</div>

        {/* Alerts */}
        {weather.frost_warning && (
          <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2 mb-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Frost warning tonight!</span>
          </div>
        )}

        {weather.precipitation_chance > 50 && (
          <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2 mb-3">
            <CloudRain className="w-5 h-5" />
            <span>{weather.precipitation_chance}% rain chance</span>
          </div>
        )}

        {/* Details */}
        <div className="grid grid-cols-2 gap-3 text-xs opacity-90">
          <div className="flex items-center gap-2 bg-white/10 rounded px-2 py-1">
            <Wind className="w-4 h-4" />
            <span>{weather.wind_speed_mph} mph</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded px-2 py-1">
            <Droplets className="w-4 h-4" />
            <span>{weather.humidity_percent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getWeatherIcon(code) {
  const codeNum = parseInt(code) || 0;
  if (codeNum >= 200 && codeNum < 300) return '⛈️';
  if (codeNum >= 300 && codeNum < 600) return '🌧️';
  if (codeNum >= 600 && codeNum < 700) return '❄️';
  if (codeNum >= 700 && codeNum < 800) return '🌫️';
  if (codeNum === 800) return '☀️';
  if (codeNum > 800) return '⛅';
  return '🌤️';
}