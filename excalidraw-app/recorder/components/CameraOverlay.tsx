import { useEffect, useMemo, useRef } from "react";

import { useDraggable } from "../hooks/useDraggable";
import { useRecorderContext } from "../RecorderContext";
import styles from "../styles/CameraOverlay.module.css";

const getDimensions = (size: number, shape: "circle" | "rect") => ({
  w: size,
  h: shape === "circle" ? size : Math.round((size * 9) / 16),
});

const clampOverlayPosition = (x: number, y: number, w: number, h: number) => ({
  x: Math.min(window.innerWidth - w - 8, Math.max(8, x)),
  y: Math.min(window.innerHeight - h - 8, Math.max(8, y)),
});

export const CameraOverlay = () => {
  const { state, patchState, media } = useRecorderContext();

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const dims = useMemo(
    () => getDimensions(state.cameraSize, state.cameraShape),
    [state.cameraShape, state.cameraSize],
  );

  const hasStream = !!media.cameraStreamRef.current;
  const trackLive =
    media.cameraStreamRef.current?.getVideoTracks()[0]?.readyState === "live";
  const showPlaceholder = state.isCameraOn && (!hasStream || !trackLive);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media.cameraStreamRef.current) {
      return;
    }

    video.srcObject = media.cameraStreamRef.current;
    video.play().catch(() => {
      // ignored
    });
  }, [media.cameraStreamRef, state.isCameraOn]);

  const drag = useDraggable({
    getCurrentPosition: () => state.cameraPipPos,
    getBounds: () => ({
      minX: 8,
      minY: 8,
      maxX: Math.max(8, window.innerWidth - dims.w - 8),
      maxY: Math.max(8, window.innerHeight - dims.h - 8),
    }),
    onChange: (position) => {
      patchState({ cameraPipPos: position });
    },
    disabled: false,
  });

  if (!state.isCameraOn) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      style={{
        left: state.cameraPipPos.x,
        top: state.cameraPipPos.y,
        width: dims.w,
        height: dims.h,
        borderRadius: state.cameraShape === "circle" ? "50%" : "12px",
        borderColor: state.isRecording
          ? "var(--danger)"
          : "rgba(255,255,255,0.95)",
      }}
      onDoubleClick={() => {
        const candidates = [100, 200, 300];
        const currentIndex = candidates.findIndex(
          (v) => v === state.cameraSize,
        );
        const next =
          candidates[
            (currentIndex + 1 + candidates.length) % candidates.length
          ];
        const nextDims = getDimensions(next, state.cameraShape);
        const nextPos = clampOverlayPosition(
          state.cameraPipPos.x,
          state.cameraPipPos.y,
          nextDims.w,
          nextDims.h,
        );

        patchState({
          cameraSize: next,
          cameraPipPos: nextPos,
        });
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={styles.dragArea} onPointerDown={drag.onPointerDown} />

      <button
        type="button"
        className={styles.close}
        onClick={() => {
          media.stopCameraStream();
          patchState({ isCameraOn: false });
        }}
      >
        ✕
      </button>

      {showPlaceholder ? (
        <div className={styles.placeholder}>设备已断开</div>
      ) : (
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          style={{ transform: state.cameraMirrored ? "scaleX(-1)" : "none" }}
        />
      )}

      <button
        type="button"
        className={styles.resizeHandle}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();

          const startX = event.clientX;
          const startY = event.clientY;
          const startSize = state.cameraSize;

          const onMove = (moveEvent: PointerEvent) => {
            const delta = Math.max(
              moveEvent.clientX - startX,
              moveEvent.clientY - startY,
            );
            const next = Math.max(
              80,
              Math.min(360, Math.round(startSize + delta)),
            );
            patchState({ cameraSize: next });
          };

          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      >
        ◢
      </button>
    </div>
  );
};
