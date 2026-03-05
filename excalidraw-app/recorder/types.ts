export type AspectRatioOption =
  | "free"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3"
  | "1:1"
  | "21:9";

export type CameraShape = "circle" | "rect";

export type CaptureSource = "board" | "screen";

export type PopoverType = "camera" | "mic" | "teleprompter" | "region" | null;

export type ToastType = "success" | "warning";

export type PermissionStateEx = "unknown" | "granted" | "denied";

export type SizePreset = {
  w: number;
  h: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type AnchorRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type RecorderToast = {
  id: number;
  message: string;
  type: ToastType;
};

export type RecorderState = {
  isPanelVisible: boolean;
  panelPosition: Point;

  region: Rect | null;
  isSelectingRegion: boolean;
  aspectRatio: AspectRatioOption;
  presets: SizePreset[];
  captureSource: CaptureSource;

  isCameraOn: boolean;
  cameraDeviceId: string | null;
  cameraShape: CameraShape;
  cameraMirrored: boolean;
  cameraSize: number;
  cameraPipPos: Point;

  isMicOn: boolean;
  micDeviceId: string | null;
  micGain: number;
  noiseSuppression: boolean;

  isSystemAudioOn: boolean;
  isSystemAudioSupported: boolean;

  isTeleprompterOn: boolean;
  teleprompterText: string;
  teleprompterFontSize: number;
  teleprompterSpeed: number;
  teleprompterOpacity: number;
  teleprompterColor: string;
  teleprompterPosition: Point;
  teleprompterSize: { w: number; h: number };
  teleprompterPaused: boolean;

  activePopover: PopoverType;
  popoverAnchor: AnchorRect | null;

  cameraPermission: PermissionStateEx;
  micPermission: PermissionStateEx;

  isRecording: boolean;
  isRecordingPaused: boolean;
  recordingSeconds: number;

  isConverting: boolean;
  conversionProgress: number;

  toast: RecorderToast | null;
};

export type RecorderDispatchPatch = Partial<RecorderState>;

export type AudioInputLevel = {
  level: number;
  bars: number[];
};
