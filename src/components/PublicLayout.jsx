import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Sprout, Menu, X, Home, BookOpen, Users, ChefHat, Bug, 
  Lightbulb, Grid3X3, Package, Calendar, LogIn, Sparkles,
  Lock, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const publicNav = [
  { name: 'Home', icon: Home, path: 'Landing' },
  { name: 'Plant Catalog', icon: Sprout, path: 'PlantCatalog' },
  { name: 'Community Gardens', icon: Users, path: 'BrowseGardens' },
  { name: 'Blog', icon: BookOpen, path: 'BlogList' },
  { name: 'Recipes', icon: ChefHat, path: 'Recipes' },
  { name: 'Pest Library', icon: Bug, path: 'PestLibrary' },
  { name: 'Resources', icon: Lightbulb, path: 'Resources' },
];

const appFeaturesNav = [
  { name: 'My Gardens', icon: Grid3X3, requiresAuth: true },
  { name: 'Planting Calendar', icon: Calendar, requiresAuth: true, page: 'CalendarPlanner' },
  { name: 'Companion Chart', icon: Sprout, requiresAuth: true, page: 'CompanionPlanner' },
  { name: 'Seed Stash', icon: Package, requiresAuth: true },
];

export default function PublicLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const handleLogin = () => {
    base44.auth.redirectToLogin(createPageUrl('Dashboard'));
  };

  const currentPath = location.pathname.split('/').pop();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/50 via-white to-emerald-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={createPageUrl('Landing')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg">
                <Sprout className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900 hidden sm:block">AwesomeGardener</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {publicNav.map(item => (
                <Link 
                  key={item.path} 
                  to={createPageUrl(item.path)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPath === item.path 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button 
                onClick={handleLogin}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
              
              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6 text-gray-700" />
                ) : (
                  <Menu className="w-6 h-6 text-gray-700" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-emerald-100">
              <div className="space-y-1">
                {publicNav.map(item => (
                  <Link 
                    key={item.path} 
                    to={createPageUrl(item.path)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      currentPath === item.path 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                ))}
                
                <div className="pt-3 mt-3 border-t border-gray-200">
                  <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Sign in to access
                  </p>
                  {appFeaturesNav.map(item => (
                    item.page ? (
                      <Link
                        key={item.name}
                        to={createPageUrl(item.page)}
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                      >
                        <item.icon className="w-5 h-5" />
                        {item.name}
                      </Link>
                    ) : (
                      <button
                        key={item.name}
                        onClick={handleLogin}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50"
                      >
                        <item.icon className="w-5 h-5" />
                        {item.name}
                        <Lock className="w-4 h-4 ml-auto" />
                      </button>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* CTA Banner */}
      <div className="sticky bottom-0 z-40 bg-gradient-to-r from-emerald-600 to-green-600 border-t border-emerald-700 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h3 className="text-white font-bold text-lg mb-1 flex items-center justify-center sm:justify-start gap-2">
                <Sparkles className="w-5 h-5" />
                Ready to plan your garden?
              </h3>
              <p className="text-emerald-100 text-sm">
                Create a free account to access the full garden planner, seed tracker, and more
              </p>
            </div>
            <Button 
              onClick={handleLogin}
              size="lg"
              className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold gap-2 shadow-xl"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                <Sprout className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white">AwesomeGardener</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="https://pepperseeds.net" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                PepperSeeds.net
              </a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-800 text-center text-sm">
            <p>© {new Date().getFullYear()} AwesomeGardener. Free gardening tools for everyone.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}