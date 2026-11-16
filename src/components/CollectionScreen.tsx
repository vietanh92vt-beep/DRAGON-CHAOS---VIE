import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CLASS_META, CLASS_ORDER, DRAGON_BY_ID, DRAGONS } from '../data/dragons';
import { DragonClass } from '../types/game';
import { DragonPortrait } from './DragonPortrait';
import { ClassIcon } from './ClassIcon';
import { soundFX } from '../utils/sound';

interface Props {
  onBack: () => void;
}

export const CollectionScreen: React.FC<Props> = ({ onBack }) => {
  const [filter, setFilter] = useState<DragonClass | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string>(DRAGONS[0].id);

  const list = filter === 'ALL' ? DRAGONS : DRAGONS.filter((d) => d.dragonClass === filter);
  const active = DRAGON_BY_ID[selectedId] || DRAGONS[0];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col">
      <header className="w-full max-w-[1440px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              soundFX.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-[#131822] hover:bg-[#1C2333] border border-white/10 rounded-lg text-slate-200 cursor-pointer"
          >
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              Bộ Sưu Tập 20 Rồng Huyền Thoại
            </h1>
            <p className="text-xs text-slate-400">
              5 tộc hệ nguyên bản · Chỉ số và bộ 5 kỹ năng riêng biệt cho từng loài rồng
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131822] border border-white/10 rounded-lg">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              filter === 'ALL' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Tất Cả (20)
          </button>
          {CLASS_ORDER.map((cls) => (
            <button
              key={cls}
              onClick={() => setFilter(cls)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                filter === cls ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClassIcon dragonClass={cls} size={13} />
              {CLASS_META[cls].label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 w-full max-w-[1440px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Grid */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 content-start">
          {list.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                soundFX.playClick();
                setSelectedId(d.id);
              }}
              className={`group relative rounded-xl overflow-hidden bg-[#131822] border text-left transition-all cursor-pointer ${
                selectedId === d.id
                  ? 'border-amber-400 ring-1 ring-amber-400/50'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="aspect-[3/4] relative">
                <DragonPortrait
                  dragon={d}
                  className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                    <ClassIcon dragonClass={d.dragonClass} size={12} />
                    <span>{CLASS_META[d.dragonClass].label}</span>
                  </div>
                  <div className="font-semibold text-sm text-white truncate mt-0.5">
                    {d.name}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail View */}
        <aside className="lg:col-span-5">
          <div className="sticky top-6 rounded-xl bg-[#131822] border border-white/10 overflow-hidden">
            <div className="relative h-64 overflow-hidden">
              <DragonPortrait dragon={active} className="w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#131822] via-black/40 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5">
                <div className="flex items-center gap-2 text-xs text-slate-200">
                  <ClassIcon dragonClass={active.dragonClass} size={14} />
                  <span>{CLASS_META[active.dragonClass].label}</span>
                  <span>·</span>
                  <span className="text-amber-300">{active.title}</span>
                </div>
                <h2 className="font-display text-3xl font-bold text-white mt-0.5">
                  {active.name}
                </h2>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">{active.playstyle}</p>

              <div className="grid grid-cols-4 gap-3 p-3.5 rounded-lg bg-[#0B0E14] border border-white/10 font-mono-stats text-xs">
                <div>
                  <div className="text-slate-400 text-[10px]">HP</div>
                  <div className="font-bold text-emerald-400">{active.stats.hp}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">ATK</div>
                  <div className="font-bold text-rose-300">{active.stats.atk}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">MATK</div>
                  <div className="font-bold text-sky-300">{active.stats.matk}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">DEF/MDEF</div>
                  <div className="font-bold text-amber-300">
                    {active.stats.def}/{active.stats.mdef}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">SPD</div>
                  <div className="font-semibold">{active.stats.spd}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">ASPD</div>
                  <div className="font-semibold">{active.stats.aspd}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">RANGE</div>
                  <div className="font-semibold">{active.stats.range}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">ENERGY</div>
                  <div className="font-semibold text-cyan-300">{active.stats.maxEnergy}</div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-semibold text-amber-300">
                    Nội tại — {active.passive.name}
                  </div>
                  <p className="text-slate-300 mt-0.5 leading-relaxed">
                    {active.passive.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="font-semibold text-slate-200">
                    Đánh thường — {active.basicAttack.name}
                  </div>
                  <p className="text-slate-400 mt-0.5">{active.basicAttack.description}</p>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="flex justify-between font-semibold text-sky-300">
                    <span>Kỹ năng 1 — {active.skill1.name}</span>
                    <span className="font-mono-stats text-slate-400">CD {active.skill1.cooldown}s</span>
                  </div>
                  <p className="text-slate-300 mt-0.5 leading-relaxed">
                    {active.skill1.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="flex justify-between font-semibold text-sky-300">
                    <span>Kỹ năng 2 — {active.skill2.name}</span>
                    <span className="font-mono-stats text-slate-400">CD {active.skill2.cooldown}s</span>
                  </div>
                  <p className="text-slate-300 mt-0.5 leading-relaxed">
                    {active.skill2.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="flex justify-between font-semibold text-amber-400">
                    <span>Tuyệt kỹ — {active.ultimate.name}</span>
                    <span className="font-mono-stats text-slate-400">
                      {active.ultimate.energyCost} NL
                    </span>
                  </div>
                  <p className="text-slate-200 mt-0.5 leading-relaxed">
                    {active.ultimate.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
