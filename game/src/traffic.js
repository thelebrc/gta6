// Traffic and pedestrians. Cars follow the road lanes (right-hand traffic), slow
// for the car ahead, and choose a new road at intersections; pedestrians stroll the
// sidewalks and run from danger. Parked cars sit in bays just off the asphalt,
// waiting to be stolen. Collisions use two small circles per car (front and rear),
// so cars passing in opposite lanes do not scrape each other.

import { CAR_TYPES, PEDS, TRAFFIC } from './config.js';
import { isWater, randomRoadPoint, randomSidewalkPoint, resolveCircle } from './world.js';

const PED_COLORS = ['#c96a4a', '#4a7a9a', '#7a9a4a', '#9a6ab0', '#b0883a', '#5a8a7a', '#a04a5a'];
const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'coupe', 'truck', 'sedan', 'taxi'];

/** Half the car's width, for walls: a car in its lane clears the buildings. */
export function carRadius(car) {
  const type = CAR_TYPES[car.type];
  return type.width / 2 + 2;
}

/** Two circles (front and rear) that approximate the car's body. */
export function carCircles(car) {
  const type = CAR_TYPES[car.type];
  const half = type.length / 2 - 16;
  const cx = Math.cos(car.angle);
  const cy = Math.sin(car.angle);
  return [
    { x: car.x + cx * half, y: car.y + cy * half, r: 15 },
    { x: car.x - cx * half, y: car.y - cy * half, r: 15 },
  ];
}

