import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader, CheckCircle, RotateCcw } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function SeedPacketScanner({ onScanComplete, onClose }) {
  const [step, setStep] = useState('capture');
  const [imageData, setImageData] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (step === 'capture') {
      startCamera();
    }
    return () => stopCamera();
  }, [step]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      setError('Could not access camera. Please allow camera permissions or upload a photo.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setImageData(dataUrl);
    
    stopCamera();
    processImage(dataUrl);
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setImageData(dataUrl);
        stopCamera();
        processImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  }

  async function processImage(dataUrl) {
    setStep('processing');
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);
      
      const { data: { text } } = await Tesseract.recognize(
        dataUrl,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(10 + (m.progress * 60));
            }
          }
        }
      );
      
      setOcrText(text);
      setProgress(75);

      const aiPrompt = `You are a seed packet data extractor. Extract information from this OCR text from a seed packet photo.

OCR TEXT:
${text}

Return ONLY a JSON object with these fields (use null if not found):
{
  "variety_name": "the full variety name (e.g., 'Cherokee Purple Tomato')",
  "plant_type": "the type of plant (e.g., 'Tomato', 'Pepper', 'Lettuce')",
  "vendor": "seed company name (e.g., 'Burpee', 'Baker Creek')",
  "days_to_maturity": number or null,
  "description": "variety description if found",
  "sowing_depth": "planting depth if mentioned",
  "spacing": "plant spacing if mentioned",
  "sun_requirement": "full sun, partial shade, etc. if mentioned"
}

Return ONLY the JSON, no other text.`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            variety_name: { type: "string" },
            plant_type: { type: "string" },
            vendor: { type: "string" },
            days_to_maturity: { type: "number" },
            description: { type: "string" },
            sowing_depth: { type: "string" },
            spacing: { type: "string" },
            sun_requirement: { type: "string" }
          }
        }
      });
      
      setProgress(90);
      setExtractedData(aiResponse || extractBasicInfo(text));
      setProgress(100);
      setStep('review');

    } catch (error) {
      console.error('Processing error:', error);
      setError('Could not read seed packet. Please try again with better lighting or enter manually.');
      setStep('capture');
    } finally {
      setIsProcessing(false);
    }
  }

  function extractBasicInfo(text) {
    const lines = text.split('\n').filter(l => l.trim());
    return {
      variety_name: lines[0] || null,
      plant_type: null,
      vendor: null,
      days_to_maturity: null,
      description: lines.slice(1, 3).join(' ') || null
    };
  }

  function resetScanner() {
    setStep('capture');
    setImageData(null);
    setOcrText('');
    setExtractedData(null);
    setError(null);
    setProgress(0);
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <button
        onClick={() => {
          stopCamera();
          onClose();
        }}
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/20 rounded-full z-10"
      >
        <X size={24} />
      </button>

      {step === 'capture' && (
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                📷 Scan Seed Packet
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Point camera at the seed packet label
              </p>
            </div>

            <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              <div className="absolute inset-4 border-2 border-white/50 rounded-lg pointer-events-none">
                <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-white"></div>
                <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-white"></div>
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-white"></div>
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-white"></div>
              </div>

              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className="text-white text-center p-4">
                    <p>{error}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 space-y-3">
              <Button
                onClick={capturePhoto}
                className="w-full bg-emerald-500 text-white py-4 rounded-xl font-semibold hover:bg-emerald-600 flex items-center justify-center gap-2 text-lg"
              >
                <Camera size={24} />
                Take Photo
              </Button>
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full border-2 py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Upload size={20} />
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

      {step === 'processing' && (
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <Loader className="w-16 h-16 mx-auto text-emerald-500 animate-spin mb-4" />
            <h3 className="text-xl font-bold mb-2">Reading Seed Packet...</h3>
            <p className="text-gray-600 mb-4">Extracting variety information</p>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">{Math.round(progress)}%</p>

            {imageData && (
              <img
                src={imageData}
                alt="Seed packet"
                className="mt-4 rounded-lg max-h-40 mx-auto border"
              />
            )}
          </div>
        </div>
      )}

      {step === 'review' && extractedData && (
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b sticky top-0 bg-white">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              <h3 className="text-xl font-bold">Review Extracted Data</h3>
            </div>
            <p className="text-gray-600 text-sm mt-1">
              Edit any fields that weren't read correctly
            </p>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <Label>Variety Name *</Label>
              <Input
                value={extractedData.variety_name || ''}
                onChange={(e) => setExtractedData({
                  ...extractedData,
                  variety_name: e.target.value
                })}
                placeholder="e.g., Cherokee Purple Tomato"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Plant Type</Label>
              <Input
                value={extractedData.plant_type || ''}
                onChange={(e) => setExtractedData({
                  ...extractedData,
                  plant_type: e.target.value
                })}
                placeholder="e.g., Tomato, Pepper"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Seed Vendor</Label>
              <Input
                value={extractedData.vendor || ''}
                onChange={(e) => setExtractedData({
                  ...extractedData,
                  vendor: e.target.value
                })}
                placeholder="e.g., Burpee, Baker Creek"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Days to Maturity</Label>
              <Input
                type="number"
                value={extractedData.days_to_maturity || ''}
                onChange={(e) => setExtractedData({
                  ...extractedData,
                  days_to_maturity: parseInt(e.target.value) || null
                })}
                placeholder="e.g., 75"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={extractedData.description || ''}
                onChange={(e) => setExtractedData({
                  ...extractedData,
                  description: e.target.value
                })}
                rows={3}
                placeholder="Variety description..."
                className="mt-2"
              />
            </div>

            {imageData && (
              <div>
                <Label>Captured Image</Label>
                <img
                  src={imageData}
                  alt="Seed packet"
                  className="w-full rounded-xl border mt-2"
                />
              </div>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                View raw OCR text
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded-lg text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                {ocrText}
              </pre>
            </details>
          </div>

          <div className="p-4 border-t sticky bottom-0 bg-white flex gap-3">
            <Button
              onClick={resetScanner}
              variant="outline"
              className="flex-1"
            >
              <RotateCcw size={18} className="mr-2" />
              Retake
            </Button>
            <Button
              onClick={() => onScanComplete(extractedData)}
              disabled={!extractedData.variety_name}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600"
            >
              Add to Seed Stash
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}