// The HUD and the menus, drawn in screen space over the world: money and health
// top-left, wanted stars top-right, the objective banner top-centre, the minimap
// bottom-right, the message feed bottom-left, and the title, pause and end
// screens. Nothing here touches the simulation.

import { FONT, PALETTE, STORY } from './config.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function drawStars(ctx, x, y, wanted) {
  ctx.font = '22px ' + FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < wanted ? PALETTE.gold : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 26, y);
  }
}

function drawMinimap(ctx, G, x, y, size) {
  const city = G.city;
  const scale = size / city.w;
  const mapH = city.h * scale;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, mapH, 8);
  ctx.clip();
  ctx.fillStyle = PALETTE.grassDark;
  ctx.fillRect(x, y, size, mapH);
  // Water and beach along the south edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x, y + city.beachY * scale, size, (city.waterY - city.beachY) * scale);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x, y + city.waterY * scale, size, (city.h - city.waterY) * scale);
  // Roads.
  ctx.strokeStyle = 'rgba(20,20,26,0.85)';
  ctx.lineWidth = Math.max(2, 70 * scale * 0.55);
  for (const line of city.vLines) {
    ctx.beginPath();
    ctx.moveTo(x + line * scale, y);
    ctx.lineTo(x + line * scale, y + city.cityH * scale);
    ctx.stroke();
  }
  for (const line of city.hLines) {
    ctx.beginPath();
    ctx.moveTo(x, y + line * scale);
    ctx.lineTo(x + size, y + line * scale);
    ctx.stroke();
  }
  // Landmarks.
  ctx.fillStyle = PALETTE.gold;
  for (const spot of [city.garage, city.bank, city.safehouse]) {
    ctx.beginPath();
    ctx.arc(x + spot.x * scale, y + spot.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker, pulsing.
  const obj = G.objective;
  if (obj && obj.target) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(x + obj.target.x * scale, y + obj.target.y * scale, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#ff4d4d';
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + G.player.x * scale, y + G.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, size, mapH, 8);
  ctx.stroke();
}

function drawObjective(ctx, G, view) {
  const obj = G.objective;
  if (!obj) return;
  const w = Math.min(560, view.w - 40);
  const x = (view.w - w) / 2;
  const y = 12;
  panel(ctx, x, y, w, 54);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 15px ' + FONT;
  const mission = G.mission.index < 5 ? `Job ${G.mission.index + 1}/5 — ` : '';
  ctx.fillText(mission + obj.text, view.w / 2, y + 17);
  // Compass arrow toward the marker, or the timer / progress bar.
  if (obj.target) {
    const dx = obj.target.x - G.player.x;
    const dy = obj.target.y - G.player.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) - G.player.angle;
    const ax = view.w / 2;
    const ay = y + 42;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px ' + FONT;
    ctx.fillText(`${Math.round(dist)} m`, view.w / 2 + 28, y + 42);
    if (obj.timer > 0) {
      ctx.fillStyle = obj.timer < 15 ? PALETTE.danger : PALETTE.hudMuted;
      ctx.font = 'bold 12px ' + FONT;
      ctx.fillText(`${Math.ceil(obj.timer)}s`, view.w / 2 + 78, y + 42);
    }
  } else if (obj.timer > 0) {
    ctx.fillStyle = obj.timer < 15 ? PALETTE.danger : PALETTE.hudMuted;
    ctx.font = 'bold 14px ' + FONT;
    ctx.fillText(`${Math.ceil(obj.timer)}s left`, view.w / 2, y + 42);
  } else if (obj.progress > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + 24, y + 38, w - 48, 6);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(x + 24, y + 38, (w - 48) * Math.min(1, obj.progress), 6);
  }
}

function drawFeed(ctx, G, view) {
  const now = G.time;
  const lines = G.feed.filter((m) => now - m.t < 7).slice(-4);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '13px ' + FONT;
  let y = view.h - 24 - lines.length * 20;
  for (const line of lines) {
    const age = now - line.t;
    ctx.globalAlpha = age > 5 ? Math.max(0, 1 - (age - 5) / 2) : 1;
    const w = ctx.measureText(line.text).width + 16;
    panel(ctx, 12, y, Math.min(w, view.w - 24), 18);
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(line.text, 20, y + 3);
    y += 20;
  }
  ctx.globalAlpha = 1;
}

