// Solmar City itself: a seeded grid city with roads, buildings, parks, a stadium, a
// port, a beach and a pier, plus the geometry every other module needs — what is a
// road, what blocks movement, where cars and pedestrians may spawn. No drawing here.

import { PALETTE, WORLD } from './config.js';

const ROOFS = [PALETTE.roofTerra, PALETTE.roofSlate, PALETTE.roofCream, PALETTE.roofBrick, PALETTE.roofGlass];

/** Vertical road centre lines, left to right; horizontal ones are the same by symmetry. */
export function roadLines(axis) {
  const lines = [];
  const count = axis === 'x' ? WORLD.cols + 1 : WORLD.rows + 1;
  for (let i = 0; i < count; i += 1) {
    lines.push(i * (WORLD.block + WORLD.road) + WORLD.road / 2);
  }
  return lines;
}

function blockRect(col, row) {
  const x = col * (WORLD.block + WORLD.road) + WORLD.road;
  const y = row * (WORLD.block + WORLD.road) + WORLD.road;
  return { x, y, w: WORLD.block, h: WORLD.block };
}

function makeBuildings(random, rect, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const w = random.range(64, 132);
    const h = random.range(64, 132);
    const x = rect.x + random.range(10, Math.max(11, rect.w - w - 10));
    const y = rect.y + random.range(10, Math.max(11, rect.h - h - 10));
    out.push({
      x, y, w, h,
      roof: random.pick(ROOFS),
      height: random.range(8, 22),
      wall: PALETTE.buildingWall,
    });
  }
  return out;
}

function makePark(random, rect) {
  const trees = [];
  const n = random.int(6, 10);
  for (let i = 0; i < n; i += 1) {
    trees.push({
      x: rect.x + random.range(18, rect.w - 18),
      y: rect.y + random.range(18, rect.h - 18),
      r: random.range(10, 17),
      color: random.chance(0.5) ? PALETTE.parkTree : PALETTE.parkTree2,
    });
  }
  return trees;
}

export function createCity(random) {
  const cityW = WORLD.cols * WORLD.block + (WORLD.cols + 1) * WORLD.road;
  const cityH = WORLD.rows * WORLD.block + (WORLD.rows + 1) * WORLD.road;
  const beachY = cityH;
  const waterY = cityH + WORLD.beach;
  const worldH = waterY + WORLD.water;

  const buildings = [];
  const parks = [];
  const containers = [];
  const stadium = { ...blockRect(6, 2), label: 'Solmar Stadium' };
  const portBlocks = [blockRect(8, 5), blockRect(8, 6)];
  const bankBlock = blockRect(4, 3);
  const safehouseBlock = blockRect(1, 6);
  const garageBlock = blockRect(1, 1);

  for (let row = 0; row < WORLD.rows; row += 1) {
    for (let col = 0; col < WORLD.cols; col += 1) {
      const rect = blockRect(col, row);
      const isStadium = col === 6 && row === 2;
      const isPort = (col === 8 && row === 5) || (col === 8 && row === 6);
      const isBank = col === 4 && row === 3;
      const isSafehouse = col === 1 && row === 6;
      if (isStadium || isPort) continue;
      if (random.chance(0.16)) {
        parks.push({ ...rect, trees: makePark(random, rect) });
        continue;
      }
      if (isBank) {
        buildings.push({
          x: rect.x + 40, y: rect.y + 30, w: 150, h: 170,
          roof: PALETTE.roofGlass, height: 30, wall: '#6a6258', bank: true,
        });
        continue;
      }
      if (isSafehouse) {
        buildings.push({
          x: rect.x + 70, y: rect.y + 70, w: 90, h: 80,
          roof: PALETTE.roofTerra, height: 10, wall: '#a08a6a', safehouse: true,
        });
        continue;
      }
      buildings.push(...makeBuildings(random, rect, random.int(1, 3)));
    }
  }

  // The port: stacked shipping containers in the two east blocks.
  const containerColors = [PALETTE.containerA, PALETTE.containerB, PALETTE.containerC];
  for (const rect of portBlocks) {
    for (let i = 0; i < 7; i += 1) {
      containers.push({
        x: rect.x + random.range(8, rect.w - 78),
        y: rect.y + random.range(8, rect.h - 38),
        w: 70, h: 30,
        color: random.pick(containerColors),
      });
    }
  }

  // Landmarks the missions point at, all on a roadside so a car can reach them.
  const garage = { x: garageBlock.x + garageBlock.w + 8, y: garageBlock.y + 60, label: 'Rocco\'s Garage' };
  const bank = { x: bankBlock.x + bankBlock.w / 2, y: bankBlock.y + bankBlock.h + 8, label: 'Solmar National Bank' };
  const safehouse = { x: safehouseBlock.x + 115, y: safehouseBlock.y + safehouseBlock.h + 8, label: 'Safehouse' };
  const pier = { x: cityW * 0.36, y0: beachY + 6, y1: waterY + 150, w: 34, label: 'Sunset Pier' };
  const spawn = { x: garage.x + 40, y: garage.y + 120 };

  // Roadside parking bays: just off the asphalt (centre 46 px from the road
  // centre line, clear of the 16 px traffic lanes), parallel to the road.
  const parking = [];
  const vLines = roadLines('x');
  const hLines = roadLines('y');
  for (const line of vLines) {
    for (let y = WORLD.road + 120; y < cityH - 120; y += random.range(260, 520)) {
      const x = line + WORLD.road / 2 + 11;
      if (x < cityW - 40) parking.push({ x, y, angle: Math.PI / 2 });
    }
  }
  for (const line of hLines) {
    for (let x = WORLD.road + 120; x < cityW - 120; x += random.range(260, 520)) {
      const y = line + WORLD.road / 2 + 11;
      if (y < beachY - 20) parking.push({ x, y, angle: 0 });
    }
  }

  return {
    w: cityW, h: worldH, cityH, beachY, waterY,
    buildings, parks, containers, stadium, portBlocks,
    garage, bank, safehouse, pier, spawn, parking,
    vLines, hLines,
  };
}

