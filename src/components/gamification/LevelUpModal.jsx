import React, { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star, Sparkles, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function LevelUpModal({ newLevel, open, onClose }) {
  useEffect(() => {
    if (open && newLevel) {
      // Trigger confetti celebration
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ['#fbbf24', '#8b5cf6', '#10b981'];

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [open, newLevel]);

  if (!newLevel) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center p-8"
        >
          {/* Stars decoration */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <Sparkles className="w-8 h-8 text-yellow-500" />
            <Star className="w-12 h-12 text-yellow-500 fill-yellow-500" />
            <Sparkles className="w-8 h-8 text-yellow-500" />
          </div>

          {/* Title */}
          <h2 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            LEVEL UP!
          </h2>

          {/* Level number */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
            className="text-7xl font-black mb-4 text-gray-900"
          >
            {newLevel}
          </motion.div>

          <p className="text-gray-600 mb-6 text-lg">
            You reached <span className="font-bold text-purple-600">Level {newLevel}</span>
          </p>

          {/* Perk unlocked */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 mb-6 border-2 border-purple-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Keep Growing!</p>
            <p className="text-xs text-gray-600">Continue your gardening journey and unlock more achievements</p>
          </div>

          {/* CTA */}
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-6 text-lg"
          >
            <Trophy className="w-5 h-5 mr-2" />
            Continue Gardening
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}