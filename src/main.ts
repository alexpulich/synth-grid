import { AudioEngine } from './audio/audio-engine';
import { Sequencer } from './sequencer/sequencer';
import { Scheduler } from './audio/scheduler';
import { Transport } from './sequencer/transport';
import { MidiOutput } from './midi/midi-output';
import { AppUI } from './ui/app';

const audioEngine = new AudioEngine();
const sequencer = new Sequencer();
const midiOutput = new MidiOutput();
const appRef: { current: AppUI | null } = { current: null };

const scheduler = new Scheduler(audioEngine, sequencer, (step) => {
  if (sequencer.isPlaying && appRef.current) {
    appRef.current.onStepAdvance(step);
  }
}, midiOutput);

const transport = new Transport(sequencer, scheduler, audioEngine);

const app = new AppUI(
  document.getElementById('app')!,
  sequencer,
  transport,
  audioEngine,
  midiOutput,
);
appRef.current = app;

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Silent failure — PWA is optional
  });
}
