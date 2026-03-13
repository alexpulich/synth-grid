import { describe, it, expect } from 'vitest';
import { MuteScenes, NUM_MUTE_SCENES } from './mute-scenes';

describe('MuteScenes', () => {
  function create(): MuteScenes {
    return new MuteScenes();
  }

  const sampleScene = () => ({
    muted: [true, false, false, true, false, false, false, false],
    soloRow: null as number | null,
  });

  it('initial: all 8 slots empty', () => {
    const scenes = create();
    for (let i = 0; i < NUM_MUTE_SCENES; i++) {
      expect(scenes.hasScene(i)).toBe(false);
      expect(scenes.recallScene(i)).toBeNull();
    }
  });

  it('saveScene stores and recallScene retrieves', () => {
    const scenes = create();
    const data = sampleScene();
    scenes.saveScene(0, data);
    expect(scenes.hasScene(0)).toBe(true);
    const recalled = scenes.recallScene(0);
    expect(recalled).toEqual(data);
  });

  it('recallScene returns a copy (no mutation leak)', () => {
    const scenes = create();
    scenes.saveScene(0, sampleScene());
    const a = scenes.recallScene(0)!;
    a.muted[0] = false;
    a.soloRow = 3;
    const b = scenes.recallScene(0)!;
    expect(b.muted[0]).toBe(true);
    expect(b.soloRow).toBeNull();
  });

  it('saveScene stores a copy (input mutation does not affect stored scene)', () => {
    const scenes = create();
    const data = sampleScene();
    scenes.saveScene(0, data);
    data.muted[0] = false;
    data.soloRow = 5;
    const recalled = scenes.recallScene(0)!;
    expect(recalled.muted[0]).toBe(true);
    expect(recalled.soloRow).toBeNull();
  });

  it('scenes are independent across slots', () => {
    const scenes = create();
    const scene0 = { muted: [true, false, false, false, false, false, false, false], soloRow: null };
    const scene1 = { muted: [false, true, false, false, false, false, false, false], soloRow: 1 };
    scenes.saveScene(0, scene0);
    scenes.saveScene(1, scene1);
    expect(scenes.recallScene(0)).toEqual(scene0);
    expect(scenes.recallScene(1)).toEqual(scene1);
  });

  it('loadScenes restores all slots', () => {
    const scenes = create();
    const data: (ReturnType<typeof sampleScene> | null)[] = new Array(NUM_MUTE_SCENES).fill(null);
    data[2] = sampleScene();
    data[5] = { muted: [false, false, false, false, false, false, false, true], soloRow: 7 };
    scenes.loadScenes(data);

    expect(scenes.hasScene(0)).toBe(false);
    expect(scenes.hasScene(2)).toBe(true);
    expect(scenes.recallScene(2)).toEqual(data[2]);
    expect(scenes.hasScene(5)).toBe(true);
    expect(scenes.recallScene(5)).toEqual(data[5]);
  });

  it('getAllScenes returns copies of all slots', () => {
    const scenes = create();
    scenes.saveScene(3, sampleScene());
    const all = scenes.getAllScenes();
    expect(all).toHaveLength(NUM_MUTE_SCENES);
    expect(all[3]).toEqual(sampleScene());
    expect(all[0]).toBeNull();
    // Verify copy
    all[3]!.muted[0] = false;
    expect(scenes.recallScene(3)!.muted[0]).toBe(true);
  });
});
