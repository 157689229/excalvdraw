import { useEffect, useMemo, useRef } from "react";

import { useAudioAnalyser } from "../hooks/useAudioAnalyser";
import { useRecorderContext } from "../RecorderContext";
import styles from "../styles/Popover.module.css";

const getLevelStatus = (level: number) => {
  if (level < 0.04) {
    return { label: "静音", color: "#9CA3AF" };
  }
  if (level < 0.12) {
    return { label: "偏弱", color: "#F59E0B" };
  }
  if (level < 0.35) {
    return { label: "正常", color: "#10B981" };
  }
  if (level < 0.6) {
    return { label: "偏响", color: "#FB923C" };
  }
  return { label: "过响！", color: "#EF4444" };
};

export const MicSettings = () => {
  const { state, patchState, closePopover, media, showToast } =
    useRecorderContext();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isOpen = state.activePopover === "mic";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target)) {
        closePopover();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopover();
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closePopover, isOpen]);

  useEffect(() => {
    if (!isOpen || !state.isMicOn || media.micStreamRef.current) {
      return;
    }

    media
      .ensureMicStream({
        deviceId: state.micDeviceId ?? media.audioInputs[0]?.deviceId ?? null,
        noiseSuppression: state.noiseSuppression,
      })
      .then((stream) => {
        if (stream) {
          patchState({
            micDeviceId:
              stream.getAudioTracks()[0]?.getSettings().deviceId ??
              state.micDeviceId,
          });
        }
      })
      .catch(() => {
        // ignored
      });
  }, [
    isOpen,
    media,
    patchState,
    state.isMicOn,
    state.micDeviceId,
    state.noiseSuppression,
  ]);

  const analyser = useAudioAnalyser(media.micStreamRef.current, state.isMicOn);

  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const bars = analyser.spectrum;
    const barWidth = Math.max(2, Math.floor(width / bars.length) - 1);

    bars.forEach((value, index) => {
      const barHeight = Math.max(2, value * height);
      const x = index * (barWidth + 1);
      const y = height - barHeight;

      let fill = "#3B82F6";
      if (value > 0.35) {
        fill = "#10B981";
      }
      if (value > 0.65) {
        fill = "#EF4444";
      }

      ctx.fillStyle = fill;
      ctx.fillRect(x, y, barWidth, barHeight);
    });

    if (!state.isMicOn) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(0, height / 2, width, 1);
    }
  }, [analyser.spectrum, state.isMicOn]);

  const panelStyle = useMemo(() => {
    if (!state.popoverAnchor) {
      return undefined;
    }

    return {
      left: state.popoverAnchor.left + state.popoverAnchor.width / 2,
      top: state.popoverAnchor.top - 12,
    };
  }, [state.popoverAnchor]);

  if (!isOpen || !panelStyle) {
    return null;
  }

  const status = getLevelStatus(analyser.level);
  const db = Math.round(20 * Math.log10(Math.max(0.00001, analyser.level)));

  return (
    <div
      className={styles.popover}
      style={panelStyle}
      ref={panelRef}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={styles.arrow} />

      <div className={styles.rowBetween}>
        <label className={styles.label}>启用麦克风</label>
        <button
          type="button"
          className={styles.toggle}
          data-on={state.isMicOn ? "true" : "false"}
          onClick={() => {
            const next = !state.isMicOn;
            patchState({ isMicOn: next });
            if (!next) {
              media.stopMicStream();
            } else {
              media
                .ensureMicStream({
                  deviceId:
                    state.micDeviceId ?? media.audioInputs[0]?.deviceId ?? null,
                  noiseSuppression: state.noiseSuppression,
                })
                .then((stream) => {
                  if (!stream) {
                    showToast(
                      "麦克风权限被拒绝，请在浏览器设置中允许",
                      "warning",
                    );
                    patchState({ isMicOn: false });
                  }
                })
                .catch(() => {
                  showToast("麦克风启动失败", "warning");
                  patchState({ isMicOn: false });
                });
            }
          }}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>

      <label className={styles.label}>设备</label>
      <select
        className={styles.select}
        value={state.micDeviceId ?? ""}
        onChange={(event) => {
          const deviceId = event.target.value || null;
          media
            .ensureMicStream({
              deviceId,
              noiseSuppression: state.noiseSuppression,
            })
            .then((stream) => {
              if (stream) {
                patchState({
                  isMicOn: true,
                  micDeviceId:
                    stream.getAudioTracks()[0]?.getSettings().deviceId ??
                    deviceId,
                });
              }
            })
            .catch(() => {
              showToast("麦克风切换失败", "warning");
            });
        }}
      >
        {media.audioInputs.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || "未命名麦克风"}
          </option>
        ))}
      </select>

      <canvas ref={waveCanvasRef} className={styles.waveCanvas} />

      <div className={styles.volumeRow}>
        <div className={styles.volumeTrack}>
          <div
            className={styles.volumeFill}
            style={{ width: `${Math.min(100, analyser.level * 100)}%` }}
          />
        </div>
        <span className={styles.dbLabel} style={{ color: status.color }}>
          {db} dB · {status.label}
        </span>
      </div>

      <label className={styles.label}>
        增益 {Math.round(state.micGain * 100)}%
      </label>
      <div className={styles.rowGap8}>
        <input
          className={styles.range}
          type="range"
          min={0.5}
          max={1.5}
          step={0.01}
          value={state.micGain}
          onChange={(event) =>
            patchState({ micGain: Number(event.target.value) })
          }
        />
        <button
          type="button"
          className={styles.smallButton}
          onClick={() => patchState({ micGain: 1 })}
        >
          ↺
        </button>
      </div>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={state.noiseSuppression}
          onChange={(event) => {
            const checked = event.target.checked;
            patchState({ noiseSuppression: checked });
          }}
        />
        降噪（实验性）
      </label>
    </div>
  );
};
