import { useEffect, useState, useCallback } from 'react';

/**
 * Hash routing, deliberately dependency-free.
 *
 * A marketplace needs shareable URLs - #/machines/s21pro has to survive a
 * reload and a paste into chat - but react-router is a lot of surface for
 * seven routes. Swap this for react-router-dom the day you need nested
 * layouts or loaders; every caller only uses `route` and `go`.
 */
const parse = () => {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return {
    page: parts[0] || 'machines',
    param: parts[1] || null,
    query: Object.fromEntries(new URLSearchParams(query || ''))
  };
};

export function useRouter() {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((page, param) => {
    window.location.hash = '#/' + page + (param ? '/' + param : '');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, []);

  return { route, go };
}
