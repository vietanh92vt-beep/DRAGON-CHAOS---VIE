import { DRAGON_BY_ID } from '../data/dragons';
import {
  AIDifficulty,
  BattleSettings,
  BattleState,
  DragonClass,
  DragonDefinition,
  DragonInstance,
  SimulationDragonSummary,
  SimulationReport,
  TeamSide,
} from '../types/game';
import {
  aiSelectVanguard,
  computeAiMovement,
  evaluateSkillUsage,
  getFormationPosition,
  selectCombatTarget,
} from './aiEngine';
import {
  ARENA_H,
  ARENA_W,
  addLog,
  applyDamage,
  applyStatusEffect,
  clamp,
  dist,
  getAllies,
  getEffectiveStats,
  getEnemies,
  healDragon,
  nextId,
  performBasicAttack,
  spawnFloatingText,
  spawnVfx,
} from './skillEngine';
import { soundFX } from '../utils/sound';

function createDragonInstance(
  def: DragonDefinition,
  team: TeamSide,
  isReserve: boolean,
  x: number,
  y: number
): DragonInstance {
  return {
    uid: nextId(team === 'PLAYER' ? 'p' : 'ai'),
    defId: def.id,
    def,
    team,
    isReserve,
    isDeployed: !isReserve,

    x,
    y,
    vx: 0,
    vy: 0,
    radius: 26,

    hp: def.stats.hp,
    maxHp: def.stats.hp,
    shield: 0,
    energy: 0,
    maxEnergy: def.stats.maxEnergy,

    s1Cd: 1.0 + Math.random() * 1.2,
    s2Cd: 2.0 + Math.random() * 1.5,
    attackCd: 0.3 + Math.random() * 0.4,
    aiThinkCd: 0.1,

    isAlive: true,
    hasRevived: false,
    bachLongReviveUsed: false,
    longKhi: 0,
    passiveStacks: 0,
    consecutiveTargetUid: null,
    consecutiveHits: 0,
    tamDauStance: 'CONG',
    tamDauTimer: 5,
    nguLongEmpoweredTimer: 0,
    maVuongTimer: 0,

    gemAtkLv: 0,
    gemDefLv: 0,
    gemSpdLv: 0,
    gemHpLv: 0,
    gemUltEmpowered: false,

    targetUid: null,
    priorityTargetUid: null,
    priorityAllyUid: null,

    effects: [],
    anim: {
      type: 'idle',
      timer: 0,
      duration: 0,
      facing: team === 'PLAYER' ? 1 : -1,
      lungeX: 0,
      lungeY: 0,
      hitFlash: 0,
      killSpotlightTimer: 0,
    },

    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    healCount: 0,
    kills: 0,
    skillsUsed: 0,
    timeAlive: 0,
    deathTime: null,
  };
}

function buildFormationForSide(
  defs: DragonDefinition[],
  vanguardIds: string[],
  team: TeamSide,
  startAllDeployed = false
): DragonInstance[] {
  const activeDefs = startAllDeployed
    ? defs
    : defs.filter((d) => vanguardIds.includes(d.id));
  const reserveDefs = startAllDeployed
    ? []
    : defs.filter((d) => !vanguardIds.includes(d.id));

  const roleGroups: Record<DragonClass, DragonDefinition[]> = {
    GUARDIAN: [],
    WARRIOR: [],
    ASSASSIN: [],
    MAGE: [],
    SUPPORT: [],
  };

  for (const d of activeDefs) {
    roleGroups[d.dragonClass].push(d);
  }

  const instances: DragonInstance[] = [];
  (Object.keys(roleGroups) as DragonClass[]).forEach((cls) => {
    const list = roleGroups[cls];
    list.forEach((d, idx) => {
      const pos = getFormationPosition(cls, idx, list.length, team, startAllDeployed && defs.length > 5);
      instances.push(createDragonInstance(d, team, false, pos.x, pos.y));
    });
  });

  reserveDefs.forEach((d) => {
    instances.push(
      createDragonInstance(
        d,
        team,
        true,
        team === 'PLAYER' ? 90 : ARENA_W - 90,
        ARENA_H / 2
      )
    );
  });

  return instances;
}

