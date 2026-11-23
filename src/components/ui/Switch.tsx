import styles from './Switch.module.css';

interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Switch({ id, checked, onChange, label }: SwitchProps) {
  return (
    <span className={styles.wrapper}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.track} ${checked ? styles.checked : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}
