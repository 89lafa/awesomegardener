import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Public pages that don't require authentication
const publicPages = ['Landing', 'PublicGarden', 'PublicPlant', 'Community'];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleToggleSidebar = () => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
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
        window.location.href = '/Landing';
        return;
      }
    } catch (error) {
      console.error('Error loading user:', error);
      if (!isPublicPage) {
        window.location.href = '/Landing';
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
    window.location.href = '/Onboarding';
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {/* Sidebar - Desktop */}
      <div className={cn(sidebarCollapsed ? 'hidden' : 'hidden lg:block')}>
        <Sidebar 
          collapsed={false} 
          onToggle={handleToggleSidebar}
          currentPage={currentPageName}
          user={user}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 transform transition-transform duration-300",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar 
          collapsed={false} 
          onToggle={() => setMobileMenuOpen(false)}
          currentPage={currentPageName}
          user={user}
        />
      </div>

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "ml-0" : "lg:ml-64"
      )}>
        <TopBar 
          user={user} 
          onMobileMenuToggle={() => setMobileMenuOpen(true)}
          onSidebarToggle={handleToggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}