export function spawnTraffic(G) {
  const random = G.random;
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const p = randomRoadPoint(G.city, random);
    const vertical = random.chance(0.5);
    const dir = random.chance(0.5) ? 1 : -1;
    const type = random.pick(TRAFFIC_TYPES);
    G.cars.push({
      x: p.x, y: p.y,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: random.range(TRAFFIC.cruiseMin, TRAFFIC.cruiseMax),
      type, color: CAR_TYPES[type].color, health: 100,
      driver: 'traffic', wrecked: false, parked: false,
      ai: {
        axis: vertical ? 'v' : 'h',
        line: vertical ? p.x : p.y,
        dir,
        cruise: random.range(TRAFFIC.cruiseMin, TRAFFIC.cruiseMax),
      },
    });
  }
  // Parked cars in the roadside bays, skipping any bay a building crowds.
  const spots = [...G.city.parking];
  for (let i = spots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  let placed = 0;
  for (const spot of spots) {
    if (placed >= 10) break;
    let blocked = false;
    for (const b of G.city.buildings) {
      if (spot.x > b.x - 34 && spot.x < b.x + b.w + 34 && spot.y > b.y - 34 && spot.y < b.y + b.h + 34) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    const type = random.pick(TRAFFIC_TYPES);
    G.cars.push({
      x: spot.x, y: spot.y, angle: spot.angle, speed: 0,
      type, color: CAR_TYPES[type].color, health: 100,
      driver: 'none', wrecked: false, parked: true, ai: null,
    });
    placed += 1;
  }
}

export function spawnPeds(G) {
  for (let i = 0; i < PEDS.count; i += 1) {
    const p = randomSidewalkPoint(G.city, G.random);
    G.peds.push({
      x: p.x, y: p.y, angle: G.random() * Math.PI * 2,
      speed: G.random.range(PEDS.walkMin, PEDS.walkMax),
      target: randomSidewalkPoint(G.city, G.random),
      fleeT: 0, down: false, downT: 0, staggerT: 0,
      color: G.random.pick(PED_COLORS), driver: false,
    });
  }
}

/** Right-hand lane offset for a car travelling `dir` on `axis`. */
function laneOffset(axis, dir) {
  if (axis === 'v') return { x: -dir * 16, y: 0 };
  return { x: 0, y: dir * 16 };
}

function crossingLines(G, axis) {
  return axis === 'v' ? G.city.hLines : G.city.vLines;
}

/** The next intersection coordinate ahead of the car along its road. */
function nextIntersection(G, car) {
  const lines = crossingLines(G, car.ai.axis);
  const pos = car.ai.axis === 'v' ? car.y : car.x;
  let best = null;
  for (const line of lines) {
    const ahead = (line - pos) * car.ai.dir;
    if (ahead > 4 && (best === null || ahead < (best - pos) * car.ai.dir)) best = line;
  }
  return best;
}

function turnAtIntersection(G, car, line) {
  const random = G.random;
  const roll = random();
  const ai = car.ai;
  // Where the car is now is the crossing: snap onto the intersection centre.
  if (ai.axis === 'v') car.y = line;
  else car.x = line;
  if (roll < 0.72) return; // straight on
  // Turn onto the crossing road: left or right.
  const turn = roll < 0.86 ? -1 : 1;
  if (ai.axis === 'v') {
    // Was travelling north/south; now east/west.
    const newDir = turn * ai.dir;
    ai.axis = 'h';
    ai.line = line;
    ai.dir = newDir;
    car.angle = newDir > 0 ? 0 : Math.PI;
  } else {
    const newDir = -turn * ai.dir;
    ai.axis = 'v';
    ai.line = line;
    ai.dir = newDir;
    car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

function carAhead(G, car) {
  let best = null;
  let bestGap = TRAFFIC.lookAhead;
  for (const other of G.cars) {
    if (other === car || other.wrecked || other.parked) continue;
    if (car.ai.axis === 'v') {
      if (Math.abs(other.x - car.x) > 30) continue;
      const gap = (other.y - car.y) * car.ai.dir;
      if (gap > 0 && gap < bestGap) { bestGap = gap; best = other; }
    } else {
      if (Math.abs(other.y - car.y) > 30) continue;
      const gap = (other.x - car.x) * car.ai.dir;
      if (gap > 0 && gap < bestGap) { bestGap = gap; best = other; }
    }
  }
  return best === null ? null : { car: best, gap: bestGap };
}

function updateTrafficCar(G, car, dt) {
  const ai = car.ai;
  const target = ai.cruise;
  const ahead = carAhead(G, car);
  let want = target;
  if (ahead) {
    want = ahead.gap < TRAFFIC.stopGap ? 0 : Math.min(target, ahead.car.speed);
  }
  const accel = want > car.speed ? 260 : 520;
  car.speed += Math.sign(want - car.speed) * Math.min(Math.abs(want - car.speed), accel * dt);

  const intersection = nextIntersection(G, car);
  if (intersection !== null) {
    const pos = ai.axis === 'v' ? car.y : car.x;
    const dist = (intersection - pos) * ai.dir;
    if (dist <= Math.max(6, car.speed * dt)) turnAtIntersection(G, car, intersection);
  }

  const off = laneOffset(ai.axis, ai.dir);
  if (ai.axis === 'v') {
    car.x = ai.line + off.x;
    car.y += ai.dir * car.speed * dt;
    car.angle = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.y = ai.line + off.y;
    car.x += ai.dir * car.speed * dt;
    car.angle = ai.dir > 0 ? 0 : Math.PI;
  }

  // Wrap around the city edge instead of piling up at the border roads.
  if (car.x < 20 || car.x > G.city.w - 20 || car.y < 20 || car.y > G.city.cityH - 20) {
    const p = randomRoadPoint(G.city, G.random);
    car.x = p.x;
    car.y = p.y;
    ai.axis = G.random.chance(0.5) ? 'v' : 'h';
    ai.line = ai.axis === 'v' ? p.x : p.y;
    ai.dir = G.random.chance(0.5) ? 1 : -1;
    car.speed = ai.cruise;
  }
}

function updateRivalCar(G, car, dt) {
  // The rival cruises the avenues a little faster than traffic, weaving lanes.
  const ai = car.ai;
  ai.weaveT -= dt;
  if (ai.weaveT <= 0) {
    ai.weaveT = G.random.range(2, 5);
    ai.weave = G.random.range(-14, 14);
  }
  updateTrafficCar(G, car, dt);
  if (ai.axis === 'v') car.x += ai.weave * dt * 4;
  else car.y += ai.weave * dt * 4;
}

function updatePed(G, ped, dt) {
  if (ped.down) {
    ped.downT -= dt;
    if (ped.downT <= 0) {
      ped.down = false;
      ped.fleeT = 3;
    }
    return;
  }
  ped.staggerT = Math.max(0, (ped.staggerT || 0) - dt);
  let speed = ped.speed;
  let tx;
  let ty;
  if (ped.fleeT > 0) {
    ped.fleeT -= dt;
    speed = PEDS.fleeSpeed;
    const dx = ped.x - G.player.x;
    const dy = ped.y - G.player.y;
    const d = Math.hypot(dx, dy) || 1;
    tx = ped.x + (dx / d) * 120;
    ty = ped.y + (dy / d) * 120;
  } else {
    if (!ped.target) ped.target = randomSidewalkPoint(G.city, G.random);
    tx = ped.target.x;
    ty = ped.target.y;
    const d = Math.hypot(tx - ped.x, ty - ped.y);
    if (d < 12) {
      ped.target = randomSidewalkPoint(G.city, G.random);
      return;
    }
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy) || 1;
  ped.angle = Math.atan2(dy, dx);
  const nx = ped.x + (dx / d) * speed * dt;
  const ny = ped.y + (dy / d) * speed * dt;
  const before = { x: ped.x, y: ped.y };
  ped.x = nx;
  ped.y = ny;
  if (resolveCircle(G.city, ped, 10) || isWater(G.city, ped.x, ped.y)) {
    ped.x = before.x;
    ped.y = before.y;
    ped.target = randomSidewalkPoint(G.city, G.random);
  }
}

/** Resolve overlaps between cars with the two-circle model; hardest player hit. */
function collideCars(G) {
  let playerImpact = 0;
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked && b.wrecked) continue;
      const circlesA = carCircles(a);
      const circlesB = carCircles(b);
      for (const ca of circlesA) {
        for (const cb of circlesB) {
          const dx = cb.x - ca.x;
          const dy = cb.y - ca.y;
          const min = ca.r + cb.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 < 0.01) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const push = (min - d) / 2;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const relSpeed = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3 + Math.abs(b.speed) * 0.3;
          if (relSpeed > 200) {
            a.health -= relSpeed / 60;
            b.health -= relSpeed / 60;
            G.particles.push({ x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2, kind: 'spark', t: 0.4 });
            if (a.driver === 'player' || b.driver === 'player') playerImpact = Math.max(playerImpact, relSpeed);
            const rival = a.driver === 'rival' ? a : b.driver === 'rival' ? b : null;
            if (rival && rival.health <= 0 && !rival.wrecked) {
              rival.wrecked = true;
              G.events.rivalWrecked = true;
            }
          }
          const avg = (a.speed + b.speed) / 2;
          a.speed = avg * 0.7;
          b.speed = avg * 0.7;
        }
      }
    }
  }
  return playerImpact;
}

