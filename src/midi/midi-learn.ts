import type { MidiCCMapping } from '../types';
import { eventBus } from '../utils/event-bus';

export class MidiLearn {
  private _armed = false;
  private _pendingCC: { cc: number; channel: number } | null = null;
  private mappings: MidiCCMapping[] = [];
  private applyCallback: ((target: string, value: number) => void) | null = null;

  get armed(): boolean { return this._armed; }
  get pendingCC(): { cc: number; channel: number } | null { return this._pendingCC; }
  get currentMappings(): MidiCCMapping[] { return [...this.mappings]; }

  onApply(callback: (target: string, value: number) => void): void {
    this.applyCallback = callback;
  }

  armLearn(): void {
    this._armed = true;
    this._pendingCC = null;
    eventBus.emit('midi:learn-toggle', true);
  }

  cancelLearn(): void {
    this._armed = false;
    this._pendingCC = null;
    eventBus.emit('midi:learn-toggle', false);
  }

  /** Called after user selects a target from the dropdown */
  assignTarget(target: string): void {
    if (!this._pendingCC) return;

    // Remove existing mapping for this CC+channel combo
    this.mappings = this.mappings.filter(
      (m) => !(m.cc === this._pendingCC!.cc && m.channel === this._pendingCC!.channel),
    );
    // Remove existing mapping for this target
    this.mappings = this.mappings.filter((m) => m.target !== target);

    this.mappings.push({
      channel: this._pendingCC.channel,
      cc: this._pendingCC.cc,
      target,
    });

    this._armed = false;
    this._pendingCC = null;
    eventBus.emit('midi:learn-toggle', false);
    eventBus.emit('midi:mapping-changed', [...this.mappings]);
  }

  /** Process incoming CC message */
  handleCC(cc: number, value: number, channel: number): void {
    // If armed and waiting for CC capture, store it
    if (this._armed && !this._pendingCC) {
      this._pendingCC = { cc, channel };
      eventBus.emit('midi:cc-captured', { cc, channel });
      return;
    }

    // Normal CC: find mapping and apply
    const mapping = this.mappings.find(
      (m) => m.cc === cc && m.channel === channel,
    );
    if (mapping && this.applyCallback) {
      this.applyCallback(mapping.target, value / 127);
    }
  }

  loadMappings(mappings: MidiCCMapping[]): void {
    this.mappings = [...mappings];
  }

  removeMapping(target: string): void {
    this.mappings = this.mappings.filter((m) => m.target !== target);
    eventBus.emit('midi:mapping-changed', [...this.mappings]);
  }
}
