import React, { useState } from 'react';
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
  Sparkles  // ✅ ADDED THIS
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

const USDA_ZONES = ['1a', '1b', '2a', '2b', '3a', '3b', '4a', '4b', '5a', '5b', '6a', '6b', '7a', '7b', '8a', '8b', '9a', '9b', '10a', '10b', '11a', '11b', '12a', '12b', '13a', '13b'];

const steps = [
  { id: 'profile', title: 'Profile', icon: User, description: 'Tell us about yourself' },
  { id: 'location', title: 'Location', icon: MapPin, description: 'Where do you garden?' },
  { id: 'frost', title: 'Frost Dates', icon: Thermometer, description: 'Configure your growing season' },
  { id: 'garden', title: 'First Garden', icon: TreeDeciduous, description: 'Create your first garden' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nickname: '',
    profile_logo_url: '',
    avatar_url: '',
    location_zip: '',
    location_city: '',
    location_state: '',
    usda_zone: '',
    last_frost_date: '',
    first_frost_date: '',
    units: 'imperial',
    garden_name: 'My Garden'
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    // Validate nickname on profile step
    if (currentStep === 0) {
      if (!formData.nickname.trim()) {
        toast.error('Please enter a nickname to continue');
        return;
      }
    }
    
    // Validate frost dates if on frost step
    if (currentStep === 2) {
      if (!formData.last_frost_date || !formData.first_frost_date) {
        toast.error('Please enter both frost dates to continue');
        return;
      }
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (loading) return; // Prevent double-submit
    
    setLoading(true);
    try {
      // Update user profile
      await base44.auth.updateMe({
        nickname: formData.nickname,
        profile_logo_url: formData.profile_logo_url,
        avatar_url: formData.avatar_url,
        location_zip: formData.location_zip,
        location_city: formData.location_city,
        location_state: formData.location_state,
        usda_zone: formData.usda_zone,
        last_frost_date: formData.last_frost_date,
        first_frost_date: formData.first_frost_date,
        units: formData.units,
        onboarding_completed: true
      });

      // Create first garden
      const garden = await base44.entities.Garden.create({
        name: formData.garden_name || 'My Garden',
        description: 'My first garden',
        privacy: 'private'
      });

      // Create default plot for the garden
      await base44.entities.GardenPlot.create({
        garden_id: garden.id,
        width: 480, // 40 feet in inches
        height: 720, // 60 feet in inches
        units: 'ft',
        shape_type: 'RECTANGLE'
      });

      navigate(createPageUrl('Dashboard'));
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
              <Input
                id="nickname"
                placeholder="Your display name for the community"
                value={formData.nickname}
                onChange={(e) => handleChange('nickname', e.target.value)}
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">This will appear on your public gardens and forum posts</p>
            </div>
            <div>
              <Label htmlFor="logo">Logo/Avatar (optional)</Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      handleChange('profile_logo_url', file_url);
                      toast.success('Logo uploaded!');
                    } catch (error) {
                      console.error('Error uploading logo:', error);
                      toast.error('Failed to upload logo');
                    }
                  }
                }}
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">Upload your profile logo (will appear on your public garden cards)</p>
              {formData.profile_logo_url && (
                <img src={formData.profile_logo_url} alt="Logo preview" className="w-16 h-16 rounded-full mt-2 border" />
              )}
            </div>
            <div>
              <Label htmlFor="units">Preferred Units</Label>
              <Select value={formData.units} onValueChange={(v) => handleChange('units', v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imperial">Imperial (feet, inches)</SelectItem>
                  <SelectItem value="metric">Metric (meters, cm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                placeholder="12345"
                value={formData.location_zip}
                onChange={(e) => handleChange('location_zip', e.target.value)}
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">Used to estimate your growing zone and frost dates</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Springfield"
                  value={formData.location_city}
                  onChange={(e) => handleChange('location_city', e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="IL"
                  value={formData.location_state}
                  onChange={(e) => handleChange('location_state', e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="zone">USDA Hardiness Zone</Label>
              <Select value={formData.usda_zone} onValueChange={(v) => handleChange('usda_zone', v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select your zone" />
                </SelectTrigger>
                <SelectContent>
                  {USDA_ZONES.map(zone => (
                    <SelectItem key={zone} value={zone}>Zone {zone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500 mt-1">
                <a href="https://planthardiness.ars.usda.gov/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                  Find your zone →
                </a>
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
                We'll use your ZIP code to automatically detect your USDA zone and frost dates.
              </p>
              <FrostDateLookup
                zip={formData.location_zip}
                city={formData.location_city}
                state={formData.location_state}
                currentZone={formData.usda_zone}
                currentLastFrost={formData.last_frost_date}
                currentFirstFrost={formData.first_frost_date}
                autoSave={true}
                onApply={async (values) => {
                  console.debug('[Onboarding] AI_frost_applied_and_saved', values);
                  // Reload user data to reflect the saved changes
                  const refreshedUser = await base44.auth.me();
                  setFormData({ 
                    ...formData, 
                    usda_zone: refreshedUser.usda_zone || values.usda_zone,
                    last_frost_date: refreshedUser.last_frost_date || values.last_frost_date,
                    first_frost_date: refreshedUser.first_frost_date || values.first_frost_date
                  });
                }}
              />
            </div>
            
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Thermometer className="w-4 h-4" />
                Or look them up manually
              </h4>
              <p className="text-sm text-blue-800 mb-3">
                Use the Almanac tool to find your frost dates, then enter them below.
              </p>
              <a
                href="https://www.almanac.com/gardening/frostdates"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Open Almanac Frost Dates Lookup →
              </a>
            </div>
            <div>
              <Label htmlFor="last_frost">Last Spring Frost Date (32°F) *</Label>
              <Input
                id="last_frost"
                type="date"
                value={formData.last_frost_date}
                onChange={(e) => handleChange('last_frost_date', e.target.value)}
                className="mt-2"
                required
              />
              <p className="text-sm text-gray-500 mt-1">When your area typically sees the last frost in spring</p>
            </div>
            <div>
              <Label htmlFor="first_frost">First Fall Frost Date (32°F) *</Label>
              <Input
                id="first_frost"
                type="date"
                value={formData.first_frost_date}
                onChange={(e) => handleChange('first_frost_date', e.target.value)}
                className="mt-2"
                required
              />
              <p className="text-sm text-gray-500 mt-1">When your area typically sees the first frost in fall</p>
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
              <Input
                id="garden_name"
                placeholder="e.g., Backyard Garden, Patio Containers"
                value={formData.garden_name}
                onChange={(e) => handleChange('garden_name', e.target.value)}
                className="mt-2"
              />
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to AwesomeGardener</h1>
          <p className="text-gray-600 mt-2">Let's set up your garden planning experience</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  index < currentStep 
                    ? 'bg-emerald-600 text-white' 
                    : index === currentStep 
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' 
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {index < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`text-xs mt-2 hidden sm:block ${
                  index === currentStep ? 'text-emerald-600 font-medium' : 'text-gray-400'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${
                  index < currentStep ? 'bg-emerald-600' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">{steps[currentStep].title}</h2>
            <p className="text-gray-600">{steps[currentStep].description}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={handleNext}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <Check className="w-4 h-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}