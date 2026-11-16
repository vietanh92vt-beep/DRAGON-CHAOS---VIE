import React from 'react';
import { X } from 'lucide-react';
import { AIDifficulty, BattleSettings } from '../types/game';
import { soundFX } from '../utils/sound';

interface Props {
  settings: BattleSettings;
  onUpdate: (next: Partial<BattleSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ settings, onUpdate, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#131822] border border-white/15 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white">Cài Đặt Trận Đấu</h2>
          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm">
          {/* Expansion Time */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="font-medium text-slate-200">Thời gian mở rộng 10v10</span>
              <span className="font-mono-stats text-amber-400 font-semibold">
                {settings.expansionTimeSec} giây
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[20, 30, 45, 60, 90].map((sec) => (
                <button
                  key={sec}
                  onClick={() => onUpdate({ expansionTimeSec: sec })}
                  className={`py-2 rounded-lg font-mono-stats text-xs font-semibold border cursor-pointer ${
                    settings.expansionTimeSec === sec
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/30'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Expansion Deaths */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="font-medium text-slate-200">Số rồng mất để mở rộng sớm</span>
              <span className="font-mono-stats text-amber-400 font-semibold">
                {settings.expansionDeathCount} rồng
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => onUpdate({ expansionDeathCount: cnt })}
                  className={`py-2 rounded-lg font-mono-stats text-xs font-semibold border cursor-pointer ${
                    settings.expansionDeathCount === cnt
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/30'
                  }`}
                >
                  {cnt} rồng
                </button>
              ))}
            </div>
          </div>

          {/* Match Duration */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="font-medium text-slate-200">Thời lượng tối đa trận đấu</span>
              <span className="font-mono-stats text-amber-400 font-semibold">
                {settings.matchDurationSec}s
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[120, 180, 240].map((sec) => (
                <button
                  key={sec}
                  onClick={() => onUpdate({ matchDurationSec: sec })}
                  className={`py-2 rounded-lg font-mono-stats text-xs font-semibold border cursor-pointer ${
                    settings.matchDurationSec === sec
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/30'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Default AI Difficulty */}
          <div>
            <div className="font-medium text-slate-200 mb-2">Độ khó AI mặc định</div>
            <div className="grid grid-cols-3 gap-2">
              {(['EASY', 'NORMAL', 'HARD'] as AIDifficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => onUpdate({ defaultDifficulty: diff })}
                  className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                    settings.defaultDifficulty === diff
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/30'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t border-white/10 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-200">Hiệu ứng âm thanh (Web Audio)</span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => {
                  soundFX.enabled = e.target.checked;
                  onUpdate({ soundEnabled: e.target.checked });
                }}
                className="w-4 h-4 accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-200">Hiển thị số sát thương & hồi máu nổi</span>
              <input
                type="checkbox"
                checked={settings.showFloatingText}
                onChange={(e) => onUpdate({ showFloatingText: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
            </label>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#0B0E14] border-t border-white/10 flex justify-end">
          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="px-5 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg cursor-pointer"
          >
            Lưu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
