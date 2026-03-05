import { useCallback } from "react";

import type { CameraShape, Point, Rect } from "../types";

type CameraCompositingOptions = {
  stream: MediaStream;
  position: Point;
  size: number;
  shape: CameraShape;
  mirrored: boolean;
};

type StartCompositorOptions = {
  displayStream: MediaStream;
  region: Rect;
  getCamera: () => CameraCompositingOptions | null;
  getBoardCanvases?: () => HTMLCanvasElement[];
};

type CompositorHandle = {
  canvasStream: MediaStream;
  stop: () => void;
};

const getRectDimensions = (size: number) => ({
  width: size,
  height: Math.round((size * 9) / 16),
});

const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const createHiddenVideo = (stream: MediaStream): HTMLVideoElement => {
  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.style.position = "fixed";
  video.style.left = "-99999px";
  video.style.top = "-99999px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.pointerEvents = "none";
  document.body.appendChild(video);

  video.play().catch(() => {
    // ignored
  });

  return video;
};

const drawBoardRegion = (
  ctx: CanvasRenderingContext2D,
  outputWidth: number,
  outputHeight: number,
  boardCanvas: HTMLCanvasElement,
  region: Rect,
): boolean => {
  const rect = boardCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const scaleX = boardCanvas.width / rect.width;
  const scaleY = boardCanvas.height / rect.height;

  let sourceX = Math.round((region.x - rect.left) * scaleX);
  let sourceY = Math.round((region.y - rect.top) * scaleY);
  let sourceW = Math.round(region.w * scaleX);
  let sourceH = Math.round(region.h * scaleY);

  if (sourceX < 0) {
    sourceW += sourceX;
    sourceX = 0;
  }
  if (sourceY < 0) {
    sourceH += sourceY;
    sourceY = 0;
  }
  if (sourceX + sourceW > boardCanvas.width) {
    sourceW = boardCanvas.width - sourceX;
  }
  if (sourceY + sourceH > boardCanvas.height) {
    sourceH = boardCanvas.height - sourceY;
  }

  if (sourceW <= 1 || sourceH <= 1) {
    return false;
  }

  try {
    ctx.drawImage(
      boardCanvas,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      0,
      0,
      outputWidth,
      outputHeight,
    );
    return true;
  } catch {
    return false;
  }
};

const drawVideoCover = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) => {
  const vw = Math.max(1, video.videoWidth || Math.round(dw));
  const vh = Math.max(1, video.videoHeight || Math.round(dh));

  const videoRatio = vw / vh;
  const boxRatio = dw / dh;

  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;

  if (videoRatio > boxRatio) {
    sw = Math.round(vh * boxRatio);
    sx = Math.round((vw - sw) / 2);
  } else if (videoRatio < boxRatio) {
    sh = Math.round(vw / boxRatio);
    sy = Math.round((vh - sh) / 2);
  }

  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
};

const drawCursor = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dpr: number,
  isPressed: boolean,
) => {
  const s = dpr;

  // Draw click indicator (ring) when mouse is pressed
  if (isPressed) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 12 * s, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 100, 100, 0.3)";
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = "rgba(255, 100, 100, 0.6)";
    ctx.stroke();
    ctx.restore();
  }

  // Draw arrow cursor
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 17);
  ctx.lineTo(4.4, 13.2);
  ctx.lineTo(7.8, 20);
  ctx.lineTo(10.5, 18.7);
  ctx.lineTo(7.1, 11.8);
  ctx.lineTo(12.2, 11.8);
  ctx.closePath();

  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#000000";
  ctx.stroke();

  ctx.restore();
};

