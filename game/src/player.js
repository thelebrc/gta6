// The player, on foot and behind the wheel: walking and running with collision,
// arcade car physics (accelerate, steer, drift, bounce off buildings), stealing
// cars, and punching. It returns what happened as events; the main loop routes
// them to the wanted system and the missions, so this file knows no police.

import { CAR, CAR_TYPES, PLAYER } from './config.js';
import { isWater, resolveCircle } from './world.js';

export function createPlayer(city) {
  return {
    x: city.spawn.x,
    y: city.spawn.y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    onFoot: true,
    car: null,
    punchT: 0,
    invuln: 0,
    hurtT: 99,
    speed: 0,
  };
}

function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    const d = Math.hypot(dx, dy);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function carRadius(car) {
  const type = CAR_TYPES[car.type];
  return type.width / 2 + 2;
}

/** Drive one car one step; returns true when it hit something hard. */
export function driveCar(G, car, dir, dt) {
  const type = CAR_TYPES[car.type];
  const top = type.topSpeed;

  if (dir.y < 0) car.speed += type.accel * dt;
  else if (dir.y > 0) {
    car.speed -= (car.speed > 30 ? CAR.brake : type.accel * 0.55) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(top, car.speed));

  const steerAuthority = Math.min(1, 0.25 + Math.abs(car.speed) / 220);
  car.angle += dir.x * CAR.steerRate * steerAuthority * Math.sign(car.speed || 1) * dt;

  // A little lateral slide when steering hard at speed: the drift feel.
  const slide = dir.x * Math.abs(car.speed) * 0.16 * steerAuthority;
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  const px = -ny;
  const py = nx;
  car.x += (nx * car.speed + px * slide) * dt;
  car.y += (ny * car.speed + py * slide) * dt;

  if (Math.abs(car.speed) > 420 && dir.x !== 0) {
    G.skid.push({ x: car.x - nx * 18, y: car.y - ny * 18, angle: car.angle, t: 0.9 });
    if (G.skid.length > 120) G.skid.shift();
  }

  const before = { x: car.x, y: car.y };
  const hitWall = resolveCircle(G.city, car, carRadius(car));
  if (hitWall) {
    const impact = Math.abs(car.speed);
    if (impact > 260) {
      car.speed *= -0.32;
      car.health -= (impact - 260) / 11;
      car.x = before.x;
      car.y = before.y;
      resolveCircle(G.city, car, carRadius(car));
      return { hard: true, impact };
    }
    // A soft scrape only scrubs speed; the car slides along the wall.
    car.speed *= 0.55;
  }
  return { hard: false, impact: 0 };
}

function punchHits(G, range, arc) {
  const hits = [];
  const px = G.player.x;
  const py = G.player.y;
  const pa = G.player.angle;
  function inArc(obj) {
    const dx = obj.x - px;
    const dy = obj.y - py;
    const d = Math.hypot(dx, dy);
    if (d > range) return false;
    const a = Math.atan2(dy, dx);
    let diff = a - pa;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < arc;
  }
  for (const ped of G.peds) if (!ped.down && inArc(ped)) hits.push({ kind: 'ped', obj: ped });
  for (const cop of G.cops) if (inArc(cop)) hits.push({ kind: 'cop', obj: cop });
  for (const car of G.cars) {
    if (car.driver === 'player' || car.wrecked) continue;
    if (inArc(car)) hits.push({ kind: 'car', obj: car });
  }
  return hits;
}

/**
 * Advance the player one step. `dir` is the held-keys direction, `actions` the
 * one-shot presses. Returns events: { stole, stolePolice, hitPed, hitCop,
 * hitRival, crashed, carWrecked, rivalWrecked }.
 */