/** The whole in-play HUD. */
export function drawHUD(ctx, G, view) {
  // Money and health, top-left.
  panel(ctx, 12, 12, 210, 58);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText(`$${Math.floor(G.money).toLocaleString('en-US')}`, 24, 30);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px ' + FONT;
  ctx.fillText(G.player.onFoot ? 'On foot' : `Driving — ${G.player.car ? G.player.car.type : ''}`, 24, 52);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(120, 44, 78, 9);
  ctx.fillStyle = G.player.health > 30 ? PALETTE.ok : PALETTE.danger;
  ctx.fillRect(120, 44, 78 * Math.max(0, G.player.health / 100), 9);

  // Wanted stars, top-right.
  panel(ctx, view.w - 232, 12, 220, 34);
  drawStars(ctx, view.w - 220, 30, G.wanted);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px ' + FONT;
  ctx.textAlign = 'right';
  ctx.fillText(G.wanted === 0 ? 'Clean' : 'WANTED', view.w - 24, 30);
  ctx.textAlign = 'left';

  drawObjective(ctx, G, view);

  // Speed, bottom-centre, while driving.
  if (!G.player.onFoot && G.player.car) {
    const mph = Math.round(Math.abs(G.player.car.speed) * 0.12);
    panel(ctx, view.w / 2 - 52, view.h - 52, 104, 36);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`${mph} mph`, view.w / 2, view.h - 34);
    ctx.textAlign = 'left';
    // Car health under the speed.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(view.w / 2 - 40, view.h - 22, 80, 5);
    ctx.fillStyle = G.player.car.health > 30 ? PALETTE.ok : PALETTE.danger;
    ctx.fillRect(view.w / 2 - 40, view.h - 22, 80 * Math.max(0, G.player.car.health / 100), 5);
  }

  drawMinimap(ctx, G, view.w - 202, view.h - 212, 190);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '11px ' + FONT;
  ctx.textAlign = 'right';
  ctx.fillText('SOLMAR CITY', view.w - 14, view.h - 216);
  ctx.textAlign = 'left';

  drawFeed(ctx, G, view);

  // Controls hint, bottom-left, small.
  ctx.fillStyle = 'rgba(244,246,248,0.6)';
  ctx.font = '12px ' + FONT;
  ctx.fillText('WASD drive / walk · Shift run · Space punch · E enter car · P pause · M mute', 14, view.h - 8);
}

function dim(ctx, view) {
  ctx.fillStyle = 'rgba(8, 12, 20, 0.62)';
  ctx.fillRect(0, 0, view.w, view.h);
}

/** The start screen: title, story, controls, Continue / New Game. */
export function drawTitle(ctx, G, view) {
  dim(ctx, view);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 64px ' + FONT;
  ctx.fillText('SOLMAR CITY', view.w / 2, view.h / 2 - 128);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '18px ' + FONT;
  ctx.fillText('An open-world crime story in the spirit of the greats — built from scratch.', view.w / 2, view.h / 2 - 92);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '15px ' + FONT;
  const blurb = STORY.blurb;
  ctx.fillText(blurb.slice(0, 92), view.w / 2, view.h / 2 - 58);
  ctx.fillText(blurb.slice(92), view.w / 2, view.h / 2 - 36);

  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '15px ' + FONT;
  ctx.fillText('WASD / arrows — move & drive · Shift — run · Space — punch · E — steal / exit car', view.w / 2, view.h / 2 + 6);
  ctx.fillText('Steal cars, lose the cops, run five jobs, and take the big score.', view.w / 2, view.h / 2 + 30);

  const hasSave = G.save && G.save.missionsDone > 0;
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillStyle = PALETTE.gold;
  if (hasSave) {
    ctx.fillText(`Press ENTER — Continue (Job ${G.save.missionsDone + 1}/5, $${G.save.money})`, view.w / 2, view.h / 2 + 78);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '14px ' + FONT;
    ctx.fillText('Press N — New game', view.w / 2, view.h / 2 + 104);
  } else {
    ctx.fillText('Press ENTER or click — New game', view.w / 2, view.h / 2 + 78);
  }
  ctx.textAlign = 'left';
}

/** The pause overlay. */
export function drawPause(ctx, view) {
  dim(ctx, view);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 10);
  ctx.font = '16px ' + FONT;
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.fillText('Press P or Esc to keep playing · M to mute', view.w / 2, view.h / 2 + 28);
  ctx.textAlign = 'left';
}

/** Busted or wasted: the reason, the cost, and how to retry. */
export function drawEnd(ctx, G, view, kind) {
  dim(ctx, view);
  ctx.textAlign = 'center';
  if (kind === 'busted') {
    ctx.fillStyle = '#7fb2ff';
    ctx.font = 'bold 56px ' + FONT;
    ctx.fillText('BUSTED', view.w / 2, view.h / 2 - 40);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '17px ' + FONT;
    ctx.fillText('The Solmar police hauled you in. They took their cut and let you go.', view.w / 2, view.h / 2 + 4);
  } else {
    ctx.fillStyle = PALETTE.danger;
    ctx.font = 'bold 56px ' + FONT;
    ctx.fillText('WASTED', view.w / 2, view.h / 2 - 40);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '17px ' + FONT;
    ctx.fillText('You woke up in St. Marina Hospital, lighter by a hospital bill.', view.w / 2, view.h / 2 + 4);
  }
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillText('Press ENTER — back on the streets', view.w / 2, view.h / 2 + 52);
  ctx.textAlign = 'left';
}
