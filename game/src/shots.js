// The screenshot scenes behind ?shot=cover|street|mission|escape. Each one sets
// up a real game state (a mission in progress, a wanted level, police on the
// tail) and plays the real rules forward for a fixed time with an autopilot that
// drives the road grid toward its target, so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { createPlayer, updatePlayer } from './player.js';
import { spawnPeds, spawnTraffic, updateTraffic } from './traffic.js';
import { updatePolice } from './police.js';
import { createMissions, currentObjective, startMission, updateMissions } from './missions.js';
import { SCREEN_PLAY } from './render.js';

/** Put a fresh game state in place for a scene to build on. */
function resetScene(G) {
  G.time = 0;
  G.player = createPlayer(G.city);
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.wanted = 0;
  G.wantedTimer = 0;
  G.money = 40;
  G.mission = createMissions();
  G.feed = [];
  G.particles = [];
  G.skid = [];
  G.events = {};
  G.camera = { x: G.player.x, y: G.player.y, zoom: 1, shake: 0 };
  spawnTraffic(G);
  spawnPeds(G);
  G.objective = currentObjective(G);
}

/** Put the player in a fresh car of `type` at (x, y), facing `angle`. */
function giveCar(G, type, x, y, angle) {
  const car = {
    x, y, angle, speed: 0, type,
    color: type === 'sports' ? '#c62f5b' : '#5b7fa6',
    health: 100, driver: 'player', wrecked: false, parked: false, ai: null,
  };
  G.cars.push(car);
  G.player.onFoot = false;
  G.player.car = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

/** Park a police car at (x, y) already chasing the player. */
function placePolice(G, x, y) {
  const car = {
    x, y, angle: Math.atan2(G.player.y - y, G.player.x - x),
    speed: 240, type: 'police', color: '#1f2a44', health: 100,
    driver: 'police', wrecked: false, parked: false, ai: null,
  };
  G.cars.push(car);
  return car;
}

/** Manhattan waypoints along the road grid from `from` to `to`. */
function roadPath(G, from, to) {
  const v = G.city.vLines;
  const h = G.city.hLines;
  const nearest = (lines, value) => lines.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
  const ix = nearest(v, from.x);
  const iy = nearest(h, from.y);
  const tx = nearest(v, to.x);
  const ty = nearest(h, to.y);
  return [
    { x: ix, y: iy },
    { x: tx, y: iy },
    { x: tx, y: ty },
    { x: to.x, y: to.y },
  ];
}

/** A driving pilot that follows waypoints, steering toward the current one. */
function makeDrivePilot(G, waypoints) {
  let index = 0;
  return () => {
    const p = G.player;
    const last = waypoints[waypoints.length - 1];
    const distLast = Math.hypot(last.x - p.x, last.y - p.y);
    // At the final stop: brake, then sit still on the road.
    if (index >= waypoints.length - 1 && distLast < 150) {
      return { x: 0, y: Math.abs(p.speed || 0) > 40 ? 1 : 0, run: false };
    }
    while (index < waypoints.length - 1) {
      const w = waypoints[index];
      const dx = w.x - p.x;
      const dy = w.y - p.y;
      const d = Math.hypot(dx, dy);
      // Arrived, or drove past it: move on, never U-turn back for it.
      const forward = { x: Math.cos(p.angle), y: Math.sin(p.angle) };
      const passed = d < 150 && (dx * forward.x + dy * forward.y) < 0;
      if (d < 46 || passed) index += 1;
      else break;
    }
    const w = waypoints[Math.min(index, waypoints.length - 1)];
    const wantAngle = Math.atan2(w.y - p.y, w.x - p.x);
    let diff = wantAngle - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const speed = Math.abs(p.speed || 0);
    // Brake into a sharp turn instead of overshooting it into the buildings.
    let throttle = -1;
    if (Math.abs(diff) > 0.7 && speed > 180) throttle = 1;
    else if (Math.hypot(w.x - p.x, w.y - p.y) < 220 && speed > 260) throttle = 0;
    return { x: Math.max(-1, Math.min(1, diff * 2.2)), y: throttle, run: false };
  };
}

/** A walking pilot that heads straight for a point. */
function makeWalkPilot(G, tx, ty) {
  return () => {
    const dx = tx - G.player.x;
    const dy = ty - G.player.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, run: false };
  };
}

