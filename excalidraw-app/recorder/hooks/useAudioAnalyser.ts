import { useEffect, useMemo, useState } from "react";

import type { AudioInputLevel } from "../types";

const DEFAULT_LEVEL: AudioInputLevel = {
  level: 0,
  bars: [0, 0, 0],
};

const BAR_COUNT = 32;

export const useAudioAnalyser = (
  stream: MediaStream | null,
  enabled: boolean,
): AudioInputLevel & { spectrum: number[] } => {
  const [level, setLevel] = useState<AudioInputLevel>(DEFAULT_LEVEL);
  const [spectrum, setSpectrum] = useState<number[]>(
    new Array(BAR_COUNT).fill(0),
  );

  useEffect(() => {
    if (!stream || !enabled) {
      setLevel(DEFAULT_LEVEL);
      setSpectrum(new Array(BAR_COUNT).fill(0));
      return;
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const audioCtx = new AudioCtx();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);

    let rafId = 0;

    const tick = () => {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i += 1) {
        const normalized = (timeData[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      const normalizedLevel = Math.min(1, rms * 3);

      const bars: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        const start = Math.floor((freqData.length / 3) * i);
        const end = Math.floor((freqData.length / 3) * (i + 1));
        let total = 0;
        for (let j = start; j < end; j += 1) {
          total += freqData[j];
        }
        const avg = total / Math.max(1, end - start);
        bars.push(Math.min(1, avg / 180));
      }

      const nextSpectrum = new Array(BAR_COUNT).fill(0).map((_, index) => {
        const start = Math.floor((freqData.length / BAR_COUNT) * index);
        const end = Math.floor((freqData.length / BAR_COUNT) * (index + 1));
        let total = 0;
        for (let j = start; j < end; j += 1) {
          total += freqData[j];
        }
        const avg = total / Math.max(1, end - start);
        return Math.min(1, avg / 255);
      });

      setLevel({ level: normalizedLevel, bars });
      setSpectrum(nextSpectrum);

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      audioCtx.close().catch(() => {
        // ignored
      });
    };
  }, [enabled, stream]);

  return useMemo(
    () => ({
      level: level.level,
      bars: level.bars,
      spectrum,
    }),
    [level, spectrum],
  );
};
