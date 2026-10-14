/**
 * Phase 8 — Mission Replay
 * Replay Engine — single authoritative playback controller.
 *
 * Coordinates timeline progression using normalized inter-event time deltas
 * with bounded delays (min 300ms, max 3000ms) modulated by playback speed (0.5x, 1x, 2x, 4x).
 * Runs independently of component render lifecycles.
 */

import { useReplayStore } from '../../store/replayStore';

const MIN_EVENT_DELAY_MS = 300;
const MAX_EVENT_DELAY_MS = 3000;

class ReplayEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  constructor() {
    // Listen to play state changes from store
    useReplayStore.subscribe((state, prevState) => {
      if (state.isPlaying && !prevState.isPlaying) {
        this.start();
      } else if (!state.isPlaying && prevState.isPlaying) {
        this.stop();
      }
    });
  }

  /**
   * Start playback cycle.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNextStep();
  }

  /**
   * Stop/pause playback.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Calculate normalized delay in ms between current event and next event.
   */
  private calculateNextDelay(): number {
    const store = useReplayStore.getState();
    const { currentIndex, events, playbackSpeed } = store;

    if (currentIndex < 0 || currentIndex >= events.length - 1) {
      return MIN_EVENT_DELAY_MS;
    }

    const currentEvent = events[currentIndex];
    const nextEvent = events[currentIndex + 1];

    const currentMs = new Date(currentEvent.createdAt).getTime();
    const nextMs = new Date(nextEvent.createdAt).getTime();

    const rawDelta = Math.max(0, nextMs - currentMs);

    // If events happened within seconds, use compressed proportional time
    // Scale down real minutes/hours: 1 minute real time -> ~500ms
    let scaledMs = rawDelta > 0 ? Math.log10(rawDelta + 10) * 400 : MIN_EVENT_DELAY_MS;

    // Clamp between min and max bounds
    const clampedMs = Math.max(MIN_EVENT_DELAY_MS, Math.min(scaledMs, MAX_EVENT_DELAY_MS));

    // Modulate by speed
    const effectiveSpeed = Math.max(0.25, playbackSpeed || 1);
    return Math.round(clampedMs / effectiveSpeed);
  }

  private scheduleNextStep(): void {
    if (!this.isRunning) return;

    const store = useReplayStore.getState();
    const { currentIndex, events } = store;

    // Check if reached end of timeline
    if (currentIndex >= events.length - 1) {
      this.stop();
      store.setIsPlaying(false);
      return;
    }

    const delay = this.calculateNextDelay();

    this.timer = setTimeout(() => {
      if (!this.isRunning) return;

      const currentStore = useReplayStore.getState();
      if (!currentStore.isPlaying) {
        this.stop();
        return;
      }

      currentStore.stepForward();

      // Continue to next event if still running
      this.scheduleNextStep();
    }, delay);
  }
}

export const replayEngine = new ReplayEngine();
