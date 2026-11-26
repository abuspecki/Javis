import type { AIProvider, AIRequest, AIResponse } from '../types';
import { fmtTime, germanGreeting, isSameDay } from '../../../lib/util';

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); });
});

/**
 * Offline persona engine. Grounded in the live context (calendar, tasks, weather)
 * so it is genuinely useful without any API key. Replace with BackendProvider for
 * free-form intelligence.
 */
export class DemoProvider implements AIProvider {
  readonly id = 'demo';
  readonly label = 'Local persona (offline)';

  async chat({ messages, context, signal }: AIRequest): Promise<AIResponse> {
    await sleep(500 + Math.random() * 700, signal);
    const last = messages[messages.length - 1]?.content ?? '';
    const q = last.toLowerCase();
    const sir = context.userTitle;
    const today = context.events.filter((e) => isSameDay(e.start, context.now)).sort((a, b) => a.start - b.start);
    const openTasks = context.tasks.filter((t) => !t.done);

    const reply = (text: string): AIResponse => ({ text, provider: this.id });

    if (/(was steht|termine|agenda|kalender|schedule|today)/.test(q)) {
      if (!today.length) return reply(`${germanGreeting()}, ${sir}. Ihr Kalender ist heute frei. Ein seltener Luxus — soll ich ihn so belassen?`);
      const words = ['einen', 'zwei', 'drei', 'vier', 'fünf', 'sechs'];
      const n = words[today.length - 1] ?? String(today.length);
      const high = today.filter((e) => e.priority === 'high').length;
      const list = today.map((e) => `${fmtTime(e.start)} ${e.title}`).join(', ');
      return reply(`${germanGreeting()}, ${sir}. Sie haben heute ${n} Termin${today.length > 1 ? 'e' : ''}${high ? `, davon ${high} mit hoher Priorität` : ''}: ${list}. Ich habe die Übersicht im Kalendermodul geöffnet.`);
    }
    if (/(aufgabe|todo|to-do|tasks)/.test(q)) {
      if (!openTasks.length) return reply(`Alle Aufgaben sind erledigt, ${sir}. Beeindruckend.`);
      return reply(`Es sind ${openTasks.length} Aufgaben offen. Die dringlichste: „${openTasks[0].text}“.`);
    }
    if (/(erinnerung|reminder)/.test(q)) {
      const next = context.reminders.filter((r) => !r.done && r.at > context.now).sort((a, b) => a.at - b.at)[0];
      return reply(next ? `Ihre nächste Erinnerung um ${fmtTime(next.at)}: „${next.text}“.` : `Keine anstehenden Erinnerungen, ${sir}.`);
    }
    if (/(wie spät|uhrzeit|time is it)/.test(q)) return reply(`Es ist ${fmtTime(context.now)} Uhr, ${sir}.`);
    if (/(wer bist du|who are you|was bist du)/.test(q))
      return reply(`Just A Rather Very Intelligent System, ${sir}. Ich verwalte Ihren Browser, Ihren Kalender und — wenn Sie mich lassen — auch Ihren Terminkalender-Optimismus.`);
    if (/(danke|thank)/.test(q)) return reply(pick([`Stets zu Diensten, ${sir}.`, `Gern geschehen, ${sir}.`, `Dafür bin ich da.`]));
    if (/(hallo|hi\b|hey|guten)/.test(q)) return reply(`${germanGreeting()}, ${sir}. Alle Systeme sind betriebsbereit. Womit kann ich dienen?`);
    if (/(status|system|diagnose)/.test(q))
      return reply(`Systemdiagnose abgeschlossen. Alle Kernmodule sind nominal, die Verbindung ist stabil. Details finden Sie im Systemmonitor rechts.`);
    if (/(witz|joke)/.test(q))
      return reply(`Ich würde Ihnen einen Witz über UDP erzählen, ${sir}, aber ich bin nicht sicher, ob er ankommt.`);

    return reply(pick([
      `Verstanden, ${sir}. Im Offline-Modus ist mein Repertoire begrenzt — verbinden Sie ein KI-Backend in den Einstellungen, und ich beantworte auch das ausführlich.`,
      `Eine interessante Frage, ${sir}. Für eine fundierte Antwort benötige ich das KI-Backend. Soll ich stattdessen im Web danach suchen? Sagen Sie einfach „Suche nach …“.`,
    ]));
  }
}
