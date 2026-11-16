import {
  AIDifficulty,
  BattleState,
  DragonDefinition,
  DragonInstance,
  TeamSide,
} from '../types/game';
import {
  ARENA_H,
  ARENA_W,
  castSkill,
  clamp,
  dist,
  findDensestEnemyCluster,
  findLowestHpAlly,
  findNearestEnemy,
  getAllies,
  getEnemies,
} from './skillEngine';

/**
 * Selects the best 5 vanguard dragons out of AI's 10-dragon pool.
 * Guarantees role synergy: frontline + backline + assassin/support.
 */
export function aiSelectVanguard(pool: DragonDefinition[]): string[] {
  const picked: string[] = [];
  const tryPickByClass = (cls: DragonDefinition['dragonClass'], maxCount: number) => {
    const candidates = pool.filter((d) => d.dragonClass === cls && !picked.includes(d.id));
    for (let i = 0; i < Math.min(maxCount, candidates.length) && picked.length < 5; i++) {
      picked.push(candidates[i].id);
    }
  };

  tryPickByClass('GUARDIAN', 1);
  tryPickByClass('WARRIOR', 1);
  tryPickByClass('MAGE', 1);
  tryPickByClass('SUPPORT', 1);
  tryPickByClass('ASSASSIN', 1);

  // Fill remaining slots if a class was missing from the 10-pool
  for (const d of pool) {
    if (picked.length >= 5) break;
    if (!picked.includes(d.id)) {
      picked.push(d.id);
    }
  }
  return picked;
}

/**
 * Computes tactical formation coordinates for a list of dragons on a given side.
 */
export function getFormationPosition(
  dragonClass: DragonDefinition['dragonClass'],
  indexInRole: number,
  totalInRole: number,
  team: TeamSide,
  isPhase2 = false
): { x: number; y: number } {
  const isLeft = team === 'PLAYER';
  const baseFrontX = isLeft ? (isPhase2 ? 390 : 410) : isPhase2 ? ARENA_W - 390 : ARENA_W - 410;
  const baseMidX = isLeft ? (isPhase2 ? 290 : 320) : isPhase2 ? ARENA_W - 290 : ARENA_W - 320;
  const baseBackX = isLeft ? (isPhase2 ? 145 : 175) : isPhase2 ? ARENA_W - 145 : ARENA_W - 175;
  const baseFlankX = isLeft ? 340 : ARENA_W - 340;

  let x = baseMidX;
  if (dragonClass === 'GUARDIAN') x = baseFrontX;
  else if (dragonClass === 'WARRIOR') x = baseMidX;
  else if (dragonClass === 'ASSASSIN') x = baseFlankX;
  else if (dragonClass === 'MAGE') x = baseBackX;
  else if (dragonClass === 'SUPPORT') x = isLeft ? baseBackX - 45 : baseBackX + 45;

  const spread = ARENA_H - 180;
  const slotStep = spread / Math.max(1, totalInRole);
  const y = clamp(
    115 + slotStep * (indexInRole + 0.5) + (dragonClass === 'ASSASSIN' ? (indexInRole % 2 === 0 ? -40 : 40) : 0),
    85,
    ARENA_H - 75
  );

  return { x, y };
}

/**
 * Selects optimal combat target for a dragon based on its class and AI difficulty.
 */
