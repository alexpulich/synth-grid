import type { Sequencer } from '../sequencer/sequencer';
import type { AudioEngine } from '../audio/audio-engine';
import type { PatternData } from './pattern-library-storage';
import { DELAY_DIVISIONS } from '../audio/effects/delay';
import { NUM_ROWS } from '../types';

export function captureSnapshot(
  sequencer: Sequencer,
  audioEngine: AudioEngine,
  getDelayDivisionIndex: () => number,
): PatternData {
  return {
    grids: sequencer.getAllGrids().map(b => b.map(r => [...r])),
    probabilities: sequencer.getAllProbabilities().map(b => b.map(r => [...r])),
    pitchOffsets: sequencer.getAllPitchOffsets().map(b => [...b]),
    noteGrids: sequencer.getAllNoteGrids().map(b => b.map(r => [...r])),
    rowVolumes: sequencer.getAllRowVolumes().map(b => [...b]),
    rowPans: sequencer.getAllRowPans().map(b => [...b]),
    filterLocks: sequencer.getAllFilterLocks().map(b =>
      b.map(r => r.map(v => isNaN(v) ? null : v)),
    ),
    ratchets: sequencer.getAllRatchets().map(b => b.map(r => [...r])),
    conditions: sequencer.getAllConditions().map(b => b.map(r => [...r])),
    gates: sequencer.getAllGates().map(b => b.map(r => [...r])),
    slides: sequencer.getAllSlides().map(b => b.map(r => [...r])),
    rowSwings: sequencer.getAllRowSwings().map(b => [...b]),
    reverbSends: sequencer.getAllReverbSends().map(b => [...b]),
    delaySends: sequencer.getAllDelaySends().map(b => [...b]),
    automationData: sequencer.getAllAutomation().map(bank =>
      bank.map(param =>
        param.map(row => row.map(v => isNaN(v) ? null : v)),
      ),
    ),
    rowLengths: sequencer.getAllRowLengths().map(b => [...b]),
    tempo: sequencer.tempo,
    selectedScale: sequencer.selectedScale,
    rootNote: sequencer.rootNote,
    soundParams: sequencer.getAllSoundParams().map(p => ({ ...p })),
    humanize: sequencer.humanize,
    sidechainEnabled: sequencer.sidechainEnabled,
    sidechainDepth: sequencer.sidechainDepth,
    sidechainRelease: sequencer.sidechainRelease,
    saturationDrive: audioEngine.saturation.drive,
    saturationTone: audioEngine.saturation.tone,
    eqLow: audioEngine.eq.low,
    eqMid: audioEngine.eq.mid,
    eqHigh: audioEngine.eq.high,
    delayDivision: getDelayDivisionIndex(),
  };
}

export function loadSnapshot(
  data: PatternData,
  sequencer: Sequencer,
  audioEngine: AudioEngine,
  effectsPanel?: {
    setDelayDivisionIndex(i: number): void;
    refresh(ae: AudioEngine, s: Sequencer): void;
  },
): void {
  // Convert null -> NaN for filter locks
  const restoredFilterLocks = data.filterLocks.map(b =>
    b.map(r => r.map(v => v === null ? NaN : v)),
  );
  // Convert null -> NaN for automation data
  const restoredAutomation = data.automationData?.map(bank =>
    bank.map(param =>
      param.map(row => row.map(v => v === null ? NaN : v)),
    ),
  );
  sequencer.loadFullState(
    data.grids, data.tempo, 0, 0,
    data.probabilities, data.pitchOffsets, data.noteGrids,
    data.rowVolumes, data.rowPans, restoredFilterLocks,
    data.ratchets, data.conditions,
    data.rowSwings, data.gates, data.slides,
    data.reverbSends, data.delaySends,
    restoredAutomation,
    data.rowLengths,
  );
  sequencer.setScale(data.selectedScale, data.rootNote);
  sequencer.setSidechain(data.sidechainEnabled, data.sidechainDepth, data.sidechainRelease);
  sequencer.humanize = data.humanize;
  sequencer.loadSoundParams(data.soundParams);
  for (let row = 0; row < NUM_ROWS; row++) {
    audioEngine.soundParams[row] = { ...sequencer.getSoundParams(row) };
  }
  audioEngine.saturation.setDrive(data.saturationDrive);
  audioEngine.saturation.setTone(data.saturationTone);
  audioEngine.eq.setLow(data.eqLow);
  audioEngine.eq.setMid(data.eqMid);
  audioEngine.eq.setHigh(data.eqHigh);
  if (effectsPanel && data.delayDivision !== undefined && data.delayDivision < DELAY_DIVISIONS.length) {
    effectsPanel.setDelayDivisionIndex(data.delayDivision);
    audioEngine.delay.setTimeFromDivision(data.tempo, DELAY_DIVISIONS[data.delayDivision].mult);
    effectsPanel.refresh(audioEngine, sequencer);
  }
}
