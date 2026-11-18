// The story: five jobs in order, from a stolen sedan to the big score. Each
// mission has steps with a target the HUD points at; finishing one pays out and
// unlocks the next. A busted or wasted player restarts the current job.

import { MISSION_REWARDS, WANTED } from './config.js';

export const MISSIONS = [
  {
    name: 'First Wheels',
    briefing: 'Rocco needs a driver, not a walker. Steal a car, any car, and bring it to his garage.',
    reward: MISSION_REWARDS[0],
  },
  {
    name: 'Courier Run',
    briefing: 'A package is waiting at the east docks. Pick it up and deliver it west — ninety seconds, no excuses.',
    reward: MISSION_REWARDS[1],
  },
  {
    name: 'Hot Pursuit',
    briefing: 'Somebody talked. The whole Solmar force is on you. Lose them — all of them.',
    reward: MISSION_REWARDS[2],
  },
  {
    name: 'Payback',
    briefing: 'Dante Rook cut you off one time too many. His red coupe is out on the avenues. Wreck it.',
    reward: MISSION_REWARDS[3],
  },
  {
    name: 'The Big Score',
    briefing: 'Solmar National Bank. Walk in, grab the cash, and get to the safehouse with every cop in the city behind you.',
    reward: MISSION_REWARDS[4],
  },
];

export function createMissions() {
  return {
    index: 0,
    step: 0,
    timer: 0,
    grabT: 0,
    hasPackage: false,
    hasCash: false,
    rival: null,
    target: null,
    done: [false, false, false, false, false],
    announced: false,
  };
}

function pickupPoint(G) {
  return { x: G.city.w - 160, y: G.city.hLines[4], label: 'Package pickup' };
}

function dropoffPoint(G) {
  return { x: G.city.vLines[1], y: G.city.hLines[6], label: 'Delivery' };
}

function spawnRival(G) {
  const p = { x: G.city.vLines[5], y: G.city.hLines[2] };
  const car = {
    x: p.x, y: p.y, angle: 0, speed: 200,
    type: 'sports', color: '#d21f3c', health: 100,
    driver: 'rival', wrecked: false, parked: false,
    ai: { axis: 'h', line: p.y, dir: 1, cruise: 250, weaveT: 0, weave: 0 },
  };
  G.cars.push(car);
  return car;
}

/** (Re)start the current mission from its first step. */
export function startMission(G) {
  const m = G.mission;
  const i = m.index;
  m.step = 0;
  m.timer = 0;
  m.grabT = 0;
  m.hasPackage = false;
  m.hasCash = false;
  m.target = null;
  m.announced = true;
  if (i === 0) {
    m.target = null;
  } else if (i === 1) {
    m.target = pickupPoint(G);
  } else if (i === 2) {
    G.wanted = 3;
    G.wantedTimer = WANTED.decaySeconds;
    m.target = null;
  } else if (i === 3) {
    if (!m.rival || m.rival.wrecked) m.rival = spawnRival(G);
    m.target = null;
  } else if (i === 4) {
    m.target = { x: G.city.bank.x, y: G.city.bank.y, label: 'Solmar National Bank' };
  }
  if (i < MISSIONS.length) {
    G.feed.push({ text: `Job ${i + 1}: ${MISSIONS[i].name} — ${MISSIONS[i].briefing}`, t: G.time });
  }
}

function near(G, target, radius) {
  if (!target) return false;
  return Math.hypot(G.player.x - target.x, G.player.y - target.y) < radius;
}

function completeMission(G) {
  const m = G.mission;
  const i = m.index;
  const reward = MISSIONS[i].reward;
  G.money += reward;
  m.done[i] = true;
  G.events.missionComplete = true;
  G.feed.push({ text: `Job complete: ${MISSIONS[i].name}. +$${reward}.`, t: G.time });
  m.index += 1;
  if (m.index < MISSIONS.length) {
    startMission(G);
  } else {
    m.target = null;
    G.feed.push({ text: 'All five jobs done. Solmar City is yours, Marlowe.', t: G.time });
  }
}

