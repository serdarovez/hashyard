import { useEffect, useState } from 'react';

const KEY = 'hy-theme';

const read = () => {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system'; // private mode - session only
  }
};

/**
 * Three states, not two. An explicit choice stamps data-theme on <html>;
 * "system" removes the stamp so prefers-color-scheme decides. Every colour in
 * styles.css is a token defined for all three states.
 */
export function useTheme() {
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const resolved =
    theme !== 'system'
      ? theme
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

  return { theme, setTheme, resolved };
}
