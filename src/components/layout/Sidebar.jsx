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
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const getNavItems = (userRole, isEditor, user) => {
    const items = [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
      { name: 'Gardens', icon: Globe, page: 'Gardens' },
      { name: 'Plot Layout', icon: Hammer, page: 'MyGarden' },
      { name: 'My Garden', icon: TreeDeciduous, page: 'GardenPlanting' },
      { name: 'Plant Catalog', icon: BookOpen, page: 'PlantCatalog' },
      { name: 'Seed Stash', icon: Package, page: 'SeedStash' },
      { name: 'Grow Lists', icon: ListChecks, page: 'GrowLists' },
      { name: 'Tasks', icon: Calendar, page: 'CalendarTasks' },
      { name: 'Calendar Planner', icon: Sprout, page: 'Calendar' },
      { name: 'My Plants', icon: Apple, page: 'MyPlants' },
      { name: 'Companion Planting', icon: Sprout, page: 'CompanionPlanner' },
      { name: 'Diary', icon: BookText, page: 'GardenDiary' },
      { name: 'Harvest Log', icon: Apple, page: 'HarvestLog' },
      { name: 'Issues Log', icon: Bug, page: 'IssuesLog' },
      { name: 'Garden Care', icon: Sprout, page: 'GardenCare' },
      { name: 'Browse Gardens', icon: Globe, page: 'BrowseGardens' },
      { name: 'Community Board', icon: MessageSquare, page: 'CommunityBoard' },
      { name: 'Messages', icon: Mail, page: 'Messages' },
      { name: 'Notifications', icon: Bell, page: 'Notifications' },
      { name: 'Zone Map', icon: MapPin, page: 'ZoneMap' },
      { name: 'Gardening Basics', icon: BookMarked, page: 'GardeningBasics' },
      { name: 'Resources', icon: Link2, page: 'Resources' },
      { name: 'Feature Requests', icon: Lightbulb, page: 'FeatureRequests' },
    ];

  // Admin/Moderator/Editor consolidated hub
  if (isEditor || userRole === 'admin' || user?.is_moderator) {
    items.push({ name: 'Admin Hub', icon: Shield, page: 'AdminHub' });
  }

  items.push({ name: 'Settings', icon: Settings, page: 'Settings' });
  
  return items;
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
        {navItems.map((item) => {
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