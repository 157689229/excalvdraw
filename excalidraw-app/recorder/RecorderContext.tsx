import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import { useCanvasCompositor } from "./hooks/useCanvasCompositor";
import { useMediaDevices } from "./hooks/useMediaDevices";
import { useRecorder } from "./hooks/useRecorder";
import { isSystemAudioCaptureSupported } from "./utils/compatibility";

import type {
  AnchorRect,
  AspectRatioOption,
  CameraShape,
  Point,
  RecorderDispatchPatch,
  RecorderState,
  RecorderToast,
} from "./types";

import "./styles/variables.css";

type RecorderContextValue = {
  state: RecorderState;
  patchState: (patch: RecorderDispatchPatch) => void;
  showToast: (message: string, type?: "success" | "warning") => void;
  closeToast: () => void;
  openPopover: (
    popover: "camera" | "mic" | "teleprompter" | "region" | null,
    anchor?: AnchorRect | null,
  ) => void;
  togglePopover: (
    popover: "camera" | "mic" | "teleprompter" | "region",
    anchor?: AnchorRect | null,
  ) => void;
  closePopover: () => void;
  togglePanel: () => void;
  startRecording: (overrideCaptureSource?: "board" | "screen") => Promise<void>;
  startScreenRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecordingPause: () => void;
  media: ReturnType<typeof useMediaDevices>;
  handleCameraButton: (anchor: AnchorRect | null) => Promise<void>;
  handleMicButton: (anchor: AnchorRect | null) => Promise<void>;
  toggleSystemAudio: () => void;
};

const RecorderContext = createContext<RecorderContextValue | null>(null);

type Action = {
  type: "PATCH";
  payload: RecorderDispatchPatch;
};

const LS_PREFIX = "excalvcord-";

const storageKeys = {
  panelPosition: `${LS_PREFIX}panel-pos`,
  region: `${LS_PREFIX}region`,
  aspectRatio: `${LS_PREFIX}aspect-ratio`,
  presets: `${LS_PREFIX}presets`,
  cameraDeviceId: `${LS_PREFIX}camera-device-id`,
  cameraShape: `${LS_PREFIX}camera-shape`,
  cameraMirrored: `${LS_PREFIX}camera-mirrored`,
  cameraSize: `${LS_PREFIX}camera-size`,
  micDeviceId: `${LS_PREFIX}mic-device-id`,
  micGain: `${LS_PREFIX}mic-gain`,
};

const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const loadPoint = (key: string, fallback: Point): Point => {
  return safeParse<Point>(localStorage.getItem(key), fallback);
};

const ASPECT_RATIO_OPTIONS = new Set<AspectRatioOption>([
  "free",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "1:1",
  "21:9",
]);

const loadAspectRatio = (): AspectRatioOption => {
  const value = localStorage.getItem(storageKeys.aspectRatio);
  if (value && ASPECT_RATIO_OPTIONS.has(value as AspectRatioOption)) {
    return value as AspectRatioOption;
  }
  return "free";
};

const getDefaultPanelPosition = (): Point => ({
  x: Math.max(20, Math.round(window.innerWidth / 2 - 260)),
  y: Math.max(20, window.innerHeight - 96),
});

const getCameraDimensions = (size: number, shape: CameraShape) => ({
  w: size,
  h: shape === "circle" ? size : Math.round((size * 9) / 16),
});

