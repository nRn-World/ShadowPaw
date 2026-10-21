/**
 * Procedural sound design for Shadow Paw.
 *
 * Everything is synthesised with WebAudio at runtime: no asset downloads, no
 * decode cost, and every effect can follow the live SFX slider. Sounds are
 * grouped into a handful of primitives (tone, noise burst, chord) so new
 * effects stay consistent instead of turning into one-off oscillator soup.
 */
export class AudioEngine {
    private static ctx: AudioContext | null = null;
    private static masterGain: GainNode | null = null;
    private static sfxVolume = 0.5;
    private static muted = false;

    /** Shared tone helper so every new sound follows the same envelope rules. */
    private static tone(opts: {
        type?: OscillatorType;
        from: number;
        to: number;
        duration: number;
        gain?: number;
        delay?: number;
        /** Optional low-pass, which turns a bright blip into a soft "thock". */
        filter?: number;
    }) {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const t0 = this.ctx.currentTime + (opts.delay || 0);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = opts.type || 'sine';
        osc.frequency.setValueAtTime(Math.max(20, opts.from), t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + opts.duration);
        gain.gain.setValueAtTime(0.0001, t0);
        // Tiny attack ramp: a hard start clicks on some browsers.
        gain.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
        let node: AudioNode = osc;
        if (opts.filter) {
            const lp = this.ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = opts.filter;
            node.connect(lp);
            node = lp;
        }
        node.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t0);
        osc.stop(t0 + opts.duration + 0.02);
    }

    /** Filtered noise burst - the backbone of impacts, wind and explosions. */
    private static noise(opts: {
        duration: number;
        gain?: number;
        delay?: number;
        from?: number;
        to?: number;
        type?: BiquadFilterType;
        q?: number;
    }) {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const t0 = this.ctx.currentTime + (opts.delay || 0);
        const length = Math.max(1, Math.floor(this.ctx.sampleRate * opts.duration));
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

        const src = this.ctx.createBufferSource();
        src.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = opts.type ?? 'lowpass';
        filter.Q.value = opts.q ?? 0.8;
        filter.frequency.setValueAtTime(opts.from ?? 2200, t0);
        filter.frequency.exponentialRampToValueAtTime(opts.to ?? 220, t0 + opts.duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(opts.gain ?? 0.25, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start(t0);
    }

    private static chord(frequencies: number[], duration: number, gain = 0.12, delay = 0, type: OscillatorType = 'triangle') {
        frequencies.forEach((f, i) => {
            this.tone({ type, from: f, to: f * 1.01, duration, gain, delay: delay + i * 0.055 });
        });
    }

    private static init() {
        if (!this.ctx) {
            const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!Ctor) return;
            this.ctx = new Ctor();
            this.masterGain = this.ctx.createGain();
            // A gentle limiter keeps stacked effects from clipping on loud moments.
            const limiter = this.ctx.createDynamicsCompressor();
            limiter.threshold.value = -10;
            limiter.knee.value = 18;
            limiter.ratio.value = 6;
            limiter.attack.value = 0.004;
            limiter.release.value = 0.18;
            this.masterGain.gain.value = this.sfxVolume;
            this.masterGain.connect(limiter);
            limiter.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') void this.ctx.resume();
    }

    public static setVolume(vol: number) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        this.applyMasterGain();
    }

    /** Master mute. The chosen SFX level is remembered, so unmuting restores it. */
    public static setMuted(muted: boolean) {
        this.muted = muted;
        this.applyMasterGain();
    }

    private static applyMasterGain() {
        if (!this.masterGain) return;
        const target = this.muted ? 0 : this.sfxVolume;
        // Ramp instead of jumping, so muting mid-jump does not click.
        const now = this.ctx?.currentTime ?? 0;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(target, now + 0.08);
    }

    // ------------------------------------------------------------- movement
    public static playJump() {
        this.tone({ type: 'sine', from: 300, to: 640, duration: 0.16, gain: 0.28 });
    }

    /** Short airy burst when a dash starts. */
    public static playDash() {
        this.tone({ type: 'sawtooth', from: 900, to: 180, duration: 0.16, gain: 0.16, filter: 2200 });
        this.noise({ duration: 0.2, gain: 0.1, from: 3200, to: 500, type: 'bandpass', q: 1.6 });
    }

    /** Soft landing thump, scaled by how hard the cat hit the floor. */
    public static playLand(power = 1) {
        this.tone({ type: 'sine', from: 160, to: 60, duration: 0.12, gain: 0.1 + power * 0.06, filter: 900 });
        this.noise({ duration: 0.1, gain: 0.04 + power * 0.03, from: 900, to: 180 });
    }

    // ------------------------------------------------------------- reward
    /** Rising arpeggio that climbs with the combo step. */
    public static playCombo(step: number) {
        const base = 420 * Math.pow(1.06, Math.min(step, 20));
        this.tone({ type: 'triangle', from: base, to: base * 1.5, duration: 0.12, gain: 0.16 });
    }

    /** Bright two-note blip for coins and pickups. */
    public static playCoin(streak = 0) {
        const shift = Math.min(streak, 12) * 18;
        this.tone({ type: 'square', from: 1100 + shift, to: 1500 + shift, duration: 0.06, gain: 0.07 });
        this.tone({ type: 'square', from: 1500 + shift, to: 2100 + shift, duration: 0.09, gain: 0.05, delay: 0.05 });
    }

    /** Soft "whoosh" for grazing a hazard without dying. */
    public static playNearMiss() {
        this.tone({ type: 'sine', from: 1400, to: 700, duration: 0.14, gain: 0.08 });
    }

    /** Triumphant chord when a level is cleared. */
    public static playLevelUp() {
        this.chord([523.25, 659.25, 783.99, 1046.5], 0.34, 0.13);
        this.tone({ type: 'sine', from: 1568, to: 1568, duration: 0.5, gain: 0.05, delay: 0.22 });
    }

    /** Descending blip for a lost life. */
    public static playLifeLost() {
        this.tone({ type: 'square', from: 420, to: 110, duration: 0.35, gain: 0.18, filter: 1600 });
    }

    /** Quick, soft confirmation for buttons in the menus. */
    public static playUiClick() {
        this.tone({ type: 'triangle', from: 720, to: 980, duration: 0.07, gain: 0.09 });
    }

    public static playUiHover() {
        this.tone({ type: 'sine', from: 520, to: 600, duration: 0.045, gain: 0.035 });
    }

    // ------------------------------------------------------------- combat
    public static playShoot() {
        this.tone({ type: 'square', from: 880, to: 220, duration: 0.08, gain: 0.13, filter: 2600 });
        this.noise({ duration: 0.06, gain: 0.05, from: 5200, to: 1200, type: 'highpass' });
    }

    public static playCollect() {
        this.tone({ type: 'sine', from: 600, to: 1800, duration: 0.16, gain: 0.22 });
    }

    public static playDamage() {
        this.tone({ type: 'sawtooth', from: 150, to: 50, duration: 0.24, gain: 0.34, filter: 700 });
        this.noise({ duration: 0.18, gain: 0.16, from: 900, to: 120 });
    }

    public static playExplosion() {
        this.noise({ duration: 0.34, gain: 0.3, from: 1800, to: 80 });
        this.tone({ type: 'sine', from: 120, to: 40, duration: 0.3, gain: 0.2 });
    }

    /** Shield-soak: a glassy ringing hit instead of a body blow. */
    public static playShieldBreak() {
        this.tone({ type: 'triangle', from: 1560, to: 620, duration: 0.28, gain: 0.16 });
        this.tone({ type: 'sine', from: 2340, to: 900, duration: 0.22, gain: 0.08, delay: 0.02 });
        this.noise({ duration: 0.16, gain: 0.12, from: 5200, to: 1400, type: 'highpass' });
    }

    /** Power-up pickup: a bright ascending sparkle. */
    public static playPowerup() {
        [660, 880, 1100, 1320].forEach((f, i) => {
            this.tone({ type: 'triangle', from: f, to: f * 1.06, duration: 0.16, gain: 0.1, delay: i * 0.06 });
        });
        this.noise({ duration: 0.22, gain: 0.05, from: 6000, to: 2400, type: 'highpass' });
    }

    /** Extra life: warm, slow chime. */
    public static playHeart() {
        this.chord([392, 523.25, 659.25], 0.42, 0.11, 0.02, 'sine');
    }

    /** Boss telegraph / phase change roar. */
    public static playBossRoar() {
        this.tone({ type: 'sawtooth', from: 90, to: 42, duration: 0.9, gain: 0.24, filter: 420 });
        this.tone({ type: 'square', from: 62, to: 34, duration: 1.05, gain: 0.12, filter: 300 });
        this.noise({ duration: 0.8, gain: 0.12, from: 600, to: 90 });
    }

    /** Grade stamp: snappy hit + sparkle. */
    public static playGrade() {
        this.tone({ type: 'triangle', from: 1046, to: 1046, duration: 0.12, gain: 0.12 });
        this.tone({ type: 'triangle', from: 1318, to: 1318, duration: 0.22, gain: 0.1, delay: 0.08 });
    }
}
