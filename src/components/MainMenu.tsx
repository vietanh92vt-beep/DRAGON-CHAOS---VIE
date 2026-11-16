import React from 'react';
import { BookOpen, FlaskConical, Play, Settings, Shield } from 'lucide-react';
import { DRAGONS, CLASS_META } from '../data/dragons';
import { ScreenType } from '../types/game';
import { DragonPortrait } from './DragonPortrait';
import { ClassIcon } from './ClassIcon';
import { soundFX } from '../utils/sound';

interface Props {
  onNavigate: (screen: ScreenType) => void;
  onOpenSettings: () => void;
}

const FEATURED_IDS = [
  'ngu_long',
  'kim_long',
  'hoa_long_mage',
  'am_long',
  'bach_long',
  'thien_thach_long',
];

export const MainMenu: React.FC<Props> = ({ onNavigate, onOpenSettings }) => {
  const featured = DRAGONS.filter((d) => FEATURED_IDS.includes(d.id));

  const go = (screen: ScreenType) => {
    soundFX.playClick();
    onNavigate(screen);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-8 border-b border-white/10">
        <span className="font-display text-xl font-bold tracking-tight text-amber-400 whitespace-nowrap shrink-0">
          DRAGON CHAOS
        </span>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <button
            onClick={() => go('COLLECTION')}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Collection
          </button>
          <button
            onClick={() => go('RULES')}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Rules
          </button>
          <button
            onClick={() => go('TEST_MODE')}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Battle Test
          </button>
          <button
            onClick={() => {
              soundFX.playClick();
              onOpenSettings();
            }}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Settings
          </button>
        </nav>

        <button
          onClick={() => go('DRAFT')}
          className="px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          PLAY
        </button>
      </header>

      {/* Main Hero */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-6">
          <p className="text-sm font-medium text-amber-400/90 tracking-wide">
            Đấu trường chiến thuật 2D thời gian thực · 5v5 mở rộng 10v10
          </p>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-50 leading-[1.08] text-balance">
            DRAGON CHAOS
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
            Tuyển chọn đội hình 10 loài rồng từ bộ sưu tập 20 rồng huyền thoại thuộc 5 tộc hệ.
            Triển khai 5 rồng tiên phong, mở rộng chiến trường lên 10v10, kích hoạt kỹ năng chủ động và đánh bại AI chiến thuật.
          </p>

          {/* Primary + Secondary Actions */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => go('DRAFT')}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play size={18} fill="currentColor" />
              PLAY
            </button>

            <button
              onClick={() => go('COLLECTION')}
              className="inline-flex items-center gap-2 px-5 py-3.5 bg-[#131822] hover:bg-[#1C2333] border border-white/10 text-slate-100 font-medium text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Shield size={16} className="text-amber-400" />
              COLLECTION
            </button>

            <button
              onClick={() => go('TEST_MODE')}
              className="inline-flex items-center gap-2 px-5 py-3.5 bg-[#131822] hover:bg-[#1C2333] border border-white/10 text-slate-100 font-medium text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FlaskConical size={16} className="text-sky-400" />
              BATTLE TEST
            </button>

            <button
              onClick={() => go('RULES')}
              className="inline-flex items-center gap-2 px-5 py-3.5 bg-[#131822] hover:bg-[#1C2333] border border-white/10 text-slate-100 font-medium text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpen size={16} className="text-emerald-400" />
              RULES
            </button>

            <button
              onClick={() => {
                soundFX.playClick();
                onOpenSettings();
              }}
              className="inline-flex items-center gap-2 px-5 py-3.5 bg-[#131822] hover:bg-[#1C2333] border border-white/10 text-slate-100 font-medium text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings size={16} className="text-slate-300" />
              SETTINGS
            </button>
          </div>

          {/* Core Specs Strip */}
          <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-6 max-w-lg">
            <div>
              <div className="font-mono-stats text-2xl font-bold text-slate-100">20</div>
              <div className="text-xs text-slate-400 mt-0.5">Loài rồng độc bản</div>
            </div>
            <div>
              <div className="font-mono-stats text-2xl font-bold text-slate-100">5 Tộc Hệ</div>
              <div className="text-xs text-slate-400 mt-0.5">Khắc chế & phối hợp</div>
            </div>
            <div>
              <div className="font-mono-stats text-2xl font-bold text-slate-100">5v5 → 10v10</div>
              <div className="text-xs text-slate-400 mt-0.5">Mở rộng chiến trường</div>
            </div>
          </div>
        </div>

        {/* Visual Showcase: 6 Featured Dragons from Original Collection */}
        <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {featured.map((dragon) => (
            <button
              key={dragon.id}
              onClick={() => go('COLLECTION')}
              className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-[#131822] border border-white/10 hover:border-amber-400/50 transition-all text-left cursor-pointer"
            >
              <DragonPortrait
                dragon={dragon}
                className="w-full h-full group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <ClassIcon dragonClass={dragon.dragonClass} size={12} />
                  <span>{CLASS_META[dragon.dragonClass].label}</span>
                </div>
                <div className="font-semibold text-sm text-white mt-0.5 truncate">
                  {dragon.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};
