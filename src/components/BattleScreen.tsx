import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Crosshair,
  Gem,
  Pause,
  Play,
  RotateCcw,
  Skull,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  AIDifficulty,
  BattleSettings,
  BattleState,
  DragonInstance,
  GemType,
} from '../types/game';
import {
  autoDeployPlayerReserves,
  createBattleState,
  placeSinglePlayerReserve,
  stepBattle,
} from '../engine/combatEngine';
import {
  ARENA_H,
  ARENA_W,
  GEM_CONFIG,
  applyGemUpgrade,
  castSkill,
  dist,
  getEffectiveStats,
} from '../engine/skillEngine';
import { preloadDragonImages, renderBattlefield } from '../engine/battlefieldRenderer';
import { CLASS_META } from '../data/dragons';
import { DragonPortrait } from './DragonPortrait';
import { ClassIcon } from './ClassIcon';
import { ResultModal } from './ResultModal';
import { soundFX } from '../utils/sound';

interface Props {
  playerTeamIds: string[];
  playerVanguardIds: string[];
  aiTeamIds: string[];
  aiVanguardIds: string[];
  difficulty: AIDifficulty;
  settings: BattleSettings;
  mode?: 'STANDARD' | 'TEST_5V5' | 'TEST_10V10';
  onExit: () => void;
  onUpdateSettings: (next: Partial<BattleSettings>) => void;
}

