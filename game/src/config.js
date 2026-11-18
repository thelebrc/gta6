// Solmar City — every tuning number and colour in one place.
// The city is a seeded grid: roads every BLOCK+ROAD_W pixels, buildings inside the
// blocks, a beach and open water along the south edge. The canvas is a window that
// follows the player; nothing below depends on the screen size.

export const STEP = 1 / 60;

export const WORLD = {
  cols: 9,
  rows: 8,
  block: 230,
  road: 70,
  beach: 170,
  water: 260,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 185,
  runSpeed: 305,
  punchRange: 52,
  punchArc: 1.1,
  punchCooldown: 0.38,
  punchDamage: 34,
  health: 100,
};

export const CAR = {
  // Arcade handling: speed is a scalar along the heading, with a little lateral slide.
  accel: 520,
  brake: 760,
  reverseAccel: 320,
  maxSpeed: 620,
  maxReverse: 220,
  steerRate: 2.35,
  grip: 6.5,
  radius: 20,
  enterRange: 78,
  health: 100,
};

export const CAR_TYPES = {
  sedan: { length: 64, width: 30, color: '#5b7fa6', topSpeed: 520, accel: 480, label: 'Sedan' },
  taxi: { length: 64, width: 30, color: '#f2b705', topSpeed: 540, accel: 500, label: 'Taxi' },
  coupe: { length: 60, width: 28, color: '#b8452e', topSpeed: 580, accel: 560, label: 'Coupe' },
  truck: { length: 84, width: 34, color: '#7a6a58', topSpeed: 430, accel: 380, label: 'Truck' },
  sports: { length: 62, width: 29, color: '#c62f5b', topSpeed: 680, accel: 640, label: 'Sports' },
  police: { length: 66, width: 30, color: '#1f2a44', topSpeed: 640, accel: 620, label: 'Police' },
};

export const TRAFFIC = {
  count: 16,
  cruiseMin: 130,
  cruiseMax: 210,
  stopGap: 58,
  lookAhead: 120,
};

export const PEDS = {
  count: 26,
  walkMin: 42,
  walkMax: 78,
  fleeSpeed: 190,
};

export const WANTED = {
  max: 5,
  decaySeconds: 20,
  steal: 1,
  hitPed: 1,
  hitCop: 2,
  maxPoliceCars: 3,
  maxCops: 3,
  spawnDistance: 620,
  despawnDistance: 1500,
};

export const MISSION_REWARDS = [500, 800, 1200, 1500, 5000];

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4c',
  road: '#3d3f45',
  roadEdge: '#565864',
  sidewalk: '#9a9a92',
  lane: '#e8d44d',
  sand: '#e3c98f',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  parkTree: '#2e6b34',
  parkTree2: '#3f8340',
  buildingWall: '#8d8578',
  roofTerra: '#b65c38',
  roofSlate: '#4a5a6a',
  roofCream: '#d9c9a3',
  roofBrick: '#8e4a3c',
  roofGlass: '#5f8fa8',
  pier: '#7a5c3e',
  stadium: '#3f7a4a',
  containerA: '#c65a2e',
  containerB: '#2e7a8a',
  containerC: '#7a9a3a',
  playerJacket: '#e8a13a',
  playerPants: '#2c3a55',
  policeBlue: '#2b4acb',
  hudPanel: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f4f6f8',
  hudMuted: '#aab4c0',
  gold: '#f2c94c',
  danger: '#e5534b',
  ok: '#58c96b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-city.save.v1';

/** The city is called Solmar City; the player is a newcomer named Marlowe Vane. */
export const STORY = {
  city: 'Solmar City',
  hero: 'Marlowe Vane',
  blurb:
    'Marlowe Vane arrives in Solmar City with forty dollars and a borrowed jacket. ' +
    'Five jobs stand between him and the big score — if the Solmar police do not catch him first.',
};
