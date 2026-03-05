import styles from "../styles/ControlPanel.module.css";

type SystemAudioProps = {
  active: boolean;
  supported: boolean;
  disabled: boolean;
  onClick: () => void;
};

export const SystemAudio = ({
  active,
  supported,
  disabled,
  onClick,
}: SystemAudioProps) => {
  const label = !supported
    ? "当前浏览器不支持"
    : active
    ? "关闭系统声音"
    : "开启系统声音";

  return (
    <button
      type="button"
      className={styles.toolButton}
      data-active={active ? "true" : "false"}
      disabled={disabled || !supported}
      title={label}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 9h4l5-4v14l-5-4H4V9Z"
          stroke="currentColor"
          strokeWidth="1.7"
          fill="none"
          strokeLinejoin="round"
        />
        {supported && active && (
          <>
            <path
              d="M16 9a5 5 0 0 1 0 6"
              stroke="currentColor"
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M18.8 6.8a8.3 8.3 0 0 1 0 10.4"
              stroke="currentColor"
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
            />
          </>
        )}
        {supported && !active && (
          <path
            d="M16.5 9.5 20 13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
};
