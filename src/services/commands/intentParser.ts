import type { JarvisAction } from '../../types';
import { toUrl } from '../../lib/util';

export interface Intent {
  actions: JarvisAction[];
  /** What JARVIS says back. */
  reply: string;
  /** If true, the message is still forwarded to the AI after actions run. */
  passthrough?: boolean;
}

const SITES: Record<string, string> = {
  youtube: 'https://www.youtube.com',
  google: 'https://www.google.com',
  wikipedia: 'https://de.wikipedia.org',
  github: 'https://github.com',
  gmail: 'https://mail.google.com',
  'google mail': 'https://mail.google.com',
  maps: 'https://maps.google.com',
  'google maps': 'https://maps.google.com',
  netflix: 'https://www.netflix.com',
  amazon: 'https://www.amazon.de',
  spotify: 'https://open.spotify.com',
  reddit: 'https://www.reddit.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
  linkedin: 'https://www.linkedin.com',
  'chat gpt': 'https://chat.openai.com',
  claude: 'https://claude.ai',
  openstreetmap: 'https://www.openstreetmap.org',
};

const WAKE = /^(hey|hi|ok|okay|hallo)?\s*,?\s*(jarvis|j\.a\.r\.v\.i\.s\.?)\s*[,.!?]?\s*/i;

/** Strip the wake word; returns [rest, hadWakeWord]. */
export function stripWakeWord(input: string): [string, boolean] {
  const m = input.match(WAKE);
  if (!m) return [input.trim(), false];
  return [input.slice(m[0].length).trim(), true];
}

/**
 * Deterministic command layer. Runs before the AI so browser control is instant,
 * offline-capable and never hallucinated. Returns null when the input is a question
 * for the AI.
 */
