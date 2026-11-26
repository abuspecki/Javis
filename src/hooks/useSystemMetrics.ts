import { useEffect, useRef, useState } from 'react';
import { readSnapshot, type MetricSample, type SystemSnapshot } from '../services/system/metrics';

const WINDOW = 40;

export function useSystemMetrics(intervalMs = 1500) {
  const [snap, setSnap] = useState<SystemSnapshot | null>(null);
  const [series, setSeries] = useState<MetricSample[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (busy.current || document.hidden) return; // don't sample hidden tabs — saves CPU
      busy.current = true;
      try {
        const s = await readSnapshot();
        if (!alive) return;
        setSnap(s);
        setSeries((prev) => [...prev, s.sample].slice(-WINDOW));
      } finally { busy.current = false; }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);

  return { snap, series };
}
