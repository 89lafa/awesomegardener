import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Leaf, Archive, Calendar, MoreHorizontal, Mail,
  LayoutDashboard, TreeDeciduous, Hammer, BookOpen, ListChecks, Globe, 
  Lightbulb, Settings, Sprout, Shield, BookText, Bug, Apple, MapPin, Link2,
  MessageSquare, ChefHat, Award, Target, Trophy
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  Drawer, 
  DrawerTrigger, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerFooter, 
  DrawerClose 
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Get more menu items from sidebar structure
const getMoreMenuItems = (user) => {
  const isAdmin = user?.role === 'admin';
  const isEditor = user?.is_editor;
  const isMod = user?.is_moderator;
  
  return [
    { category: 'PLANTING & PLANNING' },
    { name: 'Gardens', icon: Globe, page: 'Gardens' },
    { name: 'My Plants', icon: Apple, page: 'MyPlants' },
    { name: 'Grow Lists', icon: ListChecks, page: 'GrowLists' },
    
    { category: 'GARDEN MANAGEMENT' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Tasks', icon: ListChecks, page: 'CalendarTasks' },
    { name: 'Indoor Grow', icon: Sprout, page: 'IndoorGrowSpaces' },
    { name: 'Houseplants', icon: Sprout, page: 'IndoorPlants' },
    { name: 'My Indoor Plants', icon: Sprout, page: 'MyIndoorPlants' },
    { name: 'Plot Layout', icon: Hammer, page: 'MyGarden' },
    { name: 'Garden Planting', icon: TreeDeciduous, page: 'GardenPlanting' },
    
    { category: 'TRACKING' },
    { name: 'Diary', icon: BookText, page: 'GardenDiary' },
    { name: 'Harvest Log', icon: Apple, page: 'HarvestLog' },
    { name: 'Issues Log', icon: Bug, page: 'IssuesLog' },
    
    { category: 'COMMUNITY' },
    { name: 'Seed Trading', icon: Apple, page: 'SeedTrading' },
    { name: 'Companion Planting', icon: Sprout, page: 'CompanionPlanner' },
    { name: 'Browse Gardens', icon: Globe, page: 'BrowseGardens' },
    { name: 'Leaderboard', icon: Trophy, page: 'Leaderboard' },
    
    { category: 'GAMIFICATION' },
    { name: 'Achievements', icon: Award, page: 'Achievements' },
    { name: 'Challenges', icon: Target, page: 'Challenges' },
    
    { category: 'AI TOOLS' },
    { name: 'AI Assistants', icon: Lightbulb, page: 'AIAssistants' },
    { name: 'Recipes', icon: ChefHat, page: 'Recipes' },
    
    { category: 'LEARN & EXPLORE' },
    { name: 'Resources', icon: Link2, page: 'Resources' },
    { name: 'Community Board', icon: MessageSquare, page: 'CommunityBoard' },
    { name: 'Feature Requests', icon: Lightbulb, page: 'FeatureRequests' },
    
    { category: 'SETTINGS' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
    
    ...(isEditor || isAdmin || isMod 
      ? [
          { category: 'ADMIN' },
          { name: 'Admin Hub', icon: Shield, page: 'AdminHub' },
          { name: 'Manage Achievements', icon: Award, page: 'AdminAchievements' },
          { name: 'Manage Challenges', icon: Target, page: 'AdminChallenges' },
          { name: 'Manage Recipes', icon: ChefHat, page: 'AdminRecipes' },
        ]
      : []
    ),
  ];
};

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const [user, setUser] = useState(null);
  
  // Stack Preservation: Load last visited paths from localStorage
  const getStoredPath = (tabRoot) => {
    return localStorage.getItem(`bottomnav_stack_${tabRoot}`) || tabRoot;
  };
  
  const setStoredPath = (tabRoot, path) => {
    localStorage.setItem(`bottomnav_stack_${tabRoot}`, path);
  };
  
  // Track current path changes to update localStorage
  useEffect(() => {
    const currentPath = location.pathname;
    
    // Determine which tab this path belongs to
    if (currentPath.startsWith('/Dashboard') || currentPath === '/') {
      setStoredPath('/Dashboard', currentPath);
    } else if (currentPath.includes('PlantCatalog') || currentPath.includes('ViewVariety')) {
      setStoredPath('/PlantCatalog', currentPath);
    } else if (currentPath.includes('SeedStash')) {
      setStoredPath('/SeedStash', currentPath);
    } else if (currentPath.includes('Messages')) {
      setStoredPath('/Messages', currentPath);
    }
  }, [location.pathname]);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };
  
  const items = [
    { path: '/Dashboard', icon: Home, label: 'Home' },
    { path: '/PlantCatalog', icon: Leaf, label: 'Plants' },
    { path: '/SeedStash', icon: Archive, label: 'Seeds' },
    { path: '/Messages', icon: Mail, label: 'Messages' },
  ];

  const handleTabClick = (tabPath) => {
    const currentPath = location.pathname;
    
    // Check if we're currently on this tab (or a sub-page of this tab)
    const isOnTab = currentPath === tabPath || getStoredPath(tabPath) === currentPath;
    
    if (isOnTab && currentPath === tabPath) {
      // Already on root, clicking again -> reset stack
      setStoredPath(tabPath, tabPath);
      navigate(tabPath, { replace: true });
    } else if (isOnTab && currentPath !== tabPath) {
      // On a sub-page of this tab, clicking tab -> go to root
      setStoredPath(tabPath, tabPath);
      navigate(tabPath);
    } else {
      // Switching to different tab -> restore last visited path
      const storedPath = getStoredPath(tabPath);
      navigate(storedPath);
    }
  };
  
  const moreMenuItems = user ? getMoreMenuItems(user) : [];
  
  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 border-t lg:hidden z-50 backdrop-blur-md bg-white dark:bg-gray-900" style={{ borderColor: 'var(--border-default)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around h-16">
          {items.map(item => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleTabClick(item.path)}
                className="flex flex-col items-center justify-center min-w-[64px] touch-manipulation text-gray-700 dark:text-gray-300"
                style={{ 
                  color: isActive ? '#10b981' : undefined
                }}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowMoreDrawer(true)}
            className="flex flex-col items-center justify-center min-w-[64px] touch-manipulation text-gray-700 dark:text-gray-300"
          >
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-xs">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Drawer */}
      <Drawer open={showMoreDrawer} onOpenChange={setShowMoreDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>More Navigation</DrawerTitle>
            <DrawerDescription>Access all app features</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="h-[70vh] px-4">
            <div className="space-y-1 pb-4">
              {moreMenuItems.map((item, idx) => {
                if (item.category) {
                  return (
                    <div key={`cat-${idx}`} className="pt-4 pb-2 px-3 mt-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{item.category}</p>
                    </div>
                  );
                }
                
                const Icon = item.icon;
                return (
                  <button
                    key={item.page}
                    onClick={() => {
                      navigate(createPageUrl(item.page));
                      setShowMoreDrawer(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all touch-manipulation",
                      location.pathname.includes(item.page) 
                        ? "bg-emerald-50 text-emerald-700" 
                        : "text-gray-700 active:bg-gray-100"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium text-sm">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}