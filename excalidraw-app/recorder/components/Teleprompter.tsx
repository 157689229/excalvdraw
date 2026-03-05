import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDraggable } from "../hooks/useDraggable";
import { useRecorderContext } from "../RecorderContext";
import { getBoardViewportRect } from "../utils/region";
import styles from "../styles/Teleprompter.module.css";
import popoverStyles from "../styles/Popover.module.css";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const PRESET_COLORS = [
  { name: "红", value: "#EF4444" },
  { name: "橙", value: "#F97316" },
  { name: "黄", value: "#FDE047" },
  { name: "绿", value: "#22C55E" },
  { name: "青色", value: "#06B6D4" },
  { name: "蓝", value: "#3B82F6" },
  { name: "紫", value: "#8B5CF6" },
  { name: "粉", value: "#EC4899" },
  { name: "黑", value: "#111111" },
  { name: "白", value: "#FFFFFF" },
];

const normalizeHex = (value: string): string => {
  const text = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(text)) {
    return `#${text
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(text)) {
    return `#${text}`.toUpperCase();
  }
  return "#FFFFFF";
};

const getTeleprompterSizeBounds = () => {
  const viewport = getBoardViewportRect();
  const maxW = Math.max(360, Math.round(viewport.w));
  const maxH = Math.max(180, Math.round(viewport.h));
  return {
    minW: 300,
    maxW,
    minH: 100,
    maxH,
  };
};

