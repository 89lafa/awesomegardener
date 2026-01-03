import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PlotBuilder() {
  const [searchParams] = useSearchParams();
  const gardenId = searchParams.get('gardenId');

  useEffect(() => {
    console.log('[PlotBuilder] Redirecting to MyGarden...');
    // Redirect to MyGarden with garden ID
    const targetUrl = gardenId 
      ? createPageUrl('MyGarden') + `?gardenId=${gardenId}`
      : createPageUrl('MyGarden');
    window.location.href = targetUrl;
  }, [gardenId]);

  return null;
}