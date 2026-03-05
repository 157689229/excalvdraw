import { useEffect, useMemo, useRef, useState } from "react";

import { useRecorderContext } from "../RecorderContext";
import styles from "../styles/RegionSelector.module.css";

import type { AspectRatioOption, Rect } from "../types";

type ResizeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

type InteractionState =
  | { type: "draw"; startX: number; startY: number }
  | { type: "move"; startX: number; startY: number; origin: Rect }
  | {
      type: "resize";
      startX: number;
      startY: number;
      origin: Rect;
      handle: ResizeHandle;
    };

const MIN_DRAW_SIZE = 64;
const MIN_REGION_WIDTH = 320;
const MIN_REGION_HEIGHT = 240;

const ASPECT_OPTIONS: { value: AspectRatioOption; label: string }[] = [
  { value: "free", label: "自由" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "1:1", label: "1:1" },
  { value: "21:9", label: "21:9" },
];

const clampRegion = (region: Rect): Rect => {
  const width = Math.max(
    MIN_REGION_WIDTH,
    Math.min(window.innerWidth, region.w),
  );
  const height = Math.max(
    MIN_REGION_HEIGHT,
    Math.min(window.innerHeight, region.h),
  );

  const x = Math.min(window.innerWidth - width, Math.max(0, region.x));
  const y = Math.min(window.innerHeight - height, Math.max(0, region.y));

  return { x, y, w: width, h: height };
};

const normalizeRect = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Rect => {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.max(MIN_DRAW_SIZE, Math.abs(x2 - x1));
  const h = Math.max(MIN_DRAW_SIZE, Math.abs(y2 - y1));

  return { x, y, w, h };
};

const parseAspectRatio = (ratio: AspectRatioOption): number | null => {
  if (ratio === "free") {
    return null;
  }

  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) {
    return null;
  }

  return w / h;
};

const applyAspect = (region: Rect, ratioOption: AspectRatioOption): Rect => {
  const ratio = parseAspectRatio(ratioOption);
  if (!ratio) {
    return clampRegion(region);
  }

  const widthBasedHeight = Math.round(region.w / ratio);
  const heightBasedWidth = Math.round(region.h * ratio);

  let next = { ...region };
  if (
    Math.abs(widthBasedHeight - region.h) <
    Math.abs(heightBasedWidth - region.w)
  ) {
    next.h = Math.max(MIN_REGION_HEIGHT, widthBasedHeight);
  } else {
    next.w = Math.max(MIN_REGION_WIDTH, heightBasedWidth);
  }

  return clampRegion(next);
};

const resizeRect = (
  origin: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  ratioOption: AspectRatioOption,
): Rect => {
  let x = origin.x;
  let y = origin.y;
  let w = origin.w;
  let h = origin.h;

  if (handle.includes("e")) {
    w = origin.w + dx;
  }
  if (handle.includes("s")) {
    h = origin.h + dy;
  }
  if (handle.includes("w")) {
    x = origin.x + dx;
    w = origin.w - dx;
  }
  if (handle.includes("n")) {
    y = origin.y + dy;
    h = origin.h - dy;
  }

  w = Math.max(MIN_REGION_WIDTH, w);
  h = Math.max(MIN_REGION_HEIGHT, h);

  if (handle.includes("w")) {
    x = origin.x + (origin.w - w);
  }
  if (handle.includes("n")) {
    y = origin.y + (origin.h - h);
  }

  let next = { x, y, w, h };

  const ratio = parseAspectRatio(ratioOption);
  if (ratio) {
    const fromWidth = Math.round(next.w / ratio);
    const fromHeight = Math.round(next.h * ratio);

    if (Math.abs(fromWidth - next.h) < Math.abs(fromHeight - next.w)) {
      const oldHeight = next.h;
      next.h = Math.max(MIN_REGION_HEIGHT, fromWidth);
      if (handle.includes("n")) {
        next.y -= next.h - oldHeight;
      }
    } else {
      const oldWidth = next.w;
      next.w = Math.max(MIN_REGION_WIDTH, fromHeight);
      if (handle.includes("w")) {
        next.x -= next.w - oldWidth;
      }
    }
  }

  return clampRegion(next);
};

