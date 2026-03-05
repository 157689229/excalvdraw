import { useCallback, useEffect, useRef } from "react";

import { downloadBlob, createRecordingFilename } from "../utils/download";
import {
  canCaptureDisplay,
  getPreferredRecorderMimeType,
  isMediaRecorderSupported,
} from "../utils/compatibility";

import type { MutableRefObject } from "react";
import type { RecorderDispatchPatch, RecorderState } from "../types";

type MediaDevicesBridge = {
  cameraStreamRef: MutableRefObject<MediaStream | null>;
  micStreamRef: MutableRefObject<MediaStream | null>;
  ensureCameraStream: (opts: {
    deviceId: string | null;
  }) => Promise<MediaStream | null>;
  ensureMicStream: (opts: {
    deviceId: string | null;
    noiseSuppression: boolean;
  }) => Promise<MediaStream | null>;
};

type CompositorBridge = {
  start: (opts: {
    displayStream: MediaStream;
    region: { x: number; y: number; w: number; h: number };
    getCamera: () => {
      stream: MediaStream;
      position: { x: number; y: number };
      size: number;
      shape: "circle" | "rect";
      mirrored: boolean;
    } | null;
    getBoardCanvases?: () => HTMLCanvasElement[];
  }) => Promise<{ canvasStream: MediaStream; stop: () => void }>;
};

type UseRecorderOptions = {
  state: RecorderState;
  patchState: (patch: RecorderDispatchPatch) => void;
  showToast: (message: string, type?: "success" | "warning") => void;
  media: MediaDevicesBridge;
  compositor: CompositorBridge;
};

const getFullscreenRegion = () => ({
  x: 0,
  y: 0,
  w: window.innerWidth,
  h: window.innerHeight,
});

const getBoardCanvases = (): HTMLCanvasElement[] => {
  return Array.from(
    document.querySelectorAll<HTMLCanvasElement>(
      ".excalidraw .excalidraw__canvas.static, .excalidraw .excalidraw__canvas.interactive",
    ),
  );
};

const convertWebmToMp4 = async (
  inputBlob: Blob,
  onProgress: (progress: number) => void,
): Promise<Blob> => {
  const ffmpegModule = (await import("@ffmpeg/ffmpeg")) as any;
  const utilModule = (await import("@ffmpeg/util")) as any;

  const FFmpegCtor = ffmpegModule.FFmpeg;
  if (!FFmpegCtor) {
    throw new Error("FFmpeg 模块加载失败");
  }

  const ffmpeg = new FFmpegCtor();

  if (typeof ffmpeg.on === "function") {
    ffmpeg.on("progress", ({ progress }: { progress: number }) => {
      onProgress(progress);
    });
  }

  const toBlobURL = utilModule.toBlobURL;
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  await ffmpeg.writeFile("input.webm", await utilModule.fetchFile(inputBlob));
  await ffmpeg.exec([
    "-i",
    "input.webm",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "output.mp4",
  ]);

  const output = await ffmpeg.readFile("output.mp4");
  const bytes = output instanceof Uint8Array ? output : new Uint8Array(output as any);
  return new Blob([bytes], { type: "video/mp4" });
};

