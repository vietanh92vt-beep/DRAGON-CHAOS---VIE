import {
  ArenaZone,
  BattleLogEntry,
  BattleState,
  DragonInstance,
  FloatingText,
  GemType,
  Projectile,
  StatusEffect,
  TeamSide,
  VfxEffect,
} from '../types/game';
import { soundFX } from '../utils/sound';

export const ARENA_W = 1200;
export const ARENA_H = 560;

let uidCounter = 1;
export function nextId(prefix = 'id'): string {
  uidCounter += 1;
  return `${prefix}_${uidCounter}`;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function addLog(
  state: BattleState,
  type: BattleLogEntry['type'],
  message: string,
  team?: TeamSide,
  dragonName?: string
) {
  state.logs.unshift({
    id: nextId('log'),
    time: state.elapsed,
    type,
    team,
    dragonName,
    message,
  });
  if (state.logs.length > 140) {
    state.logs.length = 140;
  }
}

export function spawnFloatingText(
  state: BattleState,
  x: number,
  y: number,
  text: string,
  color: string,
  size = 14,
  headless = false
) {
  if (headless) return;
  if (state.floatingTexts.length > 90) {
    state.floatingTexts.shift();
  }
  state.floatingTexts.push({
    id: nextId('ft'),
    x: x + (Math.random() - 0.5) * 18,
    y: y - 24,
    text,
    color,
    size,
    duration: 0.85,
    maxDuration: 0.85,
    vy: -36,
  });
}

export function spawnVfx(
  state: BattleState,
  vfx: Omit<VfxEffect, 'id' | 'maxDuration'>,
  headless = false
) {
  if (headless) return;
  if (state.vfx.length > 120) {
    state.vfx.shift();
  }
  state.vfx.push({
    ...vfx,
    id: nextId('vfx'),
    maxDuration: vfx.duration,
  });
}

export function hasEffect(dragon: DragonInstance, type: StatusEffect['type']): boolean {
  return dragon.effects.some((e) => e.type === type);
}

export function getEffectiveStats(dragon: DragonInstance, allDragons: DragonInstance[]) {
  const base = dragon.def.stats;
  let atk = base.atk;
  let matk = base.matk;
  let def = base.def;
  let mdef = base.mdef;
  let spd = base.spd;
  let aspd = base.aspd;
  let dmgReduce = 0;

  // Passive stat modifiers
  if (dragon.defId === 'kim_long') {
    def += dragon.passiveStacks * 8;
  } else if (dragon.defId === 'ngu_long') {
    atk *= 1 + dragon.longKhi * 0.03;
    if (dragon.nguLongEmpoweredTimer > 0) {
      atk *= 1.25;
      aspd *= 1.3;
    }
  } else if (dragon.defId === 'ma_long') {
    atk += dragon.passiveStacks * 18;
    matk += dragon.passiveStacks * 18;
    if (dragon.maVuongTimer > 0) {
      atk *= 1.45;
      aspd *= 1.45;
      spd *= 1.3;
    }
  } else if (dragon.defId === 'thuy_long') {
    matk *= 1 + dragon.passiveStacks * 0.05;
  } else if (dragon.defId === 'bang_long') {
    matk *= 1 + dragon.passiveStacks * 0.06;
  } else if (dragon.defId === 'tam_dau_long') {
    if (dragon.tamDauStance === 'CONG') {
      atk *= 1.25;
      matk *= 1.25;
    } else if (dragon.tamDauStance === 'THU') {
      def += 30;
      mdef += 30;
    }
  }

  // Thánh Long passive aura: allies within 220 gain +22 MDEF
  for (const ally of allDragons) {
    if (
      ally.isAlive &&
      ally.isDeployed &&
      ally.team === dragon.team &&
      ally.defId === 'thanh_long' &&
      ally.uid !== dragon.uid &&
      dist(dragon.x, dragon.y, ally.x, ally.y) <= 220
    ) {
      mdef += 22;
      break; // non-stacking aura
    }
  }

  // Active status effects
  let slowPct = 0;
  for (const ef of dragon.effects) {
    switch (ef.type) {
      case 'ATK_BUFF':
        atk *= 1 + ef.value;
        break;
      case 'MATK_BUFF':
        matk *= 1 + ef.value;
        break;
      case 'DEF_BUFF':
        def += ef.value;
        break;
      case 'MDEF_BUFF':
        mdef += ef.value;
        break;
      case 'ASPD_BUFF':
        aspd *= 1 + ef.value;
        break;
      case 'DEF_SHRED':
        def -= ef.value;
        break;
      case 'DMG_REDUCE':
        dmgReduce = Math.max(dmgReduce, ef.value);
        break;
      case 'SLOW':
        slowPct = Math.max(slowPct, ef.value);
        break;
      case 'STEALTH':
        spd *= 1.45;
        break;
    }
  }

  // Player Gem Enhancements (Ngọc Long Hồn)
  if (dragon.gemAtkLv > 0) {
    atk *= 1 + dragon.gemAtkLv * 0.18;
    matk *= 1 + dragon.gemAtkLv * 0.18;
  }
  if (dragon.gemDefLv > 0) {
    def *= 1 + dragon.gemDefLv * 0.22;
    mdef *= 1 + dragon.gemDefLv * 0.22;
  }
  if (dragon.gemSpdLv > 0) {
    aspd *= 1 + dragon.gemSpdLv * 0.2;
    spd *= 1 + dragon.gemSpdLv * 0.15;
  }

  spd *= Math.max(0.35, 1 - slowPct);
  def = Math.max(5, def);
  mdef = Math.max(5, mdef);

  return { atk, matk, def, mdef, spd, aspd, dmgReduce };
}

export function applyStatusEffect(
  dragon: DragonInstance,
  newEffect: Omit<StatusEffect, 'id' | 'maxDuration'>,
  maxStacks = 1
) {
  if (!dragon.isAlive) return;

  // CC Immunity check
  if (
    (newEffect.type === 'STUN' || newEffect.type === 'ROOT' || newEffect.type === 'SLOW') &&
    hasEffect(dragon, 'CC_IMMUNE')
  ) {
    return;
  }

  const existing = dragon.effects.find(
    (e) => e.type === newEffect.type && (maxStacks > 1 || e.sourceId === newEffect.sourceId)
  );

  // Cap stun/root duration
  const cappedDuration =
    newEffect.type === 'STUN' || newEffect.type === 'ROOT'
      ? Math.min(newEffect.duration, 2.2)
      : newEffect.duration;

  if (existing) {
    existing.duration = Math.max(existing.duration, cappedDuration);
    existing.maxDuration = Math.max(existing.maxDuration, cappedDuration);
    if (maxStacks > 1) {
      existing.stacks = Math.min(maxStacks, existing.stacks + 1);
      existing.value = Math.max(existing.value, newEffect.value);
    } else {
      existing.value = Math.max(existing.value, newEffect.value);
    }
  } else {
    dragon.effects.push({
      ...newEffect,
      id: nextId('ef'),
      duration: cappedDuration,
      maxDuration: cappedDuration,
      stacks: Math.min(maxStacks, newEffect.stacks || 1),
    });
  }
}

export function grantShield(
  state: BattleState,
  target: DragonInstance,
  amount: number,
  duration: number,
  sourceId: string,
  headless = false
) {
  if (!target.isAlive) return;
  const finalAmount = Math.round(amount);
  target.shield = Math.min(target.maxHp * 0.75, target.shield + finalAmount);
  applyStatusEffect(target, {
    type: 'SHIELD',
    sourceId,
    duration,
    value: finalAmount,
    stacks: 1,
  });
  spawnFloatingText(state, target.x, target.y, `+${finalAmount} Khiên`, '#FDE047', 12, headless);
}

export function healDragon(
  state: BattleState,
  healer: DragonInstance,
  target: DragonInstance,
  rawAmount: number,
  headless = false
): number {
  if (!target.isAlive) return 0;
  let amount = rawAmount;

  // Bạch Long passive: +35% heal if target < 50% HP
  if (healer.defId === 'bach_long' && target.hp < target.maxHp * 0.5) {
    amount *= 1.35;
  }
  // Tam Đầu Long Hỗ Trợ stance: +25% heal
  if (healer.defId === 'tam_dau_long' && healer.tamDauStance === 'HO_TRO') {
    amount *= 1.25;
  }

  const missing = target.maxHp - target.hp;
  const actual = Math.max(0, Math.min(missing, Math.round(amount)));
  if (actual > 0) {
    target.hp += actual;
    healer.healingDone += actual;
    healer.healCount += 1;
    spawnFloatingText(state, target.x, target.y, `+${actual}`, '#34D399', 14, headless);
  }
  return actual;
}

export function applyDamage(
  state: BattleState,
  attacker: DragonInstance | null,
  target: DragonInstance,
  rawDamage: number,
  damageType: 'PHYSICAL' | 'MAGIC' | 'TRUE',
  headless = false,
  isReflect = false
): number {
  if (!target.isAlive || !target.isDeployed) return 0;

  const targetStats = getEffectiveStats(target, state.dragons);
  let damage = rawDamage;

  if (attacker) {
    // Âm Long passive: +30% damage when attacking from behind or flank
    if (attacker.defId === 'am_long') {
      const attackerBehind =
        (target.anim.facing === 1 && attacker.x < target.x) ||
        (target.anim.facing === -1 && attacker.x > target.x);
      if (attackerBehind) {
        damage *= 1.3;
      }
    }
    // Hắc Long passive: +25% damage vs debuffed enemies
    if (attacker.defId === 'hac_long') {
      const hasDebuff = target.effects.some((e) =>
        ['SLOW', 'STUN', 'ROOT', 'BURN', 'POISON', 'DEF_SHRED', 'MARKED'].includes(e.type)
      );
      if (hasDebuff) damage *= 1.25;
    }
    // Quỷ Long passive: up to +40% damage vs <45% HP + Marked +20%
    if (attacker.defId === 'quy_long') {
      if (target.hp < target.maxHp * 0.45) {
        damage *= 1.4;
      }
      if (hasEffect(target, 'MARKED')) {
        damage *= 1.2;
      }
    }
    // Diệt Thế Long passive: consecutive hits +10% each up to +50%
    if (attacker.defId === 'diet_the_long') {
      if (attacker.consecutiveTargetUid === target.uid) {
        attacker.consecutiveHits = Math.min(5, attacker.consecutiveHits + 1);
      } else {
        attacker.consecutiveTargetUid = target.uid;
        attacker.consecutiveHits = 0;
      }
      damage *= 1 + attacker.consecutiveHits * 0.1;
    }
  }

  // Mitigation formula
  if (damageType === 'PHYSICAL') {
    damage *= 100 / (100 + targetStats.def);
  } else if (damageType === 'MAGIC') {
    damage *= 100 / (100 + targetStats.mdef);
  }

  damage *= 1 - targetStats.dmgReduce;
  const finalDamage = Math.max(8, Math.round(damage));

  // Kim Long passive: gain armor stack when hit
  if (target.defId === 'kim_long' && !isReflect) {
    target.passiveStacks = Math.min(8, target.passiveStacks + 1);
  }

  // Energy gain from taking damage
  target.energy = Math.min(target.maxEnergy, target.energy + Math.min(10, finalDamage / 40));

  // Shield absorption
  let remaining = finalDamage;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }

  target.hp = Math.max(0, target.hp - remaining);
  target.damageTaken += finalDamage;

  if (attacker && !attacker.isClone) {
    attacker.damageDealt += finalDamage;
  } else if (attacker?.isClone && attacker.ownerUid) {
    const owner = state.dragons.find((d) => d.uid === attacker.ownerUid);
    if (owner) owner.damageDealt += finalDamage;
  }

  // Huyết Long passive: lifesteal 20% capped at 160
  if (attacker && attacker.defId === 'huyet_long' && !isReflect) {
    const steal = Math.min(160, finalDamage * 0.2);
    healDragon(state, attacker, attacker, steal, headless);
  }

  // Reflect check (Kim Long S2)
  if (!isReflect && attacker && attacker.isAlive) {
    const reflectEf = target.effects.find((e) => e.type === 'REFLECT');
    if (reflectEf && dist(attacker.x, attacker.y, target.x, target.y) <= 240) {
      applyDamage(state, target, attacker, finalDamage * reflectEf.value, 'MAGIC', headless, true);
    }
  }

  // Visual hit state
  if (!headless) {
    target.anim.hitFlash = 0.14;
    if (target.anim.type === 'idle' || target.anim.type === 'move') {
      target.anim.type = 'hit';
      target.anim.timer = 0.14;
      target.anim.duration = 0.14;
    }
    const color =
      damageType === 'MAGIC' ? '#60A5FA' : damageType === 'TRUE' ? '#FDE047' : '#F87171';
    spawnFloatingText(state, target.x, target.y, `-${finalDamage}`, color, finalDamage > 260 ? 17 : 13, headless);
  }

  // Death check
  if (target.hp <= 0) {
    handleDragonDeath(state, target, attacker, headless);
  }

  return finalDamage;
}

