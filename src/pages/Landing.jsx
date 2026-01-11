import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Sprout, 
  Grid3X3, 
  Package, 
  Calendar, 
  Share2, 
  ArrowRight,
  CheckCircle2,
  TreeDeciduous,
  Leaf
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import InstallPWAButton from '@/components/landing/InstallPWAButton';

const features = [
  {
    icon: Grid3X3,
    title: 'Visual Garden Builder',
    description: 'Design your garden with an intuitive drag-and-drop interface. Plan beds, plots, and containers on a square-foot grid.'
  },
  {
    icon: Package,
    title: 'Seed Stash & Grow Lists',
    description: 'Track your seed inventory, create wishlists, and build seasonal grow lists to stay organized.'
  },
  {
    icon: Calendar,
    title: 'Smart Planting Calendar',
    description: 'Get personalized planting schedules based on your location and frost dates. Never miss a planting window.'
  },
  {
    icon: Share2,
    title: 'Share Your Garden',
    description: 'Share your garden designs, individual plants, and progress with friends or the community.'
  }
];

const benefits = [
  'Plan unlimited gardens and beds',
  'Access the full plant catalog',
  'Track seeds and harvest',
  'Generate planting schedules',
  'Share with the community'
];

export default function Landing() {
  const handleLogin = () => {
    base44.auth.redirectToLogin(createPageUrl('Dashboard'));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                <Sprout className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">AwesomeGardener</span>
            </div>
            <Button onClick={handleLogin} className="bg-emerald-600 hover:bg-emerald-700">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-emerald-50/50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium mb-6">
                <Leaf className="w-4 h-4" />
                Free garden planning tool
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Plan your 
                <span className="text-emerald-600"> perfect garden</span> in minutes
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Design beautiful garden layouts, track your seeds, and never miss a planting date. 
                The easiest way to grow more with less effort.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={handleLogin}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6 gap-2"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <InstallPWAButton />
                <Link to={createPageUrl('Community')}>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="text-lg px-8 py-6 border-gray-300 w-full sm:w-auto"
                  >
                    Browse Public Gardens
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-green-600 p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                    <span className="text-white/80 text-sm ml-4">Garden Builder</span>
                  </div>
                </div>
                <div className="p-6">
                  {/* Mock garden grid */}
                  <div className="grid grid-cols-6 gap-1 mb-4">
                    {Array(24).fill(0).map((_, i) => (
                      <div 
                        key={i} 
                        className={`aspect-square rounded-lg ${
                          [0,1,6,7].includes(i) ? 'bg-red-100 border-2 border-red-200' :
                          [4,5,10,11].includes(i) ? 'bg-green-100 border-2 border-green-200' :
                          [14,15,16,20,21,22].includes(i) ? 'bg-yellow-100 border-2 border-yellow-200' :
                          'bg-amber-50 border border-amber-100'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                      Tomatoes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
                      Peppers
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" />
                      Squash
                    </span>
                  </div>
                </div>
              </div>
              {/* Floating cards */}
              <div className="absolute -left-4 -bottom-4 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Plant Today</p>
                    <p className="text-xs text-gray-500">3 tasks due</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-4 top-20 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Seed Stash</p>
                    <p className="text-xs text-gray-500">24 varieties</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Everything you need to grow
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From planning to harvest, AwesomeGardener helps you every step of the way
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-emerald-600 to-green-700">
        <div className="max-w-4xl mx-auto text-center">
          <TreeDeciduous className="w-16 h-16 text-white/80 mx-auto mb-6" />
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Ready to grow something amazing?
          </h2>
          <p className="text-xl text-emerald-100 mb-8">
            Join thousands of gardeners planning their best gardens ever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="bg-white text-emerald-700 hover:bg-emerald-50 text-lg px-8 py-6 gap-2"
            >
              Start Planning Now
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                <Sprout className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-white">AwesomeGardener</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Affiliate Disclosure</a>
              <a href="https://pepperseeds.net" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                PepperSeeds.net
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            <p>© {new Date().getFullYear()} AwesomeGardener. A free tool supported by <a href="https://pepperseeds.net" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">PepperSeeds.net</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}