export function parseIntent(raw: string, title = 'Sir'): Intent | null {
  const [text, hadWake] = stripWakeWord(raw);
  const q = text.toLowerCase().replace(/[.!?]+$/, '').trim();

  if (!q && hadWake) return { actions: [], reply: `Ja, ${title}?` };

  // ── Tabs ──
  if (/^(öffne|mach|open)\s+(einen\s+)?(neuen\s+)?(privaten|inkognito|private|incognito)\s+tab/.test(q))
    return { actions: [{ type: 'newTab', private: true }], reply: 'Privater Tab geöffnet. Ich werde nichts davon im Verlauf speichern.' };
  if (/^(öffne|mach|open)\s+(einen\s+)?(neuen|new)\s+tab/.test(q) || q === 'neuer tab' || q === 'new tab')
    return { actions: [{ type: 'newTab' }], reply: 'Neuer Tab ist bereit.' };
  if (/(schließe?|schliess|close)\s+(den\s+)?(aktuellen\s+|current\s+|this\s+)?tab/.test(q))
    return { actions: [{ type: 'closeTab' }], reply: 'Tab geschlossen.' };

  // ── Navigation ──
  if (/^(zurück|geh zurück|go back|back)$/.test(q)) return { actions: [{ type: 'back' }], reply: 'Zurück.' };
  if (/^(vorwärts|weiter|go forward|forward)$/.test(q)) return { actions: [{ type: 'forward' }], reply: 'Vorwärts.' };
  if (/^(neu laden|aktualisier(e|en)?|reload|refresh)/.test(q)) return { actions: [{ type: 'reload' }], reply: 'Seite wird neu geladen.' };
  if (/(lesezeichen|bookmark)\s*(hinzufügen|setzen|speichern|add|this)?$/.test(q) && /(setz|speicher|hinzu|add|merk|mach)/.test(q))
    return { actions: [{ type: 'bookmark' }], reply: 'Lesezeichen gespeichert.' };

  // ── Search ──
  const search = q.match(/^(suche?|such|google|finde?|search)\s+(nach|for)?\s*(.+)$/);
  if (search) {
    const query = text.slice(text.toLowerCase().indexOf(search[3])).trim();
    return { actions: [{ type: 'search', query }], reply: `Ich suche nach „${query}“.` };
  }

  // ── Open site ──
  const open = q.match(/^(öffne|open|geh(e)? (zu|auf)|navigiere (zu|nach)|zeig(e)? mir)\s+(.+?)(\s+(bitte|please))?$/);
  if (open) {
    const target = open[6].replace(/^(die seite|die website|the site)\s+/, '').trim();
    // Module shortcuts handled below take priority for "zeig mir meine termine"
    if (!/(termin|kalender|aufgabe|notiz|wetter|erinnerung|nachricht|news|einstellung|settings)/.test(target)) {
      const known = SITES[target];
      const url = known ?? toUrl(target.replace(/\s+punkt\s+/g, '.').replace(/\s+dot\s+/g, '.')) ??
        (/^[\w-]+$/.test(target) ? `https://www.${target}.com` : null);
      if (url) return { actions: [{ type: 'navigate', url }], reply: `Öffne ${known ? target.replace(/\b\w/g, (c) => c.toUpperCase()) : url}.` };
    }
  }

  // ── Modules ──
  if (/(wetter|weather)/.test(q))
    return { actions: [{ type: 'openModule', module: 'weather' }], reply: '', passthrough: true };
  if (/(termine|kalender|calendar|appointments|was steht.*an)/.test(q))
    return { actions: [{ type: 'openModule', module: 'calendar' }], reply: '', passthrough: true };
  if (/(zeig|öffne|show).*(aufgaben|todo|tasks)/.test(q))
    return { actions: [{ type: 'openModule', module: 'tasks' }], reply: '', passthrough: true };
  if (/(zeig|öffne|show).*(nachrichten|news)/.test(q))
    return { actions: [{ type: 'openModule', module: 'news' }], reply: 'Die aktuellen Schlagzeilen sind im Nachrichtenmodul.' };
  if (/(zeig|öffne|show).*(notizen|notes)/.test(q))
    return { actions: [{ type: 'openModule', module: 'notes' }], reply: 'Ihre Notizen, ' + title + '.' };
  if (/(einstellungen|settings)/.test(q))
    return { actions: [{ type: 'openSettings' }], reply: 'Einstellungen geöffnet.' };

  // ── Create items ──
  const task = text.match(/^(neue aufgabe|aufgabe hinzufügen|add task|füge aufgabe hinzu)[:\s]+(.+)$/i);
  if (task) return { actions: [{ type: 'addTask', text: task[2] }], reply: `Aufgabe „${task[2]}“ notiert.` };
  const note = text.match(/^(notiz|notiere|note)[:\s]+(.+)$/i);
  if (note) return { actions: [{ type: 'addNote', text: note[2] }], reply: 'Notiz gespeichert.' };
  const rem = text.match(/^erinnere mich (in (\d+) minuten? )?(daran,? )?(an |dass )?(.+)$/i);
  if (rem) {
    const mins = rem[2] ? Number(rem[2]) : 30;
    return { actions: [{ type: 'addReminder', text: rem[5], at: Date.now() + mins * 60_000 }], reply: `Ich erinnere Sie in ${mins} Minuten daran, ${title}.` };
  }

  // ── Views ──
  if (/(fokus|focus)\s*(modus|mode)/.test(q)) return { actions: [{ type: 'setView', view: 'focus' }], reply: 'Fokusmodus aktiviert.' };
  if (/(browser)\s*(modus|mode|ansicht)/.test(q)) return { actions: [{ type: 'setView', view: 'browser' }], reply: 'Browseransicht aktiviert.' };
  if (/(kommando|command|standard)\s*(modus|mode|ansicht)/.test(q)) return { actions: [{ type: 'setView', view: 'command' }], reply: 'Kommandozentrale wiederhergestellt.' };
  if (/(lösche|clear|reset).*(chat|gespräch|verlauf|conversation)/.test(q)) return { actions: [{ type: 'clearChat' }], reply: '' };

  return null;
}
