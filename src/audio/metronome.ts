export class Metronome {
  private readonly gainNode: GainNode;
  private _enabled = false;
  private _volume = 0.5;

  constructor(private readonly ctx: AudioContext) {
    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(this._volume, 0);
    this.gainNode.connect(ctx.destination);
  }

  get enabled(): boolean { return this._enabled; }
  get volume(): number { return this._volume; }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  setVolume(v: number): void {
    this._volume = v;
    this.gainNode.gain.setValueAtTime(v, this.ctx.currentTime);
  }

  scheduleClick(time: number, isAccent: boolean): void {
    if (!this._enabled) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
    env.gain.setValueAtTime(this._volume * (isAccent ? 1.0 : 0.6), time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(env);
    env.connect(this.gainNode);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}
