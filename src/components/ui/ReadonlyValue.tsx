import type { ReactNode } from 'react';
import styles from './ReadonlyValue.module.css';

interface ReadonlyValueProps {
  label: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
}

/** Par rótulo/valor somente leitura com a aparência de um campo; usar dentro de um <dl>. */
export function ReadonlyValue({ label, children, tone = 'default' }: ReadonlyValueProps) {
  return (
    <div className={styles.item}>
      <dt className={styles.label}>{label}</dt>
      <dd className={tone === 'danger' ? `${styles.value} ${styles.danger}` : styles.value}>{children}</dd>
    </div>
  );
}
