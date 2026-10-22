import { NavLink } from 'react-router-dom';
import { CalendarClock, Users, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/reservas', label: 'Reservas', icon: CalendarClock },
];

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>Z</span>
        <span className={styles.logoText}>urbizzi</span>
      </div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={styles.footer}>
        <ThemeToggle />
      </div>
    </aside>
  );
}
