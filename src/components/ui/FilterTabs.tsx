import styles from './FilterTabs.module.css';

export interface FilterTab<T extends string> {
  value: T;
  label: string;
  count: number;
}

interface FilterTabsProps<T extends string> {
  label: string;
  tabs: FilterTab<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function FilterTabs<T extends string>({ label, tabs, value, onChange }: FilterTabsProps<T>) {
  return (
    <div className={styles.tabs} role="group" aria-label={label}>
      {tabs.map((tab) => {
        const ativo = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            className={ativo ? `${styles.tab} ${styles.active}` : styles.tab}
            aria-pressed={ativo}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            <span className={styles.count}>{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
}
