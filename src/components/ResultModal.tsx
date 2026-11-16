import React from 'react';
import { Award, HeartPulse, RotateCcw, Skull, Swords, Trophy } from 'lucide-react';
import { BattleState } from '../types/game';
import { DragonPortrait } from './DragonPortrait';
import { CLASS_META } from '../data/dragons';

interface Props {
  state: BattleState;
  onReplay: () => void;
  onMainMenu: () => void;
}

export const ResultModal: React.FC<Props> = ({ state, onReplay, onMainMenu }) => {
  const realDragons = state.dragons.filter((d) => !d.isClone);
  const playerAlive = realDragons.filter((d) => d.team === 'PLAYER' && d.isAlive).length;
  const aiAlive = realDragons.filter((d) => d.team === 'AI' && d.isAlive).length;

  const topDamage = [...realDragons].sort((a, b) => b.damageDealt - a.damageDealt)[0];
  const topHeal = [...realDragons].sort((a, b) => b.healingDone - a.healingDone)[0];
  const topKills = [...realDragons].sort((a, b) => b.kills - a.kills || b.damageDealt - a.damageDealt)[0];

  const isVictory = state.winner === 'PLAYER';
  const isDraw = state.winner === 'DRAW';

  const titleText = isVictory ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT';
  const titleSub = isVictory
    ? 'Chiến thắng thuộc về đội hình của bạn'
    : isDraw
    ? 'Trận đấu kết thúc với kết quả hòa'
    : 'Đội hình AI đã giành chiến thắng';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#131822] border border-white/15 rounded-2xl overflow-hidden shadow-2xl my-auto">
        {/* Top Banner */}
        <div
          className={`px-6 py-6 border-b border-white/10 text-center ${
            isVictory
              ? 'bg-emerald-950/40'
              : isDraw
              ? 'bg-amber-950/30'
              : 'bg-rose-950/40'
          }`}
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/40 border border-white/15 mb-3">
            <Trophy
              size={24}
              className={
                isVictory ? 'text-amber-400' : isDraw ? 'text-slate-300' : 'text-rose-400'
              }
            />
          </div>
          <h2
            className={`font-display text-3xl sm:text-4xl font-bold tracking-wide ${
              isVictory ? 'text-emerald-400' : isDraw ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            {titleText}
          </h2>
          <p className="text-sm text-slate-200 mt-1">{titleSub}</p>
          <p className="text-xs text-slate-400 mt-1">{state.winReason}</p>
        </div>

        {/* Highlights */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 border-b border-white/10">
          {/* Top Damage */}
          {topDamage && (
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-white/10 flex items-center gap-3">
              <DragonPortrait dragon={topDamage.def} className="w-12 h-12 rounded-lg shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[11px] text-rose-400 font-medium">
                  <Swords size={12} />
                  <span>Sát thương cao nhất</span>
                </div>
                <div className="font-semibold text-sm text-white truncate">{topDamage.def.name}</div>
                <div className="font-mono-stats text-xs text-slate-300">
                  {Math.round(topDamage.damageDealt).toLocaleString()} DMG
                </div>
              </div>
            </div>
          )}

          {/* Top Healing */}
          {topHeal && (
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-white/10 flex items-center gap-3">
              <DragonPortrait dragon={topHeal.def} className="w-12 h-12 rounded-lg shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <HeartPulse size={12} />
                  <span>Hồi máu nhiều nhất</span>
                </div>
                <div className="font-semibold text-sm text-white truncate">{topHeal.def.name}</div>
                <div className="font-mono-stats text-xs text-slate-300">
                  {Math.round(topHeal.healingDone).toLocaleString()} HP
                </div>
              </div>
            </div>
          )}

          {/* Most Kills */}
          {topKills && (
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-white/10 flex items-center gap-3">
              <DragonPortrait dragon={topKills.def} className="w-12 h-12 rounded-lg shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                  <Skull size={12} />
                  <span>Hạ gục nhiều nhất</span>
                </div>
                <div className="font-semibold text-sm text-white truncate">{topKills.def.name}</div>
                <div className="font-mono-stats text-xs text-slate-300">
                  {topKills.kills} mạng
                </div>
              </div>
            </div>
          )}

          {/* Surviving Count */}
          <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-white/10 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-[11px] text-sky-400 font-medium">
              <Award size={12} />
              <span>Rồng còn sống</span>
            </div>
            <div className="font-mono-stats text-xl font-bold text-white mt-1">
              {playerAlive} vs {aiAlive}
            </div>
            <div className="text-[11px] text-slate-400">
              Thời gian: {state.elapsed.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Full Stats Table */}
        <div className="p-5 max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Rồng</th>
                <th className="py-2 px-2 font-medium">Phe</th>
                <th className="py-2 px-2 font-medium">Tộc hệ</th>
                <th className="py-2 px-2 font-medium text-right">Sát thương</th>
                <th className="py-2 px-2 font-medium text-right">Hồi máu</th>
                <th className="py-2 px-2 font-medium text-right">Hạ gục</th>
                <th className="py-2 pl-2 font-medium text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono-stats">
              {[...realDragons]
                .sort((a, b) => b.damageDealt - a.damageDealt)
                .map((d) => (
                  <tr key={d.uid} className="hover:bg-white/[0.02]">
                    <td className="py-2 pr-3 font-sans font-medium text-slate-100">
                      {d.def.name}
                    </td>
                    <td
                      className={`py-2 px-2 font-sans ${
                        d.team === 'PLAYER' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {d.team === 'PLAYER' ? 'Bạn' : 'AI'}
                    </td>
                    <td className="py-2 px-2 font-sans text-slate-400">
                      {CLASS_META[d.def.dragonClass].label}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-200">
                      {Math.round(d.damageDealt).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-300">
                      {Math.round(d.healingDone).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right text-amber-300">{d.kills}</td>
                    <td className="py-2 pl-2 text-right font-sans">
                      {d.isAlive ? (
                        <span className="text-emerald-400">Còn sống</span>
                      ) : (
                        <span className="text-slate-500">Bị hạ</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 bg-[#0B0E14] border-t border-white/10 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={onMainMenu}
            className="px-5 py-2.5 text-sm font-medium bg-[#1C2333] hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Về Màn Hình Chính
          </button>
          <button
            onClick={onReplay}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw size={16} />
            Chơi Lại
          </button>
        </div>
      </div>
    </div>
  );
};
