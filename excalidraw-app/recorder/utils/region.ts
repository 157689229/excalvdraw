import type { AspectRatioOption, Rect } from "../types";

const BOARD_CANVAS_SELECTOR =
  ".excalidraw .excalidraw__canvas.static, .excalidraw .excalidraw__canvas.interactive";

const ASPECTS: AspectRatioOption[] = [
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "1:1",
  "21:9",
];

export const parseAspectRatio = (ratio: AspectRatioOption): number | null => {
  if (ratio === "free") {
    return null;
  }
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) {
    return null;
  }
  return w / h;
};

export const inferAspectRatio = (
  w: number,
  h: number,
  tolerance = 0.03,
): AspectRatioOption => {
  if (w <= 0 || h <= 0) {
    return "free";
  }
  const ratio = w / h;

  let nearest: AspectRatioOption = "free";
  let nearestDiff = Number.POSITIVE_INFINITY;

  for (const option of ASPECTS) {
    const parsed = parseAspectRatio(option);
    if (!parsed) {
      continue;
    }
    const diff = Math.abs(parsed - ratio);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearest = option;
    }
  }

  return nearestDiff <= tolerance ? nearest : "free";
};

export const getBoardViewportRect = (): Rect => {
  const canvas = document.querySelector<HTMLCanvasElement>(
    BOARD_CANVAS_SELECTOR,
  );
  if (!canvas) {
    return {
      x: 0,
      y: 0,
      w: window.innerWidth,
      h: window.innerHeight,
    };
  }

  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const x = Math.round(rect.left);
  const y = Math.round(rect.top);

  return { x, y, w, h };
};

export const createCenteredRegionByAspect = (
  aspect: AspectRatioOption,
  viewport: Rect,
): Rect => {
  const maxWidth = Math.max(64, Math.round(viewport.w * 0.8));
  const maxHeight = Math.max(64, Math.round(viewport.h * 0.8));
  const ratio = parseAspectRatio(aspect);

  let width = maxWidth;
  let height = maxHeight;

  if (ratio) {
    width = maxWidth;
    height = Math.round(width / ratio);

    if (height > maxHeight) {
      height = maxHeight;
      width = Math.round(height * ratio);
    }
  }

  width = Math.max(64, Math.min(viewport.w, width));
  height = Math.max(64, Math.min(viewport.h, height));

  return {
    x: Math.round(viewport.x + (viewport.w - width) / 2),
    y: Math.round(viewport.y + (viewport.h - height) / 2),
    w: width,
    h: height,
  };
};
