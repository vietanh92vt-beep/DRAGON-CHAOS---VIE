export type DragonClass = 'GUARDIAN' | 'MAGE' | 'ASSASSIN' | 'SUPPORT' | 'WARRIOR';

export type TeamSide = 'PLAYER' | 'AI';

export type AIDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export type ScreenType =
  | 'MENU'
  | 'DRAFT'
  | 'BATTLE'
  | 'COLLECTION'
  | 'RULES'
  | 'TEST_MODE';

export interface DragonStats {
  hp: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  spd: number;       // pixels per second on 1200x600 logical arena
  aspd: number;      // attacks per second
  range: number;     // attack range in logical arena units
  maxEnergy: number; // energy required for ultimate
}

export interface AbilityDescriptor {
  name: string;
  description: string;
  cooldown?: number;
  energyCost?: number;
  targetType: 'ENEMY' | 'ALLY' | 'SELF' | 'AREA' | 'NONE';
}

export interface DragonDefinition {
  id: string;
  name: string;
  dragonClass: DragonClass;
  image: string;
  accentColor: string;
  secondaryColor: string;
  title: string;
  playstyle: string;
  stats: DragonStats;
  passive: AbilityDescriptor;
  basicAttack: AbilityDescriptor;
  skill1: AbilityDescriptor;
  skill2: AbilityDescriptor;
  ultimate: AbilityDescriptor;
}

export type AnimationType = 'idle' | 'move' | 'attack' | 'skill' | 'hit' | 'dead';

export interface DragonAnimState {
  type: AnimationType;
  timer: number;
  duration: number;
  facing: 1 | -1; // 1 = facing right, -1 = facing left
  lungeX: number;
  lungeY: number;
  hitFlash: number;
  killSpotlightTimer: number;
}

export interface StatusEffect {
  id: string;
  type:
    | 'SHIELD'
    | 'REFLECT'
    | 'STUN'
    | 'ROOT'
    | 'SLOW'
    | 'BURN'
    | 'POISON'
    | 'CC_IMMUNE'
    | 'ATK_BUFF'
    | 'MATK_BUFF'
    | 'DEF_BUFF'
    | 'MDEF_BUFF'
    | 'ASPD_BUFF'
    | 'DMG_REDUCE'
    | 'DEF_SHRED'
    | 'MARKED'
    | 'STEALTH'
    | 'HOT';
  sourceId: string;
  duration: number;
  maxDuration: number;
  value: number;
  stacks: number;
  tickTimer?: number;
}

export interface DragonInstance {
  uid: string;
  defId: string;
  def: DragonDefinition;
  team: TeamSide;
  isReserve: boolean;
  isDeployed: boolean;

  // Spatial
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;

  // Live Combat Stats
  hp: number;
  maxHp: number;
  shield: number;
  energy: number;
  maxEnergy: number;

  s1Cd: number;
  s2Cd: number;
  attackCd: number;
  aiThinkCd: number;

  isAlive: boolean;
  isClone?: boolean;
  cloneLifeTimer?: number;
  ownerUid?: string;

  // Unique mechanics & caps
  hasRevived: boolean;       // Cốt Long passive limit (1 per match)
  bachLongReviveUsed: boolean; // Bạch Long ult limit (1 per match)
  longKhi: number;           // Ngự Long stacks (0..10)
  passiveStacks: number;     // Kim Long, Băng Long, Lôi Long, Thủy Long, Ma Long, Địa Ngục Long, Thiên Thạch Long
  consecutiveTargetUid: string | null; // Diệt Thế Long
  consecutiveHits: number;
  tamDauStance: 'CONG' | 'THU' | 'HO_TRO'; // Tam Đầu Long cycling stance
  tamDauTimer: number;
  nguLongEmpoweredTimer: number;
  maVuongTimer: number;

  // Player Gem Enhancements (Ngọc Long Hồn)
  gemAtkLv: number;
  gemDefLv: number;
  gemSpdLv: number;
  gemHpLv: number;
  gemUltEmpowered: boolean;

  // Targeting
  targetUid: string | null;
  priorityTargetUid: string | null; // Player manual override
  priorityAllyUid: string | null;   // Player manual heal/buff override

