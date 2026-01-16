import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function ShareButton({ type, id, title }) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    const baseUrl = window.location.origin;
    if (type === 'topic') {
      return `${baseUrl}/ForumTopic?id=${id}`;
    }
    return window.location.href;
  };

  const handleCopyLink = () => {
    const url = getShareUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (platform) => {
    const url = getShareUrl();
    const text = title || 'Check out this discussion';
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'reddit':
        shareUrl = `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
        break;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Share2 className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('twitter')}>
          Share on Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('facebook')}>
          Share on Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('reddit')}>
          Share on Reddit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}