export function createBattleState(params: {
  playerTeamIds: string[];
  playerVanguardIds: string[];
  aiTeamIds: string[];
  aiVanguardIds?: string[];
  difficulty: AIDifficulty;
  settings: BattleSettings;
  mode?: 'STANDARD' | 'TEST_5V5' | 'TEST_10V10';
}): BattleState {
  const mode = params.mode || 'STANDARD';
  const startAllDeployed = mode !== 'STANDARD';

  const playerDefs = params.playerTeamIds.map((id) => DRAGON_BY_ID[id]).filter(Boolean);
  const aiDefs = params.aiTeamIds.map((id) => DRAGON_BY_ID[id]).filter(Boolean);
  const aiVanguard = params.aiVanguardIds || aiSelectVanguard(aiDefs);

  const playerDragons = buildFormationForSide(
    playerDefs,
    params.playerVanguardIds,
    'PLAYER',
    startAllDeployed
  );
  const aiDragons = buildFormationForSide(
    aiDefs,
    aiVanguard,
    'AI',
    startAllDeployed
  );

  const initialPhase: BattleState['phase'] =
    mode === 'TEST_10V10' ? 'PHASE_2_10V10' : 'PHASE_1_5V5';

  const state: BattleState = {
    phase: initialPhase,
    elapsed: 0,
    maxDuration: params.settings.matchDurationSec,
    expansionTime: params.settings.expansionTimeSec,
    expansionDeaths: params.settings.expansionDeathCount,
    hasExpanded: mode !== 'STANDARD',
    difficulty: params.difficulty,
    mode,

    dragons: [...playerDragons, ...aiDragons],
    projectiles: [],
    zones: [],
    vfx: [],
    floatingTexts: [],
    logs: [],

    winner: null,
    winReason: '',
    playerGems: 5,
    gemIncomeTimer: 12,
    ultCutIn: null,
    pendingDeployUids: [],
    killAnnouncement: null,
  };

  addLog(
    state,
    'SYSTEM',
    mode === 'TEST_10V10'
      ? 'Trận chiến 10v10 bắt đầu!'
      : mode === 'TEST_5V5'
      ? 'Trận chiến thử nghiệm 5v5 bắt đầu!'
      : 'Giai đoạn 1 (5v5) bắt đầu! 5 rồng dự bị sẽ xuất trận khi đạt điều kiện mở rộng.'
  );

  return state;
}

export function deployAiReserves(state: BattleState) {
  const reserves = state.dragons.filter(
    (d) => d.team === 'AI' && d.isReserve && !d.isDeployed
  );
  const roleGroups: Record<DragonClass, DragonInstance[]> = {
    GUARDIAN: [],
    WARRIOR: [],
    ASSASSIN: [],
    MAGE: [],
    SUPPORT: [],
  };
  reserves.forEach((d) => roleGroups[d.def.dragonClass].push(d));

  (Object.keys(roleGroups) as DragonClass[]).forEach((cls) => {
    const list = roleGroups[cls];
    list.forEach((d, idx) => {
      const pos = getFormationPosition(cls, idx, list.length, 'AI', true);
      d.x = clamp(pos.x + (Math.random() - 0.5) * 35, ARENA_W * 0.55, ARENA_W - 65);
      d.y = clamp(pos.y + (Math.random() - 0.5) * 28, 80, ARENA_H - 65);
      d.isReserve = false;
      d.isDeployed = true;
    });
  });
}

export function autoDeployPlayerReserves(state: BattleState) {
  const reserves = state.dragons.filter(
    (d) => d.team === 'PLAYER' && d.isReserve && !d.isDeployed
  );
  const roleGroups: Record<DragonClass, DragonInstance[]> = {
    GUARDIAN: [],
    WARRIOR: [],
    ASSASSIN: [],
    MAGE: [],
    SUPPORT: [],
  };
  reserves.forEach((d) => roleGroups[d.def.dragonClass].push(d));

  (Object.keys(roleGroups) as DragonClass[]).forEach((cls) => {
    const list = roleGroups[cls];
    list.forEach((d, idx) => {
      const pos = getFormationPosition(cls, idx, list.length, 'PLAYER', true);
      d.x = clamp(pos.x + (Math.random() - 0.5) * 35, 65, ARENA_W * 0.45);
      d.y = clamp(pos.y + (Math.random() - 0.5) * 28, 80, ARENA_H - 65);
      d.isReserve = false;
      d.isDeployed = true;
    });
  });

  state.pendingDeployUids = [];
  state.phase = 'PHASE_2_10V10';
  addLog(state, 'PHASE', 'Giai đoạn 2 (10v10): Toàn bộ rồng dự bị hai phe đã vào trận!');
}

