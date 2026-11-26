import { describe, expect, it } from 'vitest';
import { parseIntent, stripWakeWord } from '../services/commands/intentParser';

const first = (s: string) => parseIntent(s)?.actions[0];

describe('intent parser', () => {
  it('strips the wake word', () => {
    expect(stripWakeWord('Hey Jarvis, öffne YouTube')).toEqual(['öffne YouTube', true]);
    expect(stripWakeWord('öffne YouTube')).toEqual(['öffne YouTube', false]);
  });
  it('handles the commands from the spec', () => {
    expect(first('Öffne YouTube.')).toEqual({ type: 'navigate', url: 'https://www.youtube.com' });
    expect(first('Suche nach künstlicher Intelligenz')).toEqual({ type: 'search', query: 'künstlicher Intelligenz' });
    expect(first('Öffne einen neuen Tab')).toEqual({ type: 'newTab' });
    expect(first('Schließe den aktuellen Tab')).toEqual({ type: 'closeTab' });
    expect(first('Wie ist das Wetter?')).toEqual({ type: 'openModule', module: 'weather' });
    expect(first('Zeige mir meine Termine')).toEqual({ type: 'openModule', module: 'calendar' });
    expect(parseIntent('Hey Jarvis')?.reply).toMatch(/Ja, Sir/);
  });
  it('recognises AI skills', () => {
    expect(first('Fasse diese Seite zusammen')).toEqual({ type: 'skill', skill: 'summarize' });
    expect(first('Übersetze die Seite ins Englisch')).toEqual({ type: 'skill', skill: 'translate', arg: 'Englisch' });
    expect(first('Analysiere die Seite')).toEqual({ type: 'skill', skill: 'analyze' });
    expect(first('Recherchiere über Festkörperbatterien')).toEqual({ type: 'skill', skill: 'research', arg: 'Festkörperbatterien' });
    expect(first('Schreibe eine E-Mail an pepper@stark.com wegen Freitag')).toMatchObject({ type: 'skill', skill: 'email' });
    expect(first('Sortiere meine Lesezeichen')).toEqual({ type: 'skill', skill: 'bookmarks' });
    expect(first('Zerlege die Aufgabe Umzug planen')).toEqual({ type: 'skill', skill: 'breakdown', arg: 'Umzug planen' });
    expect(first('Exportiere den Kalender')).toEqual({ type: 'exportCalendar' });
  });
  it('recognises routines', () => {
    expect(first('Starte Morgenroutine')).toEqual({ type: 'routine', name: 'morgen' });
    expect(first('Starte Arbeitsbeginn')).toEqual({ type: 'routine', name: 'arbeitsbeginn' });
  });
  it('leaves free questions to the AI', () => {
    expect(parseIntent('Was ist die Hauptstadt von Australien?')).toBeNull();
  });
});
