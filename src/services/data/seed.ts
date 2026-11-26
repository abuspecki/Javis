import type { CalendarEvent, NewsItem, Note, Reminder, Task } from '../../types';
import { uid } from '../../lib/util';

/** Realistic demo data, generated relative to "now" so it always looks current. */
const at = (dayOffset: number, h: number, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

export const seedEvents = (): CalendarEvent[] => [
  { id: uid(), title: 'Board Meeting — Stark Industries', start: at(0, 9, 30), end: at(0, 11), location: 'Konferenzraum 42', priority: 'high' },
  { id: uid(), title: 'Lunch mit Pepper', start: at(0, 13), end: at(0, 14), location: 'Malibu' },
  { id: uid(), title: 'Arc-Reactor Review', start: at(0, 19, 30), end: at(0, 20, 30), location: 'Labor', priority: 'high' },
  { id: uid(), title: 'Pressekonferenz', start: at(1, 10), end: at(1, 11) },
  { id: uid(), title: 'Testflug Mk. VII', start: at(2, 16), end: at(2, 17, 30), location: 'Hangar 3' },
];

export const seedTasks = (): Task[] => [
  { id: uid(), text: 'Quartalsbericht prüfen', done: false, createdAt: Date.now() - 86400e3 },
  { id: uid(), text: 'Firmware-Update für Workshop-Roboter', done: false, createdAt: Date.now() - 3600e3 },
  { id: uid(), text: 'Rückruf bei Happy', done: true, createdAt: Date.now() - 7200e3 },
];

export const seedReminders = (): Reminder[] => [
  { id: uid(), text: 'Medikamente nehmen', at: Date.now() + 45 * 60e3, done: false },
  { id: uid(), text: 'Rhodey Geburtstag gratulieren', at: at(1, 9), done: false },
];

export const seedNotes = (): Note[] => [
  { id: uid(), text: 'Palladium-Alternative: Vibranium-Legierung testen?', updatedAt: Date.now() - 5 * 3600e3 },
];

/** No free, CORS-enabled news API exists without a key → clearly marked demo headlines. */
export const demoNews = (): NewsItem[] => [
  { id: uid(), title: 'Durchbruch bei Festkörperbatterien: 1.000 km Reichweite in Reichweite', source: 'TechWire', time: Date.now() - 22 * 60e3, category: 'Tech' },
  { id: uid(), title: 'EU einigt sich auf neue Leitlinien für KI-Assistenten', source: 'Policy Daily', time: Date.now() - 74 * 60e3, category: 'Politik' },
  { id: uid(), title: 'Märkte im Plus — Halbleiter-Aktien führen den Index an', source: 'Finance Now', time: Date.now() - 2.5 * 3600e3, category: 'Wirtschaft' },
  { id: uid(), title: 'Neue Mission zum Mond-Südpol erfolgreich gestartet', source: 'Orbit News', time: Date.now() - 5 * 3600e3, category: 'Wissenschaft' },
];