export function handleDragonDeath(
  state: BattleState,
  victim: DragonInstance,
  killer: DragonInstance | null,
  headless = false
) {
  if (!victim.isAlive) return;

  // Cốt Long passive: 1x self-revive at 45% HP
  if (victim.defId === 'cot_long' && !victim.hasRevived && !victim.isClone) {
    victim.hasRevived = true;
    victim.hp = Math.round(victim.maxHp * 0.45);
    victim.shield = 180;
    victim.effects = [];
    spawnFloatingText(state, victim.x, victim.y, 'HỒI SINH!', '#4ADE80', 18, headless);
    spawnVfx(state, { kind: 'RING', x: victim.x, y: victim.y, radius: 75, color: '#4ADE80', duration: 0.55 }, headless);
    addLog(state, 'REVIVE', `${victim.def.name} kích hoạt Bất Tử Hài Cốt, tự hồi sinh!`, victim.team, victim.def.name);
    return;
  }

  victim.isAlive = false;
  victim.hp = 0;
  victim.shield = 0;
  victim.effects = [];
  victim.deathTime = state.elapsed;
  victim.anim.type = 'dead';
  victim.anim.timer = 0.5;
  victim.anim.duration = 0.5;

  if (victim.isClone) return;

  const actualKiller =
    killer?.isClone && killer.ownerUid
      ? state.dragons.find((d) => d.uid === killer.ownerUid) || killer
      : killer;

  if (actualKiller) {
    actualKiller.kills += 1;
    actualKiller.energy = Math.min(actualKiller.maxEnergy, actualKiller.energy + 25);
    actualKiller.anim.killSpotlightTimer = 1.6;

    // Ma Long passive: +18 ATK/MATK per kill (max 5)
    if (actualKiller.defId === 'ma_long') {
      actualKiller.passiveStacks = Math.min(5, actualKiller.passiveStacks + 1);
    }
  }

  // Ma Long nearby kill passive check if not direct killer
  for (const d of state.dragons) {
    if (
      d.isAlive &&
      d.isDeployed &&
      d.defId === 'ma_long' &&
      d.uid !== actualKiller?.uid &&
      d.team !== victim.team &&
      dist(d.x, d.y, victim.x, victim.y) <= 220
    ) {
      d.passiveStacks = Math.min(5, d.passiveStacks + 1);
    }
  }

  const killerName = actualKiller ? actualKiller.def.name : 'Hiệu ứng nguyên tố';
  addLog(
    state,
    'KILL',
    `${killerName} đã hạ gục ${victim.def.name}!`,
    actualKiller?.team,
    killerName
  );

  if (victim.team === 'AI') {
    state.playerGems += 2;
    if (!headless) {
      spawnFloatingText(state, victim.x, victim.y - 16, '+2 Ngọc', '#38BDF8', 13, headless);
    }
  }

  if (!headless) {
    soundFX.playKill();
    spawnVfx(
      state,
      {
        kind: 'KILL_BURST',
        x: victim.x,
        y: victim.y,
        radius: 90,
        color: victim.def.accentColor,
        duration: 0.65,
      },
      headless
    );
    if (actualKiller) {
      state.killAnnouncement = {
        killerName: actualKiller.def.name,
        victimName: victim.def.name,
        killerImage: actualKiller.def.image,
        killerTeam: actualKiller.team,
        timer: 2.6,
      };
    }
  }
}

