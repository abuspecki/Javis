import { useEffect, useState } from 'react';

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mql = window.matchMedia(q);
    const h = () => setM(mql.matches);
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
  }, [q]);
  return m;
}
