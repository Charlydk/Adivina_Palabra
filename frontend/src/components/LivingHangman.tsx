import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LivingHangmanProps {
  errors: number;
  maxErrors: number;
  status: string;
  size?: 'xs' | 'sm' | 'md' | 'full';
}

const LivingHangman: React.FC<LivingHangmanProps> = ({ errors, maxErrors, status, size = 'md' }) => {
  const sizeClass = size === 'full' ? 'w-full h-64 lg:h-80'
    : size === 'xs' ? 'w-8 h-9'
    : size === 'sm' ? 'w-20 h-24'
    : 'w-48 h-56';
  const isWon = status === 'Won';
  const isLost = status === 'Lost';

  // Fase7B = victory, Fase7A = defeat, Fase1–Fase6 = in-progress progression.
  const phaseIndex = Math.max(1, Math.min(6, Math.floor((errors / maxErrors) * 6) + 1));
  const imageSrc = isWon
    ? '/img/Fase7B.png'
    : isLost
    ? '/img/Fase7A.png'
    : `/img/Fase${phaseIndex}.png`;

  // Detect a new error to trigger shake
  const prevErrors = useRef(errors);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (errors > prevErrors.current && !isLost) {
      prevErrors.current = errors;
      // Defer the state update to avoid synchronous setState inside an effect
      const start = setTimeout(() => setShaking(true), 0);
      const stop = setTimeout(() => setShaking(false), 500);
      return () => { clearTimeout(start); clearTimeout(stop); };
    }
    prevErrors.current = errors;
  }, [errors, isLost]);

  return (
    <div className={`relative flex items-center justify-center select-none ${sizeClass}`}>
      <AnimatePresence mode="wait">
        <motion.img
          key={imageSrc}
          src={imageSrc}
          alt={`Estado del juego fase ${isWon ? '7B' : isLost ? '7A' : phaseIndex}`}
          className="w-full h-full object-contain"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{
            opacity: 1,
            scale: isWon ? [1, 1.08, 1] : 1,
            rotate: shaking ? [0, -4, 4, -4, 4, 0] : 0,
            filter: isLost
              ? 'drop-shadow(0 0 12px rgba(220,38,38,0.7))'
              : isWon
              ? 'drop-shadow(0 0 14px rgba(74,222,128,0.7))'
              : 'none',
          }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{
            opacity: { duration: 0.25 },
            scale: isWon
              ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' }
              : { duration: 0.2 },
            rotate: { duration: 0.5, ease: 'easeInOut' },
          }}
        />
      </AnimatePresence>

      {/* Overlay rojo pulsante al perder */}
      {isLost && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.5) 0%, transparent 70%)' }}
        />
      )}

      {/* Aura verde al ganar */}
      {isWon && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          animate={{ opacity: [0, 0.2, 0] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.5) 0%, transparent 70%)' }}
        />
      )}
    </div>
  );
};

export default LivingHangman;
