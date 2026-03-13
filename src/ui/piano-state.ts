import type { ScaleDefinition } from '../utils/scales';
import { scaleDegreesToSemitones } from '../utils/scales';
import { VELOCITY_OFF } from '../types';

/**
 * Compute which semitone offsets are available for the piano roll
 * based on the current scale. Returns pitches sorted descending.
 */
export function computePitchRows(scale: ScaleDefinition): number[] {
  if (scale.intervals.length === 12) {
    // Chromatic: all 25 semitones
    const pitches: number[] = [];
    for (let s = 12; s >= -12; s--) {
      pitches.push(s);
    }
    return pitches;
  }

  // Non-chromatic: enumerate scale degrees that produce semitones in [-12, +12]
  const seen = new Set<number>();
  const pitches: number[] = [];
  const len = scale.intervals.length;
  const maxDegrees = Math.ceil(24 / 12 * len) + len;

  for (let degree = -maxDegrees; degree <= maxDegrees; degree++) {
    const semitones = scaleDegreesToSemitones(scale, degree);
    if (semitones >= -12 && semitones <= 12 && !seen.has(semitones)) {
      seen.add(semitones);
      pitches.push(semitones);
    }
  }

  // Sort descending (highest pitch at top)
  pitches.sort((a, b) => b - a);
  return pitches;
}

export type CellAction = 'activate' | 'erase' | 'move';

/**
 * Determine what action to take when a cell is toggled.
 * Pure logic — no side effects.
 */
export function determineCellAction(currentVel: number, currentNote: number, targetPitch: number): CellAction {
  if (currentVel === VELOCITY_OFF) {
    return 'activate';
  } else if (currentNote === targetPitch) {
    return 'erase';
  } else {
    return 'move';
  }
}

/**
 * Determine what action to take during a drag operation.
 * Returns null if the cell should be skipped.
 */
export function getDragEffect(
  dragMode: 'paint' | 'erase',
  currentVel: number,
  currentNote: number,
  targetPitch: number,
): CellAction | null {
  if (dragMode === 'paint') {
    if (currentVel === VELOCITY_OFF) {
      return 'activate';
    } else if (currentNote !== targetPitch) {
      return 'move';
    }
    return null;
  } else {
    // Erase mode: only erase if the cell matches the target pitch
    if (currentVel !== VELOCITY_OFF && currentNote === targetPitch) {
      return 'erase';
    }
    return null;
  }
}
