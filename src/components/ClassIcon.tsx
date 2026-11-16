import React from 'react';
import { Crosshair, HeartPulse, Shield, Sparkles, Swords } from 'lucide-react';
import { DragonClass } from '../types/game';
import { CLASS_META } from '../data/dragons';

export const ClassIcon: React.FC<{ dragonClass: DragonClass; size?: number }> = ({
  dragonClass,
  size = 15,
}) => {
  const color = CLASS_META[dragonClass].color;
  switch (dragonClass) {
    case 'GUARDIAN':
      return <Shield size={size} style={{ color }} className="shrink-0" />;
    case 'MAGE':
      return <Sparkles size={size} style={{ color }} className="shrink-0" />;
    case 'ASSASSIN':
      return <Crosshair size={size} style={{ color }} className="shrink-0" />;
    case 'SUPPORT':
      return <HeartPulse size={size} style={{ color }} className="shrink-0" />;
    case 'WARRIOR':
      return <Swords size={size} style={{ color }} className="shrink-0" />;
  }
};
