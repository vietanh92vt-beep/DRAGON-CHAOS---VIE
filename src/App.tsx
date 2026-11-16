import { useState } from 'react';
import { AIDifficulty, BattleSettings, ScreenType } from './types/game';
import { MainMenu } from './components/MainMenu';
import { TeamDraftScreen } from './components/TeamDraftScreen';
import { BattleScreen } from './components/BattleScreen';
import { CollectionScreen } from './components/CollectionScreen';
import { RulesScreen } from './components/RulesScreen';
import { BattleTestScreen } from './components/BattleTestScreen';
import { SettingsModal } from './components/SettingsModal';
import { soundFX } from './utils/sound';

interface MatchConfig {
  playerTeamIds: string[];
  playerVanguardIds: string[];
  aiTeamIds: string[];
  aiVanguardIds: string[];
  difficulty: AIDifficulty;
}

const DEFAULT_SETTINGS: BattleSettings = {
  expansionTimeSec: 45,
  expansionDeathCount: 3,
  matchDurationSec: 180,
  defaultDifficulty: 'NORMAL',
  soundEnabled: true,
  showFloatingText: true,
};

export default function App() {
  const [screen, setScreen] = useState<ScreenType>('MENU');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<BattleSettings>(DEFAULT_SETTINGS);
  const [matchConfig, setMatchConfig] = useState<MatchConfig | null>(null);

  const updateSettings = (next: Partial<BattleSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...next };
      soundFX.enabled = updated.soundEnabled;
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100">
      {screen === 'MENU' && (
        <MainMenu
          onNavigate={setScreen}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {screen === 'DRAFT' && (
        <TeamDraftScreen
          defaultDifficulty={settings.defaultDifficulty}
          onBack={() => setScreen('MENU')}
          onStartBattle={(cfg) => {
            setMatchConfig(cfg);
            setScreen('BATTLE');
          }}
        />
      )}

      {screen === 'BATTLE' && matchConfig && (
        <BattleScreen
          playerTeamIds={matchConfig.playerTeamIds}
          playerVanguardIds={matchConfig.playerVanguardIds}
          aiTeamIds={matchConfig.aiTeamIds}
          aiVanguardIds={matchConfig.aiVanguardIds}
          difficulty={matchConfig.difficulty}
          settings={settings}
          onExit={() => setScreen('MENU')}
          onUpdateSettings={updateSettings}
        />
      )}

      {screen === 'COLLECTION' && (
        <CollectionScreen onBack={() => setScreen('MENU')} />
      )}

      {screen === 'RULES' && (
        <RulesScreen onBack={() => setScreen('MENU')} />
      )}

      {screen === 'TEST_MODE' && (
        <BattleTestScreen
          settings={settings}
          onBack={() => setScreen('MENU')}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