/** True when the point is on asphalt (inside a road band, within the city). */
export function isRoad(city, x, y) {
  if (x < 0 || y < 0 || x > city.w || y > city.cityH) return false;
  for (const line of city.vLines) {
    if (Math.abs(x - line) <= WORLD.road / 2) return true;
  }
  for (const line of city.hLines) {
    if (Math.abs(y - line) <= WORLD.road / 2) return true;
  }
  return false;
}

export function isWater(city, x, y) {
  return y >= city.waterY;
}

export function isBeach(city, x, y) {
  return y >= city.beachY && y < city.waterY;
}

/** Circle (x, y, r) against every solid thing: returns the push-out, or null. */
export function collideCircle(city, x, y, r) {
  // World bounds and the water keep everything on land.
  if (x < r) return { nx: 1, ny: 0, depth: r - x };
  if (x > city.w - r) return { nx: -1, ny: 0, depth: x - (city.w - r) };
  if (y < r) return { nx: 0, ny: 1, depth: r - y };
  if (y > city.waterY - 14 - r) return { nx: 0, ny: -1, depth: y - (city.waterY - 14 - r) };
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        return { nx: dx / d, ny: dy / d, depth: r - d };
      }
      // Centre inside the box: push out along the smallest penetration.
      const left = x - b.x + r;
      const right = b.x + b.w - x + r;
      const top = y - b.y + r;
      const bottom = b.y + b.h - y + r;
      const m = Math.min(left, right, top, bottom);
      if (m === left) return { nx: -1, ny: 0, depth: left };
      if (m === right) return { nx: 1, ny: 0, depth: right };
      if (m === top) return { nx: 0, ny: -1, depth: top };
      return { nx: 0, ny: 1, depth: bottom };
    }
  }
  for (const c of city.containers) {
    const cx = Math.max(c.x, Math.min(x, c.x + c.w));
    const cy = Math.max(c.y, Math.min(y, c.y + c.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      return { nx: dx / d, ny: dy / d, depth: r - d };
    }
  }
  return null;
}

/** Push a circle out of solids; returns true when anything pushed it. */
export function resolveCircle(city, pos, r) {
  let hit = false;
  for (let i = 0; i < 3; i += 1) {
    const c = collideCircle(city, pos.x, pos.y, r);
    if (!c) break;
    pos.x += c.nx * c.depth;
    pos.y += c.ny * c.depth;
    hit = true;
  }
  return hit;
}

/** The nearest point on any road centre line, for spawns and routing. */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const line of city.vLines) {
    const d = Math.abs(x - line);
    if (d < bestD) { bestD = d; best = { x: line, y }; }
  }
  for (const line of city.hLines) {
    const d = Math.abs(y - line);
    if (d < bestD) { bestD = d; best = { x, y: line }; }
  }
  return best;
}

export function randomRoadPoint(city, random) {
  if (random.chance(0.5)) {
    return { x: random.pick(city.vLines), y: random.range(WORLD.road, city.cityH - WORLD.road) };
  }
  return { x: random.range(WORLD.road, city.w - WORLD.road), y: random.pick(city.hLines) };
}

/** A point on a sidewalk: just off a road band, where pedestrians walk. */
export function randomSidewalkPoint(city, random) {
  const p = randomRoadPoint(city, random);
  const off = WORLD.road / 2 + 10;
  if (random.chance(0.5)) p.x += random.chance(0.5) ? off : -off;
  else p.y += random.chance(0.5) ? off : -off;
  p.x = Math.max(20, Math.min(city.w - 20, p.x));
  p.y = Math.max(20, Math.min(city.cityH - 20, p.y));
  return p;
}
