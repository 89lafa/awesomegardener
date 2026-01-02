import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AdBanner({ 
  placement = 'top_banner',
  pageType = 'dashboard',
  plantTypeId = null,
  varietyId = null,
  className = ''
}) {
  const [content, setContent] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, [pageType, plantTypeId, varietyId]);

  const loadContent = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let contents = await base44.entities.MonetizationContent.filter({
        placement,
        is_active: true
      }, '-priority', 10);

      // Filter by targeting
      contents = contents.filter(c => {
        // Page type targeting
        if (c.targeting?.page_type && !c.targeting.page_type.includes(pageType)) {
          return false;
        }
        // Date range
        if (c.active_from && c.active_from > today) return false;
        if (c.active_to && c.active_to < today) return false;
        return true;
      });

      // Prioritize by plant type/variety match
      if (plantTypeId) {
        const matched = contents.find(c => c.targeting?.plant_type_id === plantTypeId);
        if (matched) {
          setContent(matched);
          setLoading(false);
          return;
        }
      }

      // Fall back to first available
      setContent(contents[0] || null);
    } catch (error) {
      console.error('Error loading ad content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async () => {
    if (!content) return;

    try {
      // Track click
      await base44.entities.ClickEvent.create({
        content_id: content.id,
        placement: content.placement,
        page_type: pageType,
        object_id: plantTypeId || varietyId,
        landing_url: content.landing_url
      });

      // Build URL with UTM params
      const url = new URL(content.landing_url);
      url.searchParams.set('utm_source', content.utm_source || 'awesomegardener');
      url.searchParams.set('utm_medium', content.utm_medium || placement);
      url.searchParams.set('utm_campaign', content.utm_campaign || 'general');

      window.open(url.toString(), '_blank');
    } catch (error) {
      console.error('Error tracking click:', error);
      window.open(content.landing_url, '_blank');
    }
  };

  if (loading || !content || dismissed) return null;

  const isAffiliate = content.content_type === 'affiliate';

  if (placement === 'top_banner') {
    return (
      <div className={cn(
        "relative bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-4 mb-6",
        className
      )}>
        <div className="flex items-center gap-4">
          {content.image_url && (
            <img 
              src={content.image_url} 
              alt={content.title}
              className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{content.title}</h3>
            {content.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{content.description}</p>
            )}
            {isAffiliate && content.disclosure_text && (
              <p className="text-xs text-gray-400 mt-1">{content.disclosure_text}</p>
            )}
          </div>
          <Button onClick={handleClick} className="bg-emerald-600 hover:bg-emerald-700 gap-2 flex-shrink-0">
            Shop Seeds
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 text-gray-400 hover:text-gray-600"
          onClick={() => setDismissed(true)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  if (placement === 'inline_card') {
    return (
      <div className={cn(
        "bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
        className
      )} onClick={handleClick}>
        {content.image_url && (
          <img 
            src={content.image_url} 
            alt={content.title}
            className="w-full h-32 object-cover rounded-lg mb-3"
          />
        )}
        <h4 className="font-medium text-gray-900 mb-1">{content.title}</h4>
        {content.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-2">{content.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-emerald-600 text-sm font-medium">Shop Now →</span>
          {isAffiliate && (
            <span className="text-xs text-gray-400">Affiliate</span>
          )}
        </div>
      </div>
    );
  }

  // Side banner
  return (
    <div className={cn(
      "bg-gradient-to-b from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-4",
      className
    )}>
      {content.image_url && (
        <img 
          src={content.image_url} 
          alt={content.title}
          className="w-full h-40 object-cover rounded-lg mb-3"
        />
      )}
      <h4 className="font-semibold text-gray-900 mb-2">{content.title}</h4>
      {content.description && (
        <p className="text-sm text-gray-600 mb-3">{content.description}</p>
      )}
      <Button onClick={handleClick} className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
        Shop Seeds
        <ExternalLink className="w-4 h-4" />
      </Button>
      {isAffiliate && content.disclosure_text && (
        <p className="text-xs text-gray-400 mt-2 text-center">{content.disclosure_text}</p>
      )}
    </div>
  );
}