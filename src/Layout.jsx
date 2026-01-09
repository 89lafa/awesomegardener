import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Public pages that don't require authentication
const publicPages = ['Landing', 'PublicGarden', 'PublicPlant', 'Community'];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const handleMobileMenuToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleDesktopToggle = () => {
    const newCollapsed = !desktopSidebarCollapsed;
    setDesktopSidebarCollapsed(newCollapsed);
    localStorage.setItem('sidebar_collapsed', String(newCollapsed));
  };

  const isPublicPage = publicPages.includes(currentPageName);
  const isLandingPage = currentPageName === 'Landing';

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const userData = await base44.auth.me();
        
        // Check if user is blocked
        if (userData.is_blocked) {
          await base44.auth.logout();
          window.location.href = '/Landing?blocked=true';
          return;
        }
        
        setUser(userData);
      } else if (!isPublicPage) {
        // Redirect to landing for non-public pages
        window.location.href = createPageUrl('Landing');
        return;
      }
    } catch (error) {
      console.error('Error loading user:', error);
      if (!isPublicPage) {
        window.location.href = createPageUrl('Landing');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading AwesomeGardener...</p>
        </div>
      </div>
    );
  }

  // Landing page has its own layout
  if (isLandingPage) {
    return <div className="min-h-screen bg-[#FDFBF7]">{children}</div>;
  }

  // Public pages without sidebar
  if (isPublicPage && !user) {
    return <div className="min-h-screen bg-[#FDFBF7]">{children}</div>;
  }

  // Check if onboarding is needed
  if (user && !user.onboarding_completed && currentPageName !== 'Onboarding') {
    window.location.href = createPageUrl('Onboarding');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {/* Desktop Sidebar */}
      <div className={cn(desktopSidebarCollapsed ? 'hidden' : 'hidden lg:block')}>
        <Sidebar 
          collapsed={false} 
          onToggle={handleDesktopToggle}
          currentPage={currentPageName}
          user={user}
          isMobile={false}
        />
      </div>

      {/* Mobile Sidebar Overlay - BEHIND sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleMobileMenuToggle}
          style={{ pointerEvents: 'auto' }}
        />
      )}

      {/* Mobile Sidebar - ABOVE overlay */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 transform transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar 
          collapsed={false} 
          onToggle={handleMobileMenuToggle}
          currentPage={currentPageName}
          user={user}
          isMobile={true}
        />
      </div>

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        desktopSidebarCollapsed ? "ml-0" : "lg:ml-64"
      )}>
        <TopBar 
          user={user} 
          onMobileMenuToggle={handleMobileMenuToggle}
          onSidebarToggle={handleDesktopToggle}
          sidebarCollapsed={desktopSidebarCollapsed}
        />
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}