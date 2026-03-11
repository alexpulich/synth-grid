import { eventBus } from '../utils/event-bus';

export const MAX_CHAIN_LENGTH = 32;

export class PatternChain {
  private chain: number[] = [];
  private _songMode = false;
  private _chainPosition = 0;

  get songMode(): boolean { return this._songMode; }
  get chainPosition(): number { return this._chainPosition; }
  get length(): number { return this.chain.length; }

  toggleSongMode(): void {
    this._songMode = !this._songMode;
    this._chainPosition = 0;
    eventBus.emit('chain:mode-changed', this._songMode);
  }

  addToChain(bankIndex: number): void {
    if (this.chain.length >= MAX_CHAIN_LENGTH) return;
    this.chain.push(bankIndex);
    eventBus.emit('chain:updated', this.getChain());
  }

  removeFromChain(position: number): void {
    if (position < 0 || position >= this.chain.length) return;
    this.chain.splice(position, 1);
    if (this._chainPosition >= this.chain.length) {
      this._chainPosition = 0;
    }
    eventBus.emit('chain:updated', this.getChain());
  }

  moveItem(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.chain.length) return;
    if (toIndex < 0 || toIndex >= this.chain.length) return;
    if (fromIndex === toIndex) return;
    const [item] = this.chain.splice(fromIndex, 1);
    this.chain.splice(toIndex, 0, item);
    // Keep chain position tracking the same bank during playback
    if (this._chainPosition === fromIndex) {
      this._chainPosition = toIndex;
    } else if (fromIndex < this._chainPosition && toIndex >= this._chainPosition) {
      this._chainPosition--;
    } else if (fromIndex > this._chainPosition && toIndex <= this._chainPosition) {
      this._chainPosition++;
    }
    eventBus.emit('chain:updated', this.getChain());
  }

  clearChain(): void {
    this.chain = [];
    this._chainPosition = 0;
    eventBus.emit('chain:updated', this.getChain());
  }

  advanceChain(): number | null {
    if (this.chain.length === 0) return null;
    this._chainPosition = (this._chainPosition + 1) % this.chain.length;
    const nextBank = this.chain[this._chainPosition];
    eventBus.emit('chain:position-changed', this._chainPosition);
    return nextBank;
  }

  getCurrentChainBank(): number | null {
    if (this.chain.length === 0) return null;
    return this.chain[this._chainPosition];
  }

  resetPosition(): void {
    this._chainPosition = 0;
    if (this.chain.length > 0) {
      eventBus.emit('chain:position-changed', 0);
    }
  }

  getChain(): number[] { return [...this.chain]; }
}