export function getEnemies(state: BattleState, team: TeamSide): DragonInstance[] {
  return state.dragons.filter(
    (d) => d.isAlive && d.isDeployed && d.team !== team && !hasEffect(d, 'STEALTH')
  );
}

export function getAllies(state: BattleState, team: TeamSide): DragonInstance[] {
  return state.dragons.filter((d) => d.isAlive && d.isDeployed && d.team === team);
}

export function findNearestEnemy(state: BattleState, self: DragonInstance): DragonInstance | null {
  const enemies = getEnemies(state, self.team);
  let best: DragonInstance | null = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    const d = dist(self.x, self.y, e.x, e.y);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

export function findLowestHpAlly(state: BattleState, self: DragonInstance): DragonInstance | null {
  if (self.priorityAllyUid) {
    const pref = state.dragons.find(
      (d) => d.uid === self.priorityAllyUid && d.isAlive && d.isDeployed && d.team === self.team
    );
    if (pref && pref.hp < pref.maxHp) return pref;
  }
  const allies = getAllies(state, self.team).filter((a) => !a.isClone);
  let best: DragonInstance | null = null;
  let lowestPct = 2;
  for (const a of allies) {
    const pct = a.hp / a.maxHp;
    if (pct < lowestPct) {
      lowestPct = pct;
      best = a;
    }
  }
  return best || self;
}

export function findDensestEnemyCluster(
  state: BattleState,
  self: DragonInstance,
  aoeRadius = 150
): { target: DragonInstance | null; x: number; y: number; count: number } {
  const enemies = getEnemies(state, self.team);
  if (enemies.length === 0) return { target: null, x: self.x, y: self.y, count: 0 };
  let bestTarget = enemies[0];
  let bestCount = -1;
  for (const e of enemies) {
    let count = 0;
    for (const other of enemies) {
      if (dist(e.x, e.y, other.x, other.y) <= aoeRadius) count += 1;
    }
    if (count > bestCount) {
      bestCount = count;
      bestTarget = e;
    }
  }
  return { target: bestTarget, x: bestTarget.x, y: bestTarget.y, count: bestCount };
}

export function performBasicAttack(
  state: BattleState,
  attacker: DragonInstance,
  target: DragonInstance,
  headless = false
) {
  const stats = getEffectiveStats(attacker, state.dragons);
  attacker.anim.facing = target.x >= attacker.x ? 1 : -1;
  attacker.anim.type = 'attack';
  attacker.anim.timer = 0.24;
  attacker.anim.duration = 0.24;
  attacker.anim.lungeX = attacker.anim.facing * 12;

  attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + 12);

  // Ngự Long passive: +1 Long Khí on hit
  if (attacker.defId === 'ngu_long') {
    attacker.longKhi = Math.min(10, attacker.longKhi + 1);
  }
  // Địa Ngục Long passive: +1 Heat stack
  if (attacker.defId === 'dia_nguc_long') {
    attacker.passiveStacks = Math.min(6, attacker.passiveStacks + 1);
  }
  // Thiên Thạch Long passive: +1 Momentum
  if (attacker.defId === 'thien_thach_long') {
    attacker.passiveStacks = Math.min(5, attacker.passiveStacks + 1);
  }

  // Ranged vs Melee
  if (attacker.def.stats.range > 140) {
    let dmg = stats.matk * 0.95;
    if (attacker.defId === 'tam_dau_long') {
      dmg = stats.atk * 0.5 + stats.matk * 0.55;
    }
    if (attacker.defId === 'loi_long') {
      attacker.passiveStacks += 1;
      if (attacker.passiveStacks >= 5) {
        attacker.passiveStacks = 0;
        dmg += 90;
        spawnFloatingText(state, attacker.x, attacker.y, 'Tích Điện!', '#FDE047', 12, headless);
      }
    }

    const proj: Projectile = {
      id: nextId('proj'),
      sourceUid: attacker.uid,
      team: attacker.team,
      x: attacker.x + attacker.anim.facing * 18,
      y: attacker.y,
      targetUid: target.uid,
      targetX: target.x,
      targetY: target.y,
      speed: 520,
      radius: 7,
      damage: dmg,
      damageType: 'MAGIC',
      color: attacker.def.accentColor,
      onHitEffect:
        attacker.defId === 'doc_long'
          ? { type: 'POISON', duration: 4, value: 16 }
          : undefined,
      trail: [],
    };
    state.projectiles.push(proj);
  } else {
    let dmg = stats.atk;
    if (attacker.defId === 'ngu_long' && attacker.nguLongEmpoweredTimer > 0) {
      dmg *= 1.25;
      spawnVfx(
        state,
        { kind: 'SLASH', x: target.x, y: target.y, radius: 42, color: '#38BDF8', duration: 0.2 },
        headless
      );
    }
    applyDamage(state, attacker, target, dmg, 'PHYSICAL', headless);
    if (!headless && Math.random() < 0.35) {
      soundFX.playHit();
    }
    spawnVfx(
      state,
      { kind: 'SLASH', x: target.x, y: target.y, radius: 28, color: attacker.def.accentColor, duration: 0.18 },
      headless
    );
  }
}

