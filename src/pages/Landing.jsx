import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Sprout, Grid3X3, Package, Calendar, Share2, ArrowRight, CheckCircle2,
  TreeDeciduous, Leaf, BookOpen, Bug, ChefHat, Lightbulb, Users, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import InstallPWAButton from '@/components/landing/InstallPWAButton';

const publicFeatures = [
  {
    icon: Sprout,
    title: 'Plant Catalog',
    description: 'Browse 1,000+ plant varieties with detailed growing info',
    link: 'PlantCatalog',
    color: 'from-green-400 to-emerald-600'
  },
  {
    icon: Calendar,
    title: 'Planting Calendar',
    description: 'See when to plant everything based on your frost dates',
    link: 'CalendarPlanner',
    color: 'from-indigo-400 to-purple-600'
  },
  {
    icon: Users,
    title: 'Community Gardens',
    description: 'Get inspired by gardens from growers worldwide',
    link: 'BrowseGardens',
    color: 'from-blue-400 to-sky-600'
  },
  {
    icon: Grid3X3,
    title: 'Companion Planting',
    description: 'Interactive chart showing which plants grow well together',
    link: 'CompanionPlanner',
    color: 'from-lime-400 to-green-600'
  },
  {
    icon: BookOpen,
    title: 'Blog & Guides',
    description: 'Learn from expert tips, tutorials, and growing guides',
    link: 'BlogList',
    color: 'from-purple-400 to-pink-600'
  },
  {
    icon: ChefHat,
    title: 'Garden Recipes',
    description: 'Discover delicious recipes using your harvest',
    link: 'Recipes',
    color: 'from-orange-400 to-red-600'
  },
  {
    icon: Bug,
    title: 'Pest Library',
    description: 'Identify and treat common garden pests & diseases',
    link: 'PestLibrary',
    color: 'from-amber-400 to-yellow-600'
  },
  {
    icon: Lightbulb,
    title: 'Resources',
    description: 'Helpful tools, calculators, and reference guides',
    link: 'Resources',
    color: 'from-teal-400 to-cyan-600'
  }
];

const appFeatures = [
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                <Sprout className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">AwesomeGardener</span>
            </div>
            <div className="flex items-center gap-4">
              <InstallPWAButton />
              <Button onClick={handleLogin} className="bg-emerald-600 hover:bg-emerald-700">
                Sign In / Sign Up
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-emerald-50/50 via-green-50/30 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* Explore Public Content */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              🌍 Explore without signing in
            </h2>
            <p className="text-xl text-gray-600">
              Browse our free resources available to everyone
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicFeatures.map((feature, index) => (
              <Link key={feature.title} to={createPageUrl(feature.link)}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full hover:shadow-2xl transition-all hover:scale-105 duration-300 cursor-pointer border-0 overflow-hidden">
                    <div className={`h-2 bg-gradient-to-r ${feature.color}`} />
                    <CardContent className="p-6">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                        <feature.icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-gray-600 mb-4">{feature.description}</p>
                      <div className="flex items-center text-emerald-600 font-medium">
                        Explore Now
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* App Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Create a free account to unlock
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to plan, track, and grow your best garden ever
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {appFeatures.map((feature, index) => (
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