import React, { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function ShareButton({ title, text, url, imageUrl }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error);
        }
      }
    } else {
      handleCopy();
    }
  };

  const shareToFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbUrl, '_blank', 'width=600,height=400');
  };

  const shareToX = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleWebShare}>
          <Share2 className="w-4 h-4 mr-2" />
          Share...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToFacebook}>
          📘 Share to Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToX}>
          🐦 Share to X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          📸 Copy for Instagram/TikTok
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}