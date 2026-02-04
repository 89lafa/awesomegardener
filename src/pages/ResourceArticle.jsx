import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import ReactMarkdown from 'react-markdown';

export default function ResourceArticle() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const resourceId = params.get('id');

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (resourceId) {
      loadArticle();
    }
  }, [resourceId]);

  const loadArticle = async () => {
    try {
      const results = await base44.entities.Resource.filter({ id: resourceId });
      if (results.length > 0) {
        setArticle(results[0]);
        
        // Increment view count
        await base44.entities.Resource.update(resourceId, {
          view_count: (results[0].view_count || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error loading article:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Article not found</p>
        <Button
          variant="outline"
          onClick={() => window.location.href = createPageUrl('Resources')}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Resources
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Button
        variant="outline"
        onClick={() => window.location.href = createPageUrl('Resources')}
        size="sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Resources
      </Button>

      {article.hero_image_url && (
        <div className="h-64 lg:h-96 rounded-xl overflow-hidden">
          <img
            src={article.hero_image_url}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
          {article.title}
        </h1>
        {article.author && (
          <p className="text-sm text-gray-600">By {article.author}</p>
        )}
      </div>

      <div className="prose prose-emerald max-w-none">
        <ReactMarkdown>{article.content}</ReactMarkdown>
      </div>

      {article.tags?.length > 0 && (
        <div className="pt-6 border-t">
          <p className="text-sm text-gray-600 mb-2">Tags:</p>
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}