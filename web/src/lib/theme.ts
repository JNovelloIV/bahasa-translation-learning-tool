import { useEffect, useState } from 'react';

const KEY = 'sehari-theme';

// Dark mode: persisted choice if any, otherwise honor the OS appearance setting.
export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#15120d' : '#f4efe3');
    document.body.style.background = dark ? '#15120d' : '#f4efe3';
  }, [dark]);

  const toggle = () => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem(KEY, next ? 'dark' : 'light');
      return next;
    });
  };

  return [dark, toggle];
}