export function placeSinglePlayerReserve(
  state: BattleState,
  uid: string,
  x: number,
  y: number
) {
  const dragon = state.dragons.find((d) => d.uid === uid && d.team === 'PLAYER');
  if (!dragon) return;
  dragon.x = clamp(x, 65, ARENA_W * 0.46);
  dragon.y = clamp(y, 80, ARENA_H - 65);
  dragon.isReserve = false;
  dragon.isDeployed = true;
  state.pendingDeployUids = state.pendingDeployUids.filter((id) => id !== uid);

  if (state.pendingDeployUids.length === 0) {
    state.phase = 'PHASE_2_10V10';
    addLog(state, 'PHASE', 'Giai đoạn 2 (10v10): Toàn bộ 20 rồng chính thức giao tranh!');
  }
}

function checkBattleExpansion(state: BattleState, headless: boolean) {
  if (state.hasExpanded || state.mode !== 'STANDARD') return;

  const playerDeaths = state.dragons.filter(
    (d) => d.team === 'PLAYER' && !d.isClone && d.isDeployed && !d.isAlive
  ).length;
  const aiDeaths = state.dragons.filter(
    (d) => d.team === 'AI' && !d.isClone && d.isDeployed && !d.isAlive
  ).length;

  const reachedTime = state.elapsed >= state.expansionTime;
  const reachedDeaths =
    playerDeaths >= state.expansionDeaths || aiDeaths >= state.expansionDeaths;

  if (!reachedTime && !reachedDeaths) return;

  state.hasExpanded = true;
  state.playerGems += 3;
  deployAiReserves(state);

  const playerReserves = state.dragons.filter(
    (d) => d.team === 'PLAYER' && d.isReserve && !d.isDeployed
  );

  if (headless || playerReserves.length === 0) {
    autoDeployPlayerReserves(state);
  } else {
    state.phase = 'DEPLOYING_10V10';
    state.pendingDeployUids = playerReserves.map((d) => d.uid);
    addLog(
      state,
      'PHASE',
      reachedDeaths
        ? `Điều kiện mở rộng đạt (${state.expansionDeaths} rồng ngã xuống)! +3 Ngọc · Triển khai 5 rồng dự bị.`
        : `Đã qua ${state.expansionTime}s! +3 Ngọc · Mở rộng chiến trường 10v10 — hãy chọn vị trí cho rồng dự bị.`
    );
  }
}

function checkVictoryCondition(state: BattleState, headless: boolean) {
  if (state.phase === 'FINISHED') return;

  const playerRemaining = state.dragons.filter(
    (d) => d.team === 'PLAYER' && !d.isClone && (d.isAlive || d.isReserve)
  );
  const aiRemaining = state.dragons.filter(
    (d) => d.team === 'AI' && !d.isClone && (d.isAlive || d.isReserve)
  );

  if (playerRemaining.length === 0 && aiRemaining.length === 0) {
    state.phase = 'FINISHED';
    state.winner = 'DRAW';
    state.winReason = 'Cả hai đội đều bị tiêu diệt cùng lúc.';
  } else if (aiRemaining.length === 0) {
    state.phase = 'FINISHED';
    state.winner = 'PLAYER';
    state.winReason = 'Đã tiêu diệt toàn bộ đội hình rồng đối thủ!';
    if (!headless) soundFX.playVictory(true);
  } else if (playerRemaining.length === 0) {
    state.phase = 'FINISHED';
    state.winner = 'AI';
    state.winReason = 'Toàn bộ rồng phe bạn đã bị hạ gục.';
    if (!headless) soundFX.playVictory(false);
  } else if (state.elapsed >= state.maxDuration) {
    const pHp = playerRemaining.reduce((sum, d) => sum + d.hp, 0);
    const aHp = aiRemaining.reduce((sum, d) => sum + d.hp, 0);
    state.phase = 'FINISHED';
    if (pHp > aHp) {
      state.winner = 'PLAYER';
      state.winReason = `Hết ${state.maxDuration}s — Tổng HP còn lại cao hơn (${Math.round(pHp)} vs ${Math.round(aHp)}).`;
      if (!headless) soundFX.playVictory(true);
    } else if (aHp > pHp) {
      state.winner = 'AI';
      state.winReason = `Hết ${state.maxDuration}s — Đối thủ có tổng HP còn lại cao hơn (${Math.round(aHp)} vs ${Math.round(pHp)}).`;
      if (!headless) soundFX.playVictory(false);
    } else {
      state.winner = 'DRAW';
      state.winReason = `Hết ${state.maxDuration}s — Tổng HP còn lại của hai đội bằng nhau (${Math.round(pHp)}).`;
    }
  }
}

