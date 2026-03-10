export const NUM_MUTE_SCENES = 8;

export interface MuteSceneData {
  muted: boolean[];
  soloRow: number | null;
}

export class MuteScenes {
  private scenes: (MuteSceneData | null)[] = new Array(NUM_MUTE_SCENES).fill(null);

  saveScene(index: number, data: MuteSceneData): void {
    this.scenes[index] = {
      muted: [...data.muted],
      soloRow: data.soloRow,
    };
  }

  recallScene(index: number): MuteSceneData | null {
    const scene = this.scenes[index];
    if (!scene) return null;
    return { muted: [...scene.muted], soloRow: scene.soloRow };
  }

  hasScene(index: number): boolean {
    return this.scenes[index] !== null;
  }

  getAllScenes(): (MuteSceneData | null)[] {
    return this.scenes.map(s => s ? { muted: [...s.muted], soloRow: s.soloRow } : null);
  }

  loadScenes(data: (MuteSceneData | null)[]): void {
    for (let i = 0; i < NUM_MUTE_SCENES; i++) {
      const d = data[i];
      this.scenes[i] = d ? { muted: [...d.muted], soloRow: d.soloRow } : null;
    }
  }
}
