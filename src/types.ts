// ─── Shared domain types ───────────────────────────────────────────────

export type CoreState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  /** Source of the reply (provider id or "command") */
  source?: string;
  error?: boolean;
  /** Links the answer is based on (web research, summarised page). */
  sources?: { url: string; title: string }[];
  /** Structured payload, e.g. an e-mail draft that can be opened in the mail app. */
  meta?: { kind: 'email'; to: string; subject: string; body: string };
}

export type SkillId = 'summarize' | 'translate' | 'analyze' | 'research' | 'email' | 'bookmarks' | 'breakdown' | 'file';

export interface Routine { id: string; name: string; urls: string[]; briefing: boolean }

/** Actions JARVIS can execute in the UI. Both the local intent parser and remote AI
 *  backends emit these, so automation works identically regardless of the model. */
export type JarvisAction =
  | { type: 'navigate'; url: string; newTab?: boolean }
  | { type: 'search'; query: string; newTab?: boolean }
  | { type: 'newTab'; url?: string; private?: boolean }
  | { type: 'closeTab' }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }
  | { type: 'bookmark' }
  | { type: 'openModule'; module: InfoModuleId }
  | { type: 'setView'; view: ViewMode }
  | { type: 'addTask'; text: string }
  | { type: 'addReminder'; text: string; at?: number }
  | { type: 'addNote'; text: string }
  | { type: 'clearChat' }
  | { type: 'openSettings' }
  /** Run an AI skill; `arg` is the free-text parameter (query, target language, task, request). */
  | { type: 'skill'; skill: SkillId; arg?: string }
  | { type: 'routine'; name: string }
  | { type: 'exportCalendar' };

export type ViewMode = 'command' | 'focus' | 'browser';

export type InfoModuleId =
  | 'clock' | 'weather' | 'calendar' | 'reminders' | 'news' | 'tasks' | 'notes';

export interface CalendarEvent { id: string; title: string; start: number; end: number; location?: string; priority?: 'high' | 'normal' }
export interface Reminder { id: string; text: string; at: number; done: boolean }
export interface Task { id: string; text: string; done: boolean; createdAt: number }
export interface Note { id: string; text: string; updatedAt: number }
export interface NewsItem { id: string; title: string; source: string; time: number; category: string }

export interface WeatherData {
  city: string;
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number;
  code: number;
  description: string;
  forecast: { day: string; min: number; max: number; code: number }[];
  demo: boolean;
}

/** Snapshot of the assistant's world, passed to AI providers as grounding context. */
export interface JarvisContext {
  now: number;
  locale: string;
  userTitle: string;
  events: CalendarEvent[];
  tasks: Task[];
  reminders: Reminder[];
  weather: WeatherData | null;
  activeTab?: { title: string; url: string };
}
