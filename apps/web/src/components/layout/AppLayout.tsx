import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

import styles from './AppLayout.module.css';

const navItems = [
  { to: '/', label: 'Catalog', end: true },
  { to: '/mcps/new', label: 'New MCP' },
  { to: '/registry', label: 'Registry' },
  { to: '/settings', label: 'Settings' },
];

export function AppLayout() {
  const { role } = useAuth();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>◆</span>
          <span>MCP Definer</span>
        </div>
        <nav className={styles.nav} aria-label="Main">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? styles.navActive : styles.navLink)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.roleBadge} title="Dev role (Phase 1)">
          {role}
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
