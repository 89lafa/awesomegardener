import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportFromURLDialog({ open, onOpenChange, onImported }) {
  const [url, setUrl] = useState('');
  const [extracting, setExtracting] = useState(false);

  const handleExtract = async () => {
    if (!url) {
      toast.error('Please enter a URL');
      return;
    }

    setExtracting(true);
    try {
      const response = await base44.functions.invoke('extractSeedDataFromURL', { url });
      
      if (response.data.success) {
        onImported?.(response.data.data);
        onOpenChange(false);
        setUrl('');
        toast.success('Seed data extracted! Review and save.');
      } else {
        toast.error('Could not extract data from URL');
      }
    } catch (error) {
      console.error('Extract error:', error);
      toast.error('Failed to extract: ' + (error.response?.data?.error || error.message));
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Vendor URL</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Seed Product URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://vendorsite.com/product/..."
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Paste a seed vendor product page URL to auto-extract variety details
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExtract}
            disabled={extracting || !url}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {extracting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Extracting...
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4 mr-2" />
                Extract Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}