export function castSkill(
  state: BattleState,
  caster: DragonInstance,
  slot: 'S1' | 'S2' | 'ULT',
  headless = false
): boolean {
  if (!caster.isAlive || !caster.isDeployed) return false;
  if (hasEffect(caster, 'STUN')) return false;

  if (slot === 'S1' && caster.s1Cd > 0) return false;
  if (slot === 'S2' && caster.s2Cd > 0) return false;
  if (slot === 'ULT' && caster.energy < caster.maxEnergy) return false;

  const stats = getEffectiveStats(caster, state.dragons);
  if (slot === 'ULT' && caster.gemUltEmpowered) {
    stats.atk *= 1.3;
    stats.matk *= 1.3;
    caster.gemUltEmpowered = false;
  }
  const enemies = getEnemies(state, caster.team);
  if (enemies.length === 0 && slot !== 'ULT') return false;

  const nearestEnemy =
    (caster.priorityTargetUid &&
      enemies.find((e) => e.uid === caster.priorityTargetUid)) ||
    (caster.targetUid && enemies.find((e) => e.uid === caster.targetUid)) ||
    findNearestEnemy(state, caster);

  const lowestEnemy = [...enemies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || nearestEnemy;
  const cluster = findDensestEnemyCluster(state, caster, 160);
  const lowestAlly = findLowestHpAlly(state, caster) || caster;

  // Set cooldowns / energy
  if (slot === 'S1') {
    caster.s1Cd = caster.def.skill1.cooldown || 6;
    caster.energy = Math.min(caster.maxEnergy, caster.energy + 16);
  } else if (slot === 'S2') {
    caster.s2Cd = caster.def.skill2.cooldown || 8;
    caster.energy = Math.min(caster.maxEnergy, caster.energy + 20);
  } else {
    caster.energy = 0;
  }

  caster.skillsUsed += 1;
  caster.anim.type = 'skill';
  caster.anim.timer = 0.35;
  caster.anim.duration = 0.35;

  const skillName =
    slot === 'S1'
      ? caster.def.skill1.name
      : slot === 'S2'
      ? caster.def.skill2.name
      : caster.def.ultimate.name;

  if (!headless) {
    if (slot === 'ULT') {
      soundFX.playUltimate();
      spawnFloatingText(state, caster.x, caster.y - 16, skillName.toUpperCase(), '#FDE047', 15, headless);
      state.ultCutIn = {
        dragonName: caster.def.name,
        skillName,
        image: caster.def.image,
        accentColor: caster.def.accentColor,
        team: caster.team,
        timer: 2.0,
      };
    } else {
      soundFX.playSkill();
      spawnFloatingText(state, caster.x, caster.y - 10, skillName, caster.def.secondaryColor, 12, headless);
    }
  }

  if (slot === 'ULT') {
    addLog(state, 'ULTIMATE', `${caster.def.name} tung tuyệt kỹ ${skillName}!`, caster.team, caster.def.name);
  }

  const id = caster.defId;

  // ==================== GUARDIAN SKILLS ====================
  if (id === 'kim_long') {
    if (slot === 'S1') {
      grantShield(state, caster, 420 + stats.def * 0.25, 5, caster.uid, headless);
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 60, color: '#F59E0B', duration: 0.45 }, headless);
    } else if (slot === 'S2') {
      applyStatusEffect(caster, { type: 'REFLECT', sourceId: caster.uid, duration: 4, value: 0.38, stacks: 1 });
      for (const e of enemies) {
        if (dist(caster.x, caster.y, e.x, e.y) <= 130) {
          applyDamage(state, caster, e, 120 + stats.def * 0.6, 'PHYSICAL', headless);
        }
      }
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 130, color: '#FDE68A', duration: 0.4 }, headless);
    } else {
      applyStatusEffect(caster, { type: 'DMG_REDUCE', sourceId: caster.uid, duration: 5, value: 0.55, stacks: 1 });
      applyStatusEffect(caster, { type: 'CC_IMMUNE', sourceId: caster.uid, duration: 5, value: 1, stacks: 1 });
      grantShield(state, caster, 550, 5, caster.uid, headless);
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 95, color: '#F59E0B', duration: 0.7 }, headless);
    }
    return true;
  }

  if (id === 'cot_long') {
    if (slot === 'S1') {
      grantShield(state, caster, 360, 4.5, caster.uid, headless);
      applyStatusEffect(caster, { type: 'DEF_BUFF', sourceId: caster.uid, duration: 4.5, value: 35, stacks: 1 });
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 55, color: '#4ADE80', duration: 0.4 }, headless);
    } else if (slot === 'S2' && nearestEnemy) {
      applyDamage(state, caster, nearestEnemy, 160 + stats.matk * 0.8, 'MAGIC', headless);
      applyStatusEffect(nearestEnemy, { type: 'ROOT', sourceId: caster.uid, duration: 2.2, value: 1, stacks: 1 });
      spawnVfx(state, { kind: 'RING', x: nearestEnemy.x, y: nearestEnemy.y, radius: 50, color: '#4ADE80', duration: 0.5 }, headless);
    } else if (slot === 'ULT') {
      state.zones.push({
        id: nextId('zone'),
        sourceUid: caster.uid,
        team: caster.team,
        kind: 'BONE_WALL',
        x: caster.x,
        y: caster.y,
        radius: 190,
        duration: 6,
        maxDuration: 6,
        tickTimer: 0.5,
        value: 40,
        color: '#4ADE80',
      });
      for (const a of getAllies(state, caster.team)) {
        if (dist(caster.x, caster.y, a.x, a.y) <= 190) {
          grantShield(state, a, 300, 5, caster.uid, headless);
        }
      }
    }
    return true;
  }

  if (id === 'thanh_long') {
    if (slot === 'S1') {
      grantShield(state, caster, 380, 4.5, caster.uid, headless);
      if (lowestAlly.uid !== caster.uid) {
        grantShield(state, lowestAlly, 380, 4.5, caster.uid, headless);
      }
      spawnVfx(state, { kind: 'RING', x: lowestAlly.x, y: lowestAlly.y, radius: 60, color: '#FACC15', duration: 0.45 }, headless);
    } else if (slot === 'S2') {
      for (const e of enemies) {
        if (dist(caster.x, caster.y, e.x, e.y) <= 155) {
          applyDamage(state, caster, e, 150 + stats.matk * 0.75, 'MAGIC', headless);
          applyStatusEffect(e, { type: 'STUN', sourceId: caster.uid, duration: 1, value: 1, stacks: 1 });
          const angle = Math.atan2(e.y - caster.y, e.x - caster.x);
          e.x = clamp(e.x + Math.cos(angle) * 75, 55, ARENA_W - 55);
          e.y = clamp(e.y + Math.sin(angle) * 75, 75, ARENA_H - 55);
        }
      }
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 155, color: '#FEF08A', duration: 0.45 }, headless);
    } else {
      for (const a of getAllies(state, caster.team)) {
        grantShield(state, a, 320, 4.5, caster.uid, headless);
        applyStatusEffect(a, { type: 'DMG_REDUCE', sourceId: caster.uid, duration: 4.5, value: 0.25, stacks: 1 });
        spawnVfx(state, { kind: 'RING', x: a.x, y: a.y, radius: 48, color: '#FACC15', duration: 0.45 }, headless);
      }
    }
    return true;
  }

  if (id === 'huyet_long') {
    if (slot === 'S1') {
      const cost = Math.round(caster.hp * 0.05);
      caster.hp = Math.max(1, caster.hp - cost);
      const missing = caster.maxHp - caster.hp;
      grantShield(state, caster, 340 + missing * 0.1, 4.5, caster.uid, headless);
    } else if (slot === 'S2') {
      const mult = caster.hp < caster.maxHp * 0.6 ? 2 : 1;
      applyStatusEffect(caster, { type: 'DEF_BUFF', sourceId: caster.uid, duration: 5, value: 25 * mult, stacks: 1 });
      applyStatusEffect(caster, { type: 'ATK_BUFF', sourceId: caster.uid, duration: 5, value: 0.18 * mult, stacks: 1 });
      for (const e of enemies) {
        if (dist(caster.x, caster.y, e.x, e.y) <= 130) {
          applyDamage(state, caster, e, 140 + stats.atk * 0.7, 'PHYSICAL', headless);
        }
      }
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 130, color: '#EF4444', duration: 0.4 }, headless);
    } else {
      state.zones.push({
        id: nextId('zone'),
        sourceUid: caster.uid,
        team: caster.team,
        kind: 'BLOOD',
        x: caster.x,
        y: caster.y,
        radius: 190,
        duration: 5,
        maxDuration: 5,
        tickTimer: 0.5,
        value: 85 + stats.matk * 0.4,
        color: '#EF4444',
      });
    }
    return true;
  }

  // ==================== MAGE SKILLS ====================
  if (id === 'bang_long') {
    caster.passiveStacks = Math.min(4, caster.passiveStacks + 1);
    if (slot === 'S1' && nearestEnemy) {
      const angle = Math.atan2(nearestEnemy.y - caster.y, nearestEnemy.x - caster.x);
      state.projectiles.push({
        id: nextId('proj'),
        sourceUid: caster.uid,
        team: caster.team,
        x: caster.x,
        y: caster.y,
        targetUid: null,
        targetX: caster.x + Math.cos(angle) * 520,
        targetY: caster.y + Math.sin(angle) * 520,
        speed: 600,
        radius: 18,
        damage: 185 + stats.matk * 0.95,
        damageType: 'MAGIC',
        color: '#60A5FA',
        piercing: true,
        hitUids: [],
        onHitEffect: { type: 'SLOW', duration: 2, value: 0.25 },
        trail: [],
      });
    } else if (slot === 'S2' && cluster.target) {
      for (const e of enemies) {
        if (dist(cluster.x, cluster.y, e.x, e.y) <= 155) {
          applyDamage(state, caster, e, 140 + stats.matk * 0.75, 'MAGIC', headless);
          applyStatusEffect(e, { type: 'SLOW', sourceId: caster.uid, duration: 3.5, value: 0.4, stacks: 1 });
        }
      }
      spawnVfx(state, { kind: 'RING', x: cluster.x, y: cluster.y, radius: 155, color: '#93C5FD', duration: 0.5 }, headless);
    } else if (slot === 'ULT' && cluster.target) {
      state.zones.push({
        id: nextId('zone'),
        sourceUid: caster.uid,
        team: caster.team,
        kind: 'BLIZZARD',
        x: cluster.x,
        y: cluster.y,
        radius: 200,
        duration: 4,
        maxDuration: 4,
        tickTimer: 0.5,
        value: 55 + stats.matk * 0.25,
        color: '#60A5FA',
      });
      for (const e of enemies) {
        if (dist(cluster.x, cluster.y, e.x, e.y) <= 200) {
          applyDamage(state, caster, e, 320 + stats.matk * 1.35, 'MAGIC', headless);
          applyStatusEffect(e, { type: 'STUN', sourceId: caster.uid, duration: 1.8, value: 1, stacks: 1 });
        }
      }
      spawnVfx(state, { kind: 'RING', x: cluster.x, y: cluster.y, radius: 200, color: '#E0F2FE', duration: 0.7 }, headless);
    }
    return true;
  }

  if (id === 'hoa_long_mage') {
    if (slot === 'S1' && nearestEnemy) {
      state.projectiles.push({
        id: nextId('proj'),
        sourceUid: caster.uid,
        team: caster.team,
        x: caster.x,
        y: caster.y,
        targetUid: nearestEnemy.uid,
        targetX: nearestEnemy.x,
        targetY: nearestEnemy.y,
        speed: 480,
        radius: 13,
        damage: 195 + stats.matk * 1.05,
        damageType: 'MAGIC',
        color: '#F97316',
        onHitEffect: { type: 'BURN', duration: 3, value: 45, aoeRadius: 110 },
        trail: [],
      });
    } else if (slot === 'S2' && cluster.target) {
      state.zones.push({
        id: nextId('zone'),
        sourceUid: caster.uid,
        team: caster.team,
        kind: 'LAVA',
        x: cluster.x,
        y: cluster.y,
        radius: 145,
        duration: 4.5,
        maxDuration: 4.5,
        tickTimer: 0.5,
        value: 75 + stats.matk * 0.35,
        color: '#FB7185',
      });
    } else if (slot === 'ULT' && cluster.target) {
      for (const e of enemies) {
        if (dist(cluster.x, cluster.y, e.x, e.y) <= 240) {
          applyDamage(state, caster, e, 360 + stats.matk * 1.5, 'MAGIC', headless);
          applyStatusEffect(e, { type: 'BURN', sourceId: caster.uid, duration: 4, value: 55, stacks: 1 }, 3);
        }
      }
      spawnVfx(state, { kind: 'RING', x: cluster.x, y: cluster.y, radius: 240, color: '#F97316', duration: 0.75 }, headless);
    }
    return true;
  }

  if (id === 'loi_long') {
    if (slot === 'S1' && nearestEnemy) {
      applyDamage(state, caster, nearestEnemy, 190 + stats.matk * 0.95, 'MAGIC', headless);
      applyStatusEffect(nearestEnemy, { type: 'STUN', sourceId: caster.uid, duration: 0.8, value: 1, stacks: 1 });
      spawnVfx(
        state,
        { kind: 'LIGHTNING', x: caster.x, y: caster.y, x2: nearestEnemy.x, y2: nearestEnemy.y, radius: 12, color: '#38BDF8', duration: 0.25 },
        headless
      );
    } else if (slot === 'S2' && nearestEnemy) {
      const chain: DragonInstance[] = [nearestEnemy];
      let curr = nearestEnemy;
      while (chain.length < 4) {
        const next = enemies
          .filter((e) => !chain.includes(e))
          .sort((a, b) => dist(curr.x, curr.y, a.x, a.y) - dist(curr.x, curr.y, b.x, b.y))[0];
        if (!next || dist(curr.x, curr.y, next.x, next.y) > 250) break;
        chain.push(next);
        curr = next;
      }
      let prevX = caster.x;
      let prevY = caster.y;
      for (const target of chain) {
        applyDamage(state, caster, target, 150 + stats.matk * 0.8, 'MAGIC', headless);
        spawnVfx(
          state,
          { kind: 'LIGHTNING', x: prevX, y: prevY, x2: target.x, y2: target.y, radius: 10, color: '#FDE047', duration: 0.28 },
          headless
        );
        prevX = target.x;
        prevY = target.y;
      }
    } else if (slot === 'ULT' && cluster.target) {
      const targets = enemies
        .filter((e) => dist(cluster.x, cluster.y, e.x, e.y) <= 210)
        .slice(0, 5);
      for (const e of targets) {
        applyDamage(state, caster, e, 290 + stats.matk * 1.25, 'MAGIC', headless);
        applyStatusEffect(e, { type: 'STUN', sourceId: caster.uid, duration: 1.2, value: 1, stacks: 1 });
        spawnVfx(
          state,
          { kind: 'LIGHTNING', x: e.x, y: 20, x2: e.x, y2: e.y, radius: 16, color: '#38BDF8', duration: 0.35 },
          headless
        );
      }
    }
    return true;
  }

  if (id === 'thuy_long') {
    caster.passiveStacks = Math.min(4, caster.passiveStacks + 1);
    caster.energy = Math.min(caster.maxEnergy, caster.energy + 4);
    if (slot === 'S1' && nearestEnemy) {
      const targets = enemies
        .filter((e) => dist(nearestEnemy.x, nearestEnemy.y, e.x, e.y) <= 135)
        .slice(0, 3);
      for (const t of targets) {
        state.projectiles.push({
          id: nextId('proj'),
          sourceUid: caster.uid,
          team: caster.team,
          x: caster.x,
          y: caster.y,
          targetUid: t.uid,
          targetX: t.x,
          targetY: t.y,
          speed: 540,
          radius: 9,
          damage: 175 + stats.matk * 0.9,
          damageType: 'MAGIC',
          color: '#0EA5E9',
          trail: [],
        });
      }
    } else if (slot === 'S2' && cluster.target) {
      for (const e of enemies) {
        if (dist(cluster.x, cluster.y, e.x, e.y) <= 180) {
          e.x += (cluster.x - e.x) * 0.55;
          e.y += (cluster.y - e.y) * 0.55;
          applyDamage(state, caster, e, 120 + stats.matk * 0.65, 'MAGIC', headless);
          applyStatusEffect(e, { type: 'SLOW', sourceId: caster.uid, duration: 2.5, value: 0.35, stacks: 1 });
        }
      }
      spawnVfx(state, { kind: 'RING', x: cluster.x, y: cluster.y, radius: 180, color: '#67E8F9', duration: 0.55 }, headless);
    } else if (slot === 'ULT' && cluster.target) {
      for (const e of enemies) {
        if (dist(cluster.x, cluster.y, e.x, e.y) <= 230) {
          applyDamage(state, caster, e, 310 + stats.matk * 1.35, 'MAGIC', headless);
          const angle = Math.atan2(e.y - caster.y, e.x - caster.x);
          e.x = clamp(e.x + Math.cos(angle) * 85, 55, ARENA_W - 55);
          e.y = clamp(e.y + Math.sin(angle) * 85, 75, ARENA_H - 55);
        }
      }
      spawnVfx(state, { kind: 'RING', x: cluster.x, y: cluster.y, radius: 230, color: '#0EA5E9', duration: 0.7 }, headless);
    }
    return true;
  }

  // ==================== ASSASSIN SKILLS ====================
  if (id === 'am_long') {
    const prey = lowestEnemy;
    if (slot === 'S1' && prey) {
      const offset = prey.anim.facing === 1 ? -42 : 42;
      caster.x = clamp(prey.x + offset, 55, ARENA_W - 55);
      caster.y = clamp(prey.y + (Math.random() - 0.5) * 20, 75, ARENA_H - 55);
      caster.targetUid = prey.uid;
      applyStatusEffect(caster, { type: 'ASPD_BUFF', sourceId: caster.uid, duration: 3, value: 0.35, stacks: 1 });
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 45, color: '#A855F7', duration: 0.3 }, headless);
    } else if (slot === 'S2' && nearestEnemy) {
      applyDamage(state, caster, nearestEnemy, 210 + stats.atk * 1.1, 'PHYSICAL', headless);
      applyStatusEffect(nearestEnemy, { type: 'DEF_SHRED', sourceId: caster.uid, duration: 3, value: 20, stacks: 1 });
      spawnVfx(state, { kind: 'SLASH', x: nearestEnemy.x, y: nearestEnemy.y, radius: 45, color: '#C084FC', duration: 0.25 }, headless);
    } else if (slot === 'ULT' && prey) {
      caster.x = clamp(prey.x - prey.anim.facing * 38, 55, ARENA_W - 55);
      caster.y = prey.y;
      applyDamage(state, caster, prey, 420 + stats.atk * 1.7, 'PHYSICAL', headless);
      spawnVfx(state, { kind: 'SLASH', x: prey.x, y: prey.y, radius: 70, color: '#A855F7', duration: 0.4 }, headless);
    }
    return true;
  }

  if (id === 'hac_long') {
    if (slot === 'S1') {
      applyStatusEffect(caster, { type: 'STEALTH', sourceId: caster.uid, duration: 2.5, value: 1, stacks: 1 });
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 50, color: '#6366F1', duration: 0.4 }, headless);
    } else if (slot === 'S2' && lowestEnemy) {
      caster.x = clamp(lowestEnemy.x - 36, 55, ARENA_W - 55);
      caster.y = lowestEnemy.y;
      caster.targetUid = lowestEnemy.uid;
      applyDamage(state, caster, lowestEnemy, 195 + stats.atk * 1.0, 'PHYSICAL', headless);
      applyStatusEffect(lowestEnemy, { type: 'SLOW', sourceId: caster.uid, duration: 2.5, value: 0.35, stacks: 1 });
      spawnVfx(state, { kind: 'SLASH', x: lowestEnemy.x, y: lowestEnemy.y, radius: 48, color: '#818CF8', duration: 0.3 }, headless);
    } else if (slot === 'ULT' && cluster.target) {
      state.zones.push({
        id: nextId('zone'),
        sourceUid: caster.uid,
        team: caster.team,
        kind: 'SHADOW',
        x: cluster.x,
        y: cluster.y,
        radius: 170,
        duration: 4.5,
        maxDuration: 4.5,
        tickTimer: 0.5,
        value: 80 + stats.matk * 0.45,
        color: '#6366F1',
      });
    }
    return true;
  }

  if (id === 'ma_long') {
    if (slot === 'S1' && nearestEnemy) {
      const dealt = applyDamage(state, caster, nearestEnemy, 180 + stats.atk * 0.95, 'PHYSICAL', headless);
      healDragon(state, caster, caster, dealt * 0.45, headless);
      spawnVfx(state, { kind: 'SLASH', x: nearestEnemy.x, y: nearestEnemy.y, radius: 42, color: '#D946EF', duration: 0.25 }, headless);
    } else if (slot === 'S2') {
      // Limit 1 active clone per Ma Long
      const existingClone = state.dragons.find((d) => d.isClone && d.ownerUid === caster.uid && d.isAlive);
      if (!existingClone) {
        state.dragons.push({
          ...caster,
          uid: nextId('clone'),
          isClone: true,
          ownerUid: caster.uid,
          cloneLifeTimer: 7,
          x: clamp(caster.x + (Math.random() - 0.5) * 50, 55, ARENA_W - 55),
          y: clamp(caster.y + (Math.random() - 0.5) * 50, 75, ARENA_H - 55),
          hp: Math.round(caster.maxHp * 0.45),
          maxHp: Math.round(caster.maxHp * 0.45),
          shield: 0,
          energy: 0,
          s1Cd: 99,
          s2Cd: 99,
          effects: [],
          anim: { ...caster.anim },
          damageDealt: 0,
          damageTaken: 0,
          healingDone: 0,
          healCount: 0,
          kills: 0,
          skillsUsed: 0,
          timeAlive: 0,
          deathTime: null,
        });
        spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 60, color: '#D946EF', duration: 0.4 }, headless);
      }
    } else if (slot === 'ULT') {
      caster.maVuongTimer = 6;
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 80, color: '#E879F9', duration: 0.55 }, headless);
    }
    return true;
  }

  if (id === 'quy_long') {
    if (slot === 'S1' && nearestEnemy) {
      applyStatusEffect(nearestEnemy, { type: 'MARKED', sourceId: caster.uid, duration: 4, value: 1, stacks: 1 });
      applyDamage(state, caster, nearestEnemy, 175 + stats.atk * 0.9, 'PHYSICAL', headless);
      spawnVfx(state, { kind: 'SLASH', x: nearestEnemy.x, y: nearestEnemy.y, radius: 44, color: '#F43F5E', duration: 0.25 }, headless);
    } else if (slot === 'S2' && lowestEnemy) {
      caster.x = clamp(lowestEnemy.x - 36, 55, ARENA_W - 55);
      caster.y = lowestEnemy.y;
      caster.targetUid = lowestEnemy.uid;
      applyDamage(state, caster, lowestEnemy, 190 + stats.atk * 0.95, 'PHYSICAL', headless);
      applyStatusEffect(lowestEnemy, { type: 'STUN', sourceId: caster.uid, duration: 0.7, value: 1, stacks: 1 });
      spawnVfx(state, { kind: 'RING', x: lowestEnemy.x, y: lowestEnemy.y, radius: 55, color: '#F43F5E', duration: 0.35 }, headless);
    } else if (slot === 'ULT' && lowestEnemy) {
      caster.x = clamp(lowestEnemy.x - 36, 55, ARENA_W - 55);
      caster.y = lowestEnemy.y;
      const missingBonus = Math.min(350, (lowestEnemy.maxHp - lowestEnemy.hp) * 0.22);
      applyDamage(state, caster, lowestEnemy, 350 + stats.atk * 1.4 + missingBonus, 'PHYSICAL', headless);
      spawnVfx(state, { kind: 'SLASH', x: lowestEnemy.x, y: lowestEnemy.y, radius: 80, color: '#FB7185', duration: 0.45 }, headless);
    }
    return true;
  }

  // ==================== SUPPORT SKILLS ====================
  if (id === 'bach_long') {
    if (slot === 'S1') {
      healDragon(state, caster, lowestAlly, 290 + stats.matk * 1.15, headless);
      spawnVfx(state, { kind: 'RING', x: lowestAlly.x, y: lowestAlly.y, radius: 55, color: '#E2E8F0', duration: 0.45 }, headless);
    } else if (slot === 'S2') {
      lowestAlly.effects = lowestAlly.effects.filter(
        (e) => !['SLOW', 'STUN', 'ROOT', 'BURN', 'POISON', 'DEF_SHRED', 'MARKED'].includes(e.type)
      );
      grantShield(state, lowestAlly, 220, 4, caster.uid, headless);
      spawnFloatingText(state, lowestAlly.x, lowestAlly.y, 'Thanh Tẩy!', '#F8FAFC', 13, headless);
    } else if (slot === 'ULT') {
      const deadAlly = state.dragons.find(
        (d) => !d.isAlive && !d.isClone && d.isDeployed && d.team === caster.team
      );
      if (deadAlly && !caster.bachLongReviveUsed) {
        caster.bachLongReviveUsed = true;
        deadAlly.isAlive = true;
        deadAlly.hp = Math.round(deadAlly.maxHp * 0.55);
        deadAlly.effects = [];
        deadAlly.anim.type = 'idle';
        spawnFloatingText(state, deadAlly.x, deadAlly.y, 'PHỤC SINH!', '#FDE68A', 18, headless);
        spawnVfx(state, { kind: 'RING', x: deadAlly.x, y: deadAlly.y, radius: 85, color: '#FDE68A', duration: 0.7 }, headless);
        addLog(
          state,
          'REVIVE',
          `${caster.def.name} hồi sinh ${deadAlly.def.name} bằng Phục Sinh Thánh Quang!`,
          caster.team,
          caster.def.name
        );
      } else {
        for (const a of getAllies(state, caster.team)) {
          healDragon(state, caster, a, 240 + stats.matk * 0.9, headless);
          spawnVfx(state, { kind: 'RING', x: a.x, y: a.y, radius: 48, color: '#F8FAFC', duration: 0.45 }, headless);
        }
      }
    }
    return true;
  }

  if (id === 'doc_long') {
    if (slot === 'S1' && cluster.target) {
      state.zones.push({
        id: nextId('zone'),
        sourceUid: caster.uid,
        team: caster.team,
        kind: 'POISON',
        x: cluster.x,
        y: cluster.y,
        radius: 150,
        duration: 4.5,
        maxDuration: 4.5,
        tickTimer: 0.5,
        value: 48 + stats.matk * 0.25,
        color: '#22C55E',
      });
    } else if (slot === 'S2' && nearestEnemy) {
      for (const e of enemies) {
        if (dist(nearestEnemy.x, nearestEnemy.y, e.x, e.y) <= 120) {
          applyDamage(state, caster, e, 135 + stats.matk * 0.75, 'MAGIC', headless);
          applyStatusEffect(e, { type: 'DEF_SHRED', sourceId: caster.uid, duration: 5, value: 32, stacks: 1 });
        }
      }
      spawnVfx(state, { kind: 'RING', x: nearestEnemy.x, y: nearestEnemy.y, radius: 120, color: '#A3E635', duration: 0.45 }, headless);
    } else if (slot === 'ULT') {
      for (const e of enemies) {
        applyDamage(state, caster, e, 260 + stats.matk * 1.2, 'MAGIC', headless);
        applyStatusEffect(e, { type: 'POISON', sourceId: caster.uid, duration: 5, value: 24, stacks: 3 }, 5);
      }
      spawnVfx(state, { kind: 'RING', x: ARENA_W / 2, y: ARENA_H / 2, radius: 360, color: '#22C55E', duration: 0.65 }, headless);
    }
    return true;
  }

  if (id === 'hoa_long_support') {
    if (slot === 'S1' && nearestEnemy) {
      applyDamage(state, caster, nearestEnemy, 130 + stats.matk * 0.7, 'MAGIC', headless);
      applyStatusEffect(nearestEnemy, { type: 'ROOT', sourceId: caster.uid, duration: 2, value: 1, stacks: 1 });
      spawnVfx(state, { kind: 'RING', x: nearestEnemy.x, y: nearestEnemy.y, radius: 48, color: '#10B981', duration: 0.4 }, headless);
    } else if (slot === 'S2') {
      const allies = getAllies(state, caster.team)
        .filter((a) => !a.isClone)
        .sort((a, b) => b.def.stats.atk + b.def.stats.matk - (a.def.stats.atk + a.def.stats.matk))
        .slice(0, 2);
      for (const a of allies) {
        applyStatusEffect(a, { type: 'ASPD_BUFF', sourceId: caster.uid, duration: 5, value: 0.3, stacks: 1 });
        applyStatusEffect(a, { type: 'MATK_BUFF', sourceId: caster.uid, duration: 5, value: 0.25, stacks: 1 });
        spawnVfx(state, { kind: 'RING', x: a.x, y: a.y, radius: 44, color: '#FDE047', duration: 0.4 }, headless);
      }
    } else if (slot === 'ULT') {
      state.zones.push({
        id: nextId('zone'),
        sourceUid: caster.uid,
        team: caster.team,
        kind: 'EDEN',
        x: caster.x,
        y: caster.y,
        radius: 210,
        duration: 5.5,
        maxDuration: 5.5,
        tickTimer: 0.5,
        value: 65 + stats.matk * 0.35,
        color: '#10B981',
      });
    }
    return true;
  }

  if (id === 'tam_dau_long') {
    if (slot === 'S1' && nearestEnemy) {
      for (const e of enemies) {
        if (dist(nearestEnemy.x, nearestEnemy.y, e.x, e.y) <= 105) {
          applyDamage(state, caster, e, 180 + stats.matk * 0.95, 'MAGIC', headless);
        }
      }
      spawnVfx(state, { kind: 'RING', x: nearestEnemy.x, y: nearestEnemy.y, radius: 105, color: '#F43F5E', duration: 0.4 }, headless);
    } else if (slot === 'S2' && cluster.target) {
      for (const e of enemies) {
        if (dist(cluster.x, cluster.y, e.x, e.y) <= 145) {
          applyStatusEffect(e, { type: 'SLOW', sourceId: caster.uid, duration: 3, value: 0.38, stacks: 1 });
          applyDamage(state, caster, e, 95 + stats.matk * 0.5, 'MAGIC', headless);
        }
      }
      grantShield(state, lowestAlly, 240, 4, caster.uid, headless);
      spawnVfx(state, { kind: 'RING', x: cluster.x, y: cluster.y, radius: 145, color: '#38BDF8', duration: 0.45 }, headless);
    } else if (slot === 'ULT') {
      if (cluster.target) {
        for (const e of enemies) {
          if (dist(cluster.x, cluster.y, e.x, e.y) <= 210) {
            applyDamage(state, caster, e, 280 + stats.matk * 1.25, 'MAGIC', headless);
          }
        }
        spawnVfx(state, { kind: 'RING', x: cluster.x, y: cluster.y, radius: 210, color: '#14B8A6', duration: 0.65 }, headless);
      }
      for (const a of getAllies(state, caster.team)) {
        healDragon(state, caster, a, 260, headless);
        grantShield(state, a, 260, 4, caster.uid, headless);
      }
    }
    return true;
  }

  // ==================== WARRIOR SKILLS ====================
  if (id === 'dia_nguc_long') {
    const heatBonus = 1 + caster.passiveStacks * 0.06;
    if (slot === 'S1' && nearestEnemy) {
      applyDamage(state, caster, nearestEnemy, (185 + stats.atk * 1.0) * heatBonus, 'PHYSICAL', headless);
      applyStatusEffect(nearestEnemy, { type: 'BURN', sourceId: caster.uid, duration: 3, value: 40, stacks: 1 }, 3);
      spawnVfx(state, { kind: 'SLASH', x: nearestEnemy.x, y: nearestEnemy.y, radius: 46, color: '#EA580C', duration: 0.25 }, headless);
    } else if (slot === 'S2' && nearestEnemy) {
      caster.x = clamp(nearestEnemy.x - 36, 55, ARENA_W - 55);
      caster.y = nearestEnemy.y;
      for (const e of enemies) {
        if (dist(caster.x, caster.y, e.x, e.y) <= 135) {
          applyDamage(state, caster, e, (165 + stats.atk * 0.85) * heatBonus, 'PHYSICAL', headless);
          applyStatusEffect(e, { type: 'STUN', sourceId: caster.uid, duration: 0.8, value: 1, stacks: 1 });
        }
      }
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 135, color: '#F97316', duration: 0.4 }, headless);
    } else if (slot === 'ULT') {
      for (const e of enemies) {
        if (dist(caster.x, caster.y, e.x, e.y) <= 200) {
          applyDamage(state, caster, e, (330 + stats.atk * 1.35) * heatBonus, 'MAGIC', headless);
          applyStatusEffect(e, { type: 'BURN', sourceId: caster.uid, duration: 3.5, value: 50, stacks: 1 }, 3);
        }
      }
      caster.passiveStacks = 0;
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 200, color: '#EA580C', duration: 0.7 }, headless);
    }
    return true;
  }

  if (id === 'diet_the_long') {
    if (slot === 'S1' && nearestEnemy) {
      applyDamage(state, caster, nearestEnemy, 180 + stats.atk * 0.95, 'PHYSICAL', headless);
      applyStatusEffect(nearestEnemy, { type: 'DEF_SHRED', sourceId: caster.uid, duration: 4.5, value: 30, stacks: 1 });
      spawnVfx(state, { kind: 'SLASH', x: nearestEnemy.x, y: nearestEnemy.y, radius: 46, color: '#E11D48', duration: 0.25 }, headless);
    } else if (slot === 'S2') {
      for (const e of enemies) {
        if (dist(caster.x, caster.y, e.x, e.y) <= 140) {
          applyDamage(state, caster, e, 200 + stats.atk * 1.05, 'PHYSICAL', headless);
        }
      }
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 140, color: '#FB7185', duration: 0.35 }, headless);
    } else if (slot === 'ULT') {
      for (const e of enemies) {
        if (dist(caster.x, caster.y, e.x, e.y) <= 210) {
          applyDamage(state, caster, e, 380 + stats.atk * 1.6, 'PHYSICAL', headless);
        }
      }
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 210, color: '#E11D48', duration: 0.7 }, headless);
    }
    return true;
  }

  if (id === 'ngu_long') {
    if (slot === 'S1') {
      const consumed = Math.min(3, caster.longKhi);
      caster.longKhi -= consumed;
      grantShield(state, caster, 240 + consumed * 45, 4.5, caster.uid, headless);
      applyStatusEffect(caster, { type: 'DEF_BUFF', sourceId: caster.uid, duration: 4.5, value: 35, stacks: 1 });
      applyStatusEffect(caster, { type: 'ASPD_BUFF', sourceId: caster.uid, duration: 4.5, value: 0.35, stacks: 1 });
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 70, color: '#3B82F6', duration: 0.45 }, headless);
    } else if (slot === 'S2' && nearestEnemy) {
      caster.x = clamp(nearestEnemy.x - 38, 55, ARENA_W - 55);
      caster.y = nearestEnemy.y;
      caster.longKhi = Math.min(10, caster.longKhi + 2);
      applyDamage(state, caster, nearestEnemy, 185 + stats.atk * 1.0, 'PHYSICAL', headless);
      const angle = Math.atan2(nearestEnemy.y - caster.y, nearestEnemy.x - caster.x);
      nearestEnemy.x = clamp(nearestEnemy.x + Math.cos(angle) * 45, 55, ARENA_W - 55);
      spawnVfx(state, { kind: 'SLASH', x: nearestEnemy.x, y: nearestEnemy.y, radius: 52, color: '#FBBF24', duration: 0.3 }, headless);
    } else if (slot === 'ULT') {
      const stacks = caster.longKhi;
      caster.longKhi = 0;
      caster.nguLongEmpoweredTimer = 6;
      const dmg = 260 + stats.atk * 1.1 + stacks * 38;
      for (const e of enemies) {
        if (dist(caster.x, caster.y, e.x, e.y) <= 210) {
          applyDamage(state, caster, e, dmg, 'MAGIC', headless);
        }
      }
      spawnFloatingText(state, caster.x, caster.y - 24, `LONG KHÍ x${stacks}!`, '#38BDF8', 15, headless);
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 210, color: '#3B82F6', duration: 0.7 }, headless);
    }
    return true;
  }

  if (id === 'thien_thach_long') {
    const momBonus = 1 + caster.passiveStacks * 0.08;
    if (slot === 'S1' && nearestEnemy) {
      caster.x = clamp(nearestEnemy.x - 36, 55, ARENA_W - 55);
      caster.y = nearestEnemy.y;
      applyDamage(state, caster, nearestEnemy, (190 + stats.atk * 1.05) * momBonus, 'PHYSICAL', headless);
      grantShield(state, caster, 220, 4, caster.uid, headless);
      caster.passiveStacks = 0;
      spawnVfx(state, { kind: 'RING', x: caster.x, y: caster.y, radius: 60, color: '#F59E0B', duration: 0.35 }, headless);
    } else if (slot === 'S2' && cluster.target) {
      for (const e of enemies) {
        if (dist(cluster.x, cluster.y, e.x, e.y) <= 130) {
          applyDamage(state, caster, e, 180 + stats.matk * 0.95, 'MAGIC', headless);
          applyStatusEffect(e, { type: 'STUN', sourceId: caster.uid, duration: 1, value: 1, stacks: 1 });
        }
      }
      spawnVfx(
        state,
        { kind: 'METEOR', x: cluster.x, y: cluster.y, radius: 130, color: '#F59E0B', duration: 0.5 },
        headless
      );
    } else if (slot === 'ULT' && cluster.target) {
      caster.x = cluster.x;
      caster.y = cluster.y;
      for (const e of enemies) {
        if (dist(cluster.x, cluster.y, e.x, e.y) <= 215) {
          applyDamage(state, caster, e, 340 + stats.atk * 1.45, 'PHYSICAL', headless);
          applyStatusEffect(e, { type: 'STUN', sourceId: caster.uid, duration: 1.4, value: 1, stacks: 1 });
        }
      }
      spawnVfx(
        state,
        { kind: 'METEOR', x: cluster.x, y: cluster.y, radius: 215, color: '#F59E0B', duration: 0.75 },
        headless
      );
    }
    return true;
  }

  return false;
}