/** Play the real rules forward for `seconds` under the pilot's steering. */
function runScene(G, seconds, pilot) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const dir = pilot(G);
    updatePlayer(G, STEP, dir, 0);
    updateTraffic(G, STEP);
    updatePolice(G, STEP);
    updateMissions(G, STEP);
    G.objective = currentObjective(G);
    for (const pt of G.particles) pt.t -= STEP;
    G.particles = G.particles.filter((p) => p.t > 0);
    for (const s of G.skid) s.t -= STEP * 0.4;
    G.skid = G.skid.filter((s) => s.t > 0);
    const cam = G.camera;
    const targetZoom = G.player.onFoot ? 1 : Math.max(0.78, 1 - Math.abs(G.player.speed || 0) / 3200);
    cam.zoom += (targetZoom - cam.zoom) * Math.min(1, STEP * 3);
    cam.x += (G.player.x - cam.x) * Math.min(1, STEP * 5);
    cam.y += (G.player.y - cam.y) * Math.min(1, STEP * 5);
    cam.shake = Math.max(0, cam.shake - STEP * 26);
    G.time += STEP;
    if (G.screen === 'busted' || G.screen === 'wasted') break;
  }
}

/**
 * Set `G` to the named scene and return the screen to draw. Unknown names
 * stage the street scene.
 */
export function stageShot(name, G) {
  resetScene(G);
  const city = G.city;

  if (name === 'cover') {
    // Hot Pursuit: three stars, two patrol cars on the tail, sports car flying
    // down the central avenue, the objective banner and minimap live.
    G.mission.index = 2;
    G.mission.done = [true, true, false, false, false];
    G.money = 1250;
    startMission(G);
    const avenue = city.hLines[3];
    const x0 = city.vLines[3];
    giveCar(G, 'sports', x0, avenue, 0);
    placePolice(G, x0 - 140, avenue - 14);
    placePolice(G, x0 - 210, avenue + 16);
    G.feed.push({ text: 'You stole a car. The heat is on.', t: 0 });
    G.feed.push({ text: 'Job 3: Hot Pursuit — lose them, all of them.', t: 0 });
    const waypoints = roadPath(G, { x: x0, y: avenue }, { x: city.vLines[8], y: avenue });
    runScene(G, 2.5, makeDrivePilot(G, waypoints));
  } else if (name === 'mission') {
    // Courier Run: package in hand, seventy-five seconds on the clock, driving
    // across town to the delivery marker.
    G.mission.index = 1;
    G.mission.done = [true, false, false, false, false];
    G.money = 1250;
    startMission(G);
    G.mission.step = 1;
    G.mission.hasPackage = true;
    G.mission.timer = 75;
    G.mission.target = { x: city.vLines[1], y: city.hLines[6], label: 'Delivery' };
    const start = { x: city.vLines[6], y: city.hLines[2] };
    giveCar(G, 'sedan', start.x, start.y, Math.PI);
    G.feed.push({ text: 'Package secured. Seventy-five seconds to deliver it.', t: 0 });
    const waypoints = roadPath(G, start, G.mission.target);
    runScene(G, 4, makeDrivePilot(G, waypoints));
  } else if (name === 'escape') {
    // The Big Score: cash grabbed, four stars, three patrol cars behind, racing
    // the beach road back to the safehouse.
    G.mission.index = 4;
    G.mission.done = [true, true, true, true, false];
    G.money = 4300;
    startMission(G);
    G.mission.step = 2;
    G.mission.hasCash = true;
    G.wanted = 4;
    G.wantedTimer = 20;
    G.mission.target = { x: city.safehouse.x, y: city.safehouse.y, label: 'Safehouse' };
    const beachRoad = city.hLines[city.hLines.length - 1];
    const x0 = city.vLines[6];
    giveCar(G, 'sports', x0, beachRoad, Math.PI);
    placePolice(G, x0 + 150, beachRoad - 14);
    placePolice(G, x0 + 220, beachRoad + 16);
    placePolice(G, x0 + 290, beachRoad - 14);
    G.feed.push({ text: 'Cash in hand! Every cop in Solmar is coming. Run!', t: 0 });
    const waypoints = roadPath(G, { x: x0, y: beachRoad }, G.mission.target);
    runScene(G, 5, makeDrivePilot(G, waypoints));
  } else {
    // Street: on foot downtown, pedestrians and traffic all around, the first
    // job telling the player to steal a car.
    startMission(G);
    const downtown = { x: city.vLines[4], y: city.hLines[3] };
    G.player.x = downtown.x + 60;
    G.player.y = downtown.y + 40;
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
    const parked = G.cars.find((c) => c.parked);
    const target = parked ? { x: parked.x, y: parked.y } : { x: downtown.x + 300, y: downtown.y };
    runScene(G, 6, makeWalkPilot(G, target.x, target.y));
  }

  G.objective = currentObjective(G);
  return { screen: SCREEN_PLAY };
}
