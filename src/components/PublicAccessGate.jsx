import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Sparkles, Leaf, Calendar, Users, BookOpen } from 'lucide-react';

export default function PublicAccessGate({ children, pageName }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authed = await base44.auth.isAuthenticated();
      setIsAuthenticated(authed);
    } catch (e) {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.pathname);
  };

  // Public pages that don't require authentication
  const publicPages = [
    'Landing',
    'PlantCatalog',
    'Catalog', 
    'Blog',
    'BlogPost',
    'PestLibrary',
    'Recipes',
    'Resources',
    'CompanionPlanting',
    'PlantingCalendar', // For "When To Plant" chart
    'Market'
  ];

  const isPublicPage = publicPages.includes(pageName);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // If authenticated or public page, show content
  if (isAuthenticated || isPublicPage) {
    return <>{children}</>;
  }

  // Show beautiful "Create Account" gate for private pages
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-2xl border-2 border-emerald-100">
        <CardContent className="p-8 sm:p-12">
          <div className="text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                <Lock className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Join AwesomeGardener
              </h1>
              <p className="text-lg text-gray-600">
                Create a free account to access this feature
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4 py-6">
              <div className="flex flex-col items-center gap-2 p-4 bg-emerald-50 rounded-lg">
                <Calendar className="w-6 h-6 text-emerald-600" />
                <span className="text-sm font-medium text-gray-700">Garden Planner</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-green-50 rounded-lg">
                <Leaf className="w-6 h-6 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Seed Tracker</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Grow Logs</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-purple-50 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Community</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3 pt-4">
              <Button 
                onClick={handleLogin}
                className="w-full h-12 text-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Create Free Account
              </Button>
              
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <button 
                  onClick={handleLogin}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold underline"
                >
                  Sign In
                </button>
              </p>
            </div>

            {/* Footer Note */}
            <p className="text-xs text-gray-400 pt-4 border-t">
              100% free to use • No credit card required • Start gardening smarter today
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}