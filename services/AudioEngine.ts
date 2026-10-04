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
    }) {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const t0 = this.ctx.currentTime + (opts.delay || 0);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = opts.type || 'sine';
        osc.frequency.setValueAtTime(Math.max(20, opts.from), t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + opts.duration);
        gain.gain.setValueAtTime(opts.gain ?? 0.2, t0);
        gain.gain.exponentialRampToValueAtTime(0.01, t0 + opts.duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t0);
        osc.stop(t0 + opts.duration + 0.02);
    }

    private static init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.sfxVolume;
            this.masterGain.connect(this.ctx.destination);
        }
    }

    public static setVolume(vol: number) {
        this.sfxVolume = vol;
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

    public static playJump() {
        this.tone({ type: 'sine', from: 300, to: 640, duration: 0.16, gain: 0.28 });
    }

    /** Short airy burst when a dash starts. */
    public static playDash() {
        this.tone({ type: 'sawtooth', from: 900, to: 180, duration: 0.16, gain: 0.16 });
    }

    /** Rising arpeggio that climbs with the combo step. */
    public static playCombo(step: number) {
        const base = 420 * Math.pow(1.06, Math.min(step, 20));
        this.tone({ type: 'triangle', from: base, to: base * 1.5, duration: 0.12, gain: 0.16 });
    }

    /** Bright two-note blip for coins and pickups. */
    public static playCoin(streak = 0) {
        const shift = Math.min(streak, 12) * 18;
        this.tone({ type: 'square', from: 1100 + shift, to: 1500 + shift, duration: 0.06, gain: 0.09 });
        this.tone({ type: 'square', from: 1500 + shift, to: 2100 + shift, duration: 0.09, gain: 0.07, delay: 0.05 });
    }

    /** Soft "whoosh" for grazing a hazard without dying. */
    public static playNearMiss() {
        this.tone({ type: 'sine', from: 1400, to: 700, duration: 0.14, gain: 0.08 });
    }

    /** Triumphant chord when a level is cleared. */
    public static playLevelUp() {
        [523, 659, 784, 1047].forEach((f, i) => {
            this.tone({ type: 'triangle', from: f, to: f * 1.02, duration: 0.28, gain: 0.14, delay: i * 0.07 });
        });
    }

    /** Descending blip for a lost life. */
    public static playLifeLost() {
        this.tone({ type: 'square', from: 420, to: 110, duration: 0.35, gain: 0.18 });
    }

    public static playShoot() {
        this.tone({ type: 'square', from: 800, to: 200, duration: 0.1, gain: 0.2 });
    }

    public static playCollect() {
        this.tone({ type: 'sine', from: 600, to: 1800, duration: 0.16, gain: 0.22 });
    }

    public static playDamage() {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    public static playExplosion() {
        this.init();
        if (!this.ctx || !this.masterGain) return;

        const bufferSize = this.ctx.sampleRate * 0.3; // 300ms
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start();
    }
}
