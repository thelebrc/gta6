// Saving between visits: money and finished jobs live in localStorage, so a
// new game can continue where the last one left off. Nothing else is kept.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 40, missionsDone: 0 };
    const data = JSON.parse(raw);
    return {
      money: typeof data.money === 'number' ? Math.max(0, Math.floor(data.money)) : 40,
      missionsDone: typeof data.missionsDone === 'number' ? Math.min(5, Math.max(0, data.missionsDone | 0)) : 0,
    };
  } catch {
    return { money: 40, missionsDone: 0 };
  }
}

export function saveGame(G) {
  try {
    const done = G.mission.done.filter(Boolean).length;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ money: Math.floor(G.money), missionsDone: done }));
  } catch {
    // Storage can be off (private windows): the game still plays.
  }
}
