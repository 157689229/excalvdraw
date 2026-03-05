import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type EnsureCameraOptions = {
  deviceId: string | null;
};

type EnsureMicOptions = {
  deviceId: string | null;
  noiseSuppression: boolean;
};

const streamIsLive = (stream: MediaStream | null): boolean => {
  return !!stream?.getTracks().some((track) => track.readyState === "live");
};

const stopStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop());
};

export const useMediaDevices = () => {
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);

  const [cameraPermission, setCameraPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const [micPermission, setMicPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    setVideoInputs(devices.filter((device) => device.kind === "videoinput"));
    setAudioInputs(devices.filter((device) => device.kind === "audioinput"));
  }, []);

  useEffect(() => {
    refreshDevices().catch(() => {
      // ignored
    });

    const onDeviceChange = () => {
      refreshDevices().catch(() => {
        // ignored
      });
    };

    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        onDeviceChange,
      );
    };
  }, [refreshDevices]);

  const ensureCameraStream = useCallback(
    async ({ deviceId }: EnsureCameraOptions): Promise<MediaStream | null> => {
      const live = streamIsLive(cameraStreamRef.current);
      const currentTrack = cameraStreamRef.current?.getVideoTracks()[0];
      const currentDeviceId = currentTrack?.getSettings().deviceId ?? null;

      if (live && (!deviceId || deviceId === currentDeviceId)) {
        return cameraStreamRef.current;
      }

      stopStream(cameraStreamRef.current);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
              }
            : true,
          audio: false,
        });
        setCameraPermission("granted");
        cameraStreamRef.current = stream;
        refreshDevices().catch(() => {
          // ignored
        });
        return stream;
      } catch (error) {
        setCameraPermission(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "denied"
            : "unknown",
        );
        return null;
      }
    },
    [refreshDevices],
  );

  const ensureMicStream = useCallback(
    async ({
      deviceId,
      noiseSuppression,
    }: EnsureMicOptions): Promise<MediaStream | null> => {
      const live = streamIsLive(micStreamRef.current);
      const currentTrack = micStreamRef.current?.getAudioTracks()[0];
      const currentDeviceId = currentTrack?.getSettings().deviceId ?? null;

      if (live && (!deviceId || currentDeviceId === deviceId)) {
        return micStreamRef.current;
      }

      stopStream(micStreamRef.current);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : null),
            echoCancellation: true,
            noiseSuppression,
          },
        });

        setMicPermission("granted");
        micStreamRef.current = stream;
        refreshDevices().catch(() => {
          // ignored
        });
        return stream;
      } catch (error) {
        setMicPermission(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "denied"
            : "unknown",
        );
        return null;
      }
    },
    [refreshDevices],
  );

  const stopCameraStream = useCallback(() => {
    stopStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
  }, []);

  const stopMicStream = useCallback(() => {
    stopStream(micStreamRef.current);
    micStreamRef.current = null;
  }, []);

  const dispose = useCallback(() => {
    stopCameraStream();
    stopMicStream();
  }, [stopCameraStream, stopMicStream]);

  return useMemo(
    () => ({
      videoInputs,
      audioInputs,
      cameraStreamRef,
      micStreamRef,
      cameraPermission,
      micPermission,
      refreshDevices,
      ensureCameraStream,
      ensureMicStream,
      stopCameraStream,
      stopMicStream,
      dispose,
    }),
    [
      audioInputs,
      cameraPermission,
      ensureCameraStream,
      ensureMicStream,
      dispose,
      micPermission,
      refreshDevices,
      stopCameraStream,
      stopMicStream,
      videoInputs,
    ],
  );
};
