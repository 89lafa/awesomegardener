import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2 } from 'lucide-react';

export default function InstallPWAButton({ size = "lg", className = "" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // Listen for PWA install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback for iOS or if prompt not available
      if (isIOS) {
        alert('To install AwesomeGardener:\n\n1. Tap the Share button\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm');
      } else {
        alert('Your browser doesn\'t support app installation. Try using Chrome, Edge, or Safari.');
      }
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  // Don't show if already installed
  if (isInstalled) {
    return (
      <Button 
        variant="outline"
        size={size}
        className={className}
        disabled
      >
        <CheckCircle2 className="w-5 h-5 mr-2" />
        App Installed
      </Button>
    );
  }

  // Show install button if prompt is available OR on iOS
  if (deferredPrompt || isIOS) {
    return (
      <Button 
        onClick={handleInstallClick}
        variant="outline"
        size={size}
        className={`border-emerald-600 text-emerald-700 hover:bg-emerald-50 ${className}`}
      >
        <Download className="w-5 h-5 mr-2" />
        Install App
      </Button>
    );
  }

  // Don't show button if not supported
  return null;
}