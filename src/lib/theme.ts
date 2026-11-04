import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

/* index.html applies the saved theme before the first paint, using the same key and colours. */
const KEY = 'crackroom-theme';
const BROWSER_BAR = { dark: '#070B20', light: '#F4F5F9' };

const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BROWSER_BAR[theme]);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* Blocked storage only means the choice is not remembered. */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  return useSyncExternalStore(subscribe, current);
}