export const Teleprompter = () => {
  const { state, patchState, closePopover } = useRecorderContext();

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const isEndedRef = useRef(false);
  const [isEndedState, setIsEndedState] = useState(false);
  const speedRef = useRef(state.teleprompterSpeed);
  const pausedRef = useRef(state.teleprompterPaused);
  const scrollPosRef = useRef(0);
  const easeRef = useRef(state.teleprompterPaused ? 0 : 1);

  const [showSettings, setShowSettings] = useState(false);
  const toggleSettings = useCallback(() => setShowSettings((v) => !v), []);

  const isPopoverOpen = state.activePopover === "teleprompter";

  const normalizedColor = normalizeHex(state.teleprompterColor);

  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    // Detect user-initiated scroll (wheel / touch / drag) vs programmatic scroll.
    // Programmatic: scrollTop ≈ round(scrollPosRef), diff < 2px.
    // User wheel/touch: diff typically 40-120px+ per event.
    if (Math.abs(scrollTop - scrollPosRef.current) > 1.5) {
      scrollPosRef.current = scrollTop;
    }
    const ended = scrollTop >= scrollHeight - clientHeight - 2;
    if (ended !== isEndedRef.current) {
      isEndedRef.current = ended;
      setIsEndedState(ended);
    }
  };

  const replay = () => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    scrollPosRef.current = 0;
    isEndedRef.current = false;
    setIsEndedState(false);
    patchState({ teleprompterPaused: false });
  };

  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target)) {
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
  }, [closePopover, isPopoverOpen]);

  // Reset scroll on turn on
  useEffect(() => {
    if (state.isTeleprompterOn && contentRef.current) {
      contentRef.current.scrollTop = 0;
      scrollPosRef.current = 0;
      easeRef.current = 0;
      isEndedRef.current = false;
      setIsEndedState(false);
    }
  }, [state.isTeleprompterOn]);

  useEffect(() => { speedRef.current = state.teleprompterSpeed; }, [state.teleprompterSpeed]);
  useEffect(() => { pausedRef.current = state.teleprompterPaused; }, [state.teleprompterPaused]);

  useEffect(() => {
    if (!state.isTeleprompterOn) return;

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (ts: number) => {
      const delta = ts - lastTs;
      lastTs = ts;

      const target = pausedRef.current ? 0 : 1;
      const smoothing = 8;
      easeRef.current += (target - easeRef.current) * Math.min(1, smoothing * delta / 1000);
      if (easeRef.current < 0.005) easeRef.current = 0;
      if (easeRef.current > 0.995) easeRef.current = 1;

      if (easeRef.current > 0 && contentRef.current) {
        scrollPosRef.current += (delta / 16.67) * speedRef.current * 0.35 * easeRef.current;
        // clamp at max scroll so scrollPosRef doesn't drift past content
        const { scrollHeight, clientHeight } = contentRef.current;
        const maxScroll = scrollHeight - clientHeight;
        if (scrollPosRef.current > maxScroll) scrollPosRef.current = maxScroll;
        if (scrollPosRef.current < 0) scrollPosRef.current = 0;
        // one-way push: float → scrollTop (browser rounds to nearest device pixel)
        contentRef.current.scrollTop = scrollPosRef.current;
        // end detection using float position (not rounded scrollTop)
        const ended = maxScroll > 0 && scrollPosRef.current >= maxScroll - 2;
        if (ended !== isEndedRef.current) {
          isEndedRef.current = ended;
          setIsEndedState(ended);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => { window.cancelAnimationFrame(rafId); };
  }, [state.isTeleprompterOn]);

  useEffect(() => {
    if (!state.isTeleprompterOn) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const withPrefix = (event.ctrlKey || event.metaKey) && event.shiftKey;
      if (!withPrefix) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === " ") {
        event.preventDefault();
        patchState({ teleprompterPaused: !state.teleprompterPaused });
      }
      if (key === "arrowup") {
        event.preventDefault();
        patchState({
          teleprompterSpeed: clamp(state.teleprompterSpeed + 0.2, 0.1, 5),
        });
      }
      if (key === "arrowdown") {
        event.preventDefault();
        patchState({
          teleprompterSpeed: clamp(state.teleprompterSpeed - 0.2, 0.1, 5),
        });
      }
      if (key === "r") {
        event.preventDefault();
        replay();
      }
      if (key === "t") {
        event.preventDefault();
        patchState({ isTeleprompterOn: !state.isTeleprompterOn });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    patchState,
    state.isTeleprompterOn,
    state.teleprompterPaused,
    state.teleprompterSpeed,
  ]);

  useEffect(() => {
    if (state.isTeleprompterOn && isEndedState && !state.teleprompterPaused) {
      patchState({ teleprompterPaused: true });
    }
  }, [isEndedState, patchState, state.isTeleprompterOn, state.teleprompterPaused]);

  const popoverStyle = useMemo(() => {
    if (!state.popoverAnchor) {
      return undefined;
    }

    return {
      left: state.popoverAnchor.left + state.popoverAnchor.width / 2,
      top: state.popoverAnchor.top - 12,
    };
  }, [state.popoverAnchor]);

  const windowDrag = useDraggable({
    getCurrentPosition: () => state.teleprompterPosition,
    getBounds: () => ({
      minX: 0,
      minY: 0,
      maxX: Math.max(0, window.innerWidth - state.teleprompterSize.w),
      maxY: Math.max(0, window.innerHeight - state.teleprompterSize.h),
    }),
    onChange: (position) => {
      patchState({ teleprompterPosition: position });
    },
    disabled: false,
  });

  return (
    <>
      {isPopoverOpen && popoverStyle && (
        <div
          className={popoverStyles.popover}
          style={popoverStyle}
          ref={popoverRef}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className={popoverStyles.arrow} />

          <div className={popoverStyles.rowBetween}>
            <label className={popoverStyles.label}>启用提词器</label>
            <button
              type="button"
              className={popoverStyles.toggle}
              data-on={state.isTeleprompterOn ? "true" : "false"}
              onClick={() =>
                patchState({ isTeleprompterOn: !state.isTeleprompterOn })
              }
            >
              <span className={popoverStyles.toggleThumb} />
            </button>
          </div>

          <label className={popoverStyles.label}>文稿</label>
          <textarea
            className={styles.textarea}
            value={state.teleprompterText}
            onChange={(event) =>
              patchState({ teleprompterText: event.target.value })
            }
            placeholder="在此粘贴或输入你的文稿…"
          />

          <label className={popoverStyles.label}>
            字体大小 {Math.round(state.teleprompterFontSize)}px
          </label>
          <input
            className={popoverStyles.range}
            type="range"
            min={20}
            max={72}
            step={1}
            value={state.teleprompterFontSize}
            onChange={(event) =>
              patchState({ teleprompterFontSize: Number(event.target.value) })
            }
          />

          <label className={popoverStyles.label}>
            滚动速度 {state.teleprompterSpeed.toFixed(1)}x
          </label>
          <input
            className={popoverStyles.range}
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={state.teleprompterSpeed}
            onChange={(event) =>
              patchState({ teleprompterSpeed: Number(event.target.value) })
            }
          />

          <label className={popoverStyles.label}>
            窗口透明度 {Math.round(state.teleprompterOpacity * 100)}%
          </label>
          <input
            className={popoverStyles.range}
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={state.teleprompterOpacity}
            onChange={(event) =>
              patchState({ teleprompterOpacity: Number(event.target.value) })
            }
          />

          <label className={popoverStyles.label}>文字颜色</label>
          <div className={styles.colorRow}>
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={styles.colorDot}
                style={{ backgroundColor: color.value }}
                title={`${color.name} ${color.value}`}
                data-active={
                  normalizeHex(state.teleprompterColor) === color.value
                    ? "true"
                    : "false"
                }
                onClick={() => patchState({ teleprompterColor: color.value })}
              />
            ))}
          </div>

          <div className={styles.colorPickerRow}>
            <input
              type="color"
              className={styles.colorPicker}
              value={normalizedColor}
              onChange={(event) =>
                patchState({ teleprompterColor: event.target.value })
              }
            />
            <input
              type="text"
              className={styles.hexInput}
              value={normalizedColor}
              onChange={(event) =>
                patchState({
                  teleprompterColor: normalizeHex(event.target.value),
                })
              }
            />
          </div>
        </div>
      )}

      {state.isTeleprompterOn && (
        <div
          className={styles.window}
          style={{
            left: state.teleprompterPosition.x,
            top: state.teleprompterPosition.y,
            width: state.teleprompterSize.w,
            height: state.teleprompterSize.h,
            backgroundColor: `rgba(0,0,0,${state.teleprompterOpacity})`,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div
            className={styles.windowHeader}
            onPointerDown={windowDrag.onPointerDown}
          >
            <span className={styles.headerTitle}>提词器</span>

            <div
              className={styles.headerActions}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={styles.headerButton}
                title="向上滚动"
                onClick={() => {
                  if (contentRef.current) {
                    contentRef.current.scrollTop -= 48;
                    scrollPosRef.current = contentRef.current.scrollTop;
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5L7 5L10.5 8.5"/></svg>
              </button>
              <button
                type="button"
                className={styles.headerButton}
                title="向下滚动"
                onClick={() => {
                  if (contentRef.current) {
                    contentRef.current.scrollTop += 48;
                    scrollPosRef.current = contentRef.current.scrollTop;
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5.5L7 9L10.5 5.5"/></svg>
              </button>

              <div className={styles.headerDivider} />

              <button
                type="button"
                className={styles.headerButton}
                title="重播"
                onClick={replay}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7a4.5 4.5 0 1 1 1 3"/><path d="M2.5 10.5V7H5.5"/></svg>
              </button>
              <button
                type="button"
                className={styles.headerButton}
                title={state.teleprompterPaused ? "继续" : "暂停"}
                onClick={() =>
                  patchState({ teleprompterPaused: !state.teleprompterPaused })
                }
              >
                {state.teleprompterPaused ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M4.5 2.8L11 7L4.5 11.2V2.8Z"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3.5" y="3" width="2.5" height="8" rx="0.5"/><rect x="8" y="3" width="2.5" height="8" rx="0.5"/></svg>
                )}
              </button>

              <div className={styles.headerDivider} />

              <button
                type="button"
                className={styles.headerButton}
                title="设置"
                data-active={showSettings ? "true" : "false"}
                onClick={toggleSettings}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="2.2"/><path d="M7 1.5v1.2M7 11.3v1.2M1.5 7h1.2M11.3 7h1.2M2.9 2.9l.85.85M10.25 10.25l.85.85M2.9 11.1l.85-.85M10.25 3.75l.85-.85"/></svg>
              </button>

              <div className={styles.headerDivider} />

              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => patchState({ isTeleprompterOn: false })}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4L10 10M10 4L4 10"/></svg>
              </button>
            </div>
          </div>

          {showSettings && (
            <div className={styles.settingsPanel}>
              <div className={styles.settingsRow}>
                <label className={styles.settingsLabel}>
                  字体大小 {Math.round(state.teleprompterFontSize)}px
                </label>
                <input
                  className={styles.settingsRange}
                  type="range"
                  min={14}
                  max={72}
                  step={1}
                  value={state.teleprompterFontSize}
                  onChange={(event) =>
                    patchState({ teleprompterFontSize: Number(event.target.value) })
                  }
                />
              </div>
              <div className={styles.settingsRow}>
                <label className={styles.settingsLabel}>
                  滚动速度 {state.teleprompterSpeed.toFixed(1)}x
                </label>
                <input
                  className={styles.settingsRange}
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={state.teleprompterSpeed}
                  onChange={(event) =>
                    patchState({ teleprompterSpeed: Number(event.target.value) })
                  }
                />
              </div>
              <div className={styles.settingsRow}>
                <label className={styles.settingsLabel}>
                  不透明度 {Math.round(state.teleprompterOpacity * 100)}%
                </label>
                <input
                  className={styles.settingsRange}
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.01}
                  value={state.teleprompterOpacity}
                  onChange={(event) =>
                    patchState({ teleprompterOpacity: Number(event.target.value) })
                  }
                />
              </div>
            </div>
          )}

          <div className={styles.textViewport} style={showSettings ? { top: 34 + 120 } : undefined}>
            <textarea
              ref={contentRef}
              className={styles.textContent}
              style={{
                color: normalizedColor,
                fontSize: state.teleprompterFontSize,
                paddingTop: state.teleprompterSize.h * 0.18,
                paddingBottom: state.teleprompterSize.h * 0.35,
              }}
              readOnly={!state.teleprompterPaused}
              value={state.teleprompterText}
              onChange={(event) =>
                patchState({ teleprompterText: event.target.value })
              }
              onScroll={handleScroll}
              placeholder="在此输入文稿内容..."
            />
          </div>

          <div className={styles.statusBar}>
            <span>
              {isEndedState
                ? "已播放完"
                : state.teleprompterPaused
                  ? "已暂停"
                  : "播放中"}
            </span>
            <div className={styles.statusRight}>
              <span className={styles.speedBadge}>{state.teleprompterSpeed.toFixed(1)}x</span>
              {isEndedState && (
                <button
                  type="button"
                  className={styles.replayBtn}
                  onClick={replay}
                >
                  重播
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            className={styles.resizeHandle}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();

              const startX = event.clientX;
              const startY = event.clientY;
              const origin = state.teleprompterSize;

              const onMove = (moveEvent: PointerEvent) => {
                const bounds = getTeleprompterSizeBounds();
                const width = clamp(
                  origin.w + (moveEvent.clientX - startX),
                  bounds.minW,
                  bounds.maxW,
                );
                const height = clamp(
                  origin.h + (moveEvent.clientY - startY),
                  bounds.minH,
                  bounds.maxH,
                );
                patchState({ teleprompterSize: { w: width, h: height } });
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
      )}
    </>
  );
};
