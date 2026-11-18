// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// five screens: title, play, paused, busted and wasted.
//
// ?seed=N fixes the city. ?shot=cover|street|mission|escape (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './world.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_NEW, ACTION_PAUSE, createInput,
} from './input.js';
import { createPlayer, hurtPlayer, updatePlayer } from './player.js';
import { spawnPeds, spawnTraffic, updateTraffic } from './traffic.js';
import { addWanted, applyBusted, applyWasted, updatePolice } from './police.js';
import { createMissions, currentObjective, startMission, updateMissions } from './missions.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
} from './render.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

/** Build a fresh Solmar City and everyone in it. */
export function createGame(gameSeed) {
  const random = createRandom(gameSeed);
  const city = createCity(random);
  const G = {
    seed: gameSeed,
    random,
    city,
    time: 0,
    screen: SCREEN_TITLE,
    player: createPlayer(city),
    cars: [],
    peds: [],
    cops: [],
    wanted: 0,
    wantedTimer: 0,
    money: 40,
    mission: createMissions(),
    feed: [],
    particles: [],
    skid: [],
    events: {},
    camera: { x: city.spawn.x, y: city.spawn.y, zoom: 1, shake: 0 },
    audio: createAudio(),
    save: loadSave(),
    objective: null,
  };
  spawnTraffic(G);
  spawnPeds(G);
  return G;
}

let G = createGame(seed);
const renderer = createRenderer(canvas);

function routePlayerEvents(events) {
  if (events.stole) {
    addWanted(G, 1);
    G.feed.push({ text: 'You stole a car. The heat is on.', t: G.time });
    G.audio.blip(660);
  }
  if (events.stolePolice) {
    addWanted(G, 2);
    G.feed.push({ text: 'You stole a police car! Bold. Very bold.', t: G.time });
  }
  if (events.hitPed) {
    addWanted(G, 1);
    G.feed.push({ text: 'You hit a pedestrian! Someone called it in.', t: G.time });
  }
  if (events.hitCop) {
    addWanted(G, 2);
    G.feed.push({ text: 'You hit an officer! The whole force is coming.', t: G.time });
  }
  if (events.hitRival) {
    G.feed.push({ text: 'You hit Dante\'s coupe! Keep going!', t: G.time });
  }
  if (events.crashed) {
    G.audio.crash();
    G.audio.thud();
  }
  if (events.carWrecked) {
    G.feed.push({ text: 'Your car is wrecked! Get out and find another.', t: G.time });
  }
}

function routeTrafficEvents(events) {
  if (events.crashed) {
    G.audio.crash();
    hurtPlayer(G, events.crashed / 45);
  }
  if (events.hitPed) {
    addWanted(G, 1);
    G.feed.push({ text: 'You ran someone over! Someone called it in.', t: G.time });
  }
  if (events.ranOver) {
    hurtPlayer(G, events.ranOver / 40);
    G.feed.push({ text: 'A car ran you over!', t: G.time });
  }
}

/** One fixed step of the whole simulation, plus camera, audio and cleanup. */
export function stepGame(game, dt, dir, actions) {
  const pEvents = updatePlayer(game, dt, dir, actions);
  routePlayerEvents(pEvents);
  const tEvents = updateTraffic(game, dt);
  routeTrafficEvents(tEvents);
  updatePolice(game, dt);
  updateMissions(game, dt);
  game.objective = currentObjective(game);

  for (const pt of game.particles) pt.t -= dt;
  game.particles = game.particles.filter((p) => p.t > 0);
  for (const s of game.skid) s.t -= dt * 0.4;
  game.skid = game.skid.filter((s) => s.t > 0);

  const cam = game.camera;
  const targetZoom = game.player.onFoot ? 1 : Math.max(0.78, 1 - Math.abs(game.player.speed || 0) / 3200);
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 3);
  cam.x += (game.player.x - cam.x) * Math.min(1, dt * 5);
  cam.y += (game.player.y - cam.y) * Math.min(1, dt * 5);
  cam.shake = Math.max(0, cam.shake - dt * 26);
  game.time += dt;
  game.audio.update(dt, game.player.onFoot ? 0 : Math.abs(game.player.speed || 0), game.wanted);

  if (game.events.missionComplete) {
    game.audio.jingle();
    saveGame(game);
  }
  game.events = {};
  if (game.feed.length > 12) game.feed.splice(0, game.feed.length - 12);
}

function startGame(fromSave) {
  G = createGame(seed);
  if (fromSave && G.save.missionsDone > 0) {
    G.money = G.save.money;
    for (let i = 0; i < G.save.missionsDone; i += 1) G.mission.done[i] = true;
    G.mission.index = G.save.missionsDone;
    G.feed.push({ text: `Welcome back, Marlowe. $${G.money} in your pocket.`, t: 0 });
  }
  startMission(G);
  G.screen = SCREEN_PLAY;
  G.audio.ensure();
  window.__solmar = G;
  announce('Playing. Follow the gold marker.');
}

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, G);
  G.screen = scene.screen;
  window.__solmar = G;
  let painted = 0;
  function paint() {
    renderer.draw(G, G.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let prevScreen = SCREEN_TITLE;

  function endScreen(next) {
    if (next === SCREEN_BUSTED) {
      applyBusted(G);
      startMission(G);
      saveGame(G);
      announce('Busted. Press Enter to get back on the streets.');
    } else if (next === SCREEN_WASTED) {
      applyWasted(G);
      startMission(G);
      saveGame(G);
      announce('Wasted. Press Enter to get back on the streets.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      G.audio.ensure();
      G.audio.setMuted(!G.audio.muted);
      G.feed.push({ text: G.audio.muted ? 'Sound off.' : 'Sound on.', t: G.time });
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(true);
      else if (actions & ACTION_NEW) startGame(false);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE) {
      // Attract mode: the city lives behind the title.
      updateTraffic(G, STEP);
      G.time += STEP;
      G.camera.x = G.city.spawn.x + Math.sin(G.time * 0.05) * 120;
      G.camera.y = G.city.spawn.y + Math.cos(G.time * 0.04) * 90;
      accumulator = 0;
    } else if (screen === SCREEN_PLAY) {
      // One-shot presses count once per frame, not once per fixed step.
      let first = true;
      while (accumulator >= STEP) {
        stepGame(G, STEP, input.direction(), first ? actions : 0);
        first = false;
        accumulator -= STEP;
        if (G.screen === SCREEN_BUSTED || G.screen === SCREEN_WASTED) break;
      }
      if (G.screen !== SCREEN_PLAY) {
        endScreen(G.screen);
        screen = G.screen;
      }
    } else {
      accumulator = 0;
      G.audio.update(0, 0, 0);
    }
    if (screen !== prevScreen) {
      prevScreen = screen;
      G.screen = screen;
    }
    renderer.draw(G, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar City. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
