import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Loader2, Camera, Upload, CheckCircle, AlertCircle, Package, Edit } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================
// RATE LIMIT PROTECTION
// ============================================================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isRateLimitError(error) {
  if (!error) return false;
  const msg = (error?.message || error?.toString() || '').toLowerCase();
  return (
    msg.includes('rate limit') || msg.includes('rate_limit') ||
    msg.includes('too many requests') || msg.includes('429') ||
    msg.includes('quota') || msg.includes('throttl')
  );
}

async function safeApiCall(fn, label = '', maxRetries = 2) {
  let backoffMs = 2500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (isRateLimitError(error) && attempt < maxRetries) {
        console.warn(`[Scanner] ${label} rate limited, attempt ${attempt + 1}. Waiting ${backoffMs}ms...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 15000);
        continue;
      }
      throw error;
    }
  }
}

// Cached user — avoid calling auth.me() on every scan
let _cachedScannerUser = null;
let _cachedScannerUserTime = 0;
const SCANNER_USER_CACHE_TTL = 5 * 60 * 1000;

async function getCachedUser() {
  const now = Date.now();
  if (_cachedScannerUser && (now - _cachedScannerUserTime) < SCANNER_USER_CACHE_TTL) {
    return _cachedScannerUser;
  }
  _cachedScannerUser = await base44.auth.me();
  _cachedScannerUserTime = now;
  return _cachedScannerUser;
}

/**
 * Run an async function with a timeout.
 * If the function doesn't resolve in `ms`, rejects with a timeout error.
 */
function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    )
  ]);
}

// ============================================================
// COMPONENT
// ============================================================

export default function UnifiedSeedScanner({ onScanComplete, onClose }) {
  const [step, setStep] = useState('choice');
  const [scannedBarcode, setScannedBarcode] = useState(null);
  const [matchedProduct, setMatchedProduct] = useState(null);
  const [packetImage, setPacketImage] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState(null);
  const [stashData, setStashData] = useState({
    quantity: '',
    year_acquired: new Date().getFullYear(),
    storage_location: ''
  });
  
  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopBarcodeScanner();
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (step === 'not_found_transition') {
      const timer = setTimeout(() => {
        if (mountedRef.current) setStep('packet_capture');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [step]);

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

  // ==========================================================
  // BARCODE SCANNER
  // ==========================================================

  const startBarcodeScanner = async () => {
    try {
      setError(null);
      const container = document.getElementById('barcode-scanner-container');
      if (!container) {
        setError('Scanner container not found');
        return;
      }

      // FIX: Make sure old scanner is fully stopped before starting new one
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch (e) {}
        scannerRef.current = null;
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

  // ==========================================================
  // FIX: handleBarcode — cached user, rate limit protection,
  // non-critical calls wrapped in try/catch so they don't block
  // ==========================================================
  const handleBarcode = async (barcode) => {
    setScannedBarcode(barcode);
    setProcessing(true);

    try {
      const results = await safeApiCall(
        () => base44.entities.SeedVendorBarcode.filter({ barcode }),
        'Barcode lookup'
      );

      if (results.length > 0) {
        setMatchedProduct(results[0]);
        setStep('found');
        
        // Non-critical: update scan count (fire-and-forget, don't block)
        safeApiCall(
          () => base44.entities.SeedVendorBarcode.update(results[0].id, {
            scan_count: (results[0].scan_count || 0) + 1,
            last_scanned_date: new Date().toISOString()
          }),
          'Update scan count'
        ).catch(err => console.warn('[Scanner] Non-critical: scan count update failed', err.message));

        // Non-critical: log scan history (fire-and-forget)
        getCachedUser().then(user => {
          safeApiCall(
            () => base44.entities.ScanHistory.create({
              user_id: user.id,
              barcode: barcode,
              scan_date: new Date().toISOString(),
              product_found: true,
              product_id: results[0].id,
              added_to_stash: false
            }),
            'Log scan history'
          ).catch(err => console.warn('[Scanner] Non-critical: scan history failed', err.message));
        });
      } else {
        // Not found — log and transition to packet scan
        // Non-critical: log scan history (fire-and-forget)
        getCachedUser().then(user => {
          safeApiCall(
            () => base44.entities.ScanHistory.create({
              user_id: user.id,
              barcode: barcode,
              scan_date: new Date().toISOString(),
              product_found: false,
              added_to_stash: false
            }),
            'Log scan history (not found)'
          ).catch(err => console.warn('[Scanner] Non-critical: scan history failed', err.message));
        });
        
        setStep('not_found_transition');
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      if (isRateLimitError(error)) {
        toast.error('Rate limited — please wait a moment and try again');
        await sleep(3000);
      } else {
        toast.error('Error looking up barcode');
      }
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================================
  // FIX: Full reset between scans — clears ALL state
  // ==========================================================
  const resetForNewScan = () => {
    stopBarcodeScanner();
    stopCamera();
    setScannedBarcode(null);
    setMatchedProduct(null);
    setExtractedData(null);
    setPacketImage(null);
    setError(null);
    setProcessing(false);
    setProgress(0);
    setProgressMessage('');
    setStashData({
      quantity: '',
      year_acquired: new Date().getFullYear(),
      storage_location: ''
    });
    setStep('choice');
  };

  // ==========================================================
  // CAMERA
  // ==========================================================

  const startCamera = async () => {
    try {
      // FIX: Stop any existing stream before starting new one
      stopCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current && mountedRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      } else {
        // Component unmounted, clean up
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.error('Camera error:', error);
      setError('Could not access camera. Try uploading a photo instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const guideWidth = video.videoWidth * 0.75;
    const guideHeight = guideWidth * 1.5;
    const guideX = (video.videoWidth - guideWidth) / 2;
    const guideY = (video.videoHeight - guideHeight) / 2;

    canvas.width = guideWidth;
    canvas.height = guideHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, guideX, guideY, guideWidth, guideHeight, 0, 0, guideWidth, guideHeight);

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

  // ==========================================================
  // AI PACKET PROCESSING — with rate limit protection + timeout
  // ==========================================================
  const processPacketImage = async (imageDataUrl) => {
    setStep('ai_processing');
    setProcessing(true);
    setProgress(0);
    setProgressMessage('Uploading image...');

    try {
      setProgress(10);
      const blob = await (await fetch(imageDataUrl)).blob();
      const file = new File([blob], 'packet.jpg', { type: 'image/jpeg' });
      
      const { file_url } = await safeApiCall(
        () => base44.integrations.Core.UploadFile({ file }),
        'Upload packet image'
      );
      
      setProgress(30);
      setProgressMessage('Reading packet text...');

      // FIX: Add timeout — AI functions can hang indefinitely
      const enrichResult = await withTimeout(
        safeApiCall(
          () => base44.functions.invoke('enrichSeedFromPacketScan', {
            packet_image_base64: file_url,
            barcode: scannedBarcode
          }),
          'AI enrich'
        ),
        45000, // 45 second timeout
        'AI packet analysis'
      );
      
      setProgress(60);
      setProgressMessage('Identifying variety & vendor...');

      if (!enrichResult.data.success) {
        throw new Error(enrichResult.data.error || 'AI processing failed');
      }

      const extracted = enrichResult.data.extracted_data;
      
      setProgress(80);
      setProgressMessage('Checking Plant Catalog...');

      await sleep(500); // Small delay before next API call

      // FIX: Add timeout on catalog match too
      const matchResult = await withTimeout(
        safeApiCall(
          () => base44.functions.invoke('findExistingVariety', {
            variety_name: extracted.variety_name,
            plant_type_name: extracted.plant_type_name
          }),
          'Catalog match'
        ),
        20000, // 20 second timeout
        'Catalog matching'
      );
      
      setProgress(95);
      setProgressMessage('Preparing results...');

      setExtractedData({
        ...extracted,
        packetImageUrl: file_url,
        matchResult: matchResult.data
      });

      if (extracted.packet_size) {
        const seedCount = parseInt(extracted.packet_size);
        if (!isNaN(seedCount)) {
          setStashData(prev => ({ ...prev, quantity: seedCount }));
        }
      }

      setProgress(100);
      setTimeout(() => {
        if (mountedRef.current) setStep('review');
      }, 300);

    } catch (error) {
      console.error('Processing error:', error);
      const msg = error?.message || 'Processing failed';
      
      if (isRateLimitError(error)) {
        setError('Rate limited — please wait 10 seconds and try again.');
        toast.error('Rate limited. Please wait and retry.');
      } else if (msg.includes('timed out')) {
        setError('Processing took too long. Please try again.');
        toast.error('Processing timed out. Try again.');
      } else {
        setError('Failed to process packet. Please try again.');
        toast.error('Processing failed');
      }
      setStep('packet_capture');
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================================
  // FIX: confirmAndSave — with timeout + retry + proper error handling
  // Old code: no timeout, no retry — spinner spins forever on 429 or timeout
  // ==========================================================
  const confirmAndSave = async () => {
    setProcessing(true);
    try {
      const result = await withTimeout(
        safeApiCall(
          () => base44.functions.invoke('saveScannedSeed', {
            scannedBarcode,
            extractedData,
            matchResult: extractedData.matchResult,
            packetImageUrl: extractedData.packetImageUrl,
            addToStash: true
          }),
          'Save scanned seed',
          3 // More retries for the critical save operation
        ),
        30000, // 30 second timeout
        'Saving seed'
      );

      if (result.data.success) {
        if (mountedRef.current) setStep('success');
      } else {
        throw new Error(result.data.error || 'Save returned unsuccessful');
      }
    } catch (error) {
      console.error('Save error:', error);
      const msg = error?.message || 'Failed to save';
      
      if (isRateLimitError(error)) {
        toast.error('Rate limited — wait a moment and tap Confirm again');
      } else if (msg.includes('timed out')) {
        toast.error('Save timed out. Please try again.');
      } else {
        toast.error('Failed to save: ' + msg);
      }
    } finally {
      if (mountedRef.current) setProcessing(false);
    }
  };

  // ==========================================================
  // FIX: addBarcodeMatchToStash — extracted from inline onClick,
  // with rate limit protection + cached user
  // ==========================================================
  const addBarcodeMatchToStash = async () => {
    setProcessing(true);
    try {
      if (!matchedProduct?.variety_id) {
        toast.error('Missing variety data');
        return;
      }

      const variety = await safeApiCall(
        () => base44.entities.Variety.filter({ id: matchedProduct.variety_id }),
        'Fetch variety'
      );
      if (variety.length === 0) {
        toast.error('Variety not found in catalog');
        return;
      }

      await sleep(300);

      // Try to find existing profile
      let profileId = null;
      try {
        const profiles = await safeApiCall(
          () => base44.entities.PlantProfile.filter({ variety_name: variety[0].variety_name }),
          'Find profile'
        );
        if (profiles.length > 0) {
          profileId = profiles[0].id;
        }
      } catch (err) {
        console.warn('[Scanner] Profile lookup failed (non-critical):', err.message);
      }

      await sleep(300);

      await safeApiCall(
        () => base44.entities.SeedLot.create({
          plant_profile_id: profileId,
          custom_label: variety[0].variety_name,
          source_vendor_name: matchedProduct.vendor_name,
          quantity: parseInt(stashData.quantity) || 1,
          year_acquired: parseInt(stashData.year_acquired) || new Date().getFullYear(),
          storage_location: stashData.storage_location || null,
          lot_notes: `Added via barcode scan: ${matchedProduct.barcode}`,
          from_catalog: true
        }),
        'Create seed lot'
      );
      
      toast.success('Added to stash!');
      if (mountedRef.current) setStep('success');
    } catch (error) {
      console.error('Error adding to stash:', error);
      if (isRateLimitError(error)) {
        toast.error('Rate limited — wait a moment and try again');
      } else {
        toast.error('Failed to add to stash');
      }
    } finally {
      if (mountedRef.current) setProcessing(false);
    }
  };

  const handleClose = () => {
    stopBarcodeScanner();
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/20 rounded-full z-10"
      >
        <X size={24} />
      </button>

      {/* ============================================ */}
      {/* STEP: CHOICE */}
      {/* ============================================ */}
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

          <p className="text-center text-gray-500 text-sm mt-4">
            Either way, we'll help you add it to your stash!
          </p>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: BARCODE SCAN */}
      {/* ============================================ */}
      {step === 'barcode_scan' && (
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">📱 Scanning Barcode</h2>
              <p className="text-gray-600 text-sm">Point camera at barcode on seed packet</p>
            </div>
            <div id="barcode-scanner-container" className="w-full min-h-[300px] bg-gray-900" />
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div className="p-4 space-y-2">
              <p className="text-center text-gray-500 text-sm">Position barcode within frame</p>
              <Button variant="outline" onClick={() => setStep('packet_capture')} className="w-full">
                📸 Switch to Photo Instead
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: BARCODE FOUND */}
      {/* ============================================ */}
      {step === 'found' && matchedProduct && (
        <div className="bg-white rounded-2xl w-full max-w-lg">
          <div className="p-4 border-b bg-emerald-50">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle size={24} />
              <h3 className="text-xl font-bold">Barcode Match!</h3>
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
            <p className="text-emerald-600 font-medium mb-2">{matchedProduct.vendor_name}</p>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              <p>Type: {matchedProduct.plant_type_name}</p>
              {matchedProduct.packet_size && <p>Size: {matchedProduct.packet_size}</p>}
              <p className="text-xs text-gray-400">Barcode: {matchedProduct.barcode}</p>
            </div>

            <div className="space-y-3 bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold">Add to Your Stash</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    type="number"
                    value={stashData.quantity}
                    onChange={(e) => setStashData({...stashData, quantity: e.target.value})}
                    placeholder="50"
                  />
                </div>
                <div>
                  <Label className="text-xs">Year</Label>
                  <Input
                    type="number"
                    value={stashData.year_acquired}
                    onChange={(e) => setStashData({...stashData, year_acquired: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Storage Location</Label>
                <Input
                  value={stashData.storage_location}
                  onChange={(e) => setStashData({...stashData, storage_location: e.target.value})}
                  placeholder="Seed Box A"
                />
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t flex gap-3">
            <Button variant="outline" onClick={resetForNewScan} className="flex-1">
              📷 Scan Another
            </Button>
            {/* FIX: Extracted inline handler to proper function with rate limit protection */}
            <Button 
              onClick={addBarcodeMatchToStash} 
              disabled={processing} 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add to Stash
            </Button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: NOT FOUND TRANSITION */}
      {/* ============================================ */}
      {step === 'not_found_transition' && (
        <div className="bg-white rounded-2xl w-full max-w-lg p-6">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">New Barcode!</h3>
            <p className="font-mono text-lg text-gray-700 mb-3">{scannedBarcode}</p>
            <p className="text-gray-600 mb-2">This barcode isn't in our database yet.</p>
            <p className="text-gray-500 mb-4">Let's scan the packet to identify it!</p>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div className="bg-emerald-500 h-2 rounded-full animate-pulse transition-all" style={{ width: '70%' }} />
            </div>
            <p className="text-sm text-gray-500 mb-4">Opening packet scanner...</p>
            
            <div className="flex gap-2">
              <Button onClick={() => setStep('packet_capture')} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                📸 Scan Packet Now
              </Button>
              <Button variant="outline" onClick={handleClose} className="flex-1">
                ✋ Add Manually
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: PACKET CAPTURE */}
      {/* FIX: Removed DOUBLE dark overlay that made everything too dark */}
      {/* Old code had bg-black/50 div AND boxShadow 9999px overlay = double darkness */}
      {/* New code uses ONLY the boxShadow on the guide rectangle — one clean overlay */}
      {/* ============================================ */}
      {step === 'packet_capture' && (
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">📷 Scan Seed Packet</h2>
              <p className="text-gray-600 text-sm">Center packet in frame with good lighting</p>
              {scannedBarcode && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Barcode saved: {scannedBarcode}
                </p>
              )}
            </div>

            <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
              {!error && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  
                  {/* FIX: SINGLE overlay via boxShadow only — removed the bg-black/50 div
                      Old code had TWO overlapping dark layers:
                      1. <div className="absolute inset-0 bg-black/50" />
                      2. boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' on guide rectangle
                      Combined = 75% darkness, making buttons behind barely visible.
                      Now: just the boxShadow at 40% opacity = clear, readable UI */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div 
                      className="relative border-4 border-white rounded-lg" 
                      style={{ 
                        width: '75%', 
                        aspectRatio: '2/3',
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)'
                      }}
                    >
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-white text-sm font-medium bg-black/60 px-3 py-1 rounded whitespace-nowrap">
                        Center packet here
                      </span>
                      <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-emerald-400"></div>
                      <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-emerald-400"></div>
                      <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-emerald-400"></div>
                      <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-emerald-400"></div>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-center justify-center h-full bg-gray-800">
                  <div className="text-white text-center p-4">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                    <p className="mb-4">{error}</p>
                    <Button onClick={() => { setError(null); startCamera(); }} variant="outline" className="text-white border-white">
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 space-y-2 bg-white">
              <Button onClick={capturePhoto} disabled={!!error} className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-lg">
                <Camera className="w-5 h-5 mr-2" />
                Capture Front
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                Upload from Gallery
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

      {/* ============================================ */}
      {/* STEP: AI PROCESSING */}
      {/* ============================================ */}
      {step === 'ai_processing' && (
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="text-center">
            {packetImage && (
              <img src={packetImage} alt="Packet" className="w-32 h-32 object-cover rounded-lg mx-auto mb-4 border-2 border-gray-200" />
            )}
            <Loader2 className="w-12 h-12 mx-auto text-emerald-500 animate-spin mb-4" />
            <h3 className="text-xl font-bold mb-2">Analyzing Packet...</h3>
            
            <div className="space-y-2 text-sm text-left mb-4">
              <div className="flex items-center gap-2">
                {progress > 25 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                <span className={progress > 25 ? 'text-emerald-600' : 'text-gray-500'}>Reading packet text...</span>
              </div>
              <div className="flex items-center gap-2">
                {progress > 55 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                <span className={progress > 55 ? 'text-emerald-600' : 'text-gray-500'}>Identifying variety & vendor...</span>
              </div>
              <div className="flex items-center gap-2">
                {progress > 75 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                <span className={progress > 75 ? 'text-emerald-600' : 'text-gray-500'}>Searching growing information...</span>
              </div>
              <div className="flex items-center gap-2">
                {progress > 85 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                <span className={progress > 85 ? 'text-emerald-600' : 'text-gray-500'}>Checking Plant Catalog...</span>
              </div>
              <div className="flex items-center gap-2">
                {progress > 95 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                <span className={progress > 95 ? 'text-emerald-600' : 'text-gray-500'}>Preparing record...</span>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div className="bg-emerald-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-gray-500">{progress}%</p>
            <p className="text-xs text-gray-400 mt-2">This usually takes 5-15 seconds</p>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: REVIEW */}
      {/* ============================================ */}
      {step === 'review' && extractedData && (
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto pb-24 md:pb-0">
          <div className="p-6 border-b sticky top-0 bg-white z-10">
            <h2 className="text-2xl font-bold mb-2">Review Scanned Seed</h2>
            {extractedData.matchResult?.action === 'link_barcode' && (
              <p className="text-emerald-600 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Matched to existing catalog entry</span>
              </p>
            )}
            {extractedData.matchResult?.action === 'create_new' && (
              <p className="text-blue-600 flex items-center gap-2 font-medium">
                <span className="text-xl">🆕</span>
                New variety - will be added to catalog
              </p>
            )}
            {scannedBarcode && (
              <p className="text-xs text-gray-500 mt-1">Barcode: {scannedBarcode}</p>
            )}
          </div>

          <div className="p-6 space-y-4">
            {packetImage && (
              <div className="flex justify-center">
                <img src={packetImage} alt="Packet" className="max-w-xs h-48 object-contain rounded-lg border-2 border-gray-200" />
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Extracted Data
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><strong>Variety:</strong> {extractedData.variety_name || 'Unknown'}</div>
                <div><strong>Type:</strong> {extractedData.plant_type_name || 'Unknown'}</div>
                <div><strong>Vendor:</strong> {extractedData.vendor_name || 'Unknown'}</div>
                {extractedData.days_to_maturity && <div><strong>DTM:</strong> {extractedData.days_to_maturity} days</div>}
                {extractedData.spacing_recommended && <div><strong>Spacing:</strong> {extractedData.spacing_recommended}"</div>}
                {extractedData.sun_requirement && <div><strong>Sun:</strong> {extractedData.sun_requirement?.replace(/_/g, ' ')}</div>}
                {extractedData.water_requirement && <div><strong>Water:</strong> {extractedData.water_requirement}</div>}
                {extractedData.seed_line_type && <div><strong>Seed Type:</strong> {extractedData.seed_line_type}</div>}
                {extractedData.packet_size && <div><strong>Packet Size:</strong> {extractedData.packet_size}</div>}
                {extractedData.retail_price && <div><strong>Price:</strong> ${extractedData.retail_price}</div>}
              </div>
              {extractedData.confidence_score && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">AI Confidence:</span>
                  <span className="font-bold text-emerald-600">{extractedData.confidence_score}%</span>
                </div>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold">Add to Your Stash</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    type="number"
                    value={stashData.quantity}
                    onChange={(e) => setStashData({...stashData, quantity: e.target.value})}
                    placeholder={extractedData.packet_size || '50'}
                  />
                </div>
                <div>
                  <Label className="text-xs">Year</Label>
                  <Input
                    type="number"
                    value={stashData.year_acquired}
                    onChange={(e) => setStashData({...stashData, year_acquired: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Storage Location</Label>
                <Input
                  value={stashData.storage_location}
                  onChange={(e) => setStashData({...stashData, storage_location: e.target.value})}
                  placeholder="Seed Box A"
                />
              </div>
            </div>
          </div>

          <div className="p-4 border-t sticky bottom-0 bg-white flex gap-3 mb-16 md:mb-0">
            <Button variant="outline" onClick={() => setStep('packet_capture')} className="flex-1">
              🔄 Rescan
            </Button>
            <Button onClick={confirmAndSave} disabled={processing} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              ✅ Confirm & Add
            </Button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: SUCCESS */}
      {/* ============================================ */}
      {step === 'success' && (
        <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Added to Stash!</h2>
          <p className="text-gray-600 mb-4">
            {extractedData?.variety_name || matchedProduct?.product_name || 'Seed'} added successfully
          </p>
          
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-emerald-800">
              <span className="text-xl mr-2">🌱</span>
              {scannedBarcode 
                ? "This barcode is now in our database. Next time anyone scans it, they'll get an instant match. Thanks for contributing!"
                : "Your seed has been added to your stash!"}
            </p>
          </div>

          <div className="flex gap-3">
            {/* FIX: Uses resetForNewScan which properly clears ALL state */}
            <Button 
              variant="outline" 
              onClick={resetForNewScan}
              className="flex-1"
            >
              📷 Scan Another
            </Button>
            <Button onClick={() => onScanComplete()} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              ← Back to Stash
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