export const GEM_CONFIG: Record<
  GemType,
  {
    name: string;
    cost: number;
    maxLv: number;
    color: string;
    shortDesc: string;
  }
> = {
  ATK: {
    name: 'Ngọc Cuồng Nộ',
    cost: 1,
    maxLv: 3,
    color: '#F43F5E',
    shortDesc: '+18% ATK & MATK vĩnh viễn',
  },
  DEF: {
    name: 'Ngọc Hộ Mệnh',
    cost: 1,
    maxLv: 3,
    color: '#F59E0B',
    shortDesc: '+22% DEF/MDEF & +450 Khiên',
  },
  SPD: {
    name: 'Ngọc Thần Tốc',
    cost: 1,
    maxLv: 3,
    color: '#38BDF8',
    shortDesc: '+20% ASPD, +15% SPD & Hồi S1/S2',
  },
  HP: {
    name: 'Ngọc Huyết Mạch',
    cost: 2,
    maxLv: 3,
    color: '#10B981',
    shortDesc: '+22% Max HP & Hồi 30% HP',
  },
  ULT: {
    name: 'Ngọc Long Hồn',
    cost: 2,
    maxLv: 1,
    color: '#A855F7',
    shortDesc: 'Đầy 100% Năng lượng & +30% Tuyệt kỹ',
  },
};

