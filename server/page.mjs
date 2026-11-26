import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Fetches a public web page and extracts readable text.
 * SSRF protection: only http(s), every hop (incl. redirects) must resolve to a public IP.
 */
const MAX_BYTES = 2_000_000;

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublic(url) {
  if (!/^https?:$/.test(url.protocol)) throw Object.assign(new Error('Nur http(s)-Adressen erlaubt'), { status: 400 });
  if (url.username || url.password) throw Object.assign(new Error('Zugangsdaten in URLs sind nicht erlaubt'), { status: 400 });
  const addrs = await dns.lookup(url.hostname, { all: true }).catch(() => { throw Object.assign(new Error('Host nicht auflösbar'), { status: 400 }); });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw Object.assign(new Error('Interne Adressen sind nicht erlaubt'), { status: 400 });
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü',
  szlig: 'ß', euro: '€', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', copy: '©', reg: '®', trade: '™', deg: '°', middot: '·', eacute: 'é', egrave: 'è', agrave: 'à',
};
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
});

export function htmlToText(html) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim());
  const description = decode(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? '');
  const lang = html.match(/<html[^>]+lang=["']?([\w-]+)/i)?.[1] ?? '';
  // Prefer <main>/<article> when present
  const body = html.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? html;
  const text = decode(body
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
  return { title, description, lang, text };
}

export async function fetchPage(rawUrl, signal) {
  let url = new URL(rawUrl);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual', signal: signal ?? AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JarvisReader/1.0)', Accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), url); continue; }
    if (!res.ok) throw Object.assign(new Error(`Seite antwortete mit ${res.status}`), { status: 502 });
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/|html|xml|json/.test(type)) throw Object.assign(new Error(`Nicht unterstützter Inhaltstyp: ${type || 'unbekannt'}`), { status: 415 });
    const reader = res.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { reader.cancel(); break; }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    const page = /html/.test(type) ? htmlToText(raw) : { title: url.hostname, description: '', lang: '', text: raw };
    return { url: url.toString(), ...page, text: page.text.slice(0, 60_000), truncated: page.text.length > 60_000 || size > MAX_BYTES };
  }
  throw Object.assign(new Error('Zu viele Weiterleitungen'), { status: 502 });
}
