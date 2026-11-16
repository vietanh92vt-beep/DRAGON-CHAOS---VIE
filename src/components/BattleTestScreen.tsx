import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Zap,
} from 'lucide-react';
import { CLASS_META, DRAGON_BY_ID, DRAGONS } from '../data/dragons';
import {
  AIDifficulty,
  BattleSettings,
  BattleState,
  SimulationReport,
} from '../types/game';
import {
  createBattleState,
  runSimulationBatch,
  stepBattle,
} from '../engine/combatEngine';
import { aiSelectVanguard } from '../engine/aiEngine';
import { ARENA_H, ARENA_W } from '../engine/skillEngine';
import { preloadDragonImages, renderBattlefield } from '../engine/battlefieldRenderer';
import { DragonPortrait } from './DragonPortrait';
import { ClassIcon } from './ClassIcon';
import { soundFX } from '../utils/sound';

interface Props {
  settings: BattleSettings;
  onBack: () => void;
}

const DEFAULT_TEAM_A_5 = ['kim_long', 'ngu_long', 'am_long', 'hoa_long_mage', 'bach_long'];
const DEFAULT_TEAM_B_5 = ['cot_long', 'diet_the_long', 'quy_long', 'bang_long', 'hoa_long_support'];

export const BattleTestScreen: React.FC<Props> = ({ settings, onBack }) => {
  const [testMode, setTestMode] = useState<'5V5' | '10V10'>('5V5');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('HARD');
  const [speed, setSpeed] = useState<1 | 2 | 3 | 5>(2);
  const [paused, setPaused] = useState(false);

  const [teamAIds, setTeamAIds] = useState<string[]>(DEFAULT_TEAM_A_5);
  const [teamBIds, setTeamBIds] = useState<string[]>(DEFAULT_TEAM_B_5);
  const [editingTeam, setEditingTeam] = useState<'A' | 'B' | null>(null);

  const [simReport, setSimReport] = useState<SimulationReport | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<BattleState>(
    createBattleState({
      playerTeamIds: teamAIds,
      playerVanguardIds: teamAIds,
      aiTeamIds: teamBIds,
      aiVanguardIds: teamBIds,
      difficulty,
      settings,
      mode: 'TEST_5V5',
    })
  );

  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const settingsRef = useRef(settings);
  pausedRef.current = paused;
  speedRef.current = speed;
  settingsRef.current = settings;

  const [, setTick] = useState(0);

  const requiredSize = testMode === '5V5' ? 5 : 10;

  const rebuildMatch = (
    aIds = teamAIds,
    bIds = teamBIds,
    mode = testMode,
    diff = difficulty
  ) => {
    const aDefs = aIds.map((id) => DRAGON_BY_ID[id]).filter(Boolean);
    const bDefs = bIds.map((id) => DRAGON_BY_ID[id]).filter(Boolean);
    stateRef.current = createBattleState({
      playerTeamIds: aIds,
      playerVanguardIds: aiSelectVanguard(aDefs),
      aiTeamIds: bIds,
      aiVanguardIds: aiSelectVanguard(bDefs),
      difficulty: diff,
      settings,
      mode: mode === '5V5' ? 'TEST_5V5' : 'TEST_10V10',
    });
    setPaused(false);
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
      if (!pausedRef.current && state.phase !== 'FINISHED') {
        const subSteps = speedRef.current;
        for (let i = 0; i < subSteps; i++) {
          stepBattle(state, rawDt, { autoSkillPlayer: true, headless: false });
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderBattlefield(ctx, state, {
            selectedUid: null,
            showFloatingText: settingsRef.current.showFloatingText,
            timeNow: now / 1000,
            hoverPos: null,
          });
        }
      }

      hudTimer += rawDt;
      if (hudTimer >= 0.1) {
        hudTimer = 0;
        setTick((t) => t + 1);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleModeSwitch = (mode: '5V5' | '10V10') => {
    soundFX.playClick();
    setTestMode(mode);
    setSimReport(null);
    if (mode === '5V5') {
      const a = teamAIds.slice(0, 5);
      const b = teamBIds.slice(0, 5);
      setTeamAIds(a);
      setTeamBIds(b);
      rebuildMatch(a, b, mode, difficulty);
    } else {
      const a = DRAGONS.slice(0, 10).map((d) => d.id);
      const b = DRAGONS.slice(10, 20).map((d) => d.id);
      setTeamAIds(a);
      setTeamBIds(b);
      rebuildMatch(a, b, mode, difficulty);
    }
  };

  const randomizeTeams = () => {
    soundFX.playClick();
    const shuffled = [...DRAGONS].sort(() => Math.random() - 0.5);
    const a = shuffled.slice(0, requiredSize).map((d) => d.id);
    const b = shuffled.slice(requiredSize, requiredSize * 2).map((d) => d.id);
    setTeamAIds(a);
    setTeamBIds(b);
    setSimReport(null);
    rebuildMatch(a, b, testMode, difficulty);
  };

  const toggleDragonInEditingTeam = (id: string) => {
    if (!editingTeam) return;
    soundFX.playClick();
    const setter = editingTeam === 'A' ? setTeamAIds : setTeamBIds;
    const current = editingTeam === 'A' ? teamAIds : teamBIds;
    if (current.includes(id)) {
      if (current.length > 1) {
        setter(current.filter((x) => x !== id));
      }
    } else if (current.length < requiredSize) {
      setter([...current, id]);
    }
  };

  const handleSimulate100 = () => {
    soundFX.playSkill();
    setIsSimulating(true);
    setTimeout(() => {
      const report = runSimulationBatch({
        teamAIds,
        teamBIds,
        mode: testMode,
        difficulty,
        settings,
        count: 100,
      });
      setSimReport(report);
      setIsSimulating(false);
    }, 30);
  };

  const state = stateRef.current;
  const realDragons = state.dragons.filter((d) => !d.isClone);
  const avgSurvivalA =
    realDragons
      .filter((d) => d.team === 'PLAYER')
      .reduce((s, d) => s + d.timeAlive, 0) / Math.max(1, teamAIds.length);
  const avgSurvivalB =
    realDragons
      .filter((d) => d.team === 'AI')
      .reduce((s, d) => s + d.timeAlive, 0) / Math.max(1, teamBIds.length);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#131822]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundFX.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0B0E14] hover:bg-slate-800 border border-white/10 rounded-lg text-slate-200 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Trang chủ
          </button>
          <div>
            <h1 className="font-display text-lg sm:text-xl font-bold text-white">
              Battle Test & Cân Bằng Game
            </h1>
            <p className="text-[11px] text-slate-400">
              Thử nghiệm bất kỳ 2 đội hình, log kỹ năng và mô phỏng nhanh 100 trận
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 5v5 / 10v10 */}
          <div className="flex items-center p-0.5 bg-[#0B0E14] border border-white/10 rounded-lg">
            {(['5V5', '10V10'] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleModeSwitch(m)}
                className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
                  testMode === m ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Difficulty */}
          <div className="flex items-center p-0.5 bg-[#0B0E14] border border-white/10 rounded-lg">
            {(['EASY', 'NORMAL', 'HARD'] as AIDifficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDifficulty(d);
                  rebuildMatch(teamAIds, teamBIds, testMode, d);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                  difficulty === d ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Speed */}
          <div className="flex items-center p-0.5 bg-[#0B0E14] border border-white/10 rounded-lg">
            {([1, 2, 3, 5] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2.5 py-1 text-xs font-mono-stats font-semibold rounded cursor-pointer ${
                  speed === s ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                x{s}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0B0E14] border border-white/10 hover:border-white/30 rounded-lg cursor-pointer"
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? 'Chạy' : 'Tạm dừng'}
          </button>

          <button
            onClick={() => rebuildMatch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0B0E14] border border-white/10 hover:border-white/30 rounded-lg cursor-pointer"
          >
            <RotateCcw size={13} />
            Reset Trận
          </button>

          <button
            disabled={isSimulating || teamAIds.length !== requiredSize || teamBIds.length !== requiredSize}
            onClick={handleSimulate100}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-950 rounded-lg cursor-pointer"
          >
            <Zap size={14} />
            {isSimulating ? 'Đang chạy 100 trận...' : 'SIMULATE 100 MATCHES'}
          </button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-4 space-y-5">
        {/* Team Builders Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Team A */}
          <div className="p-3.5 rounded-xl bg-[#131822] border border-emerald-500/30">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-emerald-400">
                ĐỘI A ({teamAIds.length}/{requiredSize}) · Thời gian sống TB: {avgSurvivalA.toFixed(1)}s
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={randomizeTeams}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#0B0E14] border border-white/10 rounded text-amber-300 cursor-pointer"
                >
                  <Shuffle size={11} />
                  Ngẫu nhiên 2 đội
                </button>
                <button
                  onClick={() => setEditingTeam((e) => (e === 'A' ? null : 'A'))}
                  className={`px-2.5 py-1 text-[11px] rounded font-semibold cursor-pointer ${
                    editingTeam === 'A'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-[#0B0E14] border border-white/10 text-slate-200'
                  }`}
                >
                  {editingTeam === 'A' ? 'Xong' : 'Chỉnh Đội A'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {teamAIds.map((id) => {
                const d = DRAGON_BY_ID[id];
                if (!d) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0B0E14] border border-white/10 text-xs"
                  >
                    <DragonPortrait dragon={d} className="w-6 h-6 rounded" />
                    <span>{d.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team B */}
          <div className="p-3.5 rounded-xl bg-[#131822] border border-rose-500/30">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-rose-400">
                ĐỘI B ({teamBIds.length}/{requiredSize}) · Thời gian sống TB: {avgSurvivalB.toFixed(1)}s
              </span>
              <button
                onClick={() => setEditingTeam((e) => (e === 'B' ? null : 'B'))}
                className={`px-2.5 py-1 text-[11px] rounded font-semibold cursor-pointer ${
                  editingTeam === 'B'
                    ? 'bg-rose-500 text-slate-950'
                    : 'bg-[#0B0E14] border border-white/10 text-slate-200'
                }`}
              >
                {editingTeam === 'B' ? 'Xong' : 'Chỉnh Đội B'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {teamBIds.map((id) => {
                const d = DRAGON_BY_ID[id];
                if (!d) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0B0E14] border border-white/10 text-xs"
                  >
                    <DragonPortrait dragon={d} className="w-6 h-6 rounded" />
                    <span>{d.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Team Picker Drawer if Editing A or B */}
        {editingTeam && (
          <div className="p-4 rounded-xl bg-[#131822] border border-amber-400/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-300">
                Chọn rồng cho Đội {editingTeam} (tối đa {requiredSize} rồng)
              </span>
              <button
                onClick={() => {
                  setEditingTeam(null);
                  rebuildMatch();
                }}
                className="px-4 py-1.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-lg cursor-pointer"
              >
                Áp dụng & Reset Trận
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2">
              {DRAGONS.map((d) => {
                const list = editingTeam === 'A' ? teamAIds : teamBIds;
                const active = list.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => toggleDragonInEditingTeam(d.id)}
                    className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:border-white/30'
                    }`}
                  >
                    <DragonPortrait dragon={d} className="w-full aspect-square rounded mb-1" />
                    <div className="text-[10px] font-semibold truncate">{d.name}</div>
                    <div className="text-[9px] text-slate-400 truncate">
                      {CLASS_META[d.dragonClass].label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 100-Match Simulation Report */}
        {simReport && (
          <section className="p-5 rounded-xl bg-[#131822] border border-emerald-500/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-400" />
                <h2 className="font-display text-lg font-bold text-white">
                  Kết Quả Mô Phỏng {simReport.totalMatches} Trận ({testMode} · AI {difficulty})
                </h2>
              </div>
              <div className="flex items-center gap-6 font-mono-stats text-sm">
                <span className="text-emerald-400 font-bold">
                  Đội A thắng: {simReport.teamAWins}% ({simReport.teamAWins})
                </span>
                <span className="text-rose-400 font-bold">
                  Đội B thắng: {simReport.teamBWins}% ({simReport.teamBWins})
                </span>
                <span className="text-amber-300">Hòa: {simReport.draws}</span>
                <span className="text-slate-300">
                  Thời gian TB: {simReport.avgMatchTime.toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">Rồng</th>
                    <th className="py-2 px-2 font-medium">Tộc hệ</th>
                    <th className="py-2 px-2 font-medium text-right">Số trận</th>
                    <th className="py-2 px-2 font-medium text-right">Tỷ lệ thắng</th>
                    <th className="py-2 px-2 font-medium text-right">DMG TB</th>
                    <th className="py-2 px-2 font-medium text-right">Hồi máu TB</th>
                    <th className="py-2 px-2 font-medium text-right">Hạ gục TB</th>
                    <th className="py-2 pl-2 font-medium text-right">Sống TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono-stats">
                  {simReport.dragonStats.map((s) => (
                    <tr key={s.defId} className="hover:bg-white/[0.02]">
                      <td className="py-2 pr-3 font-sans font-medium text-white">{s.name}</td>
                      <td className="py-2 px-2 font-sans text-slate-400">
                        {CLASS_META[s.dragonClass].label}
                      </td>
                      <td className="py-2 px-2 text-right">{s.matches}</td>
                      <td className="py-2 px-2 text-right text-amber-300">
                        {((s.wins / Math.max(1, s.matches)) * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-right text-rose-300">
                        {Math.round(s.totalDamage / Math.max(1, s.matches)).toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-right text-emerald-300">
                        {Math.round(s.totalHealing / Math.max(1, s.matches)).toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-200">
                        {(s.totalKills / Math.max(1, s.matches)).toFixed(2)}
                      </td>
                      <td className="py-2 pl-2 text-right text-sky-300">
                        {(s.totalTimeAlive / Math.max(1, s.matches)).toFixed(1)}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Live Canvas + Live Telemetry Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-7 space-y-2">
            <div className="rounded-xl overflow-hidden border border-white/10 bg-[#090D16]">
              <canvas
                ref={canvasRef}
                width={ARENA_W}
                height={ARENA_H}
                className="w-full h-auto block aspect-[1200/560]"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono-stats">
              <span>Thời gian: {state.elapsed.toFixed(1)}s / {state.maxDuration}s</span>
              <span>
                {state.winner
                  ? `Kết quả: ${state.winner === 'PLAYER' ? 'ĐỘI A THẮNG' : state.winner === 'AI' ? 'ĐỘI B THẮNG' : 'HÒA'}`
                  : 'Đang giao tranh...'}
              </span>
            </div>
          </div>

          {/* Live Per-Dragon Stats & Skill Log */}
          <div className="xl:col-span-5 space-y-4">
            <div className="p-3.5 rounded-xl bg-[#131822] border border-white/10">
              <h3 className="text-xs font-semibold text-slate-200 mb-2">
                Chỉ Số Trực Tiếp Từng Rồng
              </h3>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="text-slate-400 border-b border-white/10">
                      <th className="py-1.5 font-medium">Rồng</th>
                      <th className="py-1.5 font-medium text-right">DMG</th>
                      <th className="py-1.5 font-medium text-right">Hồi (Lần)</th>
                      <th className="py-1.5 font-medium text-right">Kill</th>
                      <th className="py-1.5 font-medium text-right">Sống</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono-stats">
                    {[...realDragons]
                      .sort((a, b) => b.damageDealt - a.damageDealt)
                      .map((d) => (
                        <tr key={d.uid}>
                          <td className="py-1.5 font-sans flex items-center gap-1.5">
                            <ClassIcon dragonClass={d.def.dragonClass} size={11} />
                            <span
                              className={
                                d.team === 'PLAYER' ? 'text-emerald-300' : 'text-rose-300'
                              }
                            >
                              {d.def.name}
                            </span>
                          </td>
                          <td className="py-1.5 text-right">{Math.round(d.damageDealt)}</td>
                          <td className="py-1.5 text-right text-emerald-300">
                            {Math.round(d.healingDone)} ({d.healCount})
                          </td>
                          <td className="py-1.5 text-right text-amber-300">{d.kills}</td>
                          <td className="py-1.5 text-right text-slate-400">
                            {d.timeAlive.toFixed(1)}s
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#131822] border border-white/10">
              <h3 className="text-xs font-semibold text-slate-200 mb-2">
                Log Kỹ Năng & Hạ Gục
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-[11px]">
                {state.logs.map((log) => (
                  <div key={log.id} className="text-slate-300 border-b border-white/5 pb-1">
                    <span className="font-mono-stats text-slate-500 mr-1.5">
                      [{log.time.toFixed(1)}s]
                    </span>
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