export function updatePlayer(G, dt, dir, actions) {
  const events = {};
  const p = G.player;
  p.punchT = Math.max(0, p.punchT - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtT += dt;

  if (p.onFoot) {
    const speed = dir.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving) {
      p.angle = Math.atan2(dir.y, dir.x);
      const len = Math.hypot(dir.x, dir.y);
      const nx = p.x + (dir.x / len) * speed * dt;
      const ny = p.y + (dir.y / len) * speed * dt;
      const before = { x: p.x, y: p.y };
      p.x = nx;
      p.y = ny;
      if (resolveCircle(G.city, p, PLAYER.radius)) {
        // Try sliding along one axis instead of stopping dead.
        p.x = before.x;
        p.y = ny;
        if (resolveCircle(G.city, p, PLAYER.radius)) {
          p.x = nx;
          p.y = before.y;
          resolveCircle(G.city, p, PLAYER.radius);
        }
      }
      if (isWater(G.city, p.x, p.y)) { p.x = before.x; p.y = before.y; }
    }
    p.speed = moving ? speed : 0;

    if ((actions & 4) && p.punchT <= 0) {
      p.punchT = PLAYER.punchCooldown;
      const hits = punchHits(G, PLAYER.punchRange, PLAYER.punchArc);
      for (const hit of hits) {
        if (hit.kind === 'ped') {
          hit.obj.down = true;
          hit.obj.downT = 2.2;
          hit.obj.fleeT = 3;
          events.hitPed = true;
        } else if (hit.kind === 'cop') {
          hit.obj.health -= PLAYER.punchDamage;
          hit.obj.staggerT = 0.7;
          events.hitCop = true;
        } else if (hit.kind === 'car') {
          hit.obj.health -= PLAYER.punchDamage;
          if (hit.obj.driver === 'rival') events.hitRival = true;
          if (hit.obj.health <= 0 && !hit.obj.wrecked) {
            hit.obj.wrecked = true;
            if (hit.obj.driver === 'rival') events.rivalWrecked = true;
          }
        }
      }
      if (hits.length > 0) {
        G.particles.push({ x: p.x + Math.cos(p.angle) * 40, y: p.y + Math.sin(p.angle) * 40, kind: 'punch', t: 0.25 });
      }
    }

    if (actions & 8) {
      const car = nearestCar(G.cars, p.x, p.y, CAR.enterRange);
      if (car) {
        p.onFoot = false;
        p.car = car;
        if (car.driver === 'traffic') {
          // The driver bails and runs: the car is yours now.
          G.peds.push({
            x: car.x + 26, y: car.y + 10, angle: Math.random() * Math.PI * 2,
            speed: 0, target: null, fleeT: 4, down: false, downT: 0,
            color: '#7a5a8a', driver: true,
          });
          events.stole = true;
        } else if (car.driver === 'police') {
          events.stolePolice = true;
        } else if (car.driver === 'none') {
          events.stole = true;
        }
        car.driver = 'player';
        car.speed = 0;
      }
    }
  } else {
    const car = p.car;
    if (!car || car.wrecked) {
      p.onFoot = true;
      p.car = null;
      if (car) {
        car.driver = 'none';
        car.speed = 0;
      }
    } else {
      const result = driveCar(G, car, dir, dt);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = Math.abs(car.speed);
      if (result.hard) {
        events.crashed = result.impact;
        hurtPlayer(G, (result.impact - 260) / 14);
        if (car.health <= 0) {
          car.wrecked = true;
          events.carWrecked = true;
          p.onFoot = true;
          p.car = null;
          p.x = car.x + 30;
          p.y = car.y + 30;
          resolveCircle(G.city, p, PLAYER.radius);
        }
      }
      if (actions & 8) {
        // Step out beside the car and leave it parked.
        p.onFoot = true;
        p.car = null;
        car.driver = 'none';
        car.speed = 0;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
        resolveCircle(G.city, p, PLAYER.radius);
      }
    }
  }

  // Slow health recovery when nothing has hurt the player for a while.
  if (p.hurtT > 8 && p.health > 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + 2.2 * dt);
  }
  return events;
}

/** Damage the player, with a short invulnerability window after each hit. */
export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.invuln > 0 || p.health <= 0) return;
  p.health -= amount;
  p.invuln = 0.7;
  p.hurtT = 0;
  G.camera.shake = Math.min(14, G.camera.shake + 6);
  if (p.health <= 0) {
    p.health = 0;
    G.screen = 'wasted';
  }
}
