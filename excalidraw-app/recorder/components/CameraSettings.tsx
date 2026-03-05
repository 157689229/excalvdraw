import { useEffect, useMemo, useRef } from "react";

import { useRecorderContext } from "../RecorderContext";
import styles from "../styles/Popover.module.css";

const getCameraDims = (size: number, shape: "circle" | "rect") => ({
  w: size,
  h: shape === "circle" ? size : Math.round((size * 9) / 16),
});

const getDefaultPip = (
  region: { x: number; y: number; w: number; h: number } | null,
  size: number,
  shape: "circle" | "rect",
) => {
  const dims = getCameraDims(size, shape);
  if (region) {
    return {
      x: region.x + region.w - dims.w - 16,
      y: region.y + region.h - dims.h - 16,
    };
  }

  return {
    x: window.innerWidth - dims.w - 24,
    y: window.innerHeight - dims.h - 24,
  };
};

export const CameraSettings = () => {
  const { state, patchState, closePopover, media, showToast } =
    useRecorderContext();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const isOpen = state.activePopover === "camera";

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

  const enableCamera = async () => {
    const stream = await media.ensureCameraStream({
      deviceId: state.cameraDeviceId ?? media.videoInputs[0]?.deviceId ?? null,
    });

    if (!stream) {
      showToast("摄像头权限被拒绝，请在浏览器设置中允许", "warning");
      patchState({ isCameraOn: false });
      return;
    }

    patchState({
      isCameraOn: true,
      cameraDeviceId:
        stream.getVideoTracks()[0]?.getSettings().deviceId ??
        state.cameraDeviceId,
      cameraPipPos: getDefaultPip(
        state.region,
        state.cameraSize,
        state.cameraShape,
      ),
    });
  };

  return (
    <div
      className={styles.popover}
      style={panelStyle}
      ref={panelRef}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={styles.arrow} />

      <div className={styles.rowBetween}>
        <label className={styles.label}>启用摄像头</label>
        <button
          type="button"
          className={styles.toggle}
          data-on={state.isCameraOn ? "true" : "false"}
          onClick={() => {
            if (state.isCameraOn) {
              media.stopCameraStream();
              patchState({ isCameraOn: false });
            } else {
              enableCamera().catch(() => {
                // ignored
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
        value={state.cameraDeviceId ?? ""}
        onChange={(event) => {
          const deviceId = event.target.value || null;
          media
            .ensureCameraStream({ deviceId })
            .then((stream) => {
              if (stream) {
                patchState({ isCameraOn: true, cameraDeviceId: deviceId });
              }
            })
            .catch(() => {
              showToast("摄像头切换失败", "warning");
            });
        }}
      >
        {media.videoInputs.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || "未命名摄像头"}
          </option>
        ))}
      </select>

      <label className={styles.label}>画面形状</label>
      <div className={styles.segment}>
        <button
          type="button"
          className={styles.segmentBtn}
          data-active={state.cameraShape === "circle" ? "true" : "false"}
          onClick={() => patchState({ cameraShape: "circle" })}
        >
          ○ 圆形
        </button>
        <button
          type="button"
          className={styles.segmentBtn}
          data-active={state.cameraShape === "rect" ? "true" : "false"}
          onClick={() => patchState({ cameraShape: "rect" })}
        >
          ▢ 矩形
        </button>
      </div>

      <label className={styles.label}>画面尺寸 {state.cameraSize}px</label>
      <input
        className={styles.range}
        type="range"
        min={80}
        max={360}
        step={1}
        value={state.cameraSize}
        onChange={(event) => {
          const next = Number(event.target.value);
          patchState({
            cameraSize: next,
            cameraPipPos: getDefaultPip(state.region, next, state.cameraShape),
          });
        }}
      />

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={state.cameraMirrored}
          onChange={(event) =>
            patchState({ cameraMirrored: event.target.checked })
          }
        />
        水平镜像
      </label>
    </div>
  );
};
