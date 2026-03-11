import { AudioEngine } from './audio/audio-engine';
import { Sequencer } from './sequencer/sequencer';
import { Scheduler } from './audio/scheduler';
import { Transport } from './sequencer/transport';
import { MidiOutput } from './midi/midi-output';
import { AppUI } from './ui/app';

const audioEngine = new AudioEngine();
const sequencer = new Sequencer();
const midiOutput = new MidiOutput();
let app: AppUI;

const scheduler = new Scheduler(audioEngine, sequencer, (step) => {
  if (sequencer.isPlaying) {
    app.onStepAdvance(step);
  }
}, midiOutput);

const transport = new Transport(sequencer, scheduler, audioEngine);

app = new AppUI(
  document.getElementById('app')!,
  sequencer,
  transport,
  audioEngine,
  midiOutput,
);
