// Sound, synthesized only: no audio files. A WebAudio context starts on the
// first user gesture; the engine hum follows the car's speed, the siren wails
// while the player is wanted, and one-shots cover pickups, punches and jingles.
// M mutes everything.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenHigh: false,
    muted: false,
    sirenTimer: 0,

    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        // Engine: a low sawtooth through a low-pass, pitched by speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        const engineFilter = this.ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(engineFilter);
        engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        // Siren: a square wave that alternates two tones.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'square';
        this.sirenOsc.frequency.value = 720;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      } catch {
        this.ctx = null;
      }
    },

    setMuted(muted) {
      this.muted = muted;
      if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    },

    /** Called every frame: engine pitch by speed, siren while wanted. */
    update(dt, speed, wanted) {
      if (!this.ctx) return;
      const engineTarget = speed > 20 ? 0.05 + Math.min(0.1, speed / 6000) : 0;
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : engineTarget, this.ctx.currentTime, 0.1);
      if (this.engineOsc) this.engineOsc.frequency.value = 50 + speed * 0.16;
      this.sirenTimer -= dt;
      if (wanted > 0 && !this.muted) {
        if (this.sirenTimer <= 0) {
          this.sirenTimer = 0.42;
          this.sirenHigh = !this.sirenHigh;
          this.sirenOsc.frequency.value = this.sirenHigh ? 920 : 700;
        }
        this.sirenGain.gain.setTargetAtTime(0.028, this.ctx.currentTime, 0.1);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
    },

    blip(freq) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.18);
    },

    thud() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.26);
    },

    crash() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.35;
      src.connect(gain);
      gain.connect(this.master);
      src.start(t);
    },

    /** A little rising arpeggio for mission completions. */
    jingle() {
      if (!this.ctx || this.muted) return;
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        setTimeout(() => this.blip(freq), i * 110);
      });
    },
  };
  return audio;
}