export function stepBattle(
  state: BattleState,
  dt: number,
  options: { autoSkillPlayer: boolean; headless?: boolean }
) {
  if (state.phase === 'FINISHED' || state.phase === 'DEPLOYING_10V10') return;
  const headless = !!options.headless;
  const safeDt = Math.min(dt, 0.05);

  state.elapsed += safeDt;

  // Passive Gem income (+1 Ngọc every 12s)
  state.gemIncomeTimer -= safeDt;
  if (state.gemIncomeTimer <= 0) {
    state.gemIncomeTimer = 12;
    state.playerGems += 1;
    if (!headless) {
      addLog(state, 'GEM', 'Nhận +1 Ngọc Long Hồn theo thời gian.', 'PLAYER');
    }
  }

  if (state.ultCutIn) {
    state.ultCutIn.timer -= safeDt;
    if (state.ultCutIn.timer <= 0) {
      state.ultCutIn = null;
    }
  }

  if (state.killAnnouncement) {
    state.killAnnouncement.timer -= safeDt;
    if (state.killAnnouncement.timer <= 0) {
      state.killAnnouncement = null;
    }
  }

  // Update VFX & Floating Text
  if (!headless) {
    for (let i = state.vfx.length - 1; i >= 0; i--) {
      state.vfx[i].duration -= safeDt;
      if (state.vfx[i].duration <= 0) state.vfx.splice(i, 1);
    }
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.duration -= safeDt;
      ft.y += ft.vy * safeDt;
      if (ft.duration <= 0) state.floatingTexts.splice(i, 1);
    }
  }

  // Update Arena Zones
  for (let i = state.zones.length - 1; i >= 0; i--) {
    const z = state.zones[i];
    z.duration -= safeDt;
    z.tickTimer -= safeDt;
    if (z.tickTimer <= 0) {
      z.tickTimer = 0.5;
      const source = state.dragons.find((d) => d.uid === z.sourceUid) || null;
      if (z.kind === 'EDEN' || z.kind === 'BONE_WALL') {
        for (const a of getAllies(state, z.team)) {
          if (dist(z.x, z.y, a.x, a.y) <= z.radius) {
            if (z.kind === 'EDEN' && source) {
              healDragon(state, source, a, z.value, headless);
              applyStatusEffect(a, { type: 'ATK_BUFF', sourceId: z.sourceUid, duration: 1.0, value: 0.2, stacks: 1 });
              applyStatusEffect(a, { type: 'MATK_BUFF', sourceId: z.sourceUid, duration: 1.0, value: 0.2, stacks: 1 });
            } else if (z.kind === 'BONE_WALL') {
              applyStatusEffect(a, { type: 'DEF_BUFF', sourceId: z.sourceUid, duration: 1.0, value: z.value, stacks: 1 });
              applyStatusEffect(a, { type: 'MDEF_BUFF', sourceId: z.sourceUid, duration: 1.0, value: z.value, stacks: 1 });
            }
          }
        }
      } else {
        for (const e of getEnemies(state, z.team)) {
          if (dist(z.x, z.y, e.x, e.y) <= z.radius) {
            const dealt = applyDamage(state, source, e, z.value, 'MAGIC', headless);
            if (z.kind === 'BLOOD' && source && source.isAlive) {
              healDragon(state, source, source, Math.min(90, dealt * 0.45), headless);
            } else if (z.kind === 'SHADOW') {
              applyStatusEffect(e, { type: 'DEF_SHRED', sourceId: z.sourceUid, duration: 1.2, value: 24, stacks: 1 });
            } else if (z.kind === 'POISON') {
              applyStatusEffect(e, { type: 'SLOW', sourceId: z.sourceUid, duration: 1.0, value: 0.25, stacks: 1 });
            }
          }
        }
      }
    }
    if (z.duration <= 0) state.zones.splice(i, 1);
  }

  // Update Projectiles
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    if (!headless) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6) p.trail.shift();
    }

    if (p.targetUid) {
      const target = state.dragons.find((d) => d.uid === p.targetUid && d.isAlive);
      if (target) {
        p.targetX = target.x;
        p.targetY = target.y;
      }
    }

    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * safeDt;

    if (p.piercing) {
      const len = d || 1;
      p.x += (dx / len) * step;
      p.y += (dy / len) * step;
      const source = state.dragons.find((d) => d.uid === p.sourceUid) || null;
      for (const e of getEnemies(state, p.team)) {
        if (!p.hitUids?.includes(e.uid) && dist(p.x, p.y, e.x, e.y) <= e.radius + p.radius) {
          p.hitUids?.push(e.uid);
          applyDamage(state, source, e, p.damage, p.damageType, headless);
          if (p.onHitEffect) {
            applyStatusEffect(e, {
              type: p.onHitEffect.type as 'SLOW',
              sourceId: p.sourceUid,
              duration: p.onHitEffect.duration,
              value: p.onHitEffect.value,
              stacks: 1,
            });
          }
        }
      }
      if (d <= step || p.x < 0 || p.x > ARENA_W || p.y < 0 || p.y > ARENA_H) {
        state.projectiles.splice(i, 1);
      }
    } else if (d <= step + 14) {
      const source = state.dragons.find((d) => d.uid === p.sourceUid) || null;
      if (p.onHitEffect?.aoeRadius) {
        for (const e of getEnemies(state, p.team)) {
          if (dist(p.targetX, p.targetY, e.x, e.y) <= p.onHitEffect.aoeRadius) {
            applyDamage(state, source, e, p.damage, p.damageType, headless);
            if (p.onHitEffect.type === 'BURN') {
              applyStatusEffect(
                e,
                {
                  type: 'BURN',
                  sourceId: p.sourceUid,
                  duration: p.onHitEffect.duration,
                  value: p.onHitEffect.value,
                  stacks: 1,
                },
                3
              );
            }
          }
        }
        spawnVfx(
          state,
          { kind: 'RING', x: p.targetX, y: p.targetY, radius: p.onHitEffect.aoeRadius, color: p.color, duration: 0.35 },
          headless
        );
      } else {
        const target =
          (p.targetUid && state.dragons.find((d) => d.uid === p.targetUid && d.isAlive)) ||
          getEnemies(state, p.team).find((e) => dist(p.targetX, p.targetY, e.x, e.y) <= e.radius + 20);
        if (target) {
          applyDamage(state, source, target, p.damage, p.damageType, headless);
          if (p.onHitEffect?.type === 'POISON') {
            applyStatusEffect(
              target,
              {
                type: 'POISON',
                sourceId: p.sourceUid,
                duration: p.onHitEffect.duration,
                value: p.onHitEffect.value,
                stacks: 1,
              },
              5
            );
          }
        }
      }
      state.projectiles.splice(i, 1);
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }

  // Update Dragons
  const thinkInterval =
    state.difficulty === 'EASY' ? 0.65 : state.difficulty === 'NORMAL' ? 0.3 : 0.14;

  for (const dragon of state.dragons) {
    if (!dragon.isDeployed) continue;

    // Clones expire
    if (dragon.isClone && dragon.cloneLifeTimer !== undefined) {
      dragon.cloneLifeTimer -= safeDt;
      if (dragon.cloneLifeTimer <= 0) {
        dragon.isAlive = false;
        continue;
      }
    }

    if (!dragon.isAlive) {
      if (!headless && dragon.anim.timer > 0) {
        dragon.anim.timer = Math.max(0, dragon.anim.timer - safeDt);
      }
      continue;
    }

    dragon.timeAlive += safeDt;
    dragon.s1Cd = Math.max(0, dragon.s1Cd - safeDt);
    dragon.s2Cd = Math.max(0, dragon.s2Cd - safeDt);
    dragon.attackCd = Math.max(0, dragon.attackCd - safeDt);
    dragon.aiThinkCd = Math.max(0, dragon.aiThinkCd - safeDt);
    dragon.nguLongEmpoweredTimer = Math.max(0, dragon.nguLongEmpoweredTimer - safeDt);
    dragon.maVuongTimer = Math.max(0, dragon.maVuongTimer - safeDt);

    // Passive energy regen
    dragon.energy = Math.min(dragon.maxEnergy, dragon.energy + safeDt * 5.2);

    // Tam Đầu Long cycling passive
    if (dragon.defId === 'tam_dau_long') {
      dragon.tamDauTimer -= safeDt;
      if (dragon.tamDauTimer <= 0) {
        dragon.tamDauTimer = 5;
        dragon.tamDauStance =
          dragon.tamDauStance === 'CONG'
            ? 'THU'
            : dragon.tamDauStance === 'THU'
            ? 'HO_TRO'
            : 'CONG';
        spawnFloatingText(
          state,
          dragon.x,
          dragon.y,
          dragon.tamDauStance === 'CONG' ? 'Thế Công' : dragon.tamDauStance === 'THU' ? 'Thế Thủ' : 'Thế Hỗ Trợ',
          '#14B8A6',
          11,
          headless
        );
      }
    }

    // Hoa Long passive periodic heal to nearest ally
    if (dragon.defId === 'hoa_long_support') {
      dragon.tamDauTimer -= safeDt;
      if (dragon.tamDauTimer <= 0) {
        dragon.tamDauTimer = 2.5;
        const allies = getAllies(state, dragon.team).filter((a) => !a.isClone && a.hp < a.maxHp);
        allies.sort((a, b) => dist(dragon.x, dragon.y, a.x, a.y) - dist(dragon.x, dragon.y, b.x, b.y));
        if (allies[0]) {
          healDragon(state, dragon, allies[0], 85, headless);
        }
      }
    }

    // Update Status Effects & DoTs
    for (let i = dragon.effects.length - 1; i >= 0; i--) {
      const ef = dragon.effects[i];
      if (!ef) continue;
      ef.duration -= safeDt;
      if (ef.type === 'BURN' || ef.type === 'POISON') {
        ef.tickTimer = (ef.tickTimer ?? 1) - safeDt;
        if (ef.tickTimer <= 0) {
          ef.tickTimer = 1;
          const src = state.dragons.find((d) => d.uid === ef.sourceId) || null;
          applyDamage(state, src, dragon, ef.value * ef.stacks, 'MAGIC', headless, true);
          if (!dragon.isAlive || dragon.effects.length === 0) break;
        }
      }
      if (ef.duration <= 0 && dragon.effects[i] === ef) {
        dragon.effects.splice(i, 1);
      }
    }

    if (!dragon.isAlive) continue;

    // Reset shield if no active SHIELD effect
    if (!dragon.effects.some((e) => e.type === 'SHIELD')) {
      dragon.shield = 0;
    }

    // Animation timers (strictly visual)
    if (!headless) {
      dragon.anim.hitFlash = Math.max(0, dragon.anim.hitFlash - safeDt);
      dragon.anim.killSpotlightTimer = Math.max(0, dragon.anim.killSpotlightTimer - safeDt);
      dragon.anim.lungeX *= 0.82;
      dragon.anim.lungeY *= 0.82;
      if (dragon.anim.timer > 0) {
        dragon.anim.timer -= safeDt;
        if (dragon.anim.timer <= 0) {
          dragon.anim.type = 'idle';
        }
      }
    }

    // Check Stun
    if (dragon.effects.some((e) => e.type === 'STUN')) {
      continue;
    }

    // AI Decision cadence
    if (dragon.aiThinkCd <= 0) {
      dragon.aiThinkCd = dragon.team === 'PLAYER' ? 0.14 : thinkInterval;
      const target = selectCombatTarget(state, dragon, state.difficulty);
      dragon.targetUid = target ? target.uid : null;
      evaluateSkillUsage(state, dragon, options.autoSkillPlayer, headless);
    }

    const target =
      (dragon.targetUid &&
        state.dragons.find((d) => d.uid === dragon.targetUid && d.isAlive && d.isDeployed)) ||
      selectCombatTarget(state, dragon, state.difficulty);

    if (!target) continue;
    dragon.targetUid = target.uid;

    const effStats = getEffectiveStats(dragon, state.dragons);
    const dToTarget = dist(dragon.x, dragon.y, target.x, target.y);

    // Attack if in range
    if (dToTarget <= dragon.def.stats.range && dragon.attackCd <= 0) {
      dragon.attackCd = 1 / effStats.aspd;
      performBasicAttack(state, dragon, target, headless);
    }

    // Move if not rooted
    const isRooted = dragon.effects.some((e) => e.type === 'ROOT');
    if (!isRooted) {
      const { moveX, moveY } = computeAiMovement(state, dragon, target, state.difficulty);
      if (moveX !== 0 || moveY !== 0) {
        dragon.x = clamp(dragon.x + moveX * effStats.spd * safeDt, 50, ARENA_W - 50);
        dragon.y = clamp(dragon.y + moveY * effStats.spd * safeDt, 70, ARENA_H - 50);
        if (!headless && dragon.anim.type === 'idle') {
          dragon.anim.type = 'move';
        }
        dragon.anim.facing = moveX >= 0 ? 1 : -1;
      } else {
        dragon.anim.facing = target.x >= dragon.x ? 1 : -1;
      }
    }
  }

  // Soft unit separation so dragons never stack invisibly on exact same spot
  const active = state.dragons.filter((d) => d.isAlive && d.isDeployed);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minDist = 44;
      if (d > 0 && d < minDist) {
        const push = (minDist - d) * 0.28;
        const nx = dx / d;
        const ny = dy / d;
        a.x = clamp(a.x - nx * push, 50, ARENA_W - 50);
        a.y = clamp(a.y - ny * push, 70, ARENA_H - 50);
        b.x = clamp(b.x + nx * push, 50, ARENA_W - 50);
        b.y = clamp(b.y + ny * push, 70, ARENA_H - 50);
      }
    }
  }

  checkBattleExpansion(state, headless);
  checkVictoryCondition(state, headless);
}

