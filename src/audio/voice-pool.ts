const MAX_PER_ROW = 8;
const MAX_GLOBAL = 48;

interface Voice {
  gainNode: GainNode;
  endTime: number;
  row: number;
}

export class VoicePool {
  private voices: Voice[] = [];

  acquire(ctx: AudioContext, row: number, dest: AudioNode, endTime: number): GainNode {
    this.cleanup(ctx.currentTime);

    // Steal oldest voice for this row if at per-row limit
    const rowVoices = this.voices.filter(v => v.row === row);
    if (rowVoices.length >= MAX_PER_ROW) {
      this.steal(rowVoices[0], ctx.currentTime);
    }

    // Steal oldest global voice if at global limit
    if (this.voices.length >= MAX_GLOBAL) {
      this.steal(this.voices[0], ctx.currentTime);
    }

    const gainNode = ctx.createGain();
    gainNode.connect(dest);

    this.voices.push({ gainNode, endTime, row });
    return gainNode;
  }

  private steal(voice: Voice, now: number): void {
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(0, now);
    voice.gainNode.disconnect();
    const idx = this.voices.indexOf(voice);
    if (idx !== -1) this.voices.splice(idx, 1);
  }

  private cleanup(now: number): void {
    for (let i = this.voices.length - 1; i >= 0; i--) {
      if (this.voices[i].endTime < now) {
        this.voices[i].gainNode.disconnect();
        this.voices.splice(i, 1);
      }
    }
  }
}