const getDefaultPipPosition = (
  region: RecorderState["region"],
  size: number,
  shape: CameraShape,
): Point => {
  const dims = getCameraDimensions(size, shape);
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

const createInitialState = (): RecorderState => {
  const cameraSize = Number(
    localStorage.getItem(storageKeys.cameraSize) ?? 160,
  );
  const cameraShape =
    (localStorage.getItem(storageKeys.cameraShape) as CameraShape | null) ??
    "circle";

  const region = safeParse<RecorderState["region"]>(
    localStorage.getItem(storageKeys.region),
    null,
  );

  return {
    isPanelVisible: false,
    panelPosition: loadPoint(
      storageKeys.panelPosition,
      getDefaultPanelPosition(),
    ),

    region,
    isSelectingRegion: false,
    aspectRatio: loadAspectRatio(),
    presets: safeParse(localStorage.getItem(storageKeys.presets), []),
    captureSource: "board",

    isCameraOn: false,
    cameraDeviceId: localStorage.getItem(storageKeys.cameraDeviceId),
    cameraShape,
    cameraMirrored: safeParse(
      localStorage.getItem(storageKeys.cameraMirrored),
      true,
    ),
    cameraSize: Number.isFinite(cameraSize) ? cameraSize : 160,
    cameraPipPos: getDefaultPipPosition(region, cameraSize, cameraShape),

    isMicOn: true,
    micDeviceId: localStorage.getItem(storageKeys.micDeviceId),
    micGain: safeParse<number>(localStorage.getItem(storageKeys.micGain), 1),
    noiseSuppression: false,

    isSystemAudioOn: false,
    isSystemAudioSupported: isSystemAudioCaptureSupported(),

    isTeleprompterOn: false,
    teleprompterText: "",
    teleprompterFontSize: 22,
    teleprompterSpeed: 1,
    teleprompterOpacity: 0.7,
    teleprompterColor: "#FFFFFF",
    teleprompterPosition: {
      x: Math.max(20, Math.round(window.innerWidth / 2 - 180)),
      y: Math.max(20, Math.round(window.innerHeight / 2 - 240)),
    },
    teleprompterSize: {
      w: 360,
      h: 480,
    },
    teleprompterPaused: false,

    activePopover: null,
    popoverAnchor: null,

    cameraPermission: "unknown",
    micPermission: "unknown",

    isRecording: false,
    isRecordingPaused: false,
    recordingSeconds: 0,

    isConverting: false,
    conversionProgress: 0,

    toast: null,
  };
};

const reducer = (state: RecorderState, action: Action): RecorderState => {
  switch (action.type) {
    case "PATCH":
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
};

export const RecorderProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const patchState = useCallback((patch: RecorderDispatchPatch) => {
    dispatch({ type: "PATCH", payload: patch });
  }, []);

  const toastTimeoutRef = useRef<number | null>(null);

  const closeToast = useCallback(() => {
    patchState({ toast: null });
    if (toastTimeoutRef.current != null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  }, [patchState]);

  const showToast = useCallback(
    (message: string, type: "success" | "warning" = "success") => {
      const toast: RecorderToast = {
        id: Date.now(),
        message,
        type,
      };

      patchState({ toast });

      if (toastTimeoutRef.current != null) {
        window.clearTimeout(toastTimeoutRef.current);
      }

      toastTimeoutRef.current = window.setTimeout(() => {
        patchState({ toast: null });
      }, 3000);
    },
    [patchState],
  );

  useEffect(() => {
    localStorage.setItem(
      storageKeys.panelPosition,
      JSON.stringify(state.panelPosition),
    );
  }, [state.panelPosition]);

  useEffect(() => {
    if (state.region) {
      localStorage.setItem(storageKeys.region, JSON.stringify(state.region));
    } else {
      localStorage.removeItem(storageKeys.region);
    }
  }, [state.region]);

  useEffect(() => {
    localStorage.setItem(storageKeys.aspectRatio, state.aspectRatio);
  }, [state.aspectRatio]);

  useEffect(() => {
    localStorage.setItem(storageKeys.presets, JSON.stringify(state.presets));
  }, [state.presets]);

  useEffect(() => {
    if (state.cameraDeviceId) {
      localStorage.setItem(storageKeys.cameraDeviceId, state.cameraDeviceId);
    } else {
      localStorage.removeItem(storageKeys.cameraDeviceId);
    }
  }, [state.cameraDeviceId]);

  useEffect(() => {
    localStorage.setItem(storageKeys.cameraShape, state.cameraShape);
  }, [state.cameraShape]);

  useEffect(() => {
    localStorage.setItem(
      storageKeys.cameraMirrored,
      JSON.stringify(state.cameraMirrored),
    );
  }, [state.cameraMirrored]);

  useEffect(() => {
    localStorage.setItem(storageKeys.cameraSize, state.cameraSize.toString());
  }, [state.cameraSize]);

  useEffect(() => {
    if (state.micDeviceId) {
      localStorage.setItem(storageKeys.micDeviceId, state.micDeviceId);
    } else {
      localStorage.removeItem(storageKeys.micDeviceId);
    }
  }, [state.micDeviceId]);

  useEffect(() => {
    localStorage.setItem(storageKeys.micGain, JSON.stringify(state.micGain));
  }, [state.micGain]);

  const media = useMediaDevices();
  const compositor = useCanvasCompositor();

  useEffect(() => {
    patchState({
      cameraPermission: media.cameraPermission,
      micPermission: media.micPermission,
    });
  }, [media.cameraPermission, media.micPermission, patchState]);

  const { startRecording, stopRecording, toggleRecordingPause } = useRecorder({
    state,
    patchState,
    showToast,
    media,
    compositor,
  });

  const startScreenRecording = useCallback(async () => {
    const fullRegion = {
      x: 0,
      y: 0,
      w: window.innerWidth,
      h: window.innerHeight,
    };
    patchState({
      captureSource: "screen",
      region: fullRegion,
      isSelectingRegion: false,
      activePopover: null,
      popoverAnchor: null,
    });

    await startRecording("screen");
  }, [patchState, startRecording]);

  const openPopover = useCallback(
    (
      popover: "camera" | "mic" | "teleprompter" | "region" | null,
      anchor: AnchorRect | null = null,
    ) => {
      patchState({
        activePopover: popover,
        popoverAnchor: popover ? anchor : null,
      });
    },
    [patchState],
  );

  const togglePopover = useCallback(
    (
      popover: "camera" | "mic" | "teleprompter" | "region",
      anchor: AnchorRect | null = null,
    ) => {
      patchState({
        activePopover: state.activePopover === popover ? null : popover,
        popoverAnchor: state.activePopover === popover ? null : anchor,
      });
    },
    [patchState, state.activePopover],
  );

  const closePopover = useCallback(() => {
    patchState({ activePopover: null, popoverAnchor: null });
  }, [patchState]);

  const togglePanel = useCallback(() => {
    patchState({ isPanelVisible: !state.isPanelVisible });
  }, [patchState, state.isPanelVisible]);

  const handleCameraButton = useCallback(
    async (anchor: AnchorRect | null) => {
      if (state.isRecording) {
        return;
      }

      await media.refreshDevices();

      if (!state.isCameraOn) {
        const availableCameras = media.videoInputs;

        if (availableCameras.length <= 1) {
          const stream = await media.ensureCameraStream({
            deviceId:
              state.cameraDeviceId ?? availableCameras[0]?.deviceId ?? null,
          });

          if (!stream) {
            showToast("摄像头权限被拒绝，请在浏览器设置中允许", "warning");
            return;
          }

          const deviceId =
            stream.getVideoTracks()[0]?.getSettings().deviceId ??
            state.cameraDeviceId;

          patchState({
            isCameraOn: true,
            cameraDeviceId: deviceId ?? null,
            cameraPipPos: getDefaultPipPosition(
              state.region,
              state.cameraSize,
              state.cameraShape,
            ),
            activePopover: null,
            popoverAnchor: null,
          });
          return;
        }

        openPopover("camera", anchor);
        return;
      }

      togglePopover("camera", anchor);
    },
    [
      media,
      openPopover,
      patchState,
      showToast,
      state.cameraDeviceId,
      state.cameraShape,
      state.cameraSize,
      state.isCameraOn,
      state.isRecording,
      state.region,
      togglePopover,
    ],
  );

  const handleMicButton = useCallback(
    async (anchor: AnchorRect | null) => {
      if (state.isRecording) {
        return;
      }

      await media.refreshDevices();

      if (!state.isMicOn) {
        const stream = await media.ensureMicStream({
          deviceId: state.micDeviceId ?? media.audioInputs[0]?.deviceId ?? null,
          noiseSuppression: state.noiseSuppression,
        });

        if (!stream) {
          showToast("麦克风权限被拒绝，请在浏览器设置中允许", "warning");
          return;
        }

        const trackDeviceId =
          stream.getAudioTracks()[0]?.getSettings().deviceId ??
          state.micDeviceId;

        patchState({
          isMicOn: true,
          micDeviceId: trackDeviceId ?? null,
          activePopover: null,
          popoverAnchor: null,
        });
        return;
      }

      if (!media.micStreamRef.current) {
        const stream = await media.ensureMicStream({
          deviceId: state.micDeviceId ?? media.audioInputs[0]?.deviceId ?? null,
          noiseSuppression: state.noiseSuppression,
        });

        if (!stream) {
          showToast("麦克风权限被拒绝，请在浏览器设置中允许", "warning");
          return;
        }

        patchState({
          micDeviceId:
            stream.getAudioTracks()[0]?.getSettings().deviceId ??
            state.micDeviceId,
        });
        return;
      }

      togglePopover("mic", anchor);
    },
    [
      media,
      patchState,
      showToast,
      state.isMicOn,
      state.isRecording,
      state.micDeviceId,
      state.noiseSuppression,
      togglePopover,
    ],
  );

  const toggleSystemAudio = useCallback(() => {
    if (!state.isSystemAudioSupported) {
      return;
    }

    const nextValue = !state.isSystemAudioOn;
    patchState({ isSystemAudioOn: nextValue });

    if (nextValue) {
      showToast("系统声音将在录制开始时一并捕获", "success");
    }
  }, [
    patchState,
    showToast,
    state.isSystemAudioOn,
    state.isSystemAudioSupported,
  ]);

  const value = useMemo<RecorderContextValue>(
    () => ({
      state,
      patchState,
      showToast,
      closeToast,
      openPopover,
      togglePopover,
      closePopover,
      togglePanel,
      startRecording,
      startScreenRecording,
      stopRecording,
      toggleRecordingPause,
      media,
      handleCameraButton,
      handleMicButton,
      toggleSystemAudio,
    }),
    [
      closePopover,
      closeToast,
      handleCameraButton,
      handleMicButton,
      media,
      openPopover,
      patchState,
      showToast,
      startRecording,
      startScreenRecording,
      state,
      stopRecording,
      toggleRecordingPause,
      togglePanel,
      togglePopover,
      toggleSystemAudio,
    ],
  );

  return (
    <RecorderContext.Provider value={value}>
      {children}
    </RecorderContext.Provider>
  );
};

export const useRecorderContext = () => {
  const ctx = useContext(RecorderContext);
  if (!ctx) {
    throw new Error("useRecorderContext 必须在 RecorderProvider 内使用");
  }
  return ctx;
};