export const BattleScreen: React.FC<Props> = ({
  playerTeamIds,
  playerVanguardIds,
  aiTeamIds,
  aiVanguardIds,
  difficulty,
  settings,
  mode = 'STANDARD',
  onExit,
  onUpdateSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<BattleState>(
    createBattleState({
      playerTeamIds,
      playerVanguardIds,
      aiTeamIds,
      aiVanguardIds,
      difficulty,
      settings,
      mode,
    })
  );

  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 3>(1);
  const [autoSkill, setAutoSkill] = useState(true);
  const [selectedUid, setSelectedUid] = useState<string | null>(() => {
    const first = stateRef.current.dragons.find((d) => d.team === 'PLAYER' && d.isDeployed);
    return first ? first.uid : null;
  });
  const [targetingMode, setTargetingMode] = useState<'NONE' | 'ENEMY' | 'ALLY'>('NONE');
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [, setTick] = useState(0); // forces lightweight React HUD refresh

  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const autoSkillRef = useRef(autoSkill);
  const selectedUidRef = useRef(selectedUid);
  const hoverPosRef = useRef(hoverPos);
  const settingsRef = useRef(settings);

  pausedRef.current = paused;
  speedRef.current = speed;
  autoSkillRef.current = autoSkill;
  selectedUidRef.current = selectedUid;
  hoverPosRef.current = hoverPos;
  settingsRef.current = settings;

  const resetBattle = () => {
    soundFX.playClick();
    stateRef.current = createBattleState({
      playerTeamIds,
      playerVanguardIds,
      aiTeamIds,
      aiVanguardIds,
      difficulty,
      settings,
      mode,
    });
    const first = stateRef.current.dragons.find((d) => d.team === 'PLAYER' && d.isDeployed);
    setSelectedUid(first ? first.uid : null);
    setPaused(false);
    setTargetingMode('NONE');
    setTick((t) => t + 1);
  };

  useEffect(() => {
    preloadDragonImages();
    let rafId = 0;
    let lastTime = performance.now();
    let hudTimer = 0;

    const loop = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const state = stateRef.current;
      if (!pausedRef.current && state.phase !== 'FINISHED' && state.phase !== 'DEPLOYING_10V10') {
        const subSteps = speedRef.current;
        for (let i = 0; i < subSteps; i++) {
          stepBattle(state, rawDt, {
            autoSkillPlayer: autoSkillRef.current,
            headless: false,
          });
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderBattlefield(ctx, state, {
            selectedUid: selectedUidRef.current,
            showFloatingText: settingsRef.current.showFloatingText,
            timeNow: now / 1000,
            hoverPos: hoverPosRef.current,
          });
        }
      }

      hudTimer += rawDt;
      if (hudTimer >= 0.08) {
        hudTimer = 0;
        setTick((t) => t + 1);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const getArenaCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * ARENA_W;
    const y = ((e.clientY - rect.top) / rect.height) * ARENA_H;
    return { x, y };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getArenaCoords(e);
    const state = stateRef.current;

    // 10v10 Reserve Deployment placement
    if (state.phase === 'DEPLOYING_10V10' && state.pendingDeployUids.length > 0) {
      if (x <= ARENA_W * 0.48) {
        soundFX.playClick();
        placeSinglePlayerReserve(state, state.pendingDeployUids[0], x, y);
        setTick((t) => t + 1);
      }
      return;
    }

    // Find clicked dragon (tall standee card 58x78)
    const clicked = state.dragons
      .filter((d) => d.isAlive && d.isDeployed)
      .sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y))[0];

    if (clicked && Math.abs(x - clicked.x) <= 36 && Math.abs(y - clicked.y) <= 46) {
      soundFX.playClick();
      const currentSelected = state.dragons.find((d) => d.uid === selectedUid);
      if (targetingMode === 'ENEMY' && currentSelected && currentSelected.team === 'PLAYER' && clicked.team === 'AI') {
        currentSelected.priorityTargetUid = clicked.uid;
        setTargetingMode('NONE');
        setTick((t) => t + 1);
        return;
      }
      if (targetingMode === 'ALLY' && currentSelected && currentSelected.team === 'PLAYER' && clicked.team === 'PLAYER') {
        currentSelected.priorityAllyUid = clicked.uid;
        setTargetingMode('NONE');
        setTick((t) => t + 1);
        return;
      }
      setSelectedUid(clicked.uid);
      setTargetingMode('NONE');
    }
  };

  const state = stateRef.current;
  const playerDragons = state.dragons.filter((d) => d.team === 'PLAYER' && !d.isClone);
  const aiDragons = state.dragons.filter((d) => d.team === 'AI' && !d.isClone);

  const playerAlive = playerDragons.filter((d) => d.isAlive).length;
  const aiAlive = aiDragons.filter((d) => d.isAlive).length;
  const playerTotalHp = playerDragons.reduce((s, d) => s + (d.isAlive ? d.hp : 0), 0);
  const playerMaxHp = playerDragons.reduce((s, d) => s + d.maxHp, 0);
  const aiTotalHp = aiDragons.reduce((s, d) => s + (d.isAlive ? d.hp : 0), 0);
  const aiMaxHp = aiDragons.reduce((s, d) => s + d.maxHp, 0);

  const selectedDragon: DragonInstance | undefined =
    state.dragons.find((d) => d.uid === selectedUid) ||
    playerDragons.find((d) => d.isAlive && d.isDeployed) ||
    playerDragons[0];

  const selectedEff = selectedDragon ? getEffectiveStats(selectedDragon, state.dragons) : null;
  const pendingReserve =
    state.phase === 'DEPLOYING_10V10' && state.pendingDeployUids.length > 0
      ? state.dragons.find((d) => d.uid === state.pendingDeployUids[0])
      : null;

  const timeLeft = Math.max(0, state.maxDuration - state.elapsed);
  const expansionLeft = Math.max(0, state.expansionTime - state.elapsed);
  const playerDeployedDeaths = playerDragons.filter((d) => d.isDeployed && !d.isAlive).length;
  const aiDeployedDeaths = aiDragons.filter((d) => d.isDeployed && !d.isAlive).length;
  const maxSideDeaths = Math.max(playerDeployedDeaths, aiDeployedDeaths);

  const triggerManualSkill = (slot: 'S1' | 'S2' | 'ULT') => {
    if (!selectedDragon || selectedDragon.team !== 'PLAYER') return;
    castSkill(state, selectedDragon, slot, false);
    setTick((t) => t + 1);
  };

  const triggerGemUpgrade = (gemType: GemType) => {
    if (!selectedDragon || selectedDragon.team !== 'PLAYER') return;
    if (applyGemUpgrade(state, selectedDragon.uid, gemType, false)) {
      setTick((t) => t + 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col">
      {/* Top Tactical Bar */}
      <header className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#131822]">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              soundFX.playClick();
              onExit();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0B0E14] hover:bg-slate-800 border border-white/10 rounded-lg text-slate-200 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Thoát
          </button>
          <button
            onClick={resetBattle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0B0E14] hover:bg-slate-800 border border-white/10 rounded-lg text-slate-200 cursor-pointer"
          >
            <RotateCcw size={14} />
            Đấu lại
          </button>
        </div>

        {/* Scoreboard & Phase Timer */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-right">
            <div className="text-[11px] font-semibold text-emerald-400">
              PHE BẠN · {playerAlive}/{playerDragons.length}
            </div>
            <div className="w-28 sm:w-36 h-2 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(playerTotalHp / Math.max(1, playerMaxHp)) * 100}%` }}
              />
            </div>
          </div>

          <div className="text-center px-3 py-1 rounded-lg bg-[#0B0E14] border border-white/10">
            <div className="font-mono-stats text-lg font-bold text-amber-400 leading-none">
              {Math.ceil(timeLeft)}s
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
              {state.phase === 'PHASE_1_5V5'
                ? `5v5 · Mở rộng ${Math.ceil(expansionLeft)}s (${maxSideDeaths}/${state.expansionDeaths} hạ)`
                : state.phase === 'DEPLOYING_10V10'
                ? 'Triển khai 10v10'
                : state.mode === 'TEST_5V5'
                ? 'Thử nghiệm 5v5'
                : 'Giai đoạn 2: 10v10'}
            </div>
          </div>

          <div className="text-left">
            <div className="text-[11px] font-semibold text-rose-400">
              AI ({difficulty}) · {aiAlive}/{aiDragons.length}
            </div>
            <div className="w-28 sm:w-36 h-2 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-rose-500 transition-all"
                style={{ width: `${(aiTotalHp / Math.max(1, aiMaxHp)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Playback, Gems & Auto-Skill Controls */}
        <div className="flex items-center gap-2">
          <div
            title="Nhận +1 Ngọc mỗi 12s, +2 Ngọc khi hạ gục rồng địch, +3 Ngọc khi mở rộng 10v10"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-cyan-400/40 text-cyan-300 text-xs font-mono-stats font-bold"
          >
            <Gem size={14} className="text-cyan-400" />
            <span>{state.playerGems} Ngọc</span>
            <span className="text-[10px] font-normal text-slate-400">
              (+1/{Math.ceil(state.gemIncomeTimer)}s)
            </span>
          </div>
          <button
            onClick={() => {
              soundFX.playClick();
              setAutoSkill((v) => !v);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              autoSkill
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-[#0B0E14] border-white/10 text-slate-400'
            }`}
          >
            <Zap size={13} />
            Auto Kỹ Năng: {autoSkill ? 'BẬT' : 'TẮT'}
          </button>

          <div className="flex items-center p-0.5 bg-[#0B0E14] border border-white/10 rounded-lg">
            {([1, 2, 3] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  soundFX.playClick();
                  setSpeed(s);
                }}
                className={`px-2.5 py-1 text-xs font-mono-stats font-semibold rounded cursor-pointer ${
                  speed === s ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                x{s}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              soundFX.playClick();
              setPaused((p) => !p);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg cursor-pointer"
          >
            {paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} />}
            {paused ? 'Tiếp tục' : 'Tạm dừng'}
          </button>

          <button
            onClick={() => {
              const next = !settings.soundEnabled;
              soundFX.enabled = next;
              onUpdateSettings({ soundEnabled: next });
            }}
            aria-label="Âm thanh"
            className="p-2 rounded-lg bg-[#0B0E14] border border-white/10 text-slate-300 hover:text-white cursor-pointer"
          >
            {settings.soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>
      </header>

      {/* Main Battlefield + Right Side Feed */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-3 grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Battlefield Column */}
        <div className="xl:col-span-9 space-y-3">
          {/* Reserve Deployment Banner */}
          {state.phase === 'DEPLOYING_10V10' && pendingReserve && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-400/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <DragonPortrait
                  dragon={pendingReserve.def}
                  className="w-10 h-10 rounded-lg border border-emerald-400/50"
                />
                <div>
                  <div className="text-sm font-bold text-emerald-300">
                    Mở Rộng 10v10 — Nhấp vào vùng sáng bên trái chiến trường để đặt: {pendingReserve.def.name}
                  </div>
                  <div className="text-xs text-slate-300">
                    Còn {state.pendingDeployUids.length} rồng dự bị chưa triển khai ({CLASS_META[pendingReserve.def.dragonClass].label})
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  soundFX.playSkill();
                  autoDeployPlayerReserves(state);
                  setTick((t) => t + 1);
                }}
                className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg cursor-pointer"
              >
                Triển Khai Tự Động Tất Cả
              </button>
            </div>
          )}

          {/* Kill Spotlight Toast */}
          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#090D16] shadow-2xl">
            <canvas
              ref={canvasRef}
              width={ARENA_W}
              height={ARENA_H}
              onClick={handleCanvasClick}
              onMouseMove={(e) => setHoverPos(getArenaCoords(e))}
              onMouseLeave={() => setHoverPos(null)}
              className="w-full h-auto block cursor-crosshair aspect-[1200/560]"
            />

            {state.killAnnouncement && (
              <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-2 rounded-lg bg-black/85 border border-amber-400/60 shadow-lg">
                <img
                  src={state.killAnnouncement.killerImage}
                  alt={state.killAnnouncement.killerName}
                  className="w-7 h-7 rounded-full object-cover object-top border border-amber-400"
                />
                <Skull size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-white">
                  {state.killAnnouncement.killerName}
                </span>
                <span className="text-xs text-slate-300">vừa hạ gục</span>
                <span className="text-xs font-bold text-rose-400">
                  {state.killAnnouncement.victimName}
                </span>
              </div>
            )}

            {targetingMode !== 'NONE' && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold shadow">
                {targetingMode === 'ENEMY'
                  ? 'Nhấp vào một rồng ĐỊCH trên bản đồ để ưu tiên tấn công'
                  : 'Nhấp vào một rồng ĐỒNG MINH trên bản đồ để ưu tiên hỗ trợ'}
              </div>
            )}
          </div>

          {/* Bottom Player Command Dock */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Quick Squad Selector */}
            <div className="lg:col-span-5 p-3 rounded-xl bg-[#131822] border border-white/10">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-200">Đội Hình Của Bạn</span>
                <span className="text-[11px] text-slate-400">Nhấp để chọn & điều khiển kỹ năng</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {playerDragons.map((d) => {
                  const isSel = selectedDragon?.uid === d.uid;
                  const ultReady = d.isAlive && d.isDeployed && d.energy >= d.maxEnergy;
                  return (
                    <button
                      key={d.uid}
                      onClick={() => {
                        soundFX.playClick();
                        setSelectedUid(d.uid);
                      }}
                      className={`relative rounded-lg p-1.5 border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'bg-[#1C2333] border-amber-400'
                          : 'bg-[#0B0E14] border-white/10 hover:border-white/25'
                      } ${!d.isAlive ? 'opacity-40 grayscale' : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <DragonPortrait dragon={d.def} className="w-7 h-7 rounded shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-semibold text-white truncate">
                            {d.def.name}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {!d.isDeployed ? 'Dự bị' : d.isAlive ? `${Math.round((d.hp / d.maxHp) * 100)}%` : 'Hạ'}
                          </div>
                        </div>
                      </div>
                      {d.isDeployed && d.isAlive && (
                        <div className="mt-1 space-y-0.5">
                          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${(d.hp / d.maxHp) * 100}%` }}
                            />
                          </div>
                          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${ultReady ? 'bg-amber-400' : 'bg-sky-400'}`}
                              style={{ width: `${(d.energy / d.maxEnergy) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Dragon Inspector & Manual Skill Bar */}
            <div className="lg:col-span-7 p-3 rounded-xl bg-[#131822] border border-white/10">
              {selectedDragon && selectedEff ? (
                <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                  <div className="flex items-center gap-3 sm:w-56 shrink-0">
                    <DragonPortrait
                      dragon={selectedDragon.def}
                      className="w-16 h-20 rounded-lg border border-white/10 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-[11px] text-slate-300">
                        <ClassIcon dragonClass={selectedDragon.def.dragonClass} size={12} />
                        <span>{CLASS_META[selectedDragon.def.dragonClass].label}</span>
                        <span>·</span>
                        <span className={selectedDragon.team === 'PLAYER' ? 'text-emerald-400' : 'text-rose-400'}>
                          {selectedDragon.team === 'PLAYER' ? 'Phe Bạn' : 'AI'}
                        </span>
                      </div>
                      <div className="font-display text-base font-bold text-white truncate">
                        {selectedDragon.def.name}
                      </div>
                      <div className="font-mono-stats text-[11px] text-emerald-400 mt-0.5">
                        HP {Math.round(selectedDragon.hp)}/{selectedDragon.maxHp}
                        {selectedDragon.shield > 0 ? ` (+${Math.round(selectedDragon.shield)})` : ''}
                      </div>
                      <div className="font-mono-stats text-[10px] text-slate-400 mt-0.5">
                        ATK {Math.round(selectedEff.atk)} · MP {Math.round(selectedEff.matk)} · DEF {Math.round(selectedEff.def)}
                      </div>
                      {selectedDragon.defId === 'ngu_long' && (
                        <div className="font-mono-stats text-[10px] text-sky-300 mt-0.5">
                          Long Khí: {selectedDragon.longKhi}/10
                        </div>
                      )}
                      {selectedDragon.defId === 'tam_dau_long' && (
                        <div className="text-[10px] text-teal-300 mt-0.5">
                          Thế: {selectedDragon.tamDauStance === 'CONG' ? 'Công' : selectedDragon.tamDauStance === 'THU' ? 'Thủ' : 'Hỗ Trợ'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Skill Buttons & Target Override */}
                  <div className="flex-1 flex flex-col justify-between gap-2">
                    {selectedDragon.team === 'PLAYER' && selectedDragon.isAlive && selectedDragon.isDeployed ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            disabled={selectedDragon.s1Cd > 0}
                            onClick={() => triggerManualSkill('S1')}
                            className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                              selectedDragon.s1Cd <= 0
                                ? 'bg-[#1C2333] hover:bg-slate-700 border-sky-400/50 text-white'
                                : 'bg-[#0B0E14] border-white/10 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <div className="text-[10px] text-sky-300 font-semibold">Kỹ năng 1</div>
                            <div className="text-xs font-bold truncate">{selectedDragon.def.skill1.name}</div>
                            <div className="font-mono-stats text-[10px] text-slate-400 mt-0.5">
                              {selectedDragon.s1Cd > 0 ? `${selectedDragon.s1Cd.toFixed(1)}s` : 'Sẵn sàng'}
                            </div>
                          </button>

                          <button
                            disabled={selectedDragon.s2Cd > 0}
                            onClick={() => triggerManualSkill('S2')}
                            className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                              selectedDragon.s2Cd <= 0
                                ? 'bg-[#1C2333] hover:bg-slate-700 border-sky-400/50 text-white'
                                : 'bg-[#0B0E14] border-white/10 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <div className="text-[10px] text-sky-300 font-semibold">Kỹ năng 2</div>
                            <div className="text-xs font-bold truncate">{selectedDragon.def.skill2.name}</div>
                            <div className="font-mono-stats text-[10px] text-slate-400 mt-0.5">
                              {selectedDragon.s2Cd > 0 ? `${selectedDragon.s2Cd.toFixed(1)}s` : 'Sẵn sàng'}
                            </div>
                          </button>

                          <button
                            disabled={selectedDragon.energy < selectedDragon.maxEnergy}
                            onClick={() => triggerManualSkill('ULT')}
                            className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                              selectedDragon.energy >= selectedDragon.maxEnergy
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400 text-amber-200'
                                : 'bg-[#0B0E14] border-white/10 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <div className="text-[10px] text-amber-400 font-semibold">Tuyệt kỹ</div>
                            <div className="text-xs font-bold truncate">{selectedDragon.def.ultimate.name}</div>
                            <div className="font-mono-stats text-[10px] text-slate-300 mt-0.5">
                              {Math.floor(selectedDragon.energy)}/{selectedDragon.maxEnergy} NL
                            </div>
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <button
                            onClick={() =>
                              setTargetingMode((m) => (m === 'ENEMY' ? 'NONE' : 'ENEMY'))
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border cursor-pointer ${
                              targetingMode === 'ENEMY'
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                                : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/30'
                            }`}
                          >
                            <Crosshair size={12} />
                            Chọn mục tiêu địch
                          </button>
                          {selectedDragon.def.dragonClass === 'SUPPORT' && (
                            <button
                              onClick={() =>
                                setTargetingMode((m) => (m === 'ALLY' ? 'NONE' : 'ALLY'))
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border cursor-pointer ${
                                targetingMode === 'ALLY'
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                                  : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/30'
                              }`}
                            >
                              Chọn đồng minh hỗ trợ
                            </button>
                          )}
                          <span className="text-slate-400 ml-auto font-mono-stats">
                            DMG: {Math.round(selectedDragon.damageDealt)} · Kill: {selectedDragon.kills}
                          </span>
                        </div>

                        {/* Gem Enhancement Strip (Ngọc Long Hồn) */}
                        <div className="pt-2 border-t border-white/10">
                          <div className="flex items-center justify-between text-[10px] mb-1.5">
                            <span className="inline-flex items-center gap-1 font-semibold text-cyan-300">
                              <Gem size={11} />
                              Khảm Ngọc Cường Hóa ({selectedDragon.def.name})
                            </span>
                            <span className="font-mono-stats text-slate-400">
                              Hiện có: <strong className="text-cyan-300">{state.playerGems} Ngọc</strong>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                            {(['ATK', 'DEF', 'SPD', 'HP', 'ULT'] as GemType[]).map((gType) => {
                              const cfg = GEM_CONFIG[gType];
                              const currentLv =
                                gType === 'ATK'
                                  ? selectedDragon.gemAtkLv
                                  : gType === 'DEF'
                                  ? selectedDragon.gemDefLv
                                  : gType === 'SPD'
                                  ? selectedDragon.gemSpdLv
                                  : gType === 'HP'
                                  ? selectedDragon.gemHpLv
                                  : selectedDragon.gemUltEmpowered
                                  ? 1
                                  : 0;
                              const isMaxed =
                                gType === 'ULT'
                                  ? selectedDragon.energy >= selectedDragon.maxEnergy &&
                                    selectedDragon.gemUltEmpowered
                                  : currentLv >= cfg.maxLv;
                              const canAfford = state.playerGems >= cfg.cost && !isMaxed;

                              return (
                                <button
                                  key={gType}
                                  disabled={!canAfford}
                                  onClick={() => triggerGemUpgrade(gType)}
                                  title={cfg.shortDesc}
                                  className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                                    canAfford
                                      ? 'bg-[#0B0E14] hover:bg-[#1C2333] border-cyan-400/40 text-white'
                                      : 'bg-[#0B0E14]/60 border-white/10 text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className="text-[10px] font-bold truncate"
                                      style={{ color: canAfford ? cfg.color : undefined }}
                                    >
                                      {cfg.name.replace('Ngọc ', '')}
                                    </span>
                                    <span className="font-mono-stats text-[9px] text-cyan-300 shrink-0">
                                      {isMaxed ? 'MAX' : `${cfg.cost}N`}
                                    </span>
                                  </div>
                                  <div className="text-[9px] text-slate-400 truncate mt-0.5">
                                    {gType === 'ULT'
                                      ? selectedDragon.gemUltEmpowered
                                        ? 'Đã cường hóa'
                                        : '+100% NL & +30%'
                                      : `Lv ${currentLv}/${cfg.maxLv} · ${cfg.shortDesc.split('&')[0].trim()}`}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400 flex items-center justify-between h-full">
                        <span>
                          {selectedDragon.team === 'AI'
                            ? `Đang xem rồng đối thủ (${selectedDragon.def.passive.name}: ${selectedDragon.def.passive.description})`
                            : !selectedDragon.isDeployed
                            ? 'Rồng đang ở hàng dự bị, chờ mở rộng 10v10.'
                            : 'Rồng này đã bị hạ gục.'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Column: Live Kill Table & Combat Feed */}
        <aside className="xl:col-span-3 space-y-3">
          {/* Live Damage & Kills */}
          <div className="p-3.5 rounded-xl bg-[#131822] border border-white/10">
            <h3 className="text-xs font-semibold text-slate-200 mb-2.5">
              Thống Kê Hạ Gục & Sát Thương
            </h3>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {[...state.dragons]
                .filter((d) => !d.isClone && d.isDeployed)
                .sort((a, b) => b.kills - a.kills || b.damageDealt - a.damageDealt)
                .slice(0, 10)
                .map((d) => (
                  <div
                    key={d.uid}
                    onClick={() => setSelectedUid(d.uid)}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-[#0B0E14] text-xs cursor-pointer hover:bg-slate-800/70"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-4 rounded-sm shrink-0 ${
                          d.team === 'PLAYER' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className={`truncate ${!d.isAlive ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                        {d.def.name}
                      </span>
                    </div>
                    <div className="font-mono-stats text-[11px] text-slate-300 shrink-0">
                      <span className="text-amber-300">{d.kills}K</span>
                      <span className="text-slate-500 mx-1">·</span>
                      <span>{Math.round(d.damageDealt)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Combat Log */}
          <div className="p-3.5 rounded-xl bg-[#131822] border border-white/10">
            <h3 className="text-xs font-semibold text-slate-200 mb-2.5">
              Thông Báo Chiến Đấu
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
              {state.logs.map((log) => (
                <div
                  key={log.id}
                  className={`pb-1.5 border-b border-white/5 leading-snug ${
                    log.type === 'KILL'
                      ? 'text-amber-300 font-medium'
                      : log.type === 'ULTIMATE'
                      ? 'text-sky-300'
                      : log.type === 'REVIVE'
                      ? 'text-emerald-300 font-medium'
                      : log.type === 'GEM'
                      ? 'text-cyan-300 font-medium'
                      : log.type === 'PHASE'
                      ? 'text-amber-400 font-semibold'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="font-mono-stats text-[10px] text-slate-500 mr-1.5">
                    [{log.time.toFixed(1)}s]
                  </span>
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Victory / Defeat / Draw Modal */}
      {state.phase === 'FINISHED' && (
        <ResultModal
          state={state}
          onReplay={resetBattle}
          onMainMenu={() => {
            soundFX.playClick();
            onExit();
          }}
        />
      )}
    </div>
  );
};