export function selectCombatTarget(
  state: BattleState,
  dragon: DragonInstance,
  difficulty: AIDifficulty
): DragonInstance | null {
  const enemies = getEnemies(state, dragon.team);
  if (enemies.length === 0) return null;

  // Player manual priority override
  if (dragon.team === 'PLAYER' && dragon.priorityTargetUid) {
    const manual = enemies.find((e) => e.uid === dragon.priorityTargetUid);
    if (manual) return manual;
  }

  // EASY AI just attacks nearest enemy with simple logic
  if (dragon.team === 'AI' && difficulty === 'EASY') {
    return findNearestEnemy(state, dragon);
  }

  const cls = dragon.def.dragonClass;

  if (cls === 'ASSASSIN') {
    // Assassins hunt lowest HP% target (prioritize Mage/Support on HARD)
    const scored = enemies.map((e) => {
      const hpPct = e.hp / e.maxHp;
      const squishyBonus =
        difficulty === 'HARD' && (e.def.dragonClass === 'MAGE' || e.def.dragonClass === 'SUPPORT')
          ? -0.22
          : 0;
      const distPenalty = dist(dragon.x, dragon.y, e.x, e.y) / 2000;
      return { e, score: hpPct + squishyBonus + distPenalty };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored[0].e;
  }

  if (cls === 'GUARDIAN') {
    // Guardians intercept enemies attacking allied Mages or Supports
    const allies = getAllies(state, dragon.team).filter(
      (a) => a.def.dragonClass === 'MAGE' || a.def.dragonClass === 'SUPPORT'
    );
    let threat: DragonInstance | null = null;
    let minThreatDist = 230;
    for (const ally of allies) {
      for (const e of enemies) {
        const d = dist(ally.x, ally.y, e.x, e.y);
        if (d < minThreatDist) {
          minThreatDist = d;
          threat = e;
        }
      }
    }
    if (threat) return threat;
    return findNearestEnemy(state, dragon);
  }

  if (cls === 'MAGE') {
    // Mages target densest cluster or nearest enemy in range
    const cluster = findDensestEnemyCluster(state, dragon, 155);
    if (cluster.target && cluster.count >= 2) return cluster.target;
    return findNearestEnemy(state, dragon);
  }

  if (cls === 'WARRIOR') {
    // Warriors focus wounded frontline or dive backline if close
    const scored = enemies.map((e) => {
      const d = dist(dragon.x, dragon.y, e.x, e.y);
      const hpPct = e.hp / e.maxHp;
      return { e, score: d * 0.002 + hpPct * 0.8 };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored[0].e;
  }

  // SUPPORT attacks nearest enemy safely
  return findNearestEnemy(state, dragon);
}

/**
 * Computes desired movement vector (kite for Mages/Supports, engage for melee).
 */
export function computeAiMovement(
  state: BattleState,
  dragon: DragonInstance,
  target: DragonInstance | null,
  difficulty: AIDifficulty
): { moveX: number; moveY: number } {
  if (!target) return { moveX: 0, moveY: 0 };

  const d = dist(dragon.x, dragon.y, target.x, target.y);
  const range = dragon.def.stats.range;
  const cls = dragon.def.dragonClass;

  // Ranged kiting behavior (NORMAL / HARD or PLAYER team)
  if ((cls === 'MAGE' || cls === 'SUPPORT') && (dragon.team === 'PLAYER' || difficulty !== 'EASY')) {
    const nearest = findNearestEnemy(state, dragon);
    if (nearest && dist(dragon.x, dragon.y, nearest.x, nearest.y) < 125) {
      // Back away toward own arena edge
      const awayX = dragon.x - nearest.x;
      const awayY = dragon.y - nearest.y;
      const len = Math.hypot(awayX, awayY) || 1;
      return { moveX: awayX / len, moveY: awayY / len };
    }
  }

  if (d > range * 0.88) {
    const dx = target.x - dragon.x;
    const dy = target.y - dragon.y;
    const len = Math.hypot(dx, dy) || 1;
    return { moveX: dx / len, moveY: dy / len };
  }

  return { moveX: 0, moveY: 0 };
}

/**
 * Decides when AI (or Player with Auto-Skill ON) triggers S1, S2, or Ultimate.
 */
export function evaluateSkillUsage(
  state: BattleState,
  dragon: DragonInstance,
  autoSkillPlayer: boolean,
  headless = false
) {
  if (!dragon.isAlive || !dragon.isDeployed || dragon.isClone) return;
  if (dragon.team === 'PLAYER' && !autoSkillPlayer) return;

  const difficulty: AIDifficulty = dragon.team === 'PLAYER' ? 'HARD' : state.difficulty;
  const enemies = getEnemies(state, dragon.team);
  if (enemies.length === 0) return;

  const nearest = findNearestEnemy(state, dragon);
  const cluster = findDensestEnemyCluster(state, dragon, 175);
  const lowestAlly = findLowestHpAlly(state, dragon);
  const hpPct = dragon.hp / dragon.maxHp;

  // EASY AI uses skills with random hesitation and doesn't optimize clusters
  if (dragon.team === 'AI' && difficulty === 'EASY') {
    if (dragon.energy >= dragon.maxEnergy && Math.random() < 0.45) {
      castSkill(state, dragon, 'ULT', headless);
      return;
    }
    if (dragon.s1Cd <= 0 && Math.random() < 0.5) {
      castSkill(state, dragon, 'S1', headless);
      return;
    }
    if (dragon.s2Cd <= 0 && Math.random() < 0.4) {
      castSkill(state, dragon, 'S2', headless);
    }
    return;
  }

  // Smart Role-Aware Ultimate & Skill Logic (NORMAL & HARD)
  if (dragon.energy >= dragon.maxEnergy) {
    let shouldUlt = true;

    if (dragon.defId === 'bach_long') {
      const deadAlly = state.dragons.some(
        (d) => !d.isAlive && !d.isClone && d.isDeployed && d.team === dragon.team
      );
      const hurtAllies = getAllies(state, dragon.team).filter((a) => a.hp < a.maxHp * 0.65).length;
      if (difficulty === 'HARD') {
        shouldUlt = (deadAlly && !dragon.bachLongReviveUsed) || hurtAllies >= 2;
      } else {
        shouldUlt = deadAlly || hurtAllies >= 1;
      }
    } else if (dragon.defId === 'ngu_long') {
      // Wait for at least 3 Long Khí stacks unless low HP
      shouldUlt = dragon.longKhi >= (difficulty === 'HARD' ? 4 : 2) || hpPct < 0.4;
    } else if (dragon.def.dragonClass === 'MAGE' && difficulty === 'HARD') {
      shouldUlt = cluster.count >= 2 || enemies.length <= 2;
    } else if (dragon.defId === 'kim_long' || dragon.defId === 'thanh_long') {
      shouldUlt = hpPct < 0.72 || getAllies(state, dragon.team).some((a) => a.hp < a.maxHp * 0.5);
    }

    if (shouldUlt && castSkill(state, dragon, 'ULT', headless)) {
      return;
    }
  }

  // Skill 1 & Skill 2 conditions
  const inSkillRange = nearest && dist(dragon.x, dragon.y, nearest.x, nearest.y) <= Math.max(dragon.def.stats.range + 60, 220);

  if (dragon.def.dragonClass === 'SUPPORT') {
    if (dragon.defId === 'bach_long') {
      if (dragon.s1Cd <= 0 && lowestAlly && lowestAlly.hp < lowestAlly.maxHp * 0.88) {
        castSkill(state, dragon, 'S1', headless);
        return;
      }
      if (dragon.s2Cd <= 0 && lowestAlly && (lowestAlly.effects.length > 0 || lowestAlly.hp < lowestAlly.maxHp * 0.7)) {
        castSkill(state, dragon, 'S2', headless);
        return;
      }
    } else if (dragon.defId === 'hoa_long_support') {
      if (dragon.s2Cd <= 0) {
        castSkill(state, dragon, 'S2', headless);
        return;
      }
      if (dragon.s1Cd <= 0 && inSkillRange) {
        castSkill(state, dragon, 'S1', headless);
        return;
      }
    } else if (inSkillRange) {
      if (dragon.s2Cd <= 0) {
        castSkill(state, dragon, 'S2', headless);
        return;
      }
      if (dragon.s1Cd <= 0) {
        castSkill(state, dragon, 'S1', headless);
        return;
      }
    }
    return;
  }

  if (dragon.defId === 'ngu_long') {
    if (dragon.s2Cd <= 0 && nearest && dist(dragon.x, dragon.y, nearest.x, nearest.y) <= 280) {
      castSkill(state, dragon, 'S2', headless);
      return;
    }
    if (dragon.s1Cd <= 0 && (dragon.longKhi >= 2 || hpPct < 0.7)) {
      castSkill(state, dragon, 'S1', headless);
      return;
    }
    return;
  }

  // Gap closers for Assassins / Warriors
  if (dragon.def.dragonClass === 'ASSASSIN') {
    if (dragon.s1Cd <= 0) {
      castSkill(state, dragon, 'S1', headless);
      return;
    }
    if (dragon.s2Cd <= 0) {
      castSkill(state, dragon, 'S2', headless);
      return;
    }
    return;
  }

  if (inSkillRange || dragon.def.dragonClass === 'GUARDIAN') {
    if (dragon.s1Cd <= 0) {
      castSkill(state, dragon, 'S1', headless);
      return;
    }
    if (dragon.s2Cd <= 0 && inSkillRange) {
      castSkill(state, dragon, 'S2', headless);
    }
  }
}
