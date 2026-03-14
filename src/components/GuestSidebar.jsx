import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Home, Leaf, BookOpen, Bug, ChefHat, BookMarked, 
  Users, Calendar, ShoppingBag, Sprout, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function GuestSidebar({ isOpen, onClose }) {
  const location = useLocation();

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.pathname);
  };

  const publicNavItems = [
    { name: 'Home', icon: Home, path: 'Landing', public: true },
    { name: 'Plant Catalog', icon: Leaf, path: 'PlantCatalog', public: true },
    { name: 'Blog', icon: BookOpen, path: 'Blog', public: true },
    { name: 'Pest & Disease Library', icon: Bug, path: 'PestLibrary', public: true },
    { name: 'Recipes', icon: ChefHat, path: 'Recipes', public: true },
    { name: 'Resources', icon: BookMarked, path: 'Resources', public: true },
    { name: 'Companion Planting', icon: Users, path: 'CompanionPlanting', public: true },
    { name: 'When To Plant', icon: Calendar, path: 'PlantingCalendar', public: true },
    { name: 'Market', icon: ShoppingBag, path: 'Market', public: true },
  ];

  const privateNavItems = [
    { name: 'My Dashboard', icon: Sprout, path: 'Dashboard', requiresAuth: true },
    { name: 'My Gardens', icon: Leaf, path: 'Gardens', requiresAuth: true },
    { name: 'Seed Stash', icon: Leaf, path: 'SeedStash', requiresAuth: true },
  ];

  return (
    <div 
      className={`fixed inset-0 bg-black/50 z-50 lg:hidden transition-opacity ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div 
        className={`fixed left-0 top-0 bottom-0 w-72 bg-white shadow-2xl transform transition-transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b bg-gradient-to-r from-emerald-600 to-green-600">
          <h2 className="text-xl font-bold text-white">AwesomeGardener</h2>
          <p className="text-xs text-emerald-100">Grow Smarter, Together</p>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-180px)] p-4 space-y-6">
          {/* Public Pages */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
              Browse
            </h3>
            <nav className="space-y-1">
              {publicNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === createPageUrl(item.path);
                return (
                  <Link
                    key={item.path}
                    to={createPageUrl(item.path)}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-emerald-100 text-emerald-700 font-medium' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Private Pages (Login Required) */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Members Only
            </h3>
            <nav className="space-y-1">
              {privateNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={handleLogin}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{item.name}</span>
                    <Lock className="w-3 h-3 ml-auto" />
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Login CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
          <Button 
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
          >
            Sign In / Create Account
          </Button>
        </div>
      </div>
    </div>
  );
}