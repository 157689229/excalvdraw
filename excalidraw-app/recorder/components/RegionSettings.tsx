import { useEffect, useMemo, useRef, useState } from "react";

import { useRecorderContext } from "../RecorderContext";
import {
  createCenteredRegionByAspect,
  getBoardViewportRect,
  inferAspectRatio,
} from "../utils/region";
import popoverStyles from "../styles/Popover.module.css";
import styles from "../styles/RegionSettings.module.css";

import type { AspectRatioOption, Rect } from "../types";

type RegionTab = "board" | "screen";

const LAST_REGION_KEY = "excalvcord-region";
const LAST_ASPECT_KEY = "excalvcord-aspect-ratio";

const PLATFORM_PRESETS: {
  label: string;
  ratio: AspectRatioOption;
}[] = [
    { label: "YouTube / B站", ratio: "16:9" },
    { label: "抖音 / TikTok", ratio: "9:16" },
    { label: "小红书", ratio: "3:4" },
    { label: "朋友圈", ratio: "1:1" },
    { label: "经典", ratio: "4:3" },
    { label: "超宽", ratio: "21:9" },
  ];

const parseStoredRegion = (): {
  region: Rect;
  aspect: AspectRatioOption;
} | null => {
  try {
    const rawRegion = localStorage.getItem(LAST_REGION_KEY);
    if (!rawRegion) {
      return null;
    }

    const parsed = JSON.parse(rawRegion) as Partial<Rect>;
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.w !== "number" ||
      typeof parsed.h !== "number" ||
      parsed.w <= 0 ||
      parsed.h <= 0
    ) {
      return null;
    }

    const rawAspect = localStorage.getItem(LAST_ASPECT_KEY);
    const aspect = (
      rawAspect &&
        [
          "free",
          "16:9",
          "9:16",
          "4:3",
          "3:4",
          "3:2",
          "2:3",
          "1:1",
          "21:9",
        ].includes(rawAspect)
        ? rawAspect
        : "free"
    ) as AspectRatioOption;

    return {
      region: {
        x: Math.round(parsed.x),
        y: Math.round(parsed.y),
        w: Math.round(parsed.w),
        h: Math.round(parsed.h),
      },
      aspect,
    };
  } catch {
    return null;
  }
};

const clampRegion = (region: Rect): Rect => {
  const width = Math.max(64, Math.min(window.innerWidth, region.w));
  const height = Math.max(64, Math.min(window.innerHeight, region.h));

  return {
    x: Math.min(window.innerWidth - width, Math.max(0, region.x)),
    y: Math.min(window.innerHeight - height, Math.max(0, region.y)),
    w: width,
    h: height,
  };
};

const ratioToThumbStyle = (ratio: AspectRatioOption) => {
  if (ratio === "free") {
    return {
      width: 22,
      height: 16,
    };
  }

  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) {
    return {
      width: 22,
      height: 16,
    };
  }

  if (w >= h) {
    return {
      width: 24,
      height: Math.max(8, Math.round((24 * h) / w)),
    };
  }

  return {
    width: Math.max(8, Math.round((18 * w) / h)),
    height: 18,
  };
};

const createCenteredRegionByRatio = (ratio: number, viewport: Rect): Rect => {
  const maxWidth = Math.max(64, Math.round(viewport.w * 0.8));
  const maxHeight = Math.max(64, Math.round(viewport.h * 0.8));

  let width = maxWidth;
  let height = Math.round(width / ratio);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * ratio);
  }

  return {
    x: Math.round(viewport.x + (viewport.w - width) / 2),
    y: Math.round(viewport.y + (viewport.h - height) / 2),
    w: width,
    h: height,
  };
};

