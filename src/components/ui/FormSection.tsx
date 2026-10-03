import { useId, type ReactNode } from 'react';
import styles from './FormSection.module.css';

interface FormSectionProps {
  title: string;
  description?: string;
  note?: ReactNode;
  /** Remove o espaçamento interno do corpo (ex.: tabelas encostadas nas bordas do card). */
  flush?: boolean;
  children: ReactNode;
}

export function FormSection({ title, description, note, flush = false, children }: FormSectionProps) {
  const titleId = useId();

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description && <p className={styles.description}>{description}</p>}
      </header>
      <div className={flush ? styles.flushBody : styles.body}>{children}</div>
      {note && <p className={styles.note}>{note}</p>}
    </section>
  );
}
