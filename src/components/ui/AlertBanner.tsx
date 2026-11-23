import type { ReactNode } from 'react';
import styles from './AlertBanner.module.css';

interface AlertBannerProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function AlertBanner({ title, description, action }: AlertBannerProps) {
  return (
    <div className={styles.banner} role="status">
      <span className={styles.dot} aria-hidden="true" />
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