/**
 * Headless batch simulation for Battle Test Mode ("SIMULATE 100 MATCHES").
 */
export function runSimulationBatch(params: {
  teamAIds: string[];
  teamBIds: string[];
  mode: '5V5' | '10V10';
  difficulty: AIDifficulty;
  settings: BattleSettings;
  count: number;
}): SimulationReport {
  const { teamAIds, teamBIds, mode, difficulty, settings, count } = params;
  let teamAWins = 0;
  let teamBWins = 0;
  let draws = 0;
  let totalTime = 0;

  const summaryMap: Record<string, SimulationDragonSummary> = {};

  const teamADefs = teamAIds.map((id) => DRAGON_BY_ID[id]).filter(Boolean);
  const teamBDefs = teamBIds.map((id) => DRAGON_BY_ID[id]).filter(Boolean);
  const vangA = aiSelectVanguard(teamADefs);
  const vangB = aiSelectVanguard(teamBDefs);

  for (let i = 0; i < count; i++) {
    const state = createBattleState({
      playerTeamIds: teamAIds,
      playerVanguardIds: vangA,
      aiTeamIds: teamBIds,
      aiVanguardIds: vangB,
      difficulty,
      settings,
      mode: mode === '5V5' ? 'TEST_5V5' : 'TEST_10V10',
    });

    const dt = 0.05;
    let safetySteps = 0;
    while (state.phase !== 'FINISHED' && safetySteps < 6000) {
      stepBattle(state, dt, { autoSkillPlayer: true, headless: true });
      safetySteps += 1;
    }

    if (state.winner === 'PLAYER') teamAWins += 1;
    else if (state.winner === 'AI') teamBWins += 1;
    else draws += 1;

    totalTime += state.elapsed;

    for (const d of state.dragons) {
      if (d.isClone) continue;
      if (!summaryMap[d.defId]) {
        summaryMap[d.defId] = {
          defId: d.defId,
          name: d.def.name,
          dragonClass: d.def.dragonClass,
          matches: 0,
          wins: 0,
          totalDamage: 0,
          totalHealing: 0,
          totalKills: 0,
          totalTimeAlive: 0,
        };
      }
      const s = summaryMap[d.defId];
      s.matches += 1;
      if (
        (d.team === 'PLAYER' && state.winner === 'PLAYER') ||
        (d.team === 'AI' && state.winner === 'AI')
      ) {
        s.wins += 1;
      }
      s.totalDamage += d.damageDealt;
      s.totalHealing += d.healingDone;
      s.totalKills += d.kills;
      s.totalTimeAlive += d.timeAlive;
    }
  }

  const dragonStats = Object.values(summaryMap).sort(
    (a, b) => b.totalDamage / Math.max(1, b.matches) - a.totalDamage / Math.max(1, a.matches)
  );

  return {
    totalMatches: count,
    teamAWins,
    teamBWins,
    draws,
    avgMatchTime: totalTime / Math.max(1, count),
    dragonStats,
  };
}
