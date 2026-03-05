import { useCallback, useRef, useState } from "react";

import type { Point } from "../types";

type UseDraggableOptions = {
  onChange: (position: Point) => void;
  getCurrentPosition: () => Point;
  getBounds: () => { minX: number; minY: number; maxX: number; maxY: number };
  disabled?: boolean;
};

export const useDraggable = ({
  onChange,
  getCurrentPosition,
  getBounds,
  disabled = false,
}: UseDraggableOptions) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPointerRef = useRef<Point | null>(null);
  const startPositionRef = useRef<Point | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const pointerStart = { x: event.clientX, y: event.clientY };
      const posStart = getCurrentPosition();
      startPointerRef.current = pointerStart;
      startPositionRef.current = posStart;
      setIsDragging(true);

      const onMove = (moveEvent: PointerEvent) => {
        if (!startPointerRef.current || !startPositionRef.current) {
          return;
        }

        const nextX =
          startPositionRef.current.x +
          (moveEvent.clientX - startPointerRef.current.x);
        const nextY =
          startPositionRef.current.y +
          (moveEvent.clientY - startPointerRef.current.y);

        const bounds = getBounds();

        const clampedX = Math.min(bounds.maxX, Math.max(bounds.minX, nextX));
        const clampedY = Math.min(bounds.maxY, Math.max(bounds.minY, nextY));

        onChange({ x: clampedX, y: clampedY });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        startPointerRef.current = null;
        startPositionRef.current = null;
        setIsDragging(false);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [disabled, getBounds, getCurrentPosition, onChange],
  );

  return {
    isDragging,
    onPointerDown,
  };
};
