import React, { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

const RARITY_COLORS = {
  common: 'bg-gray-100 text-gray-800 border-gray-300',
  uncommon: 'bg-green-100 text-green-800 border-green-300',
  rare: 'bg-blue-100 text-blue-800 border-blue-300',
  legendary: 'bg-purple-100 text-purple-800 border-purple-300'
};

export default function BadgeUnlockModal({ badge, open, onClose }) {
  useEffect(() => {
    if (open && badge) {
      // Trigger confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#10b981', '#fbbf24', '#8b5cf6']
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10b981', '#fbbf24', '#8b5cf6']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [open, badge]);

  if (!badge) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center p-6 bg-gradient-to-b from-yellow-50 to-white rounded-lg"
        >
          {/* Title */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">BADGE UNLOCKED!</h2>
            <Sparkles className="w-6 h-6 text-yellow-500" />
          </div>

          {/* Badge icon - large with bounce */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
            className="text-8xl mb-4"
          >
            {badge.icon}
          </motion.div>

          {/* Badge name */}
          <h3 className="text-3xl font-bold mb-2 text-gray-900">
            {badge.title}
          </h3>

          {/* Description */}
          <p className="text-gray-600 mb-4 text-base">
            {badge.description}
          </p>

          {/* XP awarded */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4 }}
            className="inline-block bg-gradient-to-r from-green-400 to-emerald-500 text-white px-6 py-3 rounded-full font-bold text-lg mb-4"
          >
            <Star className="w-5 h-5 inline mr-2" />
            +{badge.points} XP
          </motion.div>

          {/* Rarity badge */}
          <div className="mt-4">
            <Badge className={`${RARITY_COLORS[badge.rarity]} border-2 text-sm px-4 py-1`}>
              {badge.rarity.toUpperCase()}
            </Badge>
          </div>

          {/* CTA */}
          <Button
            onClick={onClose}
            className="mt-6 w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-6 text-lg"
          >
            Keep Gardening! 🌱
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}