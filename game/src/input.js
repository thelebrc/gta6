// Keyboard and mouse input, read once per frame: held keys as a direction and a
// bitmask of actions that fired since the last read. Arrow keys and space never
// scroll the page while the game has focus.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PUNCH = 4;
export const ACTION_ENTER = 8;
export const ACTION_MUTE = 16;
export const ACTION_NEW = 32;

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (name) {
      held[name] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'Space') {
      actions |= ACTION_PUNCH;
      event.preventDefault();
    } else if (event.code === 'KeyE') {
      actions |= ACTION_ENTER;
    } else if (event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
    } else if (event.code === 'Escape' || event.code === 'KeyP') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    } else if (event.code === 'KeyN') {
      actions |= ACTION_NEW;
    }
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  }

  function onPointerDown() {
    actions |= ACTION_CONFIRM;
  }

  // A key released while the tab is hidden never sends keyup: let go on blur.
  function onBlur() {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.run = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    /** Steering (-1/0/1), throttle (-1/0/1) and run for this frame. */
    direction() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        run: held.run,
      };
    },
    /** The actions that fired since the last call; each is reported once. */
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
  };
}

/** A synthetic input for the screenshot autopilot: it pretends keys are held. */
export function createScriptedInput() {
  let dir = { x: 0, y: 0, run: false };
  let actions = 0;
  return {
    setDirection(next) { dir = next; },
    press(action) { actions |= action; },
    direction() { return dir; },
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
  };
}
