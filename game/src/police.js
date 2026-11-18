// The wanted system: crimes raise the heat, it decays after twenty quiet seconds,
// and the Solmar police answer — patrol cars that chase and ram, and officers on
// foot who drag the player in when they catch him. Busted and wasted are screens
// the main loop shows; this file only decides when they happen.

import { CAR_TYPES, WANTED } from './config.js';
import { driveCar } from './player.js';
import { nearestRoadPoint, randomRoadPoint, resolveCircle } from './world.js';

/** Raise the heat by n stars and restart the decay clock. */
export function addWanted(G, n) {
  if (n <= 0) return;
  G.wanted = Math.min(WANTED.max, G.wanted + n);
  G.wantedTimer = WANTED.decaySeconds;
}

function policeCars(G) {
  return G.cars.filter((c) => c.driver === 'police' && !c.wrecked);
}

function nearestPoliceDistance(G) {
  let best = Infinity;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    best = Math.min(best, Math.hypot(car.x - G.player.x, car.y - G.player.y));
  }
  for (const cop of G.cops) {
    best = Math.min(best, Math.hypot(cop.x - G.player.x, cop.y - G.player.y));
  }
  return best;
}

function spawnPoliceCar(G) {
  let p = null;
  for (let tries = 0; tries < 8; tries += 1) {
    const candidate = randomRoadPoint(G.city, G.random);
    const d = Math.hypot(candidate.x - G.player.x, candidate.y - G.player.y);
    if (d > WANTED.spawnDistance * 0.7 && d < WANTED.spawnDistance * 2.2) {
      p = candidate;
      break;
    }
  }
  if (!p) p = nearestRoadPoint(G.city, G.player.x + WANTED.spawnDistance, G.player.y);
  const car = {
    x: p.x, y: p.y,
    angle: Math.atan2(G.player.y - p.y, G.player.x - p.x),
    speed: 0, type: 'police', color: CAR_TYPES.police.color, health: 100,
    driver: 'police', wrecked: false, parked: false, ai: null,
  };
  G.cars.push(car);
  return car;
}

function spawnCop(G) {
  const p = randomRoadPoint(G.city, G.random);
  G.cops.push({
    x: p.x, y: p.y, angle: 0, speed: 245,
    health: 100, staggerT: 0, catchT: 0, down: false,
  });
}

function angleToward(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function updatePoliceCar(G, car, dt) {
  const px = G.player.x;
  const py = G.player.y;
  // Do not pile onto the player: brake when right on top of him.
  const distToPlayer = Math.hypot(px - car.x, py - car.y);
  // Keep some space from the other patrol cars instead of stacking on one spot.
  let tx = px;
  let ty = py;
  for (const other of G.cars) {
    if (other === car || other.driver !== 'police' || other.wrecked) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 90 && d > 0.01) {
      tx += ((car.x - other.x) / d) * 60;
      ty += ((car.y - other.y) / d) * 60;
    }
  }
  const wantAngle = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleToward(car.angle, wantAngle);
  const steer = Math.abs(diff) < 0.05 ? 0 : Math.sign(diff);
  // Chase: a little faster than the player's car, slower than the player on foot.
  const target = G.player.onFoot ? 320 : Math.min(660, Math.abs(G.player.speed || 0) + 90);
  const dir = { x: steer, y: distToPlayer < 55 ? 1 : -1 };
  driveCar(G, car, dir, dt);
  // Cap the chase speed so the player can still escape.
  if (car.speed > target) car.speed = Math.max(target, car.speed - 500 * dt);
  if (car.speed < 0) car.speed = Math.min(0, car.speed + 400 * dt);
}

function updateCop(G, cop, dt) {
  if (cop.down) {
    cop.downT -= dt;
    return;
  }
  cop.staggerT = Math.max(0, cop.staggerT - dt);
  if (cop.staggerT > 0) return;
  const dx = G.player.x - cop.x;
  const dy = G.player.y - cop.y;
  const d = Math.hypot(dx, dy) || 1;
  cop.angle = Math.atan2(dy, dx);
  const speed = G.player.onFoot ? 245 : 200;
  const before = { x: cop.x, y: cop.y };
  cop.x += (dx / d) * speed * dt;
  cop.y += (dy / d) * speed * dt;
  if (resolveCircle(G.city, cop, 12)) {
    cop.x = before.x;
    cop.y = before.y;
  }
  if (G.player.onFoot && d < 30) {
    cop.catchT += dt;
    if (cop.catchT > 1.2) {
      G.screen = 'busted';
      G.feed.push({ text: 'Busted! The Solmar police hauled you in.', t: G.time });
    }
  } else {
    cop.catchT = 0;
  }
}

