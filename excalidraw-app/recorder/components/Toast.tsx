import { useRecorderContext } from "../RecorderContext";
import styles from "../styles/Toast.module.css";

export const Toast = () => {
  const { state, closeToast } = useRecorderContext();

  return (
    <>
      {state.isConverting && (
        <div className={styles.convertMask}>
          <div className={styles.convertCard}>
            <div className={styles.convertTitle}>正在转换为 MP4 格式…</div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.round(state.conversionProgress * 100)}%`,
                }}
              />
            </div>
            <div className={styles.progressText}>
              {Math.round(state.conversionProgress * 100)}%
            </div>
          </div>
        </div>
      )}

      {state.toast && (
        <div
          className={styles.toast}
          data-type={state.toast.type}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={closeToast}
          role="status"
          aria-live="polite"
        >
          <span className={styles.icon}>
            {state.toast.type === "success" ? "✅" : "⚠️"}
          </span>
          <span>{state.toast.message}</span>
        </div>
      )}
    </>
  );
};
