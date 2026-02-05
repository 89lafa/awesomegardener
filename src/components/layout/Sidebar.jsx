import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  LayoutDashboard, 
  TreeDeciduous, 
  Hammer, 
  BookOpen, 
  Package, 
  ListChecks, 
  Calendar, 
  Globe,
  MessageSquare,
  Lightbulb,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sprout,
  Shield,
  BookText,
  Bug,
  Apple,
  MapPin,
  BookMarked,
  Link2,
  Mail,
  ChefHat,
  Award,
  Target,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const getNavItems = (userRole, isEditor, user) => {
  return [
    // Main features
    { category: true, label: 'PLANTING & PLANNING' },
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Plant Catalog', icon: BookOpen, page: 'PlantCatalog' },
    { name: 'Seed Stash', icon: Package, page: 'SeedStash' },
    { name: 'Grow Lists', icon: ListChecks, page: 'GrowLists' },
    { name: 'Gardens', icon: Globe, page: 'Gardens' },
    { name: 'My Plants', icon: Apple, page: 'MyPlants' },
    
    // Garden management
    { category: true, label: 'GARDEN MANAGEMENT' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Tasks', icon: ListChecks, page: 'CalendarTasks' },
    { name: 'Indoor Grow', icon: Sprout, page: 'IndoorGrowSpaces' },
    { name: 'Ready to Plant', icon: Sprout, page: 'ReadyToPlantSeedlings' },
    { name: 'Plot Layout', icon: Hammer, page: 'MyGarden' },
    { name: 'Garden Planting', icon: TreeDeciduous, page: 'GardenPlanting' },
    
    // Tracking - Single Section with Tabs
    { category: true, label: 'TRACKING' },
    { name: 'Tracking', icon: BookText, page: 'Tracking' },
    
    // Trading & community
    { category: true, label: 'COMMUNITY' },
    { name: 'Seed Trading', icon: Apple, page: 'SeedTrading' },
    { name: 'Companion Planting', icon: Sprout, page: 'CompanionPlanner' },
    { name: 'Browse Gardens', icon: Globe, page: 'BrowseGardens' },
    { name: 'Leaderboard', icon: Trophy, page: 'LeaderboardV2' },
    
    // Gamification
    { category: true, label: 'GAMIFICATION' },
    { name: 'Achievements', icon: Award, page: 'Achievements' },
    { name: 'Challenges', icon: Target, page: 'Challenges' },
    
    // AI Tools
    { category: true, label: 'AI TOOLS' },
    { name: 'AI Assistants', icon: Lightbulb, page: 'AIAssistants' },
    { name: 'Recipes', icon: ChefHat, page: 'Recipes' },
    
    // Resources
    { category: true, label: 'LEARN & EXPLORE' },
    { name: 'Resources', icon: Link2, page: 'Resources' },
    { name: 'Community Board', icon: MessageSquare, page: 'CommunityBoard' },
    { name: 'Feature Requests', icon: Lightbulb, page: 'FeatureRequests' },
    
    // Settings
    { category: true, label: 'SETTINGS' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
    { name: 'Zone Map', icon: MapPin, page: 'ZoneMap' },
    
    // Admin (conditional)
    ...(isEditor || userRole === 'admin' || user?.is_moderator 
      ? [
          { category: true, label: 'ADMIN' },
          { name: 'Admin Hub', icon: Shield, page: 'AdminHub' },
        ]
      : []
    ),
  ];
};

export default function Sidebar({ collapsed, onToggle, currentPage, user, isMobile }) {
  const navItems = getNavItems(user?.role, user?.is_editor, user);
  
  // On mobile, don't apply collapsed state
  const effectiveCollapsed = isMobile ? false : collapsed;

  return (
    <aside className={cn(
      "h-full bg-[#1a2e12] text-white flex flex-col",
      effectiveCollapsed ? "w-16" : "w-64",
      isMobile ? "w-64" : "fixed left-0 top-0"
    )}>
      {/* Logo */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center flex-shrink-0">
          <Sprout className="w-6 h-6 text-white" />
        </div>
        {!effectiveCollapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-lg leading-tight">AwesomeGardener</h1>
            <p className="text-xs text-emerald-300/70">Plan • Grow • Harvest</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item, idx) => {
          if (item.category) {
            return !effectiveCollapsed ? (
              <div key={`cat-${idx}`} className="pt-2 px-3 pb-1 mt-2">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">{item.label}</p>
              </div>
            ) : null;
          }
          
          const isActive = currentPage === item.page;
          return (
            <Link
              key={item.name}
              to={createPageUrl(item.page)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                isActive 
                  ? "bg-emerald-500/20 text-emerald-300" 
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-emerald-400")} />
              {!effectiveCollapsed && <span className="font-medium text-sm">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          className="w-full flex items-center justify-start gap-2 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors touch-manipulation"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{isMobile ? 'Close Menu' : 'Collapse'}</span>
        </button>
      </div>

      {/* PepperSeeds Attribution */}
      {!effectiveCollapsed && (
        <div className="p-4 border-t border-white/10">
          <a 
            href="https://pepperseeds.net" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-emerald-300/60 hover:text-emerald-300 transition-colors"
          >
            Powered by PepperSeeds.net
          </a>
        </div>
      )}
    </aside>
  );
}