/**
 * Phase 8 — Mission Replay
 * ReplayControls — playback controls bar with scrubber, transport controls,
 * speed adjustments, and keyboard navigation.
 */

import React, { useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  FastForward,
} from 'lucide-react';
import { useReplayStore } from '../../store/replayStore';

export const ReplayControls: React.FC = () => {
  const {
    events,
    currentIndex,
    isPlaying,
    playbackSpeed,
    setCurrentIndex,
    setIsPlaying,
    setPlaybackSpeed,
    stepForward,
    stepBackward,
    resetReplay,
    skipToEnd,
  } = useReplayStore();

  const total = events.length;
  const currentEvent = currentIndex >= 0 && currentIndex < total ? events[currentIndex] : null;
  const firstEvent = total > 0 ? events[0] : null;
  const lastEvent = total > 0 ? events[total - 1] : null;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepBackward();
      } else if (e.code === 'Home') {
        e.preventDefault();
        resetReplay();
      } else if (e.code === 'End') {
        e.preventDefault();
        skipToEnd();
      }
    },
    [isPlaying, setIsPlaying, stepForward, stepBackward, resetReplay, skipToEnd]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentIndex(val);
  };

  const speeds = [0.5, 1, 2, 4];

  const formatEventTime = (isoString?: string) => {
    if (!isoString) return '--:--:--';
    const d = new Date(isoString);
    return !isNaN(d.getTime())
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '--:--:--';
  };

  return (
    <div className="p-4 rounded-xl bg-blackbox-surface border border-blackbox-border shadow-lg space-y-4">
      {/* Scrubber / Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono text-blackbox-muted">
          <span>{formatEventTime(firstEvent?.createdAt)}</span>
          <span className="text-cyan-400 font-bold">
            {formatEventTime(currentEvent?.createdAt)}
          </span>
          <span>{formatEventTime(lastEvent?.createdAt)}</span>
        </div>

        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={Math.max(0, currentIndex)}
            onChange={handleSliderChange}
            disabled={total === 0}
            className="w-full h-2 bg-blackbox-panel rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Replay timeline scrubber"
          />
        </div>
      </div>

      {/* Transport & Speed Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        {/* Step & Playback Buttons */}
        <div className="flex items-center gap-2">
          {/* Reset / Beginning */}
          <button
            onClick={resetReplay}
            disabled={total === 0 || currentIndex <= 0}
            className="p-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-blackbox-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset to beginning (Home)"
            aria-label="Reset replay to beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Previous Event */}
          <button
            onClick={stepBackward}
            disabled={total === 0 || currentIndex <= 0}
            className="p-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-blackbox-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Step backward one event (Left Arrow)"
            aria-label="Previous event"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Primary Play / Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={total === 0}
            className={`px-4 py-2 rounded-lg font-mono font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isPlaying
                ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-500/20'
                : 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg shadow-cyan-500/20'
            }`}
            title="Play / Pause timeline (Space)"
            aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* Next Event */}
          <button
            onClick={stepForward}
            disabled={total === 0 || currentIndex >= total - 1}
            className="p-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-blackbox-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Step forward one event (Right Arrow)"
            aria-label="Next event"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Skip to End */}
          <button
            onClick={skipToEnd}
            disabled={total === 0 || currentIndex >= total - 1}
            className="p-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-blackbox-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Skip to end (End)"
            aria-label="Skip to end of replay"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Adjustment Buttons */}
        <div className="flex items-center gap-1.5 bg-blackbox-bg p-1 rounded-lg border border-blackbox-border">
          <FastForward className="w-3.5 h-3.5 text-blackbox-muted ml-1.5 mr-0.5" />
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all ${
                playbackSpeed === s
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-blackbox-muted hover:text-blackbox-text hover:bg-blackbox-panel'
              }`}
              aria-label={`Set playback speed to ${s}x`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
