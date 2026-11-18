// The renderer: a camera that follows the player over Solmar City, then the
// world (water, beach, roads, parks, buildings, pier, stadium, port), the cars,
// the pedestrians, the officers, the effects, and finally the HUD. All drawing
// is canvas 2D; the only images are the ones this code paints.

import { CAR_TYPES, FONT, PALETTE, WORLD } from './config.js';
import { drawEnd, drawHUD, drawPause, drawTitle } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function viewSize() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function drawRoads(G) {
    const city = G.city;
    // Sidewalks first, then asphalt, so the road reads as a band with curbs.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const line of city.vLines) {
      ctx.fillRect(line - WORLD.road / 2 - 8, 0, WORLD.road + 16, city.cityH);
    }
    for (const line of city.hLines) {
      ctx.fillRect(0, line - WORLD.road / 2 - 8, city.w, WORLD.road + 16);
    }
    ctx.fillStyle = PALETTE.road;
    for (const line of city.vLines) {
      ctx.fillRect(line - WORLD.road / 2, 0, WORLD.road, city.cityH);
    }
    for (const line of city.hLines) {
      ctx.fillRect(0, line - WORLD.road / 2, city.w, WORLD.road);
    }
    // Centre dashes.
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (const line of city.vLines) {
      ctx.moveTo(line, 0);
      ctx.lineTo(line, city.cityH);
    }
    for (const line of city.hLines) {
      ctx.moveTo(0, line);
      ctx.lineTo(city.w, line);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawParks(G) {
    for (const park of G.city.parks) {
      ctx.fillStyle = '#5d8f43';
      ctx.fillRect(park.x - 6, park.y - 6, park.w + 12, park.h + 12);
      ctx.fillStyle = '#79a75c';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      for (const tree of park.trees) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.arc(tree.x + 3, tree.y + 4, tree.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tree.color;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBuildings(G, viewRect) {
    for (const b of G.city.buildings) {
      if (b.x > viewRect.x2 || b.x + b.w < viewRect.x1 || b.y > viewRect.y2 || b.y + b.h < viewRect.y1) continue;
      // Drop shadow, then the wall, then the roof with its details.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 12, b.y + 12, Math.min(26, b.w - 24), 10);
      if (b.bank) {
        ctx.fillStyle = PALETTE.gold;
        ctx.font = 'bold 15px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('$ BANK $', b.x + b.w / 2, b.y + b.h / 2 + 5);
        ctx.textAlign = 'left';
      }
      if (b.safehouse) {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y - 16, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('H', b.x + b.w / 2, b.y - 12);
        ctx.textAlign = 'left';
      }
    }
  }

  function drawStadiumAndPort(G) {
    const s = G.city.stadium;
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(s.x - 4, s.y - 4, s.w + 8, s.h + 8);
    ctx.fillStyle = PALETTE.stadium;
    ctx.beginPath();
    ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2 - 8, s.h / 2 - 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2 - 30, s.h / 2 - 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.x + s.w / 2 - 30, s.y + s.h / 2);
    ctx.lineTo(s.x + s.w / 2 + 30, s.y + s.h / 2);
    ctx.stroke();
    for (const c of G.city.containers) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(c.x + 3, c.y + 3, c.w, c.h);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    }
  }

  function drawPier(G) {
    const pier = G.city.pier;
    ctx.fillStyle = PALETTE.pier;
    ctx.fillRect(pier.x - pier.w / 2, pier.y0, pier.w, pier.y1 - pier.y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let y = pier.y0 + 14; y < pier.y1; y += 22) {
      ctx.beginPath();
      ctx.moveTo(pier.x - pier.w / 2, y);
      ctx.lineTo(pier.x + pier.w / 2, y);
      ctx.stroke();
    }
    // A couple of moored boats.
    ctx.fillStyle = '#e8e4da';
    ctx.beginPath();
    ctx.ellipse(pier.x - 44, pier.y1 - 40, 26, 10, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a6a9a';
    ctx.beginPath();
    ctx.ellipse(pier.x + 48, pier.y1 - 90, 22, 9, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMarker(G) {
    const obj = G.objective;
    if (!obj || !obj.target) return;
    const t = obj.target;
    const pulse = 1 + Math.sin(G.time * 5) * 0.18;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(t.x - 16, t.y - 220, 32, 220);
    ctx.restore();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 14px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#111111';
    ctx.fillText(t.label || '', t.x, t.y - 34);
    ctx.textAlign = 'left';
  }

  function drawCar(G, car) {
    const type = CAR_TYPES[car.type];
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 4, type.length / 2, type.width / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    const body = car.wrecked ? '#3a3a3a' : car.color;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-type.length / 2, -type.width / 2, type.length, type.width, 8);
    ctx.fill();
    // Roof and windshield.
    ctx.fillStyle = car.wrecked ? '#222222' : 'rgba(20,30,44,0.85)';
    ctx.beginPath();
    ctx.roundRect(-type.length / 2 + 12, -type.width / 2 + 5, type.length - 30, type.width - 10, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(type.length / 2 - 16, -type.width / 2 + 5, 4, type.width - 10);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#111111';
      ctx.fillRect(-6, -type.width / 2, 12, 6);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(-8, -type.width / 2 - 5, 16, 5);
    }
    if (car.type === 'police') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-type.length / 2 + 6, -type.width / 2, 14, type.width);
      const flash = Math.sin(G.time * 10) > 0;
      ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-4, -type.width / 2 - 2, 10, 6);
      ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(-4, type.width / 2 - 4, 10, 6);
    }
    if (car.driver === 'rival') {
      ctx.fillStyle = '#111111';
      ctx.fillRect(-type.length / 2, -3, type.length, 6);
    }
    // Headlights and taillights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(type.length / 2 - 2, -type.width / 2 + 3, 3, 5);
    ctx.fillRect(type.length / 2 - 2, type.width / 2 - 8, 3, 5);
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(-type.length / 2 - 1, -type.width / 2 + 3, 3, 5);
    ctx.fillRect(-type.length / 2 - 1, type.width / 2 - 8, 3, 5);
    ctx.restore();
    // A white ring marks the car the player is driving.
    if (car.driver === 'player') {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(car.x, car.y, type.length / 2 + 6, type.width / 2 + 8, car.angle, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(car.x, car.y - 6, 12 + Math.sin(G.time * 3) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(G, ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down) {
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 - 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCop(G, cop) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    if (cop.down) {
      ctx.rotate(cop.angle);
      ctx.fillStyle = PALETTE.policeBlue;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.policeBlue;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(Math.cos(cop.angle) * 6, Math.sin(cop.angle) * 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayerOnFoot(G) {
    const p = G.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(1, 4, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.playerJacket;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerPants;
    ctx.fillRect(-4, -6, 8, 12);
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(7, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Punch swoosh.
    if (p.punchT > 0.22) {
      ctx.strokeStyle = 'rgba(255,225,77,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(16, 0, 16, -0.9, 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(G) {
    for (const pt of G.particles) {
      const life = pt.t;
      if (pt.kind === 'punch') {
        ctx.strokeStyle = `rgba(255,225,77,${Math.min(1, life * 4)})`;
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + life;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x + Math.cos(a) * 18, pt.y + Math.sin(a) * 18);
          ctx.stroke();
        }
      } else if (pt.kind === 'spark') {
        ctx.fillStyle = `rgba(255,170,40,${Math.min(1, life * 3)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === 'smoke') {
        ctx.fillStyle = `rgba(90,90,90,${Math.min(0.5, life * 0.5)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y - (1.1 - life) * 30, 10 + (1.1 - life) * 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawWorld(G, view) {
    const city = G.city;
    const cam = G.camera;
    const base = Math.min(view.w / 1280, view.h / 720);
    const zoom = base * cam.zoom;
    const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
    const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
    ctx.save();
    ctx.translate(view.w / 2 + shakeX, view.h / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);

    const x1 = cam.x - view.w / 2 / zoom - 80;
    const x2 = cam.x + view.w / 2 / zoom + 80;
    const y1 = cam.y - view.h / 2 / zoom - 80;
    const y2 = cam.y + view.h / 2 / zoom + 80;
    const viewRect = { x1, x2, y1, y2 };

    // Ground: grass, then sand, then water.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x1, city.beachY, x2 - x1, city.waterY - city.beachY);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x1, city.waterY, x2 - x1, y2 - city.waterY);
    // Animated wave lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const wy = city.waterY + 40 + i * 48 + Math.sin(G.time * 1.2 + i * 2) * 6;
      ctx.beginPath();
      for (let x = Math.max(x1, 0); x < Math.min(x2, city.w); x += 60) {
        const yy = wy + Math.sin(x * 0.02 + G.time + i) * 4;
        if (x === Math.max(x1, 0)) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    drawRoads(G);
    drawParks(G);
    drawStadiumAndPort(G);
    drawPier(G);
    drawBuildings(G, viewRect);

    // Skid marks, faint and short.
    ctx.strokeStyle = 'rgba(20,20,20,0.28)';
    ctx.lineWidth = 3;
    for (const s of G.skid) {
      ctx.globalAlpha = Math.min(0.3, s.t);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
      ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    drawMarker(G);
    for (const car of G.cars) {
      if (car.x > x1 - 80 && car.x < x2 + 80 && car.y > y1 - 80 && car.y < y2 + 80) drawCar(G, car);
    }
    for (const ped of G.peds) {
      if (ped.x > x1 && ped.x < x2 && ped.y > y1 && ped.y < y2) drawPed(G, ped);
    }
    for (const cop of G.cops) {
      if (cop.x > x1 && cop.x < x2 && cop.y > y1 && cop.y < y2) drawCop(G, cop);
    }
    if (G.player.onFoot) drawPlayerOnFoot(G);
    drawParticles(G);
    ctx.restore();
  }

  function draw(G, screen) {
    const view = viewSize();
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, view.w, view.h);
    drawWorld(G, view);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHUD(ctx, G, view);
      if (screen === SCREEN_PAUSED) drawPause(ctx, view);
    } else if (screen === SCREEN_TITLE) {
      drawTitle(ctx, G, view);
    } else if (screen === SCREEN_BUSTED) {
      drawHUD(ctx, G, view);
      drawEnd(ctx, G, view, 'busted');
    } else if (screen === SCREEN_WASTED) {
      drawHUD(ctx, G, view);
      drawEnd(ctx, G, view, 'wasted');
    }
  }

  return { draw, viewSize };
}