export function applyGemUpgrade(
  state: BattleState,
  dragonUid: string,
  gemType: GemType,
  headless = false
): boolean {
  const dragon = state.dragons.find(
    (d) => d.uid === dragonUid && d.team === 'PLAYER' && d.isAlive && d.isDeployed && !d.isClone
  );
  if (!dragon) return false;

  const cfg = GEM_CONFIG[gemType];
  if (state.playerGems < cfg.cost) return false;

  if (gemType === 'ATK') {
    if (dragon.gemAtkLv >= cfg.maxLv) return false;
    dragon.gemAtkLv += 1;
  } else if (gemType === 'DEF') {
    if (dragon.gemDefLv >= cfg.maxLv) return false;
    dragon.gemDefLv += 1;
    grantShield(state, dragon, 450, 6, dragon.uid, headless);
  } else if (gemType === 'SPD') {
    if (dragon.gemSpdLv >= cfg.maxLv) return false;
    dragon.gemSpdLv += 1;
    dragon.s1Cd = 0;
    dragon.s2Cd = 0;
  } else if (gemType === 'HP') {
    if (dragon.gemHpLv >= cfg.maxLv) return false;
    dragon.gemHpLv += 1;
    const bonusHp = Math.round(dragon.def.stats.hp * 0.22);
    dragon.maxHp += bonusHp;
    const healAmt = Math.round(dragon.maxHp * 0.3);
    dragon.hp = Math.min(dragon.maxHp, dragon.hp + bonusHp + healAmt);
    spawnFloatingText(state, dragon.x, dragon.y, `+${healAmt + bonusHp} HP`, '#34D399', 14, headless);
  } else if (gemType === 'ULT') {
    if (dragon.energy >= dragon.maxEnergy && dragon.gemUltEmpowered) return false;
    dragon.energy = dragon.maxEnergy;
    dragon.gemUltEmpowered = true;
  }

  state.playerGems -= cfg.cost;
  addLog(
    state,
    'GEM',
    `Khảm ${cfg.name} cho ${dragon.def.name} (-${cfg.cost} Ngọc).`,
    'PLAYER',
    dragon.def.name
  );

  if (!headless) {
    soundFX.playSkill();
    spawnFloatingText(state, dragon.x, dragon.y - 26, cfg.name, cfg.color, 14, headless);
    spawnVfx(
      state,
      { kind: 'RING', x: dragon.x, y: dragon.y, radius: 72, color: cfg.color, duration: 0.55 },
      headless
    );
  }

  return true;
}

