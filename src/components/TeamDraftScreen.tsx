import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Shuffle, Swords, Users } from 'lucide-react';
import { CLASS_META, CLASS_ORDER, DRAGON_BY_ID, DRAGONS } from '../data/dragons';
import { AIDifficulty, DragonClass, DragonDefinition } from '../types/game';
import { aiSelectVanguard } from '../engine/aiEngine';
import { DragonPortrait } from './DragonPortrait';
import { ClassIcon } from './ClassIcon';
import { soundFX } from '../utils/sound';

interface Props {
  defaultDifficulty: AIDifficulty;
  onBack: () => void;
  onStartBattle: (params: {
    playerTeamIds: string[];
    playerVanguardIds: string[];
    aiTeamIds: string[];
    aiVanguardIds: string[];
    difficulty: AIDifficulty;
  }) => void;
}

export const TeamDraftScreen: React.FC<Props> = ({
  defaultDifficulty,
  onBack,
  onStartBattle,
}) => {
  const [filterClass, setFilterClass] = useState<DragonClass | 'ALL'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [vanguardIds, setVanguardIds] = useState<string[]>([]);
  const [inspectedId, setInspectedId] = useState<string>(DRAGONS[0].id);
  const [difficulty, setDifficulty] = useState<AIDifficulty>(defaultDifficulty);
  const [step, setStep] = useState<'PICK_10' | 'PICK_5_VANGUARD'>('PICK_10');

  const inspectedDragon: DragonDefinition = DRAGON_BY_ID[inspectedId] || DRAGONS[0];

  const filteredDragons = useMemo(() => {
    if (filterClass === 'ALL') return DRAGONS;
    return DRAGONS.filter((d) => d.dragonClass === filterClass);
  }, [filterClass]);

  const aiTeamDefs = useMemo(() => {
    return DRAGONS.filter((d) => !selectedIds.includes(d.id));
  }, [selectedIds]);

  const aiVanguardIds = useMemo(() => {
    if (selectedIds.length !== 10) return [];
    return aiSelectVanguard(aiTeamDefs);
  }, [selectedIds, aiTeamDefs]);

  const togglePick = (id: string) => {
    soundFX.playClick();
    setInspectedId(id);
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      setVanguardIds((prev) => prev.filter((x) => x !== id));
    } else if (selectedIds.length < 10) {
      const next = [...selectedIds, id];
      setSelectedIds(next);
      if (next.length === 10) {
        // Pre-populate a balanced 5-dragon vanguard that player can customize
        const defs = next.map((x) => DRAGON_BY_ID[x]);
        setVanguardIds(aiSelectVanguard(defs));
      }
    }
  };

  const quickPickBalanced = () => {
    soundFX.playClick();
    // Pick 2 from each class randomly
    const picks: string[] = [];
    for (const cls of CLASS_ORDER) {
      const pool = [...DRAGONS.filter((d) => d.dragonClass === cls)].sort(
        () => Math.random() - 0.5
      );
      picks.push(pool[0].id, pool[1].id);
    }
    setSelectedIds(picks);
    const defs = picks.map((id) => DRAGON_BY_ID[id]);
    setVanguardIds(aiSelectVanguard(defs));
  };

  const toggleVanguard = (id: string) => {
    soundFX.playClick();
    setInspectedId(id);
    if (vanguardIds.includes(id)) {
      setVanguardIds((prev) => prev.filter((x) => x !== id));
    } else if (vanguardIds.length < 5) {
      setVanguardIds((prev) => [...prev, id]);
    }
  };

  const handleLaunch = () => {
    if (selectedIds.length !== 10 || vanguardIds.length !== 5) return;
    soundFX.playSkill();
    onStartBattle({
      playerTeamIds: selectedIds,
      playerVanguardIds: vanguardIds,
      aiTeamIds: aiTeamDefs.map((d) => d.id),
      aiVanguardIds,
      difficulty,
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              soundFX.playClick();
              if (step === 'PICK_5_VANGUARD') setStep('PICK_10');
              else onBack();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-[#131822] hover:bg-[#1C2333] border border-white/10 rounded-lg text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            {step === 'PICK_5_VANGUARD' ? 'Chọn lại 10 rồng' : 'Trang chủ'}
          </button>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-50">
              {step === 'PICK_10' ? 'Chọn Đội Hình 10 Rồng' : 'Bố Trí 5 Rồng Xuất Trận & 5 Dự Bị'}
            </h1>
            <p className="text-xs text-slate-400">
              {step === 'PICK_10'
                ? 'Chọn 10 rồng cho đội bạn. AI sẽ nhận 10 rồng còn lại (không trùng lặp).'
                : 'Chọn 5 rồng xuất trận ở Giai đoạn 1 (5v5); 5 rồng còn lại sẽ vào trận khi mở rộng 10v10.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Difficulty Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#131822] border border-white/10 rounded-lg">
            {(['EASY', 'NORMAL', 'HARD'] as AIDifficulty[]).map((diff) => (
              <button
                key={diff}
                onClick={() => {
                  soundFX.playClick();
                  setDifficulty(diff);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  difficulty === diff
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                AI: {diff}
              </button>
            ))}
          </div>

          {step === 'PICK_10' ? (
            <button
              disabled={selectedIds.length !== 10}
              onClick={() => {
                soundFX.playClick();
                setStep('PICK_5_VANGUARD');
              }}
              className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedIds.length === 10
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Tiếp tục ({selectedIds.length}/10)
            </button>
          ) : (
            <button
              disabled={vanguardIds.length !== 5}
              onClick={handleLaunch}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                vanguardIds.length === 5
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Swords size={16} />
              Xác Nhận & Chiến Đấu
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Center Selection Area */}
        <div className="lg:col-span-8 space-y-4">
          {step === 'PICK_10' ? (
            <>
              {/* Filter Tabs & Quick Pick */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131822] border border-white/10 rounded-lg">
                  <button
                    onClick={() => setFilterClass('ALL')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      filterClass === 'ALL'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tất Cả (20)
                  </button>
                  {CLASS_ORDER.map((cls) => (
                    <button
                      key={cls}
                      onClick={() => setFilterClass(cls)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        filterClass === cls
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <ClassIcon dragonClass={cls} size={13} />
                      {CLASS_META[cls].label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={quickPickBalanced}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#131822] hover:bg-[#1C2333] border border-white/10 rounded-lg text-amber-300 cursor-pointer"
                  >
                    <Shuffle size={13} />
                    Chọn Nhanh 10 Rồng
                  </button>
                  {selectedIds.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedIds([]);
                        setVanguardIds([]);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-[#131822] hover:bg-[#1C2333] border border-white/10 rounded-lg text-slate-400 hover:text-rose-300 cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  )}
                </div>
              </div>

              {/* 20 Dragon Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredDragons.map((d) => {
                  const isSelected = selectedIds.includes(d.id);
                  const isInspected = inspectedId === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => togglePick(d.id)}
                      onMouseEnter={() => setInspectedId(d.id)}
                      className={`group relative rounded-xl overflow-hidden bg-[#131822] border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-400 ring-1 ring-emerald-400/50'
                          : isInspected
                          ? 'border-amber-400/60'
                          : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="aspect-[4/5] relative overflow-hidden">
                        <DragonPortrait
                          dragon={d}
                          className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />

                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            <ClassIcon dragonClass={d.dragonClass} size={12} />
                            <span>{CLASS_META[d.dragonClass].label}</span>
                          </div>
                          <div className="font-semibold text-sm text-white truncate">
                            {d.name}
                          </div>
                          <div className="mt-1 flex items-center gap-2 font-mono-stats text-[10px] text-slate-400">
                            <span>HP {d.stats.hp}</span>
                            <span>·</span>
                            <span>
                              {d.dragonClass === 'MAGE' || d.dragonClass === 'SUPPORT'
                                ? `MP ${d.stats.matk}`
                                : `ATK ${d.stats.atk}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Step 2: Pick 5 Vanguard from 10 Selected + Show AI 10 */
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-emerald-400">
                    Đội Của Bạn (Chọn 5 Xuất Trận · {vanguardIds.length}/5)
                  </h2>
                  <span className="text-xs text-slate-400">
                    Nhấp vào thẻ rồng để chuyển giữa Xuất Trận và Dự Bị
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {selectedIds.map((id) => {
                    const d = DRAGON_BY_ID[id];
                    const isVanguard = vanguardIds.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleVanguard(id)}
                        onMouseEnter={() => setInspectedId(id)}
                        className={`relative rounded-xl overflow-hidden bg-[#131822] border text-left transition-all cursor-pointer ${
                          isVanguard
                            ? 'border-amber-400 ring-1 ring-amber-400/40'
                            : 'border-white/10 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="aspect-[4/5] relative">
                          <DragonPortrait dragon={d} className="w-full h-full" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                          <div className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded bg-black/75 text-white">
                            {isVanguard ? 'Xuất Trận' : 'Dự Bị'}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2.5">
                            <div className="flex items-center gap-1 text-[11px] text-slate-300">
                              <ClassIcon dragonClass={d.dragonClass} size={12} />
                              <span>{CLASS_META[d.dragonClass].label}</span>
                            </div>
                            <div className="font-semibold text-sm text-white truncate">
                              {d.name}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AI Roster Preview */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                    <Users size={15} />
                    Đội Hình AI (10 Rồng Còn Lại — AI Tự Chọn 5 Xuất Trận)
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {aiTeamDefs.map((d) => {
                    const aiStart = aiVanguardIds.includes(d.id);
                    return (
                      <div
                        key={d.id}
                        onMouseEnter={() => setInspectedId(d.id)}
                        className={`rounded-lg p-2 bg-[#131822] border flex items-center gap-2.5 ${
                          aiStart ? 'border-rose-500/40' : 'border-white/10 opacity-75'
                        }`}
                      >
                        <DragonPortrait
                          dragon={d}
                          className="w-10 h-10 rounded-md shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {d.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {CLASS_META[d.dragonClass].label} · {aiStart ? 'Đầu trận' : 'Dự bị'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Live Dragon Inspector + Selected Squad Summary */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-xl bg-[#131822] border border-white/10 overflow-hidden">
            <div className="flex gap-4 p-4 border-b border-white/10">
              <DragonPortrait
                dragon={inspectedDragon}
                className="w-24 h-28 rounded-lg shrink-0 border border-white/10"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <ClassIcon dragonClass={inspectedDragon.dragonClass} size={14} />
                  <span>{CLASS_META[inspectedDragon.dragonClass].label}</span>
                  <span>·</span>
                  <span className="text-slate-400">{inspectedDragon.title}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-white mt-0.5">
                  {inspectedDragon.name}
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {inspectedDragon.playstyle}
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 p-3.5 border-b border-white/10 bg-[#0F141D] font-mono-stats text-xs">
              <div>
                <div className="text-slate-400 text-[10px]">HP</div>
                <div className="font-semibold text-emerald-400">{inspectedDragon.stats.hp}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">ATK</div>
                <div className="font-semibold text-rose-300">{inspectedDragon.stats.atk}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">MATK</div>
                <div className="font-semibold text-sky-300">{inspectedDragon.stats.matk}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">DEF / MDEF</div>
                <div className="font-semibold text-amber-300">
                  {inspectedDragon.stats.def}/{inspectedDragon.stats.mdef}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">SPD</div>
                <div className="font-semibold text-slate-200">{inspectedDragon.stats.spd}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">ASPD</div>
                <div className="font-semibold text-slate-200">{inspectedDragon.stats.aspd}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">RANGE</div>
                <div className="font-semibold text-slate-200">{inspectedDragon.stats.range}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px]">ENERGY</div>
                <div className="font-semibold text-cyan-300">{inspectedDragon.stats.maxEnergy}</div>
              </div>
            </div>

            {/* 5 Abilities Breakdown */}
            <div className="p-4 space-y-3 text-xs max-h-[380px] overflow-y-auto">
              <div>
                <div className="font-semibold text-amber-300">
                  Nội tại: {inspectedDragon.passive.name}
                </div>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  {inspectedDragon.passive.description}
                </p>
              </div>
              <div className="pt-2 border-t border-white/5">
                <div className="font-semibold text-slate-200">
                  Đánh thường: {inspectedDragon.basicAttack.name}
                </div>
                <p className="text-slate-400 mt-0.5">{inspectedDragon.basicAttack.description}</p>
              </div>
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between font-semibold text-sky-300">
                  <span>Kỹ năng 1: {inspectedDragon.skill1.name}</span>
                  <span className="font-mono-stats text-[11px] text-slate-400">
                    Hồi {inspectedDragon.skill1.cooldown}s
                  </span>
                </div>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  {inspectedDragon.skill1.description}
                </p>
              </div>
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between font-semibold text-sky-300">
                  <span>Kỹ năng 2: {inspectedDragon.skill2.name}</span>
                  <span className="font-mono-stats text-[11px] text-slate-400">
                    Hồi {inspectedDragon.skill2.cooldown}s
                  </span>
                </div>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  {inspectedDragon.skill2.description}
                </p>
              </div>
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between font-semibold text-amber-400">
                  <span>Tuyệt kỹ: {inspectedDragon.ultimate.name}</span>
                  <span className="font-mono-stats text-[11px] text-slate-400">
                    {inspectedDragon.ultimate.energyCost} Năng lượng
                  </span>
                </div>
                <p className="text-slate-200 mt-0.5 leading-relaxed">
                  {inspectedDragon.ultimate.description}
                </p>
              </div>
            </div>
          </div>

          {/* Selected Roster Tray */}
          <div className="rounded-xl bg-[#131822] border border-white/10 p-4">
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="font-semibold text-slate-200">
                Đội hình đã chọn ({selectedIds.length}/10)
              </span>
              <span className="text-slate-400 font-mono-stats">
                AI: {20 - selectedIds.length}/10
              </span>
            </div>
            {selectedIds.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                Nhấp vào thẻ rồng bên trái để thêm vào đội hình của bạn.
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {selectedIds.map((id) => {
                  const d = DRAGON_BY_ID[id];
                  return (
                    <button
                      key={id}
                      onClick={() => (step === 'PICK_10' ? togglePick(id) : toggleVanguard(id))}
                      title={d.name}
                      className="relative aspect-square rounded-lg overflow-hidden border border-white/15 hover:border-rose-400 transition-colors cursor-pointer"
                    >
                      <DragonPortrait dragon={d} className="w-full h-full" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/80 text-[9px] text-white px-1 py-0.5 truncate text-center">
                        {d.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
