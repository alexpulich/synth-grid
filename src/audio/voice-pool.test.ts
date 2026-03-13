import { describe, it, expect, vi } from 'vitest';
import { VoicePool } from './voice-pool';

function makeGainNode() {
  return {
    gain: { cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeCtx(currentTime = 0) {
  return {
    currentTime,
    createGain: vi.fn(() => makeGainNode()),
  } as never;
}

function makeDest() {
  return {} as never;
}

describe('VoicePool', () => {
  it('acquire returns a GainNode connected to destination', () => {
    const pool = new VoicePool();
    const ctx = makeCtx();
    const dest = makeDest();
    const node = pool.acquire(ctx, 0, dest, 1.0);
    expect(node).toBeDefined();
    expect(node.connect).toHaveBeenCalledWith(dest);
  });

  it('expired voices cleaned up on next acquire', () => {
    const pool = new VoicePool();
    const ctx = makeCtx(0);
    const dest = makeDest();

    // Acquire a voice that expires at t=0.5
    const v1 = pool.acquire(ctx, 0, dest, 0.5);

    // Advance time past expiration
    const ctx2 = makeCtx(1.0);
    pool.acquire(ctx2, 0, dest, 2.0);

    // The expired voice should have been disconnected
    expect(v1.disconnect).toHaveBeenCalled();
  });

  it('per-row limit (8): oldest voice for same row stolen', () => {
    const pool = new VoicePool();
    const ctx = makeCtx(0);
    const dest = makeDest();

    const voices = [];
    for (let i = 0; i < 8; i++) {
      voices.push(pool.acquire(ctx, 0, dest, 10 + i));
    }

    // 9th acquire on same row should steal the oldest
    pool.acquire(ctx, 0, dest, 20);
    expect(voices[0].gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(voices[0].disconnect).toHaveBeenCalled();
  });

  it('global limit (48): oldest voice stolen regardless of row', () => {
    const pool = new VoicePool();
    const ctx = makeCtx(0);
    const dest = makeDest();

    const first = pool.acquire(ctx, 0, dest, 100);
    // Fill to 48 using different rows
    for (let i = 1; i < 48; i++) {
      pool.acquire(ctx, i % 8, dest, 100);
    }

    // 49th should steal the very first
    pool.acquire(ctx, 7, dest, 100);
    expect(first.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(first.disconnect).toHaveBeenCalled();
  });

  it('stolen voice gain canceled and set to 0', () => {
    const pool = new VoicePool();
    const ctx = makeCtx(0);
    const dest = makeDest();

    const voices = [];
    for (let i = 0; i < 8; i++) {
      voices.push(pool.acquire(ctx, 0, dest, 10));
    }

    pool.acquire(ctx, 0, dest, 10);
    expect(voices[0].gain.cancelScheduledValues).toHaveBeenCalledWith(0);
    expect(voices[0].gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
  });

  it('multiple rows tracked independently (7+7 = no stealing)', () => {
    const pool = new VoicePool();
    const ctx = makeCtx(0);
    const dest = makeDest();

    const voicesRow0 = [];
    const voicesRow1 = [];
    for (let i = 0; i < 7; i++) {
      voicesRow0.push(pool.acquire(ctx, 0, dest, 10));
      voicesRow1.push(pool.acquire(ctx, 1, dest, 10));
    }

    // None should be stolen — each row has 7 (< 8 limit)
    for (const v of [...voicesRow0, ...voicesRow1]) {
      expect(v.gain.setValueAtTime).not.toHaveBeenCalled();
    }
  });

  it('acquire after steal keeps pool at limit', () => {
    const pool = new VoicePool();
    const createGain = vi.fn(() => makeGainNode());
    const ctx = { currentTime: 0, createGain } as never;
    const dest = makeDest();

    // Fill row to exactly 8
    for (let i = 0; i < 8; i++) {
      pool.acquire(ctx, 0, dest, 10);
    }

    // One more — steals one then adds one, net still 8
    pool.acquire(ctx, 0, dest, 10);
    // Another — again steal+add, still 8
    pool.acquire(ctx, 0, dest, 10);

    // createGain called 10 times total (8 + 2)
    expect(createGain).toHaveBeenCalledTimes(10);
  });

  it('cleanup only removes expired voices (endTime < now)', () => {
    const pool = new VoicePool();
    const ctx = makeCtx(0);
    const dest = makeDest();

    const v1 = pool.acquire(ctx, 0, dest, 0.5); // expires at 0.5
    const v2 = pool.acquire(ctx, 0, dest, 2.0); // expires at 2.0

    // Advance to 1.0 — v1 should be cleaned up, v2 should remain
    const ctx2 = makeCtx(1.0);
    pool.acquire(ctx2, 1, dest, 3.0);

    expect(v1.disconnect).toHaveBeenCalled();
    expect(v2.disconnect).not.toHaveBeenCalled();
  });
});
