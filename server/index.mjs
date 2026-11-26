import http from 'node:http';
import { buildSystemPrompt, extractActions } from './prompt.mjs';
import { fetchPage } from './page.mjs';
import { SKILLS } from './skills.mjs';
import { createClaudeProvider } from './providers/claude.mjs';
import { createEchoProvider } from './providers/echo.mjs';

/**
 * J.A.R.V.I.S. backend — model-agnostic chat gateway.
 *   POST /api/chat   { messages:[{role,content}], context } → { text, actions, provider }
 *   POST /api/skill  { skill, input }        → { text, sources?, data? }   (siehe skills.mjs)
 *   GET  /api/page?url=…                    → { url, title, text, … }      (öffentliche Seiten, SSRF-geschützt)
 *   GET  /api/health
 * Add more models by dropping a file into ./providers exporting { id, chat({system,messages,signal}) }.
 */
const PORT = Number(process.env.PORT || 8787);
const ORIGINS = (process.env.JARVIS_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim());

const providerName = process.env.JARVIS_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'claude' : 'echo');
const provider = providerName === 'claude' ? createClaudeProvider() : createEchoProvider();

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ORIGINS.includes(origin) || origin.startsWith('chrome-extension://'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

async function readBody(req, limit = 20 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 }); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) throw Object.assign(new Error('messages must be an array'), { status: 400 });
  const msgs = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift(); // API requires a user turn first
  if (!msgs.length) throw Object.assign(new Error('no user message'), { status: 400 });
  return msgs;
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  if (pathname === '/api/health') return json(res, 200, { ok: true, provider: provider.id, skills: Object.keys(SKILLS), webSearch: !!provider.supportsWebSearch });

  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });

  if (pathname === '/api/page' && req.method === 'GET') {
    try { return json(res, 200, await fetchPage(searchParams.get('url') ?? '', ac.signal)); }
    catch (e) { return fail(res, e, ac); }
  }
  if (pathname === '/api/skill' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const skill = SKILLS[body.skill];
      if (!skill) return json(res, 400, { error: `Unbekannte Fähigkeit: ${String(body.skill)}` });
      const result = await skill({ provider, input: body.input ?? {}, signal: ac.signal });
      return json(res, 200, { ...result, provider: provider.id });
    } catch (e) { return fail(res, e, ac); }
  }
  if (pathname !== '/api/chat' || req.method !== 'POST') return json(res, 404, { error: 'not found' });

  try {
    const body = await readBody(req);
    const messages = sanitizeMessages(body.messages);
    const system = buildSystemPrompt(body.context || {});
    const raw = await provider.chat({ system, messages, signal: ac.signal });
    const { text, actions } = extractActions(raw || '');
    json(res, 200, { text: text || '…', actions, provider: provider.id });
  } catch (e) { fail(res, e, ac); }
});

function fail(res, e, ac) {
  if (ac.signal.aborted) return;
  console.error('[jarvis] error:', e?.status ?? '', e?.message);
  const status = e.status && e.status !== 401 ? e.status : 502;
  json(res, status, { error: e.status === 401 ? 'Ungültiger API-Schlüssel' : e.message || 'Upstream error' });
}

server.listen(PORT, () => console.log(`[jarvis] backend on http://localhost:${PORT} · provider=${provider.id}`));