/** Advance the current mission one step; call every frame while playing. */
export function updateMissions(G, dt) {
  const m = G.mission;
  if (m.index >= MISSIONS.length) return;
  const i = m.index;

  if (i === 0) {
    if (m.step === 0) {
      if (!G.player.onFoot) {
        m.step = 1;
        m.target = { x: G.city.garage.x, y: G.city.garage.y, label: "Rocco's Garage" };
        G.feed.push({ text: 'Nice wheels. Now drive it to Rocco\'s Garage.', t: G.time });
      }
    } else if (near(G, m.target, 95) && !G.player.onFoot) {
      completeMission(G);
    }
  } else if (i === 1) {
    if (m.step === 0) {
      if (near(G, m.target, 70)) {
        m.step = 1;
        m.hasPackage = true;
        m.timer = 90;
        m.target = dropoffPoint(G);
        G.feed.push({ text: 'Package secured. Ninety seconds to deliver it.', t: G.time });
      }
    } else {
      m.timer -= dt;
      if (near(G, m.target, 70)) {
        completeMission(G);
      } else if (m.timer <= 0) {
        G.feed.push({ text: 'Too slow — the package went cold. The job is back on.', t: G.time });
        startMission(G);
      }
    }
  } else if (i === 2) {
    if (G.wanted === 0) {
      completeMission(G);
    }
  } else if (i === 3) {
    if (m.rival && m.rival.wrecked) {
      completeMission(G);
    } else if (m.rival) {
      m.target = { x: m.rival.x, y: m.rival.y, label: "Dante's coupe" };
    }
  } else if (i === 4) {
    if (m.step === 0) {
      if (near(G, m.target, 75)) {
        m.step = 1;
        m.grabT = 0;
        G.feed.push({ text: 'Inside. Hold position — grab the cash!', t: G.time });
      }
    } else if (m.step === 1) {
      if (near(G, m.target, 75)) {
        m.grabT += dt;
        if (m.grabT >= 3) {
          m.step = 2;
          m.hasCash = true;
          G.wanted = 4;
          G.wantedTimer = WANTED.decaySeconds;
          m.target = { x: G.city.safehouse.x, y: G.city.safehouse.y, label: 'Safehouse' };
          G.feed.push({ text: 'Cash in hand! Every cop in Solmar is coming. Run!', t: G.time });
        }
      } else {
        m.grabT = 0;
      }
    } else if (near(G, m.target, 85)) {
      completeMission(G);
    }
  }
}

/** The one-line objective the HUD shows, plus the marker it points at. */
export function currentObjective(G) {
  const m = G.mission;
  if (m.index >= MISSIONS.length) {
    return { text: 'Solmar City is yours — free roam. Steal, drive, survive.', target: null, timer: 0, progress: 0 };
  }
  const i = m.index;
  if (i === 0) {
    return m.step === 0
      ? { text: 'Steal a car — press E near one', target: null, timer: 0, progress: 0 }
      : { text: "Drive to Rocco's Garage", target: m.target, timer: 0, progress: 0 };
  }
  if (i === 1) {
    return m.step === 0
      ? { text: 'Pick up the package at the east docks', target: m.target, timer: 0, progress: 0 }
      : { text: 'Deliver the package — beat the clock', target: m.target, timer: m.timer, progress: 0 };
  }
  if (i === 2) {
    return { text: 'Lose the cops — get your wanted level to zero', target: null, timer: 0, progress: 0 };
  }
  if (i === 3) {
    return { text: "Wreck Dante's red coupe", target: m.target, timer: 0, progress: 0 };
  }
  return m.step === 0
    ? { text: 'Reach Solmar National Bank', target: m.target, timer: 0, progress: 0 }
    : m.step === 1
      ? { text: 'Grab the cash — hold position', target: m.target, timer: 0, progress: m.grabT / 3 }
      : { text: 'Escape to the safehouse!', target: m.target, timer: 0, progress: 0 };
}