export const RegionSettings = () => {
  const { state, patchState, closePopover, startRecording, startScreenRecording } = useRecorderContext();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isOpen = state.activePopover === "region";
  const [activeTab, setActiveTab] = useState<RegionTab>("board");

  const panelStyle = useMemo(() => {
    if (!state.popoverAnchor) {
      return undefined;
    }

    return {
      left: state.popoverAnchor.left + state.popoverAnchor.width / 2,
      top: state.popoverAnchor.top - 12,
    };
  }, [state.popoverAnchor]);

  const lastSelection = useMemo(
    () => parseStoredRegion(),
    [state.region, state.aspectRatio],
  );

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

  if (!isOpen || !panelStyle || state.isRecording) {
    return null;
  }

  const applyRegion = (region: Rect, aspectRatio: AspectRatioOption) => {
    patchState({
      region: clampRegion(region),
      aspectRatio,
      isSelectingRegion: true,
      activePopover: null,
      popoverAnchor: null,
    });
  };

  const applyPlatformPreset = (ratio: AspectRatioOption) => {
    const viewport = getBoardViewportRect();
    applyRegion(createCenteredRegionByAspect(ratio, viewport), ratio);
  };

  const applySavedPreset = (preset: { w: number; h: number }) => {
    const viewport = getBoardViewportRect();
    const inferred = inferAspectRatio(preset.w, preset.h);

    if (inferred !== "free") {
      applyRegion(createCenteredRegionByAspect(inferred, viewport), inferred);
      return;
    }

    const ratio = Math.max(0.1, preset.w / preset.h);
    applyRegion(createCenteredRegionByRatio(ratio, viewport), "free");
  };

  const handleScreenCapture = () => {
    startScreenRecording().catch(() => {
      // ignored
    });
  };

  return (
    <div
      className={`${popoverStyles.popover} ${styles.regionPopover}`}
      style={panelStyle}
      ref={panelRef}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={popoverStyles.arrow} />

      <div className={popoverStyles.segment}>
        <button
          type="button"
          className={popoverStyles.segmentBtn}
          data-active={activeTab === "board" ? "true" : "false"}
          onClick={() => setActiveTab("board")}
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            style={{ verticalAlign: "-2px", marginRight: 4 }}
          >
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>
          白板
        </button>
        <button
          type="button"
          className={popoverStyles.segmentBtn}
          data-active={activeTab === "screen" ? "true" : "false"}
          onClick={() => setActiveTab("screen")}
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            style={{ verticalAlign: "-2px", marginRight: 4 }}
          >
            <rect
              x="1.5"
              y="2.5"
              width="13"
              height="9"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
            <path
              d="M5.5 14h5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M8 11.5v2.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          屏幕捕获
        </button>
      </div>

      {activeTab === "board" && (
        <>
          <div className={styles.quickRow}>
            <button
              type="button"
              className={styles.quickFull}
              onClick={() => {
                applyRegion(getBoardViewportRect(), "free");
                startRecording().catch(() => {
                  // ignored
                });
              }}
            >
              ⊞ 全画布
            </button>

            {lastSelection && (
              <button
                type="button"
                className={styles.quickRestore}
                onClick={() => {
                  applyRegion(lastSelection.region, lastSelection.aspect);
                }}
              >
                ↺ 恢复上次
              </button>
            )}
          </div>

          <div className={styles.sectionHead}>平台预设</div>
          <div className={styles.presetGrid}>
            {PLATFORM_PRESETS.map((preset) => {
              const thumbStyle = ratioToThumbStyle(preset.ratio);
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={styles.presetCard}
                  onClick={() => applyPlatformPreset(preset.ratio)}
                >
                  <span className={styles.ratioThumbWrap}>
                    <span className={styles.ratioThumb} style={thumbStyle} />
                  </span>
                  <span className={styles.presetTexts}>
                    <span className={styles.presetName}>{preset.label}</span>
                    <span className={styles.presetRatio}>{preset.ratio}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.sectionHead}>自定义</div>
          <button
            type="button"
            className={styles.freeDraw}
            onClick={() => {
              patchState({
                region: null,
                aspectRatio: "free",
                isSelectingRegion: true,
                activePopover: null,
                popoverAnchor: null,
              });
            }}
          >
            ✛ 自由框选
          </button>

          {state.presets.length > 0 && (
            <>
              <div className={styles.sectionHead}>已保存预设</div>
              <div className={styles.savedList}>
                {state.presets.map((preset, index) => (
                  <div
                    key={`${preset.w}x${preset.h}-${index}`}
                    className={styles.savedRow}
                  >
                    <button
                      type="button"
                      className={styles.savedApply}
                      onClick={() => applySavedPreset(preset)}
                    >
                      <span className={styles.savedText}>
                        {preset.w} × {preset.h}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={(event) => {
                        event.stopPropagation();
                        patchState({
                          presets: state.presets.filter((_, i) => i !== index),
                        });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "screen" && (
        <>
          <button
            type="button"
            className={styles.screenCard}
            onClick={handleScreenCapture}
          >
            <span className={styles.screenCardIcon}>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <rect
                  x="2"
                  y="3"
                  width="20"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                />
                <path
                  d="M8 21h8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M12 17v4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className={styles.screenCardTexts}>
              <span className={styles.screenCardTitle}>录制整个屏幕</span>
              <span className={styles.screenCardDesc}>
                浏览器会弹窗让你选择显示器
              </span>
            </span>
          </button>

          <button
            type="button"
            className={styles.screenCard}
            onClick={handleScreenCapture}
          >
            <span className={styles.screenCardIcon}>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="13"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                />
                <path
                  d="M7 4v13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M3 8h4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className={styles.screenCardTexts}>
              <span className={styles.screenCardTitle}>录制应用窗口</span>
              <span className={styles.screenCardDesc}>
                浏览器会弹窗让你选择窗口
              </span>
            </span>
          </button>

          <button
            type="button"
            className={styles.screenCard}
            onClick={handleScreenCapture}
          >
            <span className={styles.screenCardIcon}>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                />
                <path
                  d="M3 9h18"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <circle cx="6" cy="6.5" r="1" fill="currentColor" />
                <circle cx="9" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </span>
            <span className={styles.screenCardTexts}>
              <span className={styles.screenCardTitle}>录制浏览器标签页</span>
              <span className={styles.screenCardDesc}>
                选择要录制的标签页
              </span>
            </span>
          </button>

          <div className={styles.screenHint}>
            点击后浏览器会弹出共享选择器
          </div>
        </>
      )}
    </div>
  );
};
