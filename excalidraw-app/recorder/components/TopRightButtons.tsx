import { useState, useRef } from "react";
import { RecordingIndicator } from "./RecordingIndicator";
import { useRecorderContext } from "../RecorderContext";
import { getBoardViewportRect } from "../utils/region";
import styles from "../styles/TopRightButtons.module.css";

export const TopRightButtons = () => {
  const { state, patchState, startRecording, stopRecording, togglePanel } =
    useRecorderContext();

  const onRecordClick = async () => {
    if (state.isRecording) {
      stopRecording();
      return;
    }

    if (!state.region) {
      const fullRegion = getBoardViewportRect();
      patchState({
        region: fullRegion,
        isSelectingRegion: true,
        activePopover: null,
        popoverAnchor: null,
      });
      return;
    }

    await startRecording();
  };

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const isPressed = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPosition = useRef({ x: 0, y: 0 });
  const pressTimer = useRef<number | null>(null);
  const hasMoved = useRef(false);

  const handlePointerDown = (event: React.PointerEvent) => {
    isPressed.current = true;
    dragStart.current = { x: event.clientX, y: event.clientY };
    initialPosition.current = { x: position.x, y: position.y };
    hasMoved.current = false;
    isDragging.current = false;

    // Set a timer to start dragging after a delay
    pressTimer.current = window.setTimeout(() => {
      if (isPressed.current) {
        isDragging.current = true;
        // Check if event target exists before capturing
        if (event.target instanceof Element) {
          event.target.setPointerCapture(event.pointerId);
        }
      }
    }, 200); // 200ms long press threshold
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!isPressed.current) return; // Prevent move logic from firing on hover

    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;

    // If we move too much before the timer triggers, it's a drag
    if (!isDragging.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
      isDragging.current = true;
      hasMoved.current = true;
      if (event.target instanceof Element) {
        event.target.setPointerCapture(event.pointerId);
      }
    }

    if (!isDragging.current) return;
    hasMoved.current = true;

    setPosition({
      x: initialPosition.current.x + dx,
      y: initialPosition.current.y + dy,
    });
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    isPressed.current = false;

    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    // Click detection is handled by the onClick handler below,
    // not here — Chrome can swallow pointerup in some cases.

    if (isDragging.current) {
      isDragging.current = false;
      if (event.target instanceof Element) {
        event.target.releasePointerCapture(event.pointerId);
      }
    }
  };

  return (
    <div
      className={styles.wrapper}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging.current ? "grabbing" : "grab",
        touchAction: "none", // Prevent scrolling while dragging
      }}
      onPointerDown={(event) => {
        handlePointerDown(event);
        event.stopPropagation();
      }}
      onPointerMove={(event) => {
        handlePointerMove(event);
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        handlePointerUp(event);
        event.stopPropagation();
      }}
      onClick={(event) => {
        // Use standard click event for reliable cross-browser detection.
        // Only toggle if no drag movement occurred.
        if (!hasMoved.current) {
          togglePanel();
        }
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        className={styles.iconButton}
        aria-label={"录制设置"}
      >
        <span
          className={styles.recordOuter}
          data-recording={state.isRecording ? "true" : "false"}
        >
          <span
            className={styles.recordInner}
            data-recording={state.isRecording ? "true" : "false"}
          />
        </span>
      </button>

      <RecordingIndicator />
    </div>
  );
};
