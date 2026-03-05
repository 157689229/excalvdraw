export const isMediaRecorderSupported = (): boolean => {
  return typeof window !== "undefined" && "MediaRecorder" in window;
};

export const getPreferredRecorderMimeType = (): string => {
  if (!isMediaRecorderSupported()) {
    return "";
  }

  const candidates = [
    "video/mp4;codecs=avc1.42E01E,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];

  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return "";
};

export const canCaptureDisplay = (): boolean => {
  return !!navigator.mediaDevices?.getDisplayMedia;
};

export const isSystemAudioCaptureSupported = (): boolean => {
  if (!canCaptureDisplay()) {
    return false;
  }

  const ua = navigator.userAgent;
  return /Chrome|Edg\//.test(ua);
};
