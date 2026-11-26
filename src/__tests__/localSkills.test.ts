import { describe, expect, it } from 'vitest';
import { extractiveSummary, keywords, localBookmarkCategories, localEmail, localFile } from '../services/skills/local';

const TEXT = 'Der Arc-Reaktor liefert saubere Energie für den Anzug. Die Energie des Reaktors reicht für viele Stunden Flug. ' +
  'Tony Stark entwickelte den Reaktor in einer Höhle. Später wurde der Reaktor mit einem neuen Element verbessert. ' +
  'Das Wetter in Malibu war an diesem Tag sonnig und warm. Der verbesserte Reaktor erzeugt deutlich mehr Energie als zuvor.';

describe('local skills', () => {
  it('extracts the most relevant sentences in original order', () => {
    const s = extractiveSummary(TEXT, 3);
    expect(s).toHaveLength(3);
    expect(s.join(' ')).not.toContain('Wetter in Malibu');
    expect(TEXT.indexOf(s[0])).toBeLessThan(TEXT.indexOf(s[1]));
  });
  it('finds keywords without stop words', () => {
    expect(keywords(TEXT, 3)).toContain('reaktor');
    expect(keywords(TEXT, 10)).not.toContain('der');
  });
  it('categorises bookmarks', () => {
    const r = localBookmarkCategories([{ id: '1', title: 'GitHub', url: 'https://github.com' }, { id: '2', title: 'x', url: 'https://www.youtube.com' }]);
    expect(r.data).toEqual({ kind: 'categories', map: { 1: 'Entwicklung', 2: 'Unterhaltung' } });
  });
  it('drafts an e-mail with recipient', () => {
    const r = localEmail('Schreibe eine E-Mail an Pepper pepper@stark.com wegen Termin am Freitag', 'Tony Stark');
    expect(r.data).toMatchObject({ kind: 'email', to: 'pepper@stark.com', subject: 'Termin am Freitag' });
  });
  it('analyses CSV files', () => {
    const r = localFile({ name: 'a.csv', size: 30, mediaType: 'text/csv', text: 'name;wert\na;1\nb;2\n' });
    expect(r.text).toContain('2 Zeilen');
    expect(r.text).toContain('name, wert');
  });
});
