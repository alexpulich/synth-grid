import { NUM_ROWS } from '../types';
import { eventBus } from '../utils/event-bus';

export class MuteState {
  private muted: boolean[] = new Array(NUM_ROWS).fill(false);
  private soloRow: number | null = null;

  toggleMute(row: number): void {
    if (this.soloRow === row) {
      this.soloRow = null;
    }
    this.muted[row] = !this.muted[row];
    eventBus.emit('mute:changed', this.getState());
  }

  toggleSolo(row: number): void {
    if (this.soloRow === row) {
      this.soloRow = null;
    } else {
      this.soloRow = row;
      this.muted.fill(false);
    }
    eventBus.emit('mute:changed', this.getState());
  }

  isRowAudible(row: number): boolean {
    if (this.soloRow !== null) {
      return row === this.soloRow;
    }
    return !this.muted[row];
  }

  getState(): { muted: boolean[]; soloRow: number | null } {
    return { muted: [...this.muted], soloRow: this.soloRow };
  }
}
