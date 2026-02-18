import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Leaf, Archive, Mail, MoreHorizontal, ChevronDown, ChevronUp, ArrowUp,
  LayoutDashboard, TreeDeciduous, Hammer, BookOpen, ListChecks, Calendar, Globe,
  MessageSquare, Lightbulb, Settings, Sprout, Shield, BookText, Bug, Apple, MapPin,
  Link2, ChefHat, Award, Target, Trophy, Package
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerFooter, 
  DrawerClose 
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const getMoreMenuItems = (user) => {
  const isAdmin = user?.role === 'admin';
  const isEditor = user?.is_editor;
  const isMod = user?.is_moderator;
  
  return [
    { category: 'PLANTING & PLANNING' },
    { name: 'Plant Catalog', icon: BookOpen, page: 'PlantCatalog' },
    { name: 'Gardens', icon: Globe, page: 'Gardens' },
    { name: 'My Garden Plants', icon: Apple, page: 'MyPlants' },
    { name: 'Grow Lists', icon: ListChecks, page: 'GrowLists' },
    
    { category: 'GARDEN MANAGEMENT' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Tasks', icon: ListChecks, page: 'CalendarTasks' },
    { name: 'Indoor Grow', icon: Sprout, page: 'IndoorGrowSpaces' },
    { name: 'Houseplant Spaces', icon: Sprout, page: 'IndoorPlants' },
    { name: 'My Houseplants', icon: Sprout, page: 'MyIndoorPlants' },
    { name: 'Ready to Plant', icon: Sprout, page: 'ReadyToPlantSeedlings' },
    { name: 'Plot Layout', icon: Hammer, page: 'MyGarden' },
    { name: 'Garden Spaces', icon: TreeDeciduous, page: 'GardenPlanting' },
    
    { category: 'TRACKING' },
    { name: 'Tracking', icon: BookText, page: 'Tracking' },
    
    { category: 'COMMUNITY' },
    { name: 'Seed Trading', icon: Apple, page: 'SeedTrading' },
    { name: 'Companion Planting', icon: Sprout, page: 'CompanionPlanner' },
    { name: 'Browse Gardens', icon: Globe, page: 'BrowseGardens' },
    { name: 'Leaderboard', icon: Trophy, page: 'LeaderboardV2' },
    
    { category: 'GAMIFICATION' },
    { name: 'Achievements', icon: Award, page: 'Achievements' },
    { name: 'Challenges', icon: Target, page: 'Challenges' },
    
    { category: 'AI TOOLS' },
    { name: 'AI Assistants', icon: Lightbulb, page: 'AIAssistants' },
    { name: 'Recipes', icon: ChefHat, page: 'Recipes' },
    
    { category: 'LEARN & EXPLORE' },
    { name: 'Resources', icon: Link2, page: 'Resources' },
    { name: 'Blog & News', icon: BookText, page: 'BlogList' },
    { name: 'Community Board', icon: MessageSquare, page: 'CommunityBoard' },
    { name: 'Feature Requests', icon: Lightbulb, page: 'FeatureRequests' },
    
    { category: 'SETTINGS' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
    { name: 'Zone Map', icon: MapPin, page: 'ZoneMap' },
    
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

// Floating "Back to Top" button component
function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-all duration-300 flex items-center justify-center lg:hidden"
          style={{
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

export default function CollapsibleBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const [user, setUser] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('bottom_nav_collapsed') === 'true';
  });
  
  const getStoredPath = (tabRoot) => {
    return localStorage.getItem(`bottomnav_stack_${tabRoot}`) || tabRoot;
  };
  
  const setStoredPath = (tabRoot, path) => {
    localStorage.setItem(`bottomnav_stack_${tabRoot}`, path);
  };
  
  useEffect(() => {
    const currentPath = location.pathname;
    
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

  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    localStorage.setItem('bottom_nav_collapsed', String(newCollapsed));
  };
  
  const items = [
    { path: '/Dashboard', icon: Home, label: 'Home' },
    { path: '/PlantCatalog', icon: Leaf, label: 'Plants' },
    { path: '/SeedStash', icon: Archive, label: 'Seeds' },
    { path: '/Messages', icon: Mail, label: 'Messages' },
  ];

  const handleTabClick = (tabPath) => {
    const currentPath = location.pathname;
    const storedPath = getStoredPath(tabPath);
    const isCurrentlyOnThisTab = currentPath.startsWith(tabPath);
    
    if (isCurrentlyOnThisTab && currentPath === tabPath) {
      // Already on root - do nothing or reload
      navigate(tabPath, { replace: true });
    } else if (isCurrentlyOnThisTab) {
      // On a sub-page of this tab - go to root
      setStoredPath(tabPath, tabPath);
      navigate(tabPath);
    } else {
      // Switching tabs - go to stored path or root
      navigate(storedPath || tabPath);
    }
  };
  
  const moreMenuItems = user ? getMoreMenuItems(user) : [];
  
  return (
    <>
      {/* Back to Top Button */}
      <BackToTopButton />

      {/* Collapse/Expand Button - ALWAYS VISIBLE */}
      <button
        onClick={toggleCollapse}
        className="fixed bottom-2 right-2 lg:hidden z-[60] bg-emerald-600 text-white rounded-full p-2 shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
        style={{ 
          bottom: isCollapsed ? '8px' : `calc(64px + env(safe-area-inset-bottom, 0px) + 8px)`
        }}
      >
        {isCollapsed ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Bottom Navigation Bar */}
      <nav 
        className={cn(
          "fixed left-0 right-0 border-t lg:hidden backdrop-blur-md bg-white dark:bg-gray-900 transition-all duration-300",
          isCollapsed ? 'bottom-[-64px]' : 'bottom-0'
        )}
        style={{ 
          borderColor: 'var(--border-default)', 
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 50
        }}
      >
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