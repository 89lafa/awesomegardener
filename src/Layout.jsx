import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BottomNav from '@/components/layout/BottomNav';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Public pages that don't require authentication
const publicPages = ['Landing', 'PublicGarden', 'PublicPlant', 'Community', 'GardeningBasics'];

export default function Layout({ children, currentPageName }) {
  const [authState, setAuthState] = useState('loading');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const openMobileMenu = () => {
    setMobileMenuOpen(true);
  };

  const toggleDesktopSidebar = () => {
    const newCollapsed = !desktopSidebarCollapsed;
    setDesktopSidebarCollapsed(newCollapsed);
    localStorage.setItem('sidebar_collapsed', String(newCollapsed));
  };

  const isPublicPage = publicPages.includes(currentPageName);
  const isLandingPage = currentPageName === 'Landing';

  useEffect(() => {
    loadUser();
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
        if (!isPublicPage) {
          // Redirect to landing for non-public pages
          window.location.href = createPageUrl('Landing');
          return;
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setAuthState('unauthenticated');
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

  // Check if onboarding is needed (only after auth is fully resolved)
  if (authState === 'authenticated' && user && !user.onboarding_completed && currentPageName !== 'Onboarding') {
    window.location.href = createPageUrl('Onboarding');
    return null;
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-[#FDFBF7]">
      {/* Desktop Sidebar */}
      <div className={cn('hidden lg:block', desktopSidebarCollapsed && 'lg:hidden')}>
        <Sidebar 
          collapsed={false} 
          onToggle={toggleDesktopSidebar}
          currentPage={currentPageName}
          user={user}
          isMobile={false}
        />
      </div>

      {/* Mobile Backdrop Overlay - CRITICAL: Must be BELOW sidebar in z-index */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 lg:hidden"
          style={{ zIndex: 45 }}
          onClick={closeMobileMenu}
          onTouchEnd={closeMobileMenu}
        />
      )}

      {/* Mobile Sidebar - CRITICAL: Must be ABOVE overlay */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 w-64 lg:hidden transition-transform duration-300 ease-in-out",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ zIndex: 50 }}
      >
        <Sidebar 
          collapsed={false} 
          onToggle={closeMobileMenu}
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
          onMobileMenuToggle={openMobileMenu}
          onSidebarToggle={toggleDesktopSidebar}
          sidebarCollapsed={desktopSidebarCollapsed}
        />
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
      {user && <BottomNav />}
    </div>
    </ErrorBoundary>
  );
}