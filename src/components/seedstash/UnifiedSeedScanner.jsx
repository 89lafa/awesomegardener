import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Loader2, Camera, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function UnifiedSeedScanner({ onScanComplete, onClose }) {
  const [step, setStep] = useState('choice'); // choice, barcode_scan, not_found_transition, packet_capture, ai_processing, review, success
  const [scannedBarcode, setScannedBarcode] = useState(null);
  const [matchedProduct, setMatchedProduct] = useState(null);
  const [packetImage, setPacketImage] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  
  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBarcodeScanner();
      stopCamera();
    };
  }, []);

  // Auto-transition from not_found to packet_capture
  useEffect(() => {
    if (step === 'not_found_transition') {
      const timer = setTimeout(() => {
        setStep('packet_capture');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // ========== BARCODE SCANNING ==========
  const startBarcodeScanner = async () => {
    try {
      setError(null);
      const container = document.getElementById('barcode-scanner-container');
      if (!container) {
        setError('Scanner container not found');
        return;
      }

      const scanner = new Html5Qrcode('barcode-scanner-container');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
          await handleBarcode(decodedText);
          stopBarcodeScanner();
        }
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setError('Could not start camera. Please allow permissions.');
    }
  };

  const stopBarcodeScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
  };

  const handleBarcode = async (barcode) => {
    setScannedBarcode(barcode);

    try {
      const results = await base44.entities.SeedVendorBarcode.filter({ barcode });

      if (results.length > 0) {
        setMatchedProduct(results[0]);
        setStep('found');
        
        // Increment scan count
        await base44.entities.SeedVendorBarcode.update(results[0].id, {
          scan_count: (results[0].scan_count || 0) + 1,
          last_scanned_date: new Date().toISOString()
        });
      } else {
        setStep('not_found_transition');
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      toast.error('Error looking up barcode');
    }
  };

  const rescanBarcode = () => {
    stopBarcodeScanner();
    setScannedBarcode(null);
    setMatchedProduct(null);
    setError(null);
    setStep('barcode_scan');
    setTimeout(() => startBarcodeScanner(), 300);
  };

  // ========== PACKET PHOTO CAPTURE ==========
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      setError('Could not access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPacketImage(dataUrl);
    stopCamera();
    processPacketImage(dataUrl);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setPacketImage(dataUrl);
      stopCamera();
      processPacketImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // ========== AI PROCESSING ==========
  const processPacketImage = async (imageDataUrl) => {
    setStep('ai_processing');
    setProcessing(true);
    setProgress(0);

    try {
      // Upload image first
      setProgress(10);
      const blob = await (await fetch(imageDataUrl)).blob();
      const file = new File([blob], 'packet.jpg', { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setProgress(30);

      // AI enrichment
      const enrichResult = await base44.functions.invoke('enrichSeedFromPacketScan', {
        packet_image_base64: file_url,
        barcode: scannedBarcode
      });
      setProgress(60);

      if (!enrichResult.data.success) {
        throw new Error(enrichResult.data.error || 'AI processing failed');
      }

      const extracted = enrichResult.data.extracted_data;
      setProgress(80);

      // Find existing variety
      const matchResult = await base44.functions.invoke('findExistingVariety', {
        variety_name: extracted.variety_name,
        plant_type_name: extracted.plant_type_name
      });
      setProgress(95);

      setExtractedData({
        ...extracted,
        packetImageUrl: file_url,
        matchResult: matchResult.data
      });
      setProgress(100);
      setStep('review');

    } catch (error) {
      console.error('Processing error:', error);
      setError('Failed to process packet. Please try again.');
      toast.error('Processing failed');
      setStep('packet_capture');
    } finally {
      setProcessing(false);
    }
  };

  // ========== SAVE TO STASH ==========
  const confirmAndSave = async () => {
    setProcessing(true);
    try {
      const result = await base44.functions.invoke('saveScannedSeed', {
        scannedBarcode,
        extractedData,
        matchResult: extractedData.matchResult,
        packetImageUrl: extractedData.packetImageUrl,
        addToStash: true
      });

      if (result.data.success) {
        setStep('success');
        setTimeout(() => {
          onScanComplete(result.data);
        }, 2000);
      } else {
        throw new Error(result.data.error);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save');
    } finally {
      setProcessing(false);
    }
  };

  // ========== UI HELPERS ==========
  useEffect(() => {
    if (step === 'barcode_scan') {
      setTimeout(() => startBarcodeScanner(), 300);
    } else if (step === 'packet_capture') {
      setTimeout(() => startCamera(), 300);
    }

    return () => {
      if (step === 'barcode_scan') stopBarcodeScanner();
      if (step === 'packet_capture') stopCamera();
    };
  }, [step]);

  // ========== RENDER ==========
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <button
        onClick={() => {
          stopBarcodeScanner();
          stopCamera();
          onClose();
        }}
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/20 rounded-full z-10"
      >
        <X size={24} />
      </button>

      {/* CHOICE SCREEN */}
      {step === 'choice' && (
        <div className="bg-white rounded-2xl w-full max-w-lg p-6">
          <h2 className="text-2xl font-bold mb-2">Scan Seed Packet</h2>
          <p className="text-gray-600 mb-6">How do you want to add this seed?</p>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setStep('barcode_scan')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all"
            >
              <div className="text-4xl mb-3">📱</div>
              <h3 className="font-bold mb-1">Scan Barcode</h3>
              <p className="text-sm text-gray-600">Quick lookup if known</p>
            </button>

            <button
              onClick={() => setStep('packet_capture')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all"
            >
              <div className="text-4xl mb-3">📸</div>
              <h3 className="font-bold mb-1">Photo Packet</h3>
              <p className="text-sm text-gray-600">AI reads & fills data</p>
            </button>
          </div>
        </div>
      )}

      {/* BARCODE SCAN */}
      {step === 'barcode_scan' && (
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">📱 Scanning Barcode</h2>
              <p className="text-gray-600 text-sm">Point camera at barcode</p>
            </div>
            <div id="barcode-scanner-container" className="w-full min-h-[300px]" />
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div className="p-4">
              <Button variant="outline" onClick={() => setStep('packet_capture')} className="w-full">
                📸 Switch to Photo Instead
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* BARCODE FOUND */}
      {step === 'found' && matchedProduct && (
        <div className="bg-white rounded-2xl w-full max-w-lg">
          <div className="p-4 border-b bg-emerald-50">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle size={24} />
              <h3 className="text-xl font-bold">Found!</h3>
            </div>
          </div>
          
          <div className="p-6">
            {matchedProduct.packet_image_url && (
              <img 
                src={matchedProduct.packet_image_url} 
                alt={matchedProduct.product_name}
                className="w-full h-48 object-contain mb-4 rounded-lg bg-gray-100"
              />
            )}
            <h3 className="text-2xl font-bold mb-1">{matchedProduct.product_name}</h3>
            <p className="text-emerald-600 font-medium mb-3">{matchedProduct.vendor_name}</p>
            <p className="text-sm text-gray-500">Barcode: {matchedProduct.barcode}</p>
          </div>
          
          <div className="p-4 border-t flex gap-3">
            <Button variant="outline" onClick={rescanBarcode} className="flex-1">
              📷 Scan Another
            </Button>
            <Button onClick={confirmAndSave} disabled={processing} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add to Stash
            </Button>
          </div>
        </div>
      )}

      {/* NOT FOUND TRANSITION */}
      {step === 'not_found_transition' && (
        <div className="bg-white rounded-2xl w-full max-w-lg p-6">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Barcode: {scannedBarcode}</h3>
            <p className="text-gray-600 mb-4">This barcode isn't in our database yet.</p>
            <p className="text-gray-500 mb-4">Let's scan the packet to identify it!</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div className="bg-emerald-500 h-2 rounded-full animate-pulse" style={{ width: '70%' }} />
            </div>
            <p className="text-sm text-gray-500">Opening packet scanner...</p>
            <Button onClick={() => setStep('packet_capture')} className="mt-4 w-full">
              📸 Scan Packet Now
            </Button>
          </div>
        </div>
      )}

      {/* PACKET CAPTURE */}
      {step === 'packet_capture' && (
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">📷 Scan Seed Packet</h2>
              <p className="text-gray-600 text-sm">Center packet in frame with good lighting</p>
              {scannedBarcode && (
                <p className="text-xs text-emerald-600 mt-1">✓ Barcode saved: {scannedBarcode}</p>
              )}
            </div>

            <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {/* Guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative w-[75%] aspect-[2/3] border-2 border-white rounded-lg" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}>
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-white text-sm font-medium">
                    Center packet in frame
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <Button onClick={capturePhoto} className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-lg">
                <Camera className="w-5 h-5 mr-2" />
                Capture Front
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {/* AI PROCESSING */}
      {step === 'ai_processing' && (
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="text-center">
            {packetImage && (
              <img src={packetImage} alt="Packet" className="w-32 h-32 object-cover rounded-lg mx-auto mb-4" />
            )}
            <Loader2 className="w-12 h-12 mx-auto text-emerald-500 animate-spin mb-4" />
            <h3 className="text-xl font-bold mb-2">Analyzing packet...</h3>
            
            <div className="space-y-2 text-sm text-left mb-4">
              <div className="flex items-center gap-2">
                {progress > 20 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Reading packet text...</span>
              </div>
              <div className="flex items-center gap-2">
                {progress > 50 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Identifying variety & vendor...</span>
              </div>
              <div className="flex items-center gap-2">
                {progress > 80 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Checking Plant Catalog...</span>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-gray-500 mt-2">{progress}%</p>
          </div>
        </div>
      )}

      {/* REVIEW SCREEN */}
      {step === 'review' && extractedData && (
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold mb-2">Review Scanned Seed</h2>
            {extractedData.matchResult?.action === 'link_barcode' && (
              <p className="text-emerald-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Matched to existing catalog entry
              </p>
            )}
            {extractedData.matchResult?.action === 'create_new' && (
              <p className="text-blue-600">🆕 New variety - will be added to catalog</p>
            )}
          </div>

          <div className="p-6">
            {packetImage && (
              <img src={packetImage} alt="Packet" className="w-full h-48 object-contain rounded-lg bg-gray-100 mb-6" />
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Variety:</strong> {extractedData.variety_name}</div>
              <div><strong>Type:</strong> {extractedData.plant_type_name}</div>
              <div><strong>Vendor:</strong> {extractedData.vendor_name}</div>
              {extractedData.days_to_maturity && <div><strong>DTM:</strong> {extractedData.days_to_maturity} days</div>}
              {extractedData.spacing_recommended && <div><strong>Spacing:</strong> {extractedData.spacing_recommended}"</div>}
              {extractedData.sun_requirement && <div><strong>Sun:</strong> {extractedData.sun_requirement?.replace(/_/g, ' ')}</div>}
              {extractedData.seed_line_type && <div><strong>Type:</strong> {extractedData.seed_line_type}</div>}
              {extractedData.packet_size && <div><strong>Packet:</strong> {extractedData.packet_size}</div>}
            </div>

            {extractedData.confidence_score && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">AI Confidence: </span>
                <span className="font-bold">{extractedData.confidence_score}%</span>
              </div>
            )}
          </div>

          <div className="p-6 border-t flex gap-3">
            <Button variant="outline" onClick={() => setStep('packet_capture')} className="flex-1">
              🔄 Rescan
            </Button>
            <Button onClick={confirmAndSave} disabled={processing} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              ✅ Confirm & Add to Stash
            </Button>
          </div>
        </div>
      )}

      {/* SUCCESS SCREEN */}
      {step === 'success' && (
        <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center">
          <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Added to Stash!</h2>
          <p className="text-gray-600 mb-4">{extractedData?.variety_name} added successfully</p>
          
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-emerald-800">
              🌱 This barcode is now in our database. Next time anyone scans it, they'll get an instant match. Thanks for contributing!
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep('choice'); setScannedBarcode(null); setExtractedData(null); }} className="flex-1">
              📷 Scan Another
            </Button>
            <Button onClick={() => onClose()} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              ← Back to Stash
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}