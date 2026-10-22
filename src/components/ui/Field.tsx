import type { CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import styles from './Field.module.css';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
      {error && (
        <p className={styles.error} id={`${id}-erro`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[styles.input, className].filter(Boolean).join(' ')} {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={[styles.input, className].filter(Boolean).join(' ')} {...props} />;
}

interface FieldGridProps {
  /** Valor de grid-template-columns; no mobile a grade colapsa para uma coluna. */
  columns: string;
  as?: 'div' | 'dl';
  children: ReactNode;
}

export function FieldGrid({ columns, as: Tag = 'div', children }: FieldGridProps) {
  return (
    <Tag className={styles.grid} style={{ '--field-grid-columns': columns } as CSSProperties}>
      {children}
    </Tag>
  );
}