export const RegionSelector = () => {
  const {
    state,
    patchState,
    startRecording,
    stopRecording,
    toggleRecordingPause,
  } = useRecorderContext();

  const [editingSize, setEditingSize] = useState(false);
  const [inputWidth, setInputWidth] = useState("");
  const [inputHeight, setInputHeight] = useState("");
  const interactionRef = useRef<InteractionState | null>(null);

  useEffect(() => {
    if (!state.region) {
      return;
    }
    setInputWidth(String(Math.round(state.region.w)));
    setInputHeight(String(Math.round(state.region.h)));
  }, [state.region]);

  useEffect(() => {
    if (!state.isSelectingRegion) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!state.isRecording) {
          patchState({
            isSelectingRegion: false,
            activePopover: null,
            popoverAnchor: null,
          });
        }
      }

      if (!state.region || state.isRecording) {
        return;
      }

      if (event.key === "Enter") {
        startRecording().catch(() => {
          // ignored
        });
      }

      const step = event.shiftKey ? 10 : 1;
      const region = state.region;

      if (event.key === "ArrowUp") {
        patchState({
          region: clampRegion({ ...region, y: region.y - step }),
        });
      }
      if (event.key === "ArrowDown") {
        patchState({
          region: clampRegion({ ...region, y: region.y + step }),
        });
      }
      if (event.key === "ArrowLeft") {
        patchState({
          region: clampRegion({ ...region, x: region.x - step }),
        });
      }
      if (event.key === "ArrowRight") {
        patchState({
          region: clampRegion({ ...region, x: region.x + step }),
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    patchState,
    startRecording,
    state.isRecording,
    state.isSelectingRegion,
    state.region,
  ]);

  const overlayVisible = state.isSelectingRegion || state.isRecording;
  const isSelectingMode = state.isSelectingRegion && !state.isRecording;

  const maskPieces = useMemo(() => {
    if (!state.region || !isSelectingMode) {
      return [] as React.CSSProperties[];
    }

    const r = state.region;
    return [
      { left: 0, top: 0, width: "100vw", height: r.y },
      {
        left: 0,
        top: r.y,
        width: r.x,
        height: r.h,
      },
      {
        left: r.x + r.w,
        top: r.y,
        width: window.innerWidth - (r.x + r.w),
        height: r.h,
      },
      {
        left: 0,
        top: r.y + r.h,
        width: "100vw",
        height: window.innerHeight - (r.y + r.h),
      },
    ] as React.CSSProperties[];
  }, [isSelectingMode, state.region]);

  const beginPointerInteraction = (
    event: React.PointerEvent,
    interaction: InteractionState,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    interactionRef.current = interaction;

    const onMove = (moveEvent: PointerEvent) => {
      const current = interactionRef.current;
      if (!current) {
        return;
      }

      if (current.type === "draw") {
        const next = normalizeRect(
          current.startX,
          current.startY,
          moveEvent.clientX,
          moveEvent.clientY,
        );
        patchState({ region: next });
        return;
      }

      if (current.type === "move") {
        const dx = moveEvent.clientX - current.startX;
        const dy = moveEvent.clientY - current.startY;
        patchState({
          region: clampRegion({
            ...current.origin,
            x: current.origin.x + dx,
            y: current.origin.y + dy,
          }),
        });
        return;
      }

      if (current.type === "resize") {
        const dx = moveEvent.clientX - current.startX;
        const dy = moveEvent.clientY - current.startY;
        patchState({
          region: resizeRect(
            current.origin,
            current.handle,
            dx,
            dy,
            state.aspectRatio,
          ),
        });
      }
    };

    const onUp = () => {
      const current = interactionRef.current;
      interactionRef.current = null;

      if (current?.type === "draw" && state.region) {
        const next = clampRegion(state.region);
        patchState({ region: next });
      }

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const infoPanelStyle = useMemo(() => {
    if (!state.region) {
      return undefined;
    }

    return {
      left: state.region.x + state.region.w / 2,
      top: state.region.y + state.region.h + 8,
    };
  }, [state.region]);

  return (
    <>
      {overlayVisible && (
        <div
          className={styles.overlayRoot}
          data-recording={state.isRecording ? "true" : "false"}
          onPointerDown={(event) => {
            if (state.isRecording) {
              event.stopPropagation();
              return;
            }

            const target = event.target as HTMLElement;
            if (target.dataset.role === "region-shell") {
              return;
            }

            beginPointerInteraction(event, {
              type: "draw",
              startX: event.clientX,
              startY: event.clientY,
            });
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (state.isRecording || !isSelectingMode) {
              return;
            }

            patchState({
              region: {
                x: 0,
                y: 0,
                w: window.innerWidth,
                h: window.innerHeight,
              },
              isSelectingRegion: true,
            });
          }}
        >
          {isSelectingMode && (
            <button
              type="button"
              className={styles.exitButton}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() =>
                patchState({
                  isSelectingRegion: false,
                })
              }
            >
              退出区域框选
            </button>
          )}

          {state.region
            ? maskPieces.map((style, index) => (
                <div key={index} className={styles.maskPiece} style={style} />
              ))
            : null}

          {!state.region && isSelectingMode && (
            <div className={styles.guideText}>
              <div className={styles.guideMain}>拖拽鼠标框选录制区域</div>
              <div className={styles.guideSub}>按 ESC 取消 · 双击全屏框选</div>
            </div>
          )}

          {state.region && (
            <div
              data-role="region-shell"
              className={styles.regionShell}
              data-recording={state.isRecording ? "true" : "false"}
              style={{
                left: state.region.x,
                top: state.region.y,
                width: state.region.w,
                height: state.region.h,
                pointerEvents: state.isRecording ? "none" : "auto",
              }}
              onPointerDown={(event) => {
                if (state.isRecording) {
                  event.stopPropagation();
                  return;
                }
                if (!state.region) {
                  return;
                }
                const currentRegion = state.region;

                beginPointerInteraction(event, {
                  type: "move",
                  startX: event.clientX,
                  startY: event.clientY,
                  origin: currentRegion,
                });
              }}
            >
              {!state.isRecording &&
                (
                  ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeHandle[]
                ).map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={`${styles.handle} ${styles[`handle_${handle}`]}`}
                    onPointerDown={(event) => {
                      if (!state.region) {
                        return;
                      }
                      const currentRegion = state.region;
                      beginPointerInteraction(event, {
                        type: "resize",
                        handle,
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: currentRegion,
                      });
                    }}
                  />
                ))}

              {!state.isRecording && (
                <div className={styles.dimensionTag}>
                  {Math.round(state.region.w)} × {Math.round(state.region.h)}
                </div>
              )}
            </div>
          )}

          {state.region && infoPanelStyle && (
            <div
              className={styles.infoPanel}
              style={{ ...infoPanelStyle, pointerEvents: "auto" }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className={styles.infoArrow} />

              {state.isRecording ? (
                <>
                  <button
                    type="button"
                    className={styles.pauseButton}
                    onClick={toggleRecordingPause}
                  >
                    {state.isRecordingPaused ? "▶ 继续录制" : "Ⅱ 暂停录制"}
                  </button>
                  <button
                    type="button"
                    className={styles.stopButton}
                    onClick={stopRecording}
                  >
                    ■ 停止录制
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.sizeButton}
                    onClick={() => setEditingSize((value) => !value)}
                  >
                    {Math.round(state.region.w)} × {Math.round(state.region.h)}
                  </button>

                  {editingSize && (
                    <div className={styles.sizeEditor}>
                      <input
                        value={inputWidth}
                        onChange={(event) => setInputWidth(event.target.value)}
                        onBlur={() => {
                          if (!state.region) {
                            return;
                          }
                          const w = Math.max(
                            MIN_REGION_WIDTH,
                            Number.parseInt(inputWidth || "0", 10) ||
                              state.region.w,
                          );
                          patchState({
                            region: clampRegion({
                              ...state.region,
                              w,
                            }),
                          });
                        }}
                      />
                      <span>×</span>
                      <input
                        value={inputHeight}
                        onChange={(event) => setInputHeight(event.target.value)}
                        onBlur={() => {
                          if (!state.region) {
                            return;
                          }
                          const h = Math.max(
                            MIN_REGION_HEIGHT,
                            Number.parseInt(inputHeight || "0", 10) ||
                              state.region.h,
                          );
                          patchState({
                            region: clampRegion({
                              ...state.region,
                              h,
                            }),
                          });
                        }}
                      />
                    </div>
                  )}

                  <select
                    className={styles.aspectSelect}
                    value={state.aspectRatio}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value.startsWith("preset-") && state.region) {
                        const [, wh] = value.split("preset-");
                        const [wText, hText] = wh.split("x");
                        const w = Number.parseInt(wText, 10);
                        const h = Number.parseInt(hText, 10);
                        if (w > 0 && h > 0) {
                          patchState({
                            aspectRatio: "free",
                            region: clampRegion({ ...state.region, w, h }),
                          });
                        }
                        return;
                      }

                      const next = value as AspectRatioOption;
                      patchState({
                        aspectRatio: next,
                        region: state.region
                          ? applyAspect(state.region, next)
                          : state.region,
                      });
                    }}
                  >
                    {ASPECT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    {state.presets.length > 0 && (
                      <optgroup label="已保存预设">
                        {state.presets.map((preset) => (
                          <option
                            key={`${preset.w}x${preset.h}`}
                            value={`preset-${preset.w}x${preset.h}`}
                          >
                            {preset.w} × {preset.h}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  <button
                    type="button"
                    className={styles.iconGhost}
                    title="保存预设"
                    onClick={() => {
                      if (!state.region) {
                        return;
                      }
                      const preset = {
                        w: Math.round(state.region.w),
                        h: Math.round(state.region.h),
                      };
                      const exists = state.presets.some(
                        (item) => item.w === preset.w && item.h === preset.h,
                      );
                      if (!exists) {
                        patchState({
                          presets: [...state.presets, preset],
                        });
                      }
                    }}
                  >
                    💾
                  </button>

                  <button
                    type="button"
                    className={styles.startButton}
                    onClick={() => {
                      startRecording().catch(() => {
                        // ignored
                      });
                    }}
                  >
                    🔴 开始录制
                  </button>

                  <button
                    type="button"
                    className={styles.iconGhost}
                    onClick={() => {
                      patchState({
                        region: null,
                        isSelectingRegion: false,
                      });
                    }}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
