import { useMemo } from "react";

import { useRecorderContext } from "../RecorderContext";
import styles from "../styles/TopRightButtons.module.css";

const formatTime = (total: number) => {
  const hours = Math.floor(total / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
};

export const RecordingIndicator = () => {
  const { state, toggleRecordingPause, stopRecording } = useRecorderContext();

  const time = useMemo(
    () => formatTime(state.recordingSeconds),
    [state.recordingSeconds],
  );

  if (!state.isRecording) {
    return null;
  }

  return (
    <div
      className={styles.indicator}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className={styles.indicatorDot} />
      <span className={styles.indicatorTime}>{time}</span>
      <button
        type="button"
        className={styles.indicatorAction}
        onClick={toggleRecordingPause}
      >
        {state.isRecordingPaused ? "继续" : "暂停"}
      </button>
      <button
        type="button"
        className={styles.indicatorAction}
        onClick={stopRecording}
      >
        停止
      </button>
    </div>
  );
};
