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
  Database,
  BookText,
  Bug
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const getNavItems = (userRole, isEditor) => {
    const items = [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
      { name: 'Plot Layout', icon: Hammer, page: 'MyGarden' },
      { name: 'My Garden', icon: TreeDeciduous, page: 'GardenPlanting' },
      { name: 'Plant Catalog', icon: BookOpen, page: 'PlantCatalog' },
      { name: 'Seed Stash', icon: Package, page: 'SeedStash' },
      { name: 'Grow Lists', icon: ListChecks, page: 'GrowLists' },
      { name: 'Tasks', icon: Calendar, page: 'CalendarTasks' },
      { name: 'Planting Calendar', icon: Sprout, page: 'CalendarPlanner' },
      { name: 'Diary', icon: BookText, page: 'GardenDiary' },
      { name: 'Issues Log', icon: Bug, page: 'IssuesLog' },
      { name: 'Browse Gardens', icon: Globe, page: 'BrowseGardens' },
      { name: 'Community Board', icon: MessageSquare, page: 'CommunityBoard' },
      { name: 'Feature Requests', icon: Lightbulb, page: 'FeatureRequests' },
    ];

  if (isEditor || userRole === 'admin') {
    items.push({ name: 'Review Queue', icon: Shield, page: 'EditorReviewQueue' });
    items.push({ name: 'Variety Reviews', icon: Sprout, page: 'VarietyReviewQueue' });
  }

  if (userRole === 'admin') {
    items.push({ name: 'Data Import', icon: Database, page: 'AdminDataImport' });
  }

  items.push({ name: 'Settings', icon: Settings, page: 'Settings' });
  
  return items;
};

export default function Sidebar({ collapsed, onToggle, currentPage, user }) {
  const navItems = getNavItems(user?.role, user?.is_editor);

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-[#1a2e12] text-white transition-all duration-300 z-50 flex flex-col",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center flex-shrink-0">
          <Sprout className="w-6 h-6 text-white" />
        </div>
        {!collapsed && (
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
              {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center text-white/70 hover:text-white hover:bg-white/5"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
      </div>

      {/* PepperSeeds Attribution */}
      {!collapsed && (
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