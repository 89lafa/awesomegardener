import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Loader, Package, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function BarcodeScanner({ onScanComplete, onClose }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addingToStash, setAddingToStash] = useState(false);
  
  const scannerRef = useRef(null);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  async function startScanner() {
    try {
      setError(null);
      
      const scanner = new Html5Qrcode("barcode-scanner-container");
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777
        },
        async (decodedText) => {
          console.log('Scanned:', decodedText);
          await handleBarcode(decodedText);
          stopScanner();
        },
        (errorMessage) => {
          // Ignore scan errors
        }
      );
      
      setScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setError('Could not start camera. Please allow camera permissions.');
    }
  }

  function stopScanner() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(console.error);
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function handleBarcode(barcode) {
    setLoading(true);
    
    try {
      const currentUser = await base44.auth.me();
      
      let product = null;
      try {
        const products = await base44.entities.ProductBarcode.filter({ barcode: barcode });
        if (products.length > 0) {
          product = products[0];
        }
      } catch (e) {
        console.log('Product not found in database');
      }
      
      await base44.entities.ScanHistory.create({
        user_id: currentUser.id,
        barcode: barcode,
        scan_date: new Date().toISOString(),
        product_found: !!product,
        product_id: product?.id || null,
        added_to_stash: false
      });
      
      if (product) {
        await base44.entities.ProductBarcode.update(product.id, {
          scan_count: (product.scan_count || 0) + 1
        });
        
        setResult({ product });
      } else {
        setResult({ notFound: true, barcode });
      }
      
    } catch (error) {
      console.error('Lookup error:', error);
      setError('Error looking up barcode. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function addToStash() {
    if (!result?.product) return;
    
    setAddingToStash(true);
    
    try {
      const product = result.product;
      
      let profileId = null;
      if (product.variety_id) {
        const variety = await base44.entities.Variety.filter({ id: product.variety_id });
        if (variety.length > 0) {
          const profiles = await base44.entities.PlantProfile.filter({
            variety_name: variety[0].variety_name
          });
          if (profiles.length > 0) {
            profileId = profiles[0].id;
          }
        }
      }
      
      await base44.entities.SeedLot.create({
        plant_profile_id: profileId,
        custom_label: product.variety_name || product.product_name,
        source_vendor_name: product.vendor,
        quantity: 1,
        lot_notes: `Added via barcode scan: ${product.barcode}`,
        year_acquired: new Date().getFullYear()
      });
      
      const scans = await base44.entities.ScanHistory.filter({
        barcode: product.barcode
      });
      if (scans.length > 0) {
        await base44.entities.ScanHistory.update(scans[scans.length - 1].id, { 
          added_to_stash: true 
        });
      }
      
      toast.success(`Added ${product.variety_name || product.product_name} to seed stash!`);
      onScanComplete(product);
      
    } catch (error) {
      console.error('Error adding to stash:', error);
      toast.error('Could not add to seed stash. Please try again.');
    } finally {
      setAddingToStash(false);
    }
  }

  function rescan() {
    setResult(null);
    setError(null);
    startScanner();
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <button
        onClick={() => {
          stopScanner();
          onClose();
        }}
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/20 rounded-full z-10"
      >
        <X size={24} />
      </button>

      {!result && !loading && (
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">📱 Scan Barcode</h2>
              <p className="text-gray-600 text-sm">Point camera at the barcode on the seed packet</p>
            </div>
            
            <div id="barcode-scanner-container" className="w-full min-h-[300px]" />
            
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                {error}
              </div>
            )}
            
            <div className="p-4">
              <p className="text-center text-gray-500 text-sm">
                Position the barcode within the frame
              </p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <Loader className="w-12 h-12 mx-auto text-emerald-500 animate-spin mb-4" />
          <h3 className="text-lg font-bold">Looking up barcode...</h3>
        </div>
      )}

      {result?.product && (
        <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
          <div className="p-4 border-b bg-emerald-50">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle size={24} />
              <h3 className="text-xl font-bold">Product Found!</h3>
            </div>
          </div>
          
          <div className="p-4">
            {result.product.image_url && (
              <img 
                src={result.product.image_url} 
                alt={result.product.product_name}
                className="w-full h-48 object-contain mb-4 rounded-lg bg-gray-100"
              />
            )}
            
            <div className="space-y-3">
              <div>
                <h4 className="text-2xl font-bold">
                  {result.product.variety_name || result.product.product_name}
                </h4>
                {result.product.plant_type && (
                  <p className="text-emerald-600 font-medium">{result.product.plant_type}</p>
                )}
              </div>
              
              {result.product.vendor && (
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-gray-400" />
                  <span>{result.product.vendor}</span>
                </div>
              )}
              
              {result.product.packet_size && (
                <p className="text-gray-600">Size: {result.product.packet_size}</p>
              )}
              
              {result.product.description && (
                <p className="text-gray-600 text-sm">{result.product.description}</p>
              )}
              
              <p className="text-xs text-gray-400">
                Barcode: {result.product.barcode}
              </p>
            </div>
          </div>
          
          <div className="p-4 border-t flex gap-3">
            <Button
              onClick={rescan}
              variant="outline"
              className="flex-1"
            >
              Scan Another
            </Button>
            <Button
              onClick={addToStash}
              disabled={addingToStash}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600"
            >
              {addingToStash ? (
                <Loader size={18} className="animate-spin mr-2" />
              ) : (
                <Plus size={18} className="mr-2" />
              )}
              Add to Seed Stash
            </Button>
          </div>
        </div>
      )}

      {result?.notFound && (
        <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
          <div className="p-4 border-b bg-amber-50">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertCircle size={24} />
              <h3 className="text-xl font-bold">Barcode Not Found</h3>
            </div>
          </div>
          
          <div className="p-4 text-center">
            <p className="text-gray-600 mb-2">
              This barcode isn't in our database yet:
            </p>
            <p className="font-mono text-lg font-bold mb-4">
              {result.barcode}
            </p>
            <p className="text-gray-500 text-sm">
              You can still add this seed manually to your stash.
            </p>
          </div>
          
          <div className="p-4 border-t space-y-2">
            <Button
              onClick={rescan}
              className="w-full"
            >
              Scan Different Barcode
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}