/** Advance the wanted level and every officer one step. */
export function updatePolice(G, dt) {
  // Decay: twenty quiet seconds with no officer in sight drops one star.
  if (G.wanted > 0) {
    G.wantedTimer -= dt;
    if (G.wantedTimer <= 0) {
      if (nearestPoliceDistance(G) > 520) {
        G.wanted -= 1;
        G.wantedTimer = WANTED.decaySeconds;
        if (G.wanted === 0) {
          G.feed.push({ text: 'You lost the cops. Heat is off.', t: G.time });
          // The patrol gives up and drives away.
          G.cars = G.cars.filter((c) => c.driver !== 'police');
          G.cops = [];
        }
      } else {
        G.wantedTimer = 5;
      }
    }
  }

  // Patrol cars: one per star, up to three.
  if (G.wanted > 0) {
    const want = Math.min(G.wanted, WANTED.maxPoliceCars);
    while (policeCars(G).length < want) spawnPoliceCar(G);
  }

  // Officers on foot, only while the player is on foot and wanted.
  if (G.wanted > 0 && G.player.onFoot) {
    const want = Math.min(G.wanted, WANTED.maxCops);
    while (G.cops.filter((c) => !c.down).length < want) spawnCop(G);
  } else if (!G.player.onFoot) {
    // Cops cannot keep up with a car: they fall behind and give up.
    G.cops = G.cops.filter((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < 700);
  }

  for (const car of G.cars) {
    if (car.driver === 'police' && !car.wrecked) updatePoliceCar(G, car, dt);
  }
  // A wrecked patrol car is towed away once the player is far from it.
  G.cars = G.cars.filter((c) => {
    if (c.driver !== 'police' || !c.wrecked) return true;
    return Math.hypot(c.x - G.player.x, c.y - G.player.y) < 900;
  });

  for (const cop of G.cops) updateCop(G, cop, dt);
  // A beaten officer stays down a while, then is gone; a fresh beating drops him.
  for (const cop of G.cops) {
    if (cop.health <= 0 && !cop.down) {
      cop.down = true;
      cop.downT = 2.5;
      G.feed.push({ text: 'Officer down! That will not help your record.', t: G.time });
    }
  }
  G.cops = G.cops.filter((c) => !(c.down && c.downT <= 0));
}

/** Leave any car the player was driving parked where it stands. */
function parkPlayerCar(G) {
  for (const car of G.cars) {
    if (car.driver === 'player') {
      car.driver = 'none';
      car.speed = 0;
      car.parked = false;
    }
  }
}

/** The player is caught on foot: the fine and the respawn are the main loop's job. */
export function applyBusted(G) {
  const fine = Math.floor(G.money * 0.1);
  G.money -= fine;
  G.wanted = 0;
  G.wantedTimer = 0;
  G.cars = G.cars.filter((c) => c.driver !== 'police');
  G.cops = [];
  parkPlayerCar(G);
  G.player.health = 100;
  G.player.onFoot = true;
  G.player.car = null;
  G.player.x = G.city.safehouse.x;
  G.player.y = G.city.safehouse.y + 60;
  G.feed.push({ text: `Released after a $${fine} fine. Back at the safehouse.`, t: G.time });
  return fine;
}

/** The player is wasted: hospital bill, same respawn, mission restarts. */
export function applyWasted(G) {
  const bill = Math.min(G.money, 200);
  G.money -= bill;
  G.wanted = 0;
  G.wantedTimer = 0;
  G.cars = G.cars.filter((c) => c.driver !== 'police');
  G.cops = [];
  parkPlayerCar(G);
  G.player.health = 100;
  G.player.onFoot = true;
  G.player.car = null;
  G.player.x = G.city.safehouse.x;
  G.player.y = G.city.safehouse.y + 60;
  G.feed.push({ text: `You woke up in St. Marina Hospital. Bill: $${bill}.`, t: G.time });
  return bill;
}