  // Active status effects
  effects: StatusEffect[];

  // Independent Animation State (never affects math!)
  anim: DragonAnimState;

  // Telemetry / Match Stats
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  healCount: number;
  kills: number;
  skillsUsed: number;
  timeAlive: number;
  deathTime: number | null;
}

export interface Projectile {
  id: string;
  sourceUid: string;
  team: TeamSide;
  x: number;
  y: number;
  targetUid: string | null;
  targetX: number;
  targetY: number;
  speed: number;
  radius: number;
  damage: number;
  damageType: 'PHYSICAL' | 'MAGIC' | 'TRUE';
  color: string;
  piercing?: boolean;
  hitUids?: string[];
  onHitEffect?: {
    type: 'SLOW' | 'BURN' | 'POISON' | 'ROOT' | 'STUN' | 'MARKED' | 'DEF_SHRED' | 'KNOCKBACK';
    duration: number;
    value: number;
    aoeRadius?: number;
  };
  trail: Array<{ x: number; y: number }>;
}

export interface ArenaZone {
  id: string;
  sourceUid: string;
  team: TeamSide;
  kind: 'LAVA' | 'BLOOD' | 'SHADOW' | 'EDEN' | 'BONE_WALL' | 'POISON' | 'BLIZZARD' | 'DRAGON_AURA';
  x: number;
  y: number;
  radius: number;
  duration: number;
  maxDuration: number;
  tickTimer: number;
  value: number;
  color: string;
}

export interface VfxEffect {
  id: string;
  kind: 'SLASH' | 'RING' | 'LIGHTNING' | 'METEOR' | 'BEAM' | 'PARTICLE_BURST' | 'KILL_BURST';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius: number;
  color: string;
  duration: number;
  maxDuration: number;
  points?: Array<{ x: number; y: number }>;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  duration: number;
  maxDuration: number;
  vy: number;
}

export type GemType = 'ATK' | 'DEF' | 'SPD' | 'HP' | 'ULT';

export interface BattleLogEntry {
  id: string;
  time: number;
  type: 'KILL' | 'SKILL' | 'ULTIMATE' | 'PHASE' | 'REVIVE' | 'GEM' | 'SYSTEM';
  team?: TeamSide;
  dragonName?: string;
  message: string;
}

export interface BattleSettings {
  expansionTimeSec: number;   // default 45
  expansionDeathCount: number; // default 3
  matchDurationSec: number;   // default 180
  defaultDifficulty: AIDifficulty;
  soundEnabled: boolean;
  showFloatingText: boolean;
}

export interface BattleState {
  phase: 'PHASE_1_5V5' | 'DEPLOYING_10V10' | 'PHASE_2_10V10' | 'FINISHED';
  elapsed: number;
  maxDuration: number;
  expansionTime: number;
  expansionDeaths: number;
  hasExpanded: boolean;
  difficulty: AIDifficulty;
  mode: 'STANDARD' | 'TEST_5V5' | 'TEST_10V10';

  dragons: DragonInstance[];
  projectiles: Projectile[];
  zones: ArenaZone[];
  vfx: VfxEffect[];
  floatingTexts: FloatingText[];
  logs: BattleLogEntry[];

  winner: 'PLAYER' | 'AI' | 'DRAW' | null;
  winReason: string;

  // Player Gem resource & Ultimate portrait cut-in
  playerGems: number;
  gemIncomeTimer: number;
  ultCutIn: {
    dragonName: string;
    skillName: string;
    image: string;
    accentColor: string;
    team: TeamSide;
    timer: number;
  } | null;

  // Deployment queue for Player during 10v10 expansion
  pendingDeployUids: string[];
  killAnnouncement: {
    killerName: string;
    victimName: string;
    killerImage: string;
    killerTeam: TeamSide;
    timer: number;
  } | null;
}

export interface SimulationDragonSummary {
  defId: string;
  name: string;
  dragonClass: DragonClass;
  matches: number;
  wins: number;
  totalDamage: number;
  totalHealing: number;
  totalKills: number;
  totalTimeAlive: number;
}

export interface SimulationReport {
  totalMatches: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  avgMatchTime: number;
  dragonStats: SimulationDragonSummary[];
}
