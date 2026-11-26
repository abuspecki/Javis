import type { CalendarEvent } from '../../types';

/** iCalendar (RFC 5545) import/export — works with Google Calendar, Outlook, Apple Calendar. */

const pad = (n: number) => String(n).padStart(2, '0');
const toUtc = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const unesc = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** Lines longer than 75 octets must be folded (approximated by characters). */
const fold = (line: string) => line.length <= 74 ? line : line.match(/.{1,74}/g)!.join('\r\n ');

export function eventsToIcs(events: CalendarEvent[]) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//J.A.R.V.I.S.//Control Interface//DE', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@jarvis.local`, `DTSTAMP:${toUtc(Date.now())}`, `DTSTART:${toUtc(e.start)}`, `DTEND:${toUtc(e.end)}`, fold(`SUMMARY:${esc(e.title)}`));
    if (e.location) lines.push(fold(`LOCATION:${esc(e.location)}`));
    if (e.priority === 'high') lines.push('PRIORITY:1');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function parseDate(value: string, params: string): number | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
  if (z) return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  // TZID or floating time → interpret in local time (good enough for a personal dashboard)
  void params;
  return new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime();
}

export function parseIcs(text: string): Omit<CalendarEvent, 'id'>[] {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: Omit<CalendarEvent, 'id'>[] = [];
  let cur: Record<string, { value: string; params: string }> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur?.DTSTART) {
        const start = parseDate(cur.DTSTART.value, cur.DTSTART.params);
        const allDay = /^\d{8}$/.test(cur.DTSTART.value);
        const end = cur.DTEND ? parseDate(cur.DTEND.value, cur.DTEND.params) : null;
        if (start != null) {
          out.push({
            title: unesc(cur.SUMMARY?.value ?? '(ohne Titel)'),
            start, end: end ?? start + (allDay ? 864e5 : 3600e3),
            location: cur.LOCATION ? unesc(cur.LOCATION.value) : undefined,
            priority: cur.PRIORITY && Number(cur.PRIORITY.value) > 0 && Number(cur.PRIORITY.value) <= 4 ? 'high' : 'normal',
          });
        }
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const [name, ...params] = line.slice(0, idx).split(';');
    cur[name.toUpperCase()] = { value: line.slice(idx + 1), params: params.join(';') };
  }
  return out;
}

export function downloadText(filename: string, text: string, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