export const useRecorder = ({
  state,
  patchState,
  showToast,
  media,
  compositor,
}: UseRecorderOptions) => {
  const stateRef = useRef(state);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const compositorStopRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const stopClock = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startClock = useCallback(() => {
    stopClock();
    timerRef.current = window.setInterval(() => {
      if (!stateRef.current.isRecordingPaused) {
        patchState({ recordingSeconds: stateRef.current.recordingSeconds + 1 });
      }
    }, 1000);
  }, [patchState, stopClock]);

  const cleanupTransientResources = useCallback(() => {
    displayStreamRef.current?.getTracks().forEach((track) => track.stop());
    displayStreamRef.current = null;

    compositorStopRef.current?.();
    compositorStopRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {
        // ignored
      });
      audioContextRef.current = null;
    }

    stopClock();
  }, [stopClock]);

  const finalizeRecording = useCallback(async () => {
    const usedMimeType = mimeTypeRef.current;
    const chunks = [...chunksRef.current];

    chunksRef.current = [];

    try {
      if (!chunks.length) {
        showToast("录制已停止，但没有可导出的视频数据", "warning");
        return;
      }

      const sourceBlob = new Blob(chunks, {
        type: usedMimeType || "video/webm",
      });

      const filename = createRecordingFilename();

      if (usedMimeType.includes("mp4")) {
        downloadBlob(sourceBlob, filename);
      } else {
        patchState({ isConverting: true, conversionProgress: 0 });
        try {
          const mp4Blob = await convertWebmToMp4(sourceBlob, (progress) => {
            patchState({
              conversionProgress: Math.min(1, Math.max(0, progress)),
            });
          });
          downloadBlob(mp4Blob, filename);
        } catch (error) {
          console.error(error);
          downloadBlob(sourceBlob, filename.replace(/\.mp4$/, ".webm"));
          showToast("MP4 转换失败，已下载 WebM 文件", "warning");
        } finally {
          patchState({ isConverting: false, conversionProgress: 0 });
        }
      }

      showToast("录制完成，视频已开始下载", "success");
    } finally {
      cleanupTransientResources();
      stoppingRef.current = false;
      patchState({
        isRecording: false,
        isRecordingPaused: false,
        isSelectingRegion: false,
        recordingSeconds: 0,
        captureSource: "board",
      });
    }
  }, [cleanupTransientResources, patchState, showToast]);

  const startRecording = useCallback(async (overrideCaptureSource?: "board" | "screen") => {
    if (
      stateRef.current.isRecording ||
      recorderRef.current?.state === "recording"
    ) {
      return;
    }

    if (!isMediaRecorderSupported()) {
      showToast(
        "当前浏览器不支持录制，请使用 Chrome 94+ 或 Edge 94+",
        "warning",
      );
      patchState({ isSelectingRegion: false, captureSource: "board" });
      return;
    }

    if (!canCaptureDisplay()) {
      showToast("当前浏览器不支持屏幕共享", "warning");
      patchState({ isSelectingRegion: false, captureSource: "board" });
      return;
    }

    const recordingRegion = stateRef.current.region ?? getFullscreenRegion();

    if (!stateRef.current.region) {
      patchState({ region: recordingRegion, isSelectingRegion: false });
    }

    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
        },
        audio: stateRef.current.isSystemAudioOn,
      });
    } catch {
      showToast("需要屏幕共享权限才能录制", "warning");
      patchState({ isSelectingRegion: false, captureSource: "board" });
      return;
    }

    displayStreamRef.current = displayStream;

    try {
      if (stateRef.current.isCameraOn) {
        await media.ensureCameraStream({
          deviceId: stateRef.current.cameraDeviceId,
        });
      }

      const isScreenMode = (overrideCaptureSource ?? stateRef.current.captureSource) === "screen";

      // For screen capture, use the actual video track dimensions so the
      // output matches the captured content's native resolution / aspect ratio.
      let compositorRegion = recordingRegion;
      if (isScreenMode) {
        const videoTrack = displayStream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        if (settings?.width && settings?.height) {
          const dpr = window.devicePixelRatio || 1;
          compositorRegion = {
            x: 0,
            y: 0,
            w: settings.width / dpr,
            h: settings.height / dpr,
          };
        }
      }

      const compositorHandle = await compositor.start({
        displayStream,
        region: compositorRegion,
        getBoardCanvases: isScreenMode ? undefined : getBoardCanvases,
        getCamera: () => {
          // Screen mode already captures the DOM camera overlay via
          // getDisplayMedia, so skip canvas-level compositing to avoid
          // rendering the camera feed twice.
          if (isScreenMode) {
            return null;
          }

          const cameraState = stateRef.current;
          if (!cameraState.isCameraOn) {
            return null;
          }

          const stream = media.cameraStreamRef.current;
          const track = stream?.getVideoTracks()[0];
          if (!stream || !track || track.readyState !== "live") {
            return null;
          }

          return {
            stream,
            position: cameraState.cameraPipPos,
            size: cameraState.cameraSize,
            shape: cameraState.cameraShape,
            mirrored: cameraState.cameraMirrored,
          };
        },
      });

      compositorStopRef.current = compositorHandle.stop;

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();

      if (stateRef.current.isMicOn) {
        const micStream =
          media.micStreamRef.current ??
          (await media.ensureMicStream({
            deviceId: stateRef.current.micDeviceId,
            noiseSuppression: stateRef.current.noiseSuppression,
          }));

        if (!micStream) {
          showToast("麦克风权限被拒绝，请在浏览器设置中允许", "warning");
        } else {
          const micSource = audioCtx.createMediaStreamSource(micStream);
          const micGainNode = audioCtx.createGain();
          micGainNode.gain.value = stateRef.current.micGain;
          micSource.connect(micGainNode).connect(destination);
        }
      }

      if (
        stateRef.current.isSystemAudioOn &&
        displayStream.getAudioTracks().length > 0
      ) {
        const sysSource = audioCtx.createMediaStreamSource(displayStream);
        const sysGain = audioCtx.createGain();
        sysGain.gain.value = 1;
        sysSource.connect(sysGain).connect(destination);
      }

      const finalStream = new MediaStream();
      const canvasVideoTrack =
        compositorHandle.canvasStream.getVideoTracks()[0];

      if (!canvasVideoTrack) {
        throw new Error("无法创建录制视频轨道");
      }

      finalStream.addTrack(canvasVideoTrack);
      destination.stream
        .getAudioTracks()
        .forEach((track) => finalStream.addTrack(track));

      const mimeType = getPreferredRecorderMimeType();
      if (!mimeType) {
        throw new Error("当前浏览器不支持可用的视频编码格式");
      }

      mimeTypeRef.current = mimeType;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        finalizeRecording().catch((error) => {
          console.error(error);
          cleanupTransientResources();
          stoppingRef.current = false;
          patchState({
            isRecording: false,
            recordingSeconds: 0,
            isConverting: false,
            conversionProgress: 0,
          });
          showToast("录制停止时发生错误", "warning");
        });
      };

      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === "inactive") {
          return;
        }

        stoppingRef.current = true;
        stopClock();
        recorder.stop();
      });

      recorderRef.current = mediaRecorder;

      patchState({
        isRecording: true,
        isRecordingPaused: false,
        recordingSeconds: 0,
        isSelectingRegion: false,
        activePopover: null,
        popoverAnchor: null,
      });

      mediaRecorder.onpause = () => {
        patchState({ isRecordingPaused: true });
        stopClock();
      };

      mediaRecorder.onresume = () => {
        patchState({ isRecordingPaused: false });
        startClock();
      };

      startClock();

      mediaRecorder.start(1000);
    } catch (error) {
      console.error(error);
      cleanupTransientResources();
      patchState({
        isRecording: false,
        isRecordingPaused: false,
        isSelectingRegion: false,
        recordingSeconds: 0,
        captureSource: "board",
      });
      showToast("录制启动失败，请重试", "warning");
    }
  }, [
    cleanupTransientResources,
    compositor,
    finalizeRecording,
    media,
    patchState,
    showToast,
    startClock,
    stopClock,
  ]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive" || stoppingRef.current) {
      return;
    }

    stoppingRef.current = true;
    stopClock();
    recorder.stop();
  }, [stopClock]);

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return;
    }
    recorder.pause();
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") {
      return;
    }
    recorder.resume();
  }, []);

  const toggleRecordingPause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive" || stoppingRef.current) {
      return;
    }

    if (recorder.state === "recording") {
      pauseRecording();
    } else if (recorder.state === "paused") {
      resumeRecording();
    }
  }, [pauseRecording, resumeRecording]);

  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      } catch {
        // ignored
      }
      cleanupTransientResources();
    };
  }, [cleanupTransientResources]);

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    toggleRecordingPause,
  };
};
