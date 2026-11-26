import { describe, expect, it } from 'vitest';
import { eventsToIcs, parseIcs } from '../services/data/ics';

describe('ics', () => {
  it('round-trips events including escaping', () => {
    const start = Date.UTC(2026, 10, 26, 9, 30);
    const ics = eventsToIcs([{ id: 'a', title: 'Board; Meeting, Q4', start, end: start + 3600e3, location: 'Raum 42', priority: 'high' }]);
    expect(ics).toContain('DTSTART:20261126T093000Z');
    const [e] = parseIcs(ics);
    expect(e).toMatchObject({ title: 'Board; Meeting, Q4', start, end: start + 3600e3, location: 'Raum 42', priority: 'high' });
  });
  it('parses folded lines, all-day and TZID events from other calendars', () => {
    const src = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261201', 'SUMMARY:Sehr langer Titel der', ' umgebrochen wurde', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;TZID=Europe/Berlin:20261202T140000', 'DTEND;TZID=Europe/Berlin:20261202T150000', 'SUMMARY:Call', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const [allDay, call] = parseIcs(src);
    expect(allDay.title).toBe('Sehr langer Titel derumgebrochen wurde');
    expect(allDay.end - allDay.start).toBe(864e5);
    expect(call.end - call.start).toBe(3600e3);
  });
});
