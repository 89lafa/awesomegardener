import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Sprout, 
  User, 
  MapPin, 
  Thermometer, 
  TreeDeciduous,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import FrostDateLookup from '@/components/ai/FrostDateLookup';

// ─── Broadcast units change so useUnits hook (if present) picks it up ───
function broadcastUnits(units) {
  try { window.dispatchEvent(new CustomEvent('units-changed', { detail: { units } })); } catch {}
}

// ═══════════════════════════════════════════════════════════════
// ★ FIX #2: Safe date helpers to prevent "Invalid time value"
// crash when AI Auto-Detect returns malformed or empty dates.
// ═══════════════════════════════════════════════════════════════
function isValidDateStr(str) {
  if (!str || typeof str !== 'string' || str.length < 8) return false;
  const d = new Date(str + 'T12:00:00');
  return !isNaN(d.getTime());
}

function safeFormatDate(dateStr) {
  if (!isValidDateStr(dateStr)) return null;
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── USDA Zones ───
const USDA_ZONES = ['1a','1b','2a','2b','3a','3b','4a','4b','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','10a','10b','11a','11b','12a','12b','13a','13b'];

// ─── RHS Hardiness Ratings (UK/Europe) ───
const RHS_ZONES = [
  { value: 'H1a', label: 'H1a — Heated greenhouse (>15°C / >59°F)' },
  { value: 'H1b', label: 'H1b — Heated greenhouse (10–15°C / 50–59°F)' },
  { value: 'H1c', label: 'H1c — Heated greenhouse (5–10°C / 41–50°F)' },
  { value: 'H2',  label: 'H2 — Tender (1–5°C / 34–41°F)' },
  { value: 'H3',  label: 'H3 — Half Hardy (−5 to 1°C / 23–34°F)' },
  { value: 'H4',  label: 'H4 — Hardy (−10 to −5°C / 14–23°F)' },
  { value: 'H5',  label: 'H5 — Hardy (−15 to −10°C / 5–14°F)' },
  { value: 'H6',  label: 'H6 — Hardy (−20 to −15°C / −4 to 5°F)' },
  { value: 'H7',  label: 'H7 — Very Hardy (< −20°C / < −4°F)' },
];

// ─── Country configs ───
const COUNTRIES = [
  { code: 'US', name: 'United States',  postalLabel: 'ZIP Code',            postalHint: '12345',     regionLabel: 'State',           regionHint: 'IL',             zone: 'usda',  units: 'imperial' },
  { code: 'CA', name: 'Canada',         postalLabel: 'Postal Code',         postalHint: 'K1A 0B1',   regionLabel: 'Province',        regionHint: 'ON',             zone: 'usda',  units: 'metric'   },
  { code: 'GB', name: 'United Kingdom', postalLabel: 'Postcode',            postalHint: 'SW1A 1AA',  regionLabel: 'County/Region',   regionHint: 'London',         zone: 'rhs',   units: 'metric'   },
  { code: 'IE', name: 'Ireland',        postalLabel: 'Eircode',             postalHint: 'D02 AF30',  regionLabel: 'County',          regionHint: 'Dublin',         zone: 'rhs',   units: 'metric'   },
  { code: 'AU', name: 'Australia',      postalLabel: 'Postcode',            postalHint: '2000',      regionLabel: 'State',           regionHint: 'NSW',            zone: 'usda',  units: 'metric'   },
  { code: 'NZ', name: 'New Zealand',    postalLabel: 'Postcode',            postalHint: '6011',      regionLabel: 'Region',          regionHint: 'Wellington',     zone: 'usda',  units: 'metric'   },
  { code: 'DE', name: 'Germany',        postalLabel: 'Postleitzahl (PLZ)',  postalHint: '10115',     regionLabel: 'Bundesland',      regionHint: 'Berlin',         zone: 'rhs',   units: 'metric'   },
  { code: 'FR', name: 'France',         postalLabel: 'Code Postal',         postalHint: '75001',     regionLabel: 'Région',          regionHint: 'Île-de-France',  zone: 'rhs',   units: 'metric'   },
  { code: 'IT', name: 'Italy',          postalLabel: 'CAP',                 postalHint: '00100',     regionLabel: 'Regione',         regionHint: 'Lazio',          zone: 'rhs',   units: 'metric'   },
  { code: 'ES', name: 'Spain',          postalLabel: 'Código Postal',       postalHint: '28001',     regionLabel: 'Comunidad',       regionHint: 'Madrid',         zone: 'rhs',   units: 'metric'   },
  { code: 'NL', name: 'Netherlands',    postalLabel: 'Postcode',            postalHint: '1012 AB',   regionLabel: 'Provincie',       regionHint: 'Noord-Holland',  zone: 'rhs',   units: 'metric'   },
  { code: 'ZA', name: 'South Africa',   postalLabel: 'Postal Code',         postalHint: '8001',      regionLabel: 'Province',        regionHint: 'Western Cape',   zone: 'usda',  units: 'metric'   },
  { code: 'JP', name: 'Japan',          postalLabel: 'Postal Code (〒)',    postalHint: '100-0001',  regionLabel: 'Prefecture',      regionHint: 'Tokyo',          zone: 'usda',  units: 'metric'   },
  { code: 'IN', name: 'India',          postalLabel: 'PIN Code',            postalHint: '110001',    regionLabel: 'State',           regionHint: 'Delhi',          zone: 'usda',  units: 'metric'   },
  { code: 'BR', name: 'Brazil',         postalLabel: 'CEP',                 postalHint: '01001-000', regionLabel: 'Estado',          regionHint: 'SP',             zone: 'usda',  units: 'metric'   },
  { code: 'MX', name: 'Mexico',         postalLabel: 'Código Postal',       postalHint: '06600',     regionLabel: 'Estado',          regionHint: 'CDMX',           zone: 'usda',  units: 'metric'   },
  { code: 'OTHER', name: 'Other',       postalLabel: 'Postal/ZIP Code',     postalHint: '',          regionLabel: 'Region/Province', regionHint: '',               zone: 'usda',  units: 'metric'   },
];

const cc = (code) => COUNTRIES.find(c => c.code === code) || COUNTRIES[COUNTRIES.length - 1];

const steps = [
  { id: 'profile',  title: 'Profile',      icon: User,          description: 'Tell us about yourself' },
  { id: 'location', title: 'Location',     icon: MapPin,        description: 'Where do you garden?' },
  { id: 'frost',    title: 'Frost Dates',  icon: Thermometer,   description: 'Configure your growing season' },
  { id: 'garden',   title: 'First Garden', icon: TreeDeciduous, description: 'Create your first garden' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nickname: '',
    profile_logo_url: '',
    avatar_url: '',
    country: 'US',
    location_zip: '',
    location_city: '',
    location_state: '',
    usda_zone: '',
    last_frost_date: '',
    first_frost_date: '',
    units: 'imperial',
    garden_name: 'My Garden'
  });

  const cfg = cc(formData.country);
  const isUSDA = cfg.zone === 'usda';
  const isMetric = formData.units === 'metric';

  // Auto-detect country from browser locale
  useEffect(() => {
    try {
      const locale = navigator.language || '';
      const bc = (locale.split('-')[1] || '').toUpperCase();
      if (bc) {
        const m = COUNTRIES.find(c => c.code === bc);
        if (m) setFormData(prev => ({ ...prev, country: m.code, units: m.units }));
      }
    } catch {}
  }, []);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleCountryChange = (code) => {
    const c = cc(code);
    setFormData(prev => ({
      ...prev,
      country: code,
      units: c.units,
      usda_zone: c.zone !== cfg.zone ? '' : prev.usda_zone
    }));
  };

  const handleNext = () => {
    if (currentStep === 0 && !formData.nickname.trim()) {
      toast.error('Please enter a nickname to continue'); return;
    }
    if (currentStep === 2 && (!isValidDateStr(formData.last_frost_date) || !isValidDateStr(formData.first_frost_date))) {
      toast.error('Please enter both frost dates to continue'); return;
    }
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };

  // ═══════════════════════════════════════════════════════════════
  // ★ FIX #1: ONBOARDING DOUBLE-LOOP BUG
  // navigate() does client-side route change → Layout still has
  // OLD user (onboarding_completed=false) → redirects BACK.
  // window.location.href forces FULL reload → fresh user data.
  // ═══════════════════════════════════════════════════════════════
  const handleComplete = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await base44.auth.updateMe({
        nickname: formData.nickname,
        profile_logo_url: formData.profile_logo_url,
        avatar_url: formData.avatar_url,
        country: formData.country,
        location_zip: formData.location_zip,
        location_city: formData.location_city,
        location_state: formData.location_state,
        usda_zone: formData.usda_zone,
        last_frost_date: formData.last_frost_date,
        first_frost_date: formData.first_frost_date,
        units: formData.units,
        onboarding_completed: true
      });

      broadcastUnits(formData.units);

      const garden = await base44.entities.Garden.create({
        name: formData.garden_name || 'My Garden',
        description: 'My first garden',
        privacy: 'private'
      });

      await base44.entities.GardenPlot.create({
        garden_id: garden.id,
        width: isMetric ? 1200 : 480,
        height: isMetric ? 1800 : 720,
        units: isMetric ? 'm' : 'ft',
        shape_type: 'RECTANGLE'
      });

      await new Promise(r => setTimeout(r, 500));
      // ★ FIX #1: hard nav instead of navigate()
      window.location.href = createPageUrl('Dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Failed to complete setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (steps[currentStep].id) {

      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="nickname">Nickname *</Label>
              <Input id="nickname" placeholder="Your display name for the community"
                value={formData.nickname} onChange={(e) => set('nickname', e.target.value)} className="mt-2" />
              <p className="text-sm text-gray-500 mt-1">This will appear on your public gardens and forum posts</p>
            </div>

            <div>
              <Label htmlFor="logo">Logo/Avatar (optional)</Label>
              <Input id="logo" type="file" accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      set('profile_logo_url', file_url);
                      toast.success('Logo uploaded!');
                    } catch (err) {
                      console.error('Error uploading logo:', err);
                      toast.error('Failed to upload logo');
                    }
                  }
                }}
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">Upload your profile logo (will appear on your public garden cards)</p>
              {formData.profile_logo_url && (
                <img src={formData.profile_logo_url} alt="Logo preview" className="w-16 h-16 rounded-full mt-2 border object-cover" />
              )}
            </div>

            <div>
              <Label>Country</Label>
              <Select value={formData.country} onValueChange={handleCountryChange}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Select your country" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500 mt-1">Sets labels, default units, and zone system for your region</p>
            </div>

            <div>
              <Label>Preferred Units</Label>
              <Select value={formData.units} onValueChange={(v) => { set('units', v); broadcastUnits(v); }}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="imperial">Imperial (feet, inches, °F)</SelectItem>
                  <SelectItem value="metric">Metric (meters, cm, °C)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500 mt-1">
                {isMetric
                  ? 'All measurements throughout the app will display in meters/cm and °C'
                  : 'All measurements throughout the app will display in feet/inches and °F'}
              </p>
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border">
              <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-600">Country: <strong className="text-gray-900">{cfg.name}</strong></span>
              <button type="button" onClick={() => setCurrentStep(0)}
                className="text-xs text-emerald-600 hover:underline ml-auto">Change</button>
            </div>

            <div>
              <Label htmlFor="zip">{cfg.postalLabel}</Label>
              <Input id="zip" placeholder={cfg.postalHint}
                value={formData.location_zip} onChange={(e) => set('location_zip', e.target.value)} className="mt-2" />
              <p className="text-sm text-gray-500 mt-1">Used to estimate your growing zone and frost dates</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="e.g. London"
                  value={formData.location_city} onChange={(e) => set('location_city', e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="state">{cfg.regionLabel}</Label>
                <Input id="state" placeholder={cfg.regionHint}
                  value={formData.location_state} onChange={(e) => set('location_state', e.target.value)} className="mt-2" />
              </div>
            </div>

            <div>
              <Label>{isUSDA ? 'USDA Hardiness Zone' : 'Hardiness Zone'}</Label>

              {isUSDA ? (
                <Select value={formData.usda_zone} onValueChange={(v) => set('usda_zone', v)}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Select your zone" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {USDA_ZONES.map(z => <SelectItem key={z} value={z}>Zone {z}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={formData.usda_zone} onValueChange={(v) => set('usda_zone', v)}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Select your hardiness rating" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">RHS Hardiness Ratings</div>
                    {RHS_ZONES.map(z => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t mt-1 pt-2">USDA Equivalent (if known)</div>
                    {USDA_ZONES.map(z => <SelectItem key={`u-${z}`} value={z}>USDA Zone {z}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <p className="text-sm text-gray-500 mt-2">
                {isUSDA ? (
                  <a href="https://planthardiness.ars.usda.gov/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                    Find your USDA zone →
                  </a>
                ) : (
                  <span>
                    Don't know your zone? The AI on the next step can detect it, or{' '}
                    <a href="https://planthardiness.ars.usda.gov/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                      look it up here →
                    </a>
                  </span>
                )}
              </p>
            </div>
          </div>
        );

      case 'frost':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Let AI find your frost dates & zone
              </h4>
              <p className="text-sm text-purple-800 mb-3">
                {formData.country === 'US'
                  ? "We'll use your ZIP code to automatically detect your USDA zone and frost dates."
                  : `We'll use your ${cfg.postalLabel.toLowerCase()}, city, and country to estimate your hardiness zone and frost dates.`}
              </p>
              <FrostDateLookup
                zip={formData.location_zip}
                city={formData.location_city}
                state={formData.location_state}
                country={formData.country}
                countryName={cfg.name}
                currentZone={formData.usda_zone}
                currentLastFrost={formData.last_frost_date}
                currentFirstFrost={formData.first_frost_date}
                autoSave={true}
                onApply={async (values) => {
                  console.debug('[Onboarding] AI frost applied', values);
                  try {
                    const refreshed = await base44.auth.me();
                    // ★ FIX #2: Validate dates before setting state
                    // AI may return empty/malformed strings that crash
                    // Date rendering with "Invalid time value"
                    const newZone = refreshed.usda_zone || values.usda_zone || '';
                    const newLastFrost = isValidDateStr(refreshed.last_frost_date)
                      ? refreshed.last_frost_date
                      : isValidDateStr(values.last_frost_date)
                        ? values.last_frost_date
                        : '';
                    const newFirstFrost = isValidDateStr(refreshed.first_frost_date)
                      ? refreshed.first_frost_date
                      : isValidDateStr(values.first_frost_date)
                        ? values.first_frost_date
                        : '';

                    setFormData(prev => ({
                      ...prev,
                      usda_zone: newZone,
                      last_frost_date: newLastFrost,
                      first_frost_date: newFirstFrost
                    }));
                  } catch (err) {
                    console.error('[Onboarding] Error refreshing after AI frost:', err);
                    // Fallback: use values directly if refresh fails
                    setFormData(prev => ({
                      ...prev,
                      usda_zone: values.usda_zone || prev.usda_zone,
                      last_frost_date: isValidDateStr(values.last_frost_date) ? values.last_frost_date : prev.last_frost_date,
                      first_frost_date: isValidDateStr(values.first_frost_date) ? values.first_frost_date : prev.first_frost_date
                    }));
                  }
                }}
              />
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Thermometer className="w-4 h-4" />
                Or enter them manually
              </h4>
              <p className="text-sm text-blue-800 mb-3">
                {formData.country === 'US'
                  ? 'Use the Almanac tool to find your frost dates, then enter them below.'
                  : `Search online for "frost dates ${cfg.name}" or "last frost [your city]" to find local data.`}
              </p>
              {formData.country === 'US' && (
                <a href="https://www.almanac.com/gardening/frostdates" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                  Open Almanac Frost Dates Lookup →
                </a>
              )}
              {(formData.country === 'GB' || formData.country === 'IE') && (
                <a href="https://www.rhs.org.uk/plants/types/perennials/hardiness" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                  RHS Hardiness Guide →
                </a>
              )}
            </div>

            <div>
              <Label htmlFor="last_frost">Last Spring Frost Date {isMetric ? '(0°C)' : '(32°F)'} *</Label>
              <Input id="last_frost" type="date" value={formData.last_frost_date}
                onChange={(e) => set('last_frost_date', e.target.value)} className="mt-2" required />
              <p className="text-sm text-gray-500 mt-1">When your area typically sees the last frost in spring</p>
            </div>
            <div>
              <Label htmlFor="first_frost">First {formData.country === 'US' ? 'Fall' : 'Autumn'} Frost Date {isMetric ? '(0°C)' : '(32°F)'} *</Label>
              <Input id="first_frost" type="date" value={formData.first_frost_date}
                onChange={(e) => set('first_frost_date', e.target.value)} className="mt-2" required />
              <p className="text-sm text-gray-500 mt-1">
                When your area typically sees the first frost in {formData.country === 'US' ? 'fall' : 'autumn'}
              </p>
            </div>
          </div>
        );

      case 'garden':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-sm text-emerald-800">
                Let's create your first garden! You can add more gardens later and 
                create multiple beds, plots, or container zones within each garden.
              </p>
            </div>
            <div>
              <Label htmlFor="garden_name">Garden Name</Label>
              <Input id="garden_name" placeholder="e.g., Backyard Garden, Patio Containers"
                value={formData.garden_name} onChange={(e) => set('garden_name', e.target.value)} className="mt-2" />
            </div>

            {/* Settings summary — uses safeFormatDate to prevent crashes */}
            <div className="p-4 bg-gray-50 rounded-xl border space-y-2">
              <h4 className="font-semibold text-sm text-gray-700">Your Settings Summary</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-gray-500">Country:</span>
                <span className="font-medium text-gray-900">{cfg.name}</span>
                <span className="text-gray-500">Units:</span>
                <span className="font-medium text-gray-900">{isMetric ? 'Metric (m, cm, °C)' : 'Imperial (ft, in, °F)'}</span>
                {formData.usda_zone && (<>
                  <span className="text-gray-500">Zone:</span>
                  <span className="font-medium text-gray-900">{formData.usda_zone.startsWith('H') ? formData.usda_zone : `Zone ${formData.usda_zone}`}</span>
                </>)}
                {/* ★ FIX #2: safeFormatDate prevents crash on invalid dates */}
                {safeFormatDate(formData.last_frost_date) && (<>
                  <span className="text-gray-500">Last Frost:</span>
                  <span className="font-medium text-gray-900">{safeFormatDate(formData.last_frost_date)}</span>
                </>)}
                {safeFormatDate(formData.first_frost_date) && (<>
                  <span className="text-gray-500">First Frost:</span>
                  <span className="font-medium text-gray-900">{safeFormatDate(formData.first_frost_date)}</span>
                </>)}
              </div>
            </div>

            <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <TreeDeciduous className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
              <p className="text-gray-600">Your garden workspace will be ready to design!</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to AwesomeGardener</h1>
          <p className="text-gray-600 mt-2">Let's set up your garden planning experience</p>
        </div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  index < currentStep ? 'bg-emerald-600 text-white'
                    : index === currentStep ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {index < currentStep ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs mt-2 hidden sm:block ${index === currentStep ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${index < currentStep ? 'bg-emerald-600' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">{steps[currentStep].title}</h2>
            <p className="text-gray-600">{steps[currentStep].description}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={currentStep}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Check className="w-4 h-4" /> Complete Setup</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