/** Advance traffic and pedestrians one step; returns events for the main loop. */
export function updateTraffic(G, dt) {
  const events = {};
  for (const car of G.cars) {
    if (car.wrecked) continue;
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
    else if (car.driver === 'rival') updateRivalCar(G, car, dt);
  }
  for (const ped of G.peds) updatePed(G, ped, dt);

  const impact = collideCars(G);
  if (impact > 0) events.crashed = impact;

  // A moving car that runs a pedestrian down.
  for (const car of G.cars) {
    if (car.wrecked || Math.abs(car.speed) < 40) continue;
    const circles = carCircles(car);
    for (const ped of G.peds) {
      if (ped.down) continue;
      for (const c of circles) {
        const dx = ped.x - c.x;
        const dy = ped.y - c.y;
        if (dx * dx + dy * dy < 25 * 25) {
          ped.down = true;
          ped.downT = 2.5;
          ped.fleeT = 3;
          G.particles.push({ x: ped.x, y: ped.y, kind: 'punch', t: 0.3 });
          if (car.driver === 'player') events.hitPed = true;
          break;
        }
      }
    }
  }

  // A car that hits the player on foot knocks him down and hurts him.
  if (G.player.onFoot && G.player.health > 0) {
    for (const car of G.cars) {
      if (car.wrecked || Math.abs(car.speed) < 60) continue;
      for (const c of carCircles(car)) {
        const dx = G.player.x - c.x;
        const dy = G.player.y - c.y;
        if (dx * dx + dy * dy < 28 * 28) {
          events.ranOver = Math.abs(car.speed);
          break;
        }
      }
    }
  }

  // Wrecked cars smoke and stop.
  for (const car of G.cars) {
    if (car.wrecked && car.health > -40) {
      car.health -= 2 * dt;
      if (G.random.chance(0.1)) {
        G.particles.push({ x: car.x, y: car.y - 8, kind: 'smoke', t: 1.1 });
      }
    }
  }
  return events;
}
