import { DRAGONS } from '../data/dragons';
import { BattleState, DragonClass, DragonInstance } from '../types/game';
import { ARENA_H, ARENA_W } from './skillEngine';

const imageCache: Record<string, HTMLImageElement> = {};

export function preloadDragonImages() {
  for (const d of DRAGONS) {
    if (!imageCache[d.image]) {
      const img = new Image();
      img.src = d.image;
      imageCache[d.image] = img;
    }
  }
}

const CLASS_SHORT_SYMBOL: Record<DragonClass, string> = {
  GUARDIAN: 'HV',
  MAGE: 'PS',
  ASSASSIN: 'ST',
  SUPPORT: 'HT',
  WARRIOR: 'CB',
};

export interface RenderOptions {
  selectedUid: string | null;
  showFloatingText: boolean;
  timeNow: number;
  hoverPos: { x: number; y: number } | null;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  flipX = false
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const targetRatio = dw / dh;
  const imgRatio = iw / ih;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;

  if (imgRatio > targetRatio) {
    sw = ih * targetRatio;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / targetRatio;
    sy = Math.max(0, (ih - sh) * 0.15); // Bias toward top/head of dragon artwork
  }

  ctx.save();
  if (flipX) {
    ctx.translate(dx + dw / 2, dy + dh / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();
}

export function renderBattlefield(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  opts: RenderOptions
) {
  ctx.save();
  ctx.clearRect(0, 0, ARENA_W, ARENA_H);

  // 1. Arena Background: Deep Obsidian Fantasy Battleground
  const bgGrad = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  bgGrad.addColorStop(0, '#070B12');
  bgGrad.addColorStop(0.32, '#101827');
  bgGrad.addColorStop(1, '#090D16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Left & Right Bastion Ambient Glows + Runic Circles
  const leftGlow = ctx.createRadialGradient(210, ARENA_H / 2 + 20, 30, 210, ARENA_H / 2 + 20, 440);
  leftGlow.addColorStop(0, 'rgba(16, 185, 129, 0.14)');
  leftGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, ARENA_W / 2, ARENA_H);

  const rightGlow = ctx.createRadialGradient(ARENA_W - 210, ARENA_H / 2 + 20, 30, ARENA_W - 210, ARENA_H / 2 + 20, 440);
  rightGlow.addColorStop(0, 'rgba(239, 68, 68, 0.14)');
  rightGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(ARENA_W / 2, 0, ARENA_W / 2, ARENA_H);

  // Subtle Runic Floor Rings
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 168, 67, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(ARENA_W / 2, ARENA_H / 2 + 20, 175, 115, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(ARENA_W / 2, ARENA_H / 2 + 20, 95, 62, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Perspective Tactical Floor Grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.055)';
  ctx.lineWidth = 1;
  for (let x = 60; x < ARENA_W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 55);
    ctx.lineTo(x, ARENA_H - 25);
    ctx.stroke();
  }
  for (let y = 70; y < ARENA_H - 20; y += 55) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(ARENA_W - 40, y);
    ctx.stroke();
  }

  // Center Clash Line
  ctx.strokeStyle = 'rgba(212, 168, 67, 0.22)';
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(ARENA_W / 2, 50);
  ctx.lineTo(ARENA_W / 2, ARENA_H - 30);
  ctx.stroke();
  ctx.setLineDash([]);

  // Ambient Floating Embers
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const px = ((i * 173 + opts.timeNow * (12 + (i % 4) * 5)) % (ARENA_W - 80)) + 40;
    const py = ((i * 97 - opts.timeNow * (10 + (i % 3) * 4)) % (ARENA_H - 80) + (ARENA_H - 80)) % (ARENA_H - 80) + 40;
    ctx.globalAlpha = 0.16 + 0.12 * Math.sin(opts.timeNow * 2 + i);
    ctx.fillStyle = i % 2 === 0 ? '#FBBF24' : '#38BDF8';
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Deployment Overlay if Player is placing 5 reserves
  if (state.phase === 'DEPLOYING_10V10') {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.09)';
    ctx.fillRect(45, 65, ARENA_W * 0.44, ARENA_H - 105);
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(45, 65, ARENA_W * 0.44, ARENA_H - 105);
    ctx.setLineDash([]);

    if (opts.hoverPos && opts.hoverPos.x <= ARENA_W * 0.48) {
      drawRoundedRectPath(ctx, opts.hoverPos.x - 28, opts.hoverPos.y - 38, 56, 76, 8);
      ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // 2. Ground Zones
  for (const z of state.zones) {
    const alpha = Math.min(1, z.duration / 0.8) * 0.28;
    ctx.save();
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
    ctx.fillStyle = z.color;
    ctx.globalAlpha = alpha;
    ctx.fill();

    ctx.globalAlpha = Math.min(1, z.duration / 0.8) * 0.72;
    ctx.strokeStyle = z.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 4]);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Sort Dragons by Y for clean 2.5D depth overlap
  const visibleDragons = state.dragons
    .filter((d) => d.isDeployed && (d.isAlive || d.anim.timer > 0))
    .sort((a, b) => a.y - b.y);

  for (const d of visibleDragons) {
    drawDragonUnit(ctx, d, opts, state);
  }

  // 4. Projectiles
  for (const p of state.projectiles) {
    ctx.save();
    if (p.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.radius * 0.75;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  // 5. VFX
  for (const v of state.vfx) {
    const progress = 1 - v.duration / v.maxDuration;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    if (v.kind === 'RING' || v.kind === 'KILL_BURST') {
      const r = v.radius * (0.35 + progress * 0.75);
      ctx.beginPath();
      ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = v.color;
      ctx.lineWidth = v.kind === 'KILL_BURST' ? 5 : 3;
      ctx.stroke();
      if (v.kind === 'KILL_BURST') {
        ctx.beginPath();
        ctx.arc(v.x, v.y, r * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (v.kind === 'SLASH') {
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
    } else if (v.kind === 'LIGHTNING' && v.x2 !== undefined && v.y2 !== undefined) {
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      const midX = (v.x + v.x2) / 2 + (Math.random() - 0.5) * 26;
      const midY = (v.y + v.y2) / 2 + (Math.random() - 0.5) * 26;
      ctx.lineTo(midX, midY);
      ctx.lineTo(v.x2, v.y2);
      ctx.stroke();
    } else if (v.kind === 'METEOR') {
      const dropY = v.y - (1 - progress) * 160;
      ctx.beginPath();
      ctx.arc(v.x, dropY, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#F97316';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius * progress, 0, Math.PI * 2);
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 6. Floating Damage / Heal Text
  if (opts.showFloatingText) {
    for (const ft of state.floatingTexts) {
      const alpha = Math.min(1, ft.duration / (ft.maxDuration * 0.4));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${ft.size}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  // 7. Ultimate Cut-In Original Portrait Banner
  if (state.ultCutIn) {
    const cut = state.ultCutIn;
    const fade = Math.min(1, cut.timer / 0.35);
    const isLeft = cut.team === 'PLAYER';
    const cardW = 112;
    const cardH = 152;
    const cx = isLeft ? 18 : ARENA_W - cardW - 18;
    const cy = 18;

    ctx.save();
    ctx.globalAlpha = fade * 0.96;

    // Glow backdrop
    ctx.shadowColor = cut.accentColor;
    ctx.shadowBlur = 18;
    drawRoundedRectPath(ctx, cx, cy, cardW, cardH, 10);
    ctx.fillStyle = '#0B0E14';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Portrait Art
    ctx.save();
    drawRoundedRectPath(ctx, cx, cy, cardW, cardH, 10);
    ctx.clip();
    const img = imageCache[cut.image];
    if (img && img.complete && img.naturalWidth > 0) {
      drawImageCover(ctx, img, cx, cy, cardW, cardH, !isLeft);
    }
    const scrim = ctx.createLinearGradient(cx, cy + cardH * 0.45, cx, cy + cardH);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(cx, cy, cardW, cardH);
    ctx.restore();

    drawRoundedRectPath(ctx, cx, cy, cardW, cardH, 10);
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#FDE047';
    ctx.textAlign = 'center';
    ctx.fillText('TUYỆT KỸ', cx + cardW / 2, cy + cardH - 26);
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(cut.skillName, cx + cardW / 2, cy + cardH - 12);

    ctx.restore();
  }

  ctx.restore();
}

function drawDragonUnit(
  ctx: CanvasRenderingContext2D,
  d: DragonInstance,
  opts: RenderOptions,
  state: BattleState
) {
  ctx.save();

  // Independent Animation Transforms (visual only)
  const bob =
    d.anim.type === 'idle'
      ? Math.sin(opts.timeNow * 3.1 + d.x * 0.05) * 3
      : d.anim.type === 'move'
      ? Math.sin(opts.timeNow * 10 + d.x * 0.1) * 4
      : 0;
  const tilt =
    d.anim.type === 'attack'
      ? d.anim.facing * 0.09
      : d.anim.type === 'move'
      ? d.anim.facing * 0.035
      : 0;
  const skillScale = d.anim.type === 'skill' ? 1.08 : 1;
  const scaleDeath = !d.isAlive ? Math.max(0.2, d.anim.timer / 0.5) : 1;
  const alpha = !d.isAlive
    ? Math.max(0, d.anim.timer / 0.5)
    : d.effects.some((e) => e.type === 'STEALTH')
    ? 0.42
    : d.isClone
    ? 0.78
    : 1;

  const drawX = d.x + d.anim.lungeX;
  const drawY = d.y + d.anim.lungeY + bob;

  const cardW = d.isClone ? 44 : 58;
  const cardH = d.isClone ? 60 : 78;
  const totalGemLevels = d.gemAtkLv + d.gemDefLv + d.gemSpdLv + d.gemHpLv;

  ctx.globalAlpha = alpha;

  // Ground Shadow
  ctx.beginPath();
  ctx.ellipse(d.x, d.y + cardH / 2 + 4, cardW * 0.55, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fill();

  // Elemental Glow / Gem Aura beneath card
  if (d.isAlive) {
    const auraRadius = totalGemLevels > 0 || d.gemUltEmpowered ? 46 : 36;
    const aura = ctx.createRadialGradient(drawX, drawY, 10, drawX, drawY, auraRadius);
    aura.addColorStop(0, `${d.def.accentColor}44`);
    aura.addColorStop(1, `${d.def.accentColor}00`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(drawX, drawY, auraRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kill Spotlight Ring
  if (d.anim.killSpotlightTimer > 0) {
    drawRoundedRectPath(
      ctx,
      drawX - cardW / 2 - 7,
      drawY - cardH / 2 - 7,
      cardW + 14,
      cardH + 14,
      12
    );
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Selected Highlight Frame
  if (opts.selectedUid === d.uid) {
    drawRoundedRectPath(
      ctx,
      drawX - cardW / 2 - 6,
      drawY - cardH / 2 - 6,
      cardW + 12,
      cardH + 12,
      11
    );
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Manual Priority Target Marker
  const isPriorityTarget = state.dragons.some(
    (p) => p.team === 'PLAYER' && p.isAlive && p.priorityTargetUid === d.uid
  );
  if (isPriorityTarget && d.team === 'AI') {
    drawRoundedRectPath(
      ctx,
      drawX - cardW / 2 - 7,
      drawY - cardH / 2 - 7,
      cardW + 14,
      cardH + 14,
      12
    );
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  // Draw Tall Framed Dragon Artwork Card
  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate(tilt);
  ctx.scale(scaleDeath * skillScale, scaleDeath * skillScale);

  const rx = -cardW / 2;
  const ry = -cardH / 2;

  // Clip & Render Original Dragon Portrait Artwork
  ctx.save();
  drawRoundedRectPath(ctx, rx, ry, cardW, cardH, 8);
  ctx.clip();

  const img = imageCache[d.def.image];
  if (img && img.complete && img.naturalWidth > 0) {
    drawImageCover(ctx, img, rx, ry, cardW, cardH, d.anim.facing === -1);
  } else {
    ctx.fillStyle = d.def.accentColor;
    ctx.fillRect(rx, ry, cardW, cardH);
  }

  // Bottom Scrim inside card for clean nameplate legibility
  const innerScrim = ctx.createLinearGradient(0, ry + cardH * 0.55, 0, ry + cardH);
  innerScrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  innerScrim.addColorStop(1, 'rgba(5, 8, 15, 0.92)');
  ctx.fillStyle = innerScrim;
  ctx.fillRect(rx, ry, cardW, cardH);

  // Hit Flash Overlay
  if (d.anim.hitFlash > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(rx, ry, cardW, cardH);
  }

  // Dragon Name inside bottom of card
  ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = d.team === 'PLAYER' ? '#F8FAFC' : '#FECACA';
  ctx.fillText(d.isClone ? `${d.def.name} (Ảnh)` : d.def.name, 0, ry + cardH - 3);
  ctx.restore();

  // Outer Card Border Frame
  drawRoundedRectPath(ctx, rx, ry, cardW, cardH, 8);
  ctx.strokeStyle =
    d.gemUltEmpowered
      ? '#C084FC'
      : d.team === 'PLAYER'
      ? d.isClone
        ? '#6EE7B7'
        : '#10B981'
      : d.isClone
      ? '#FCA5A5'
      : '#EF4444';
  ctx.lineWidth = totalGemLevels > 0 || d.gemUltEmpowered ? 2.8 : 2.2;
  ctx.stroke();

  // Inner subtle gold hairline for upgraded or active units
  if (totalGemLevels > 0 || d.anim.type === 'skill') {
    drawRoundedRectPath(ctx, rx + 2, ry + 2, cardW - 4, cardH - 4, 6);
    ctx.strokeStyle = d.anim.type === 'skill' ? d.def.accentColor : 'rgba(250, 204, 21, 0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Class Badge at top-left corner of card
  ctx.fillStyle = 'rgba(11, 14, 20, 0.9)';
  ctx.beginPath();
  ctx.arc(rx + 9, ry + 9, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = d.def.accentColor;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.font = '700 7.5px "JetBrains Mono", monospace';
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(CLASS_SHORT_SYMBOL[d.def.dragonClass], rx + 9, ry + 9.5);

  // Gem Socket Indicators at top-right corner of card
  if (totalGemLevels > 0 || d.gemUltEmpowered) {
    const gemColors: string[] = [];
    if (d.gemAtkLv > 0) gemColors.push('#F43F5E');
    if (d.gemDefLv > 0) gemColors.push('#F59E0B');
    if (d.gemSpdLv > 0) gemColors.push('#38BDF8');
    if (d.gemHpLv > 0) gemColors.push('#10B981');
    if (d.gemUltEmpowered) gemColors.push('#A855F7');

    gemColors.forEach((col, idx) => {
      const gx = rx + cardW - 7;
      const gy = ry + 7 + idx * 8;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(gx, gy - 3.5);
      ctx.lineTo(gx + 3.5, gy);
      ctx.lineTo(gx, gy + 3.5);
      ctx.lineTo(gx - 3.5, gy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });
  }

  ctx.restore();

  if (!d.isAlive) {
    ctx.restore();
    return;
  }

  // Overhead HP + Shield + Energy Bars above card
  const barW = cardW + 4;
  const barX = drawX - barW / 2;
  const barY = drawY - cardH / 2 - 13;

  ctx.fillStyle = 'rgba(11, 14, 20, 0.92)';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, 10);

  const hpPct = Math.max(0, Math.min(1, d.hp / d.maxHp));
  ctx.fillStyle = d.team === 'PLAYER' ? '#10B981' : '#EF4444';
  ctx.fillRect(barX, barY, barW * hpPct, 5);

  if (d.shield > 0) {
    const shPct = Math.min(1, d.shield / d.maxHp);
    ctx.fillStyle = '#FDE047';
    ctx.fillRect(barX, barY, barW * shPct, 2.5);
  }

  const enPct = Math.max(0, Math.min(1, d.energy / d.maxEnergy));
  ctx.fillStyle = enPct >= 1 ? '#FACC15' : '#38BDF8';
  ctx.fillRect(barX, barY + 6, barW * enPct, 2.5);

  // Status Indicator Text below card
  const statusFlags: string[] = [];
  if (d.effects.some((e) => e.type === 'STUN')) statusFlags.push('CHOÁNG');
  else if (d.effects.some((e) => e.type === 'ROOT')) statusFlags.push('TRÓI');
  if (d.effects.some((e) => e.type === 'BURN')) statusFlags.push('BỎNG');
  if (d.effects.some((e) => e.type === 'POISON')) statusFlags.push('ĐỘC');
  if (d.effects.some((e) => e.type === 'CC_IMMUNE')) statusFlags.push('MIỄN CC');
  if (d.defId === 'ngu_long' && d.longKhi > 0) statusFlags.push(`LK:${d.longKhi}`);

  if (statusFlags.length > 0) {
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(statusFlags.slice(0, 2).join(' · '), drawX, drawY + cardH / 2 + 5);
  }

  ctx.restore();
}
