import React, { useState } from 'react';
import { DragonDefinition } from '../types/game';

interface Props {
  dragon: DragonDefinition;
  className?: string;
}

export const DragonPortrait: React.FC<Props> = ({ dragon, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-900 text-slate-200 font-display font-bold text-sm select-none ${className}`}
        style={{
          backgroundImage: `radial-gradient(circle at 50% 35%, ${dragon.accentColor}33, #0B0E14 80%)`,
        }}
      >
        {dragon.name}
      </div>
    );
  }

  return (
    <img
      src={dragon.image}
      alt={dragon.name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover object-top ${className}`}
      loading="lazy"
    />
  );
};