export const useCanvasCompositor = () => {
  const start = useCallback(async (options: StartCompositorOptions) => {
    const dpr = window.devicePixelRatio || 1;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(options.region.w * dpr));
    canvas.height = Math.max(1, Math.round(options.region.h * dpr));
    canvas.style.position = "fixed";
    canvas.style.left = "-99999px";
    canvas.style.top = "-99999px";
    canvas.style.width = "1px";
    canvas.style.height = "1px";
    canvas.style.pointerEvents = "none";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("无法创建画面合成上下文");
    }

    const screenVideo = createHiddenVideo(options.displayStream);
    let cameraVideo: HTMLVideoElement | null = null;
    let cameraStreamId: string | null = null;

    let rafId = 0;
    let stopped = false;

    // Mouse cursor tracking
    let cursorX = -1;
    let cursorY = -1;
    let cursorVisible = false;
    let cursorPressed = false;

    const onMouseMove = (e: MouseEvent) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
      cursorVisible = true;
    };

    const onMouseLeave = () => {
      cursorVisible = false;
    };

    const onMouseDown = () => {
      cursorPressed = true;
    };

    const onMouseUp = () => {
      cursorPressed = false;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);

    const drawFrame = () => {
      if (stopped) {
        return;
      }

      const region = options.region;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let drewBaseFrame = false;
      const boardCanvases = options.getBoardCanvases?.() ?? [];
      for (const boardCanvas of boardCanvases) {
        const drew = drawBoardRegion(
          ctx,
          canvas.width,
          canvas.height,
          boardCanvas,
          region,
        );
        if (drew) {
          drewBaseFrame = true;
        }
      }

      if (!drewBaseFrame && screenVideo.readyState >= 2) {
        try {
          if (options.getBoardCanvases) {
            // Board mode fallback: crop by region coordinates
            const sourceX = Math.round(region.x * dpr);
            const sourceY = Math.round(region.y * dpr);
            const sourceW = Math.round(region.w * dpr);
            const sourceH = Math.round(region.h * dpr);
            ctx.drawImage(
              screenVideo,
              sourceX,
              sourceY,
              sourceW,
              sourceH,
              0,
              0,
              canvas.width,
              canvas.height,
            );
          } else {
            // Screen capture mode: draw full video frame
            ctx.drawImage(
              screenVideo,
              0,
              0,
              screenVideo.videoWidth,
              screenVideo.videoHeight,
              0,
              0,
              canvas.width,
              canvas.height,
            );
          }
        } catch {
          // ignored
        }
      }

      const camera = options.getCamera();
      const cameraTrack = camera?.stream.getVideoTracks()[0];
      const hasLiveCamera = !!camera && cameraTrack?.readyState === "live";

      if (hasLiveCamera && camera) {
        if (cameraStreamId !== camera.stream.id || !cameraVideo) {
          cameraVideo?.remove();
          cameraVideo = createHiddenVideo(camera.stream);
          cameraStreamId = camera.stream.id;
        }
      } else if (cameraVideo) {
        cameraVideo.remove();
        cameraVideo = null;
        cameraStreamId = null;
      }

      if (camera && cameraVideo && cameraVideo.readyState >= 2) {
        const isCircle = camera.shape === "circle";
        const width = isCircle
          ? camera.size
          : getRectDimensions(camera.size).width;
        const height = isCircle
          ? camera.size
          : getRectDimensions(camera.size).height;

        const pipX = (camera.position.x - region.x) * dpr;
        const pipY = (camera.position.y - region.y) * dpr;
        const pipW = width * dpr;
        const pipH = height * dpr;

        ctx.save();

        if (isCircle) {
          ctx.beginPath();
          ctx.arc(pipX + pipW / 2, pipY + pipH / 2, pipW / 2, 0, Math.PI * 2);
          ctx.closePath();
        } else {
          roundedRectPath(ctx, pipX, pipY, pipW, pipH, 12 * dpr);
        }
        ctx.clip();

        if (camera.mirrored) {
          ctx.translate(pipX + pipW, pipY);
          ctx.scale(-1, 1);
          drawVideoCover(ctx, cameraVideo, 0, 0, pipW, pipH);
        } else {
          drawVideoCover(ctx, cameraVideo, pipX, pipY, pipW, pipH);
        }

        ctx.restore();

        ctx.save();
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = "#FFFFFF";
        if (isCircle) {
          ctx.beginPath();
          ctx.arc(pipX + pipW / 2, pipY + pipH / 2, pipW / 2, 0, Math.PI * 2);
          ctx.closePath();
        } else {
          roundedRectPath(ctx, pipX, pipY, pipW, pipH, 12 * dpr);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw mouse cursor on top of everything
      if (cursorVisible) {
        const cx = (cursorX - region.x) * dpr;
        const cy = (cursorY - region.y) * dpr;
        if (cx >= 0 && cy >= 0 && cx <= canvas.width && cy <= canvas.height) {
          drawCursor(ctx, cx, cy, dpr, cursorPressed);
        }
      }

      rafId = window.requestAnimationFrame(drawFrame);
    };

    rafId = window.requestAnimationFrame(drawFrame);

    const canvasStream = canvas.captureStream(30);

    const handle: CompositorHandle = {
      canvasStream,
      stop: () => {
        if (stopped) {
          return;
        }
        stopped = true;
        window.cancelAnimationFrame(rafId);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseleave", onMouseLeave);
        document.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mouseup", onMouseUp);
        canvasStream.getTracks().forEach((track) => track.stop());
        screenVideo.remove();
        cameraVideo?.remove();
        canvas.remove();
      },
    };

    return handle;
  }, []);

  return {
    start,
  };
};
