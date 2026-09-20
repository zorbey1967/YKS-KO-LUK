import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { buildUserPrompt, coachSystemPrompt, packAiResult, type StudentAiBody } from '../src/lib/llmPrompt';

type Keys = {
  groq: string;
  openai: string;
  gemini: string;
  headerKey: string;
  provider: string;
  ollamaModel: string;
};

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function openaiChat(base: string, key: string, model: string, messages: { role: string; content: string }[]) {
  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0.45, messages }),
  });
  const payload = await res.json().catch(() => ({}));
  const text = String(payload?.choices?.[0]?.message?.content || '').trim();
  if (!res.ok || !text) throw new Error(String(payload?.error?.message || `HTTP ${res.status}`));
  return { text, model };
}

async function geminiChat(key: string, system: string, user: string, history: { role?: string; content?: string }[], jsonMode: boolean) {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let last = '';
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const h of history.slice(-8)) {
    if (!h.content) continue;
    contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content.slice(0, 2500) }] });
  }
  contents.push({ role: 'user', parts: [{ text: user }] });
  if (contents[0]?.role === 'model') contents.unshift({ role: 'user', parts: [{ text: 'Merhaba.' }] });

  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.5, maxOutputTokens: 2048, ...(jsonMode ? { responseMimeType: 'application/json' } : {}) },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      const text = String(payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') || '').trim();
      if (res.ok && text) return { text, model: `gemini/${model}` };
      last = String(payload?.error?.message || res.status);
    } catch (e) {
      last = e instanceof Error ? e.message : '';
    }
  }
  throw new Error(last || 'Gemini hata');
}

async function ollamaUp() {
  try {
    const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(600) });
    return r.ok;
  } catch {
    return false;
  }
}

async function runModel(body: StudentAiBody, keys: Keys) {
  const ctx = typeof body.context === 'string' ? body.context : JSON.stringify(body.context || {});
  const system = coachSystemPrompt(ctx);
  const user = buildUserPrompt(body);
  const jsonMode = body.action === 'plan' || body.action === 'schedule';
  const messages = [
    { role: 'system', content: system },
    ...(body.history || []).filter((h) => h.content).slice(-8).map((h) => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content).slice(0, 2500),
    })),
    { role: 'user', content: user },
  ];

  const want = keys.provider || 'auto';
  const groqKey = keys.groq || (want === 'groq' ? keys.headerKey : keys.headerKey.startsWith('gsk_') ? keys.headerKey : '');
  const openaiKey = keys.openai || (want === 'openai' ? keys.headerKey : keys.headerKey.startsWith('sk-') ? keys.headerKey : '');
  const geminiKey = keys.gemini || (want === 'gemini' || keys.headerKey.startsWith('AIza') ? keys.headerKey : '');

  const errors: string[] = [];

  if ((want === 'groq' || want === 'auto') && groqKey) {
    try {
      const r = await openaiChat('https://api.groq.com/openai/v1', groqKey, process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', messages);
      return { ...packAiResult(body.action || 'chat', r.text), model: `Groq · ${r.model}` };
    } catch (e) { errors.push(`groq: ${e instanceof Error ? e.message : e}`); }
  }
  if ((want === 'openai' || want === 'auto') && openaiKey) {
    try {
      const r = await openaiChat(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', openaiKey, process.env.OPENAI_MODEL || 'gpt-4o-mini', messages);
      return { ...packAiResult(body.action || 'chat', r.text), model: `OpenAI · ${r.model}` };
    } catch (e) { errors.push(`openai: ${e instanceof Error ? e.message : e}`); }
  }
  if ((want === 'gemini' || want === 'auto') && geminiKey) {
    try {
      const r = await geminiChat(geminiKey, system, user, body.history || [], jsonMode);
      return { ...packAiResult(body.action || 'chat', r.text), model: `Gemini · ${r.model}` };
    } catch (e) { errors.push(`gemini: ${e instanceof Error ? e.message : e}`); }
  }
  if ((want === 'ollama' || want === 'auto') && await ollamaUp()) {
    try {
      const r = await openaiChat('http://127.0.0.1:11434/v1', 'ollama', keys.ollamaModel || 'llama3.2', messages);
      return { ...packAiResult(body.action || 'chat', r.text), model: `Ollama · ${r.model}` };
    } catch (e) { errors.push(`ollama: ${e instanceof Error ? e.message : e}`); }
  }

  return { error: errors[0] || 'NO_KEY', reply: '' };
}

function attach(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
  server.middlewares.use((req, res, next) => {
    const url = req.url?.split('?')[0] || '';
    if (url !== '/api/student-ai') return next();

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      void (async () => {
        send(res, 200, {
          groq: Boolean(process.env.GROQ_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY),
          gemini: Boolean(process.env.GEMINI_API_KEY),
          ollama: await ollamaUp(),
        });
      })();
      return;
    }

    if (req.method !== 'POST') return next();

    void (async () => {
      try {
        const raw = await readBody(req);
        const body = (raw ? JSON.parse(raw) : {}) as StudentAiBody;
        const keys: Keys = {
          groq: process.env.GROQ_API_KEY || '',
          openai: process.env.OPENAI_API_KEY || '',
          gemini: process.env.GEMINI_API_KEY || '',
          headerKey: '',
          provider: String(req.headers['x-llm-provider'] || 'auto'),
          ollamaModel: String(req.headers['x-ollama-model'] || process.env.OLLAMA_MODEL || 'llama3.2'),
        };
        const out = await runModel(body, keys);
        send(res, 200, out);
      } catch (e) {
        send(res, 200, { error: e instanceof Error ? e.message : 'Hata', reply: '' });
      }
    })();
  });
}

export function studentAiPlugin(): Plugin {
  return {
    name: 'student-ai-gateway',
    configureServer(server) { attach(server); },
    configurePreviewServer(server) { attach(server); },
  };
}
