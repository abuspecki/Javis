import { host } from '../browser/host';

export interface MetricSample {
  t: number;
  cpu: number;       // 0..100
  ram: number;       // 0..100
  netDown: number;   // Mbit/s
  netUp: number;     // Mbit/s
}

export interface SystemSnapshot {
  sample: MetricSample;
  sources: { cpu: Source; ram: Source; net: Source };
  online: boolean;
  connectionType: string;
  rttMs: number | null;
  cores: number;
  cpuModel?: string;
  heapMB: number | null;
  realTabs: number | null;
  frameLagMs: number;
}

/** Where a value comes from. UI labels non-"live" values clearly as demo/estimate. */
export type Source = 'live' | 'estimate' | 'demo';

/* eslint-disable @typescript-eslint/no-explicit-any */
const nav: any = typeof navigator !== 'undefined' ? navigator : {};

let demoPhase = Math.random() * 10;
const wobble = (base: number, amp: number, speed: number) =>
  base + Math.sin(demoPhase * speed) * amp + (Math.random() - 0.5) * amp * 0.6;

/** Measures main-thread responsiveness — a real, browser-observable load signal. */
function measureLag(): Promise<number> {
  const start = performance.now();
  return new Promise((r) => setTimeout(() => r(Math.max(0, performance.now() - start - 50)), 50));
}

export async function readSnapshot(): Promise<SystemSnapshot> {
  demoPhase += 0.35;
  const [cpu, mem, lag, realTabs] = await Promise.all([
    host.readCpu().catch(() => null),
    host.readMemory().catch(() => null),
    measureLag(),
    host.countRealTabs().catch(() => null),
  ]);

  const conn = nav.connection;
  const pm = (performance as any).memory;
  const heapMB = pm ? pm.usedJSHeapSize / 1048576 : null;

  let cpuVal: number, cpuSrc: Source;
  if (cpu) { cpuVal = cpu.usage * 100; cpuSrc = 'live'; }
  else { cpuVal = Math.min(100, wobble(24, 9, 0.7) + lag * 1.5); cpuSrc = 'demo'; }

  let ramVal: number, ramSrc: Source;
  if (mem) { ramVal = mem.usedRatio * 100; ramSrc = 'live'; }
  else if (pm) { ramVal = (pm.usedJSHeapSize / pm.jsHeapSizeLimit) * 100 * 6 + 30; ramSrc = 'estimate'; }
  else { ramVal = wobble(48, 4, 0.3); ramSrc = 'demo'; }

  let down: number, netSrc: Source;
  if (conn?.downlink != null) { down = conn.downlink * (0.85 + Math.random() * 0.3); netSrc = 'estimate'; }
  else { down = Math.max(0, wobble(42, 18, 0.9)); netSrc = 'demo'; }
  const up = down * (0.18 + Math.random() * 0.08);

  return {
    sample: { t: Date.now(), cpu: clamp(cpuVal), ram: clamp(ramVal), netDown: down, netUp: up },
    sources: { cpu: cpuSrc, ram: ramSrc, net: netSrc },
    online: nav.onLine ?? true,
    connectionType: conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : 'N/A',
    rttMs: conn?.rtt ?? null,
    cores: cpu?.cores ?? nav.hardwareConcurrency ?? 0,
    cpuModel: cpu?.model,
    heapMB,
    realTabs,
    frameLagMs: lag,
  };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
