import { useMemo, useRef } from "react";

import { useAudioAnalyser } from "../hooks/useAudioAnalyser";
import { useDraggable } from "../hooks/useDraggable";
import { useRecorderContext } from "../RecorderContext";
import { CameraSettings } from "./CameraSettings";
import { MicSettings } from "./MicSettings";
import { RegionSettings } from "./RegionSettings";
import { SystemAudio } from "./SystemAudio";
import styles from "../styles/ControlPanel.module.css";

import type { AnchorRect } from "../types";

const getAnchorRect = (element: HTMLElement | null): AnchorRect | null => {
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
};

export const ControlPanel = () => {
  const {
    state,
    patchState,
    handleCameraButton,
    handleMicButton,
    toggleSystemAudio,
    togglePopover,
    media,
  } = useRecorderContext();

  const cameraBtnRef = useRef<HTMLButtonElement | null>(null);
  const micBtnRef = useRef<HTMLButtonElement | null>(null);
  const teleBtnRef = useRef<HTMLButtonElement | null>(null);
  const regionBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const drag = useDraggable({
    getCurrentPosition: () => state.panelPosition,
    getBounds: () => ({
      minX: 12,
      minY: 12,
      maxX: Math.max(
        12,
        window.innerWidth - (panelRef.current?.offsetWidth ?? 520) - 12,
      ),
      maxY: Math.max(12, window.innerHeight - 90),
    }),
    onChange: (position) => patchState({ panelPosition: position }),
    disabled: state.isRecording,
  });

  const micAnalysis = useAudioAnalyser(
    media.micStreamRef.current,
    state.isMicOn,
  );

  const micBars = useMemo(() => {
    return micAnalysis.bars.map((bar) => {
      let color = "#3B82F6";
      if (bar > 0.4) {
        color = "#10B981";
      }
      if (bar > 0.75) {
        color = "#EF4444";
      }

      return {
        height: `${Math.max(3, bar * 12)}px`,
        color,
      };
    });
  }, [micAnalysis.bars]);

  return (
    <>
      <div
        className={styles.panel}
        data-visible={state.isPanelVisible ? "true" : "false"}
        style={{
          left: state.panelPosition.x,
          top: state.panelPosition.y,
          opacity: state.isPanelVisible ? 1 : 0,
          pointerEvents: state.isPanelVisible ? "auto" : "none",
        }}
        ref={panelRef}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className={styles.toolsWrap}>
          <div className={styles.toolItem}>
            <button
              ref={regionBtnRef}
              type="button"
              className={styles.toolButton}
              data-active={
                state.region && state.aspectRatio !== "free" ? "true" : "false"
              }
              disabled={state.isRecording}
              onClick={() => {
                togglePopover("region", getAnchorRect(regionBtnRef.current));
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect
                  x="5"
                  y="5"
                  width="14"
                  height="14"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeDasharray="3 2"
                  fill="none"
                />
              </svg>
            </button>
            <span className={styles.label}>录制区域</span>
          </div>

          <div className={styles.separator} />

          <div className={styles.toolItem}>
            <button
              ref={cameraBtnRef}
              type="button"
              className={styles.toolButton}
              data-active={state.isCameraOn ? "true" : "false"}
              data-danger={
                state.cameraPermission === "denied" ? "true" : "false"
              }
              disabled={state.isRecording}
              title={
                state.cameraPermission === "denied"
                  ? "摄像头权限被拒绝，请在浏览器设置中允许"
                  : "摄像头"
              }
              onClick={() => {
                handleCameraButton(getAnchorRect(cameraBtnRef.current)).catch(
                  () => {
                    // ignored
                  },
                );
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect
                  x="3.5"
                  y="7"
                  width="12"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  fill="none"
                />
                <path
                  d="M15.5 10 20.5 7.8v8.4L15.5 14"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  fill="none"
                  strokeLinejoin="round"
                />
                {!state.isCameraOn && (
                  <path
                    d="M4 19 20 5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
            <span className={styles.label}>摄像头</span>
          </div>

          <div className={styles.separator} />

          <div className={styles.toolItem}>
            <button
              ref={micBtnRef}
              type="button"
              className={styles.toolButton}
              data-active={state.isMicOn ? "true" : "false"}
              data-danger={state.micPermission === "denied" ? "true" : "false"}
              disabled={state.isRecording}
              title={
                state.micPermission === "denied"
                  ? "麦克风权限被拒绝，请在浏览器设置中允许"
                  : "麦克风"
              }
              onClick={() => {
                handleMicButton(getAnchorRect(micBtnRef.current)).catch(() => {
                  // ignored
                });
              }}
            >
              <div className={styles.micIconWithBars}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect
                    x="9"
                    y="4"
                    width="6"
                    height="10"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    fill="none"
                  />
                  <path
                    d="M6.5 10.5a5.5 5.5 0 0 0 11 0"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 16.2V20"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9 20h6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                {state.isMicOn && (
                  <span className={styles.micBars}>
                    {micBars.map((bar, index) => (
                      <span
                        key={index}
                        style={{
                          height: bar.height,
                          background: bar.color,
                        }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </button>
            <span className={styles.label}>麦克风</span>
          </div>

          <div className={styles.separator} />

          <div className={styles.toolItem}>
            <SystemAudio
              active={state.isSystemAudioOn}
              supported={state.isSystemAudioSupported}
              disabled={state.isRecording}
              onClick={toggleSystemAudio}
            />
            <span className={styles.label}>系统声音</span>
          </div>

          <div className={styles.separator} />

          <div className={styles.toolItem}>
            <button
              ref={teleBtnRef}
              type="button"
              className={styles.toolButton}
              data-active={
                state.isTeleprompterOn || state.activePopover === "teleprompter"
                  ? "true"
                  : "false"
              }
              disabled={state.isRecording}
              onClick={() => {
                togglePopover(
                  "teleprompter",
                  getAnchorRect(teleBtnRef.current),
                );
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 4h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  fill="none"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 9h6M9 12h4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
              </svg>
            </button>
            <span className={styles.label}>提词器</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.dragHandle}
          title="拖动控制台"
          onPointerDown={drag.onPointerDown}
        >
          ⠿
        </button>
      </div>

      <RegionSettings />
      <CameraSettings />
      <MicSettings />
    </>
  );
};
