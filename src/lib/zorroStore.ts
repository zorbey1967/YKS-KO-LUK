import { supabase } from './supabase';

export type ZorroRole = 'user' | 'assistant';

export type ZorroMsg = {
  id: string;
  who: 'user' | 'bot';
  text: string;
  createdAt: string;
};

export type ZorroConvMeta = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
};

type MemPack = {
  convs: ZorroConvMeta[];
  msgs: Record<string, ZorroMsg[]>;
};

let cloudReady: boolean | null = null;
const guestMem: MemPack = { convs: [], msgs: {} };

function newId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const s = Array.from({ length: 32 }, hex).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

export function conversationTitleFromText(raw: string) {
  let t = String(raw || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^\[Soru fotoğrafı eklendi\]$/i, 'Soru fotoğrafı');
  const orig = t.replace(/[?!.,;:]+$/g, '').trim();
  t = orig.replace(/\b(anlatır\s*mısın|anlatır\s*misin|söyler\s*misin|anlat|nedir|ne\s*demek)\b/gi, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  if (!t) t = orig;
  const words = t.split(' ').filter(Boolean);
  if (words.length > 4) t = words.slice(0, 4).join(' ');
  if (t.length > 32) t = `${t.slice(0, 29).trim()}…`;
  return t || 'Yeni Sohbet';
}

function previewFromText(raw: string) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  if (t.length > 72) return `${t.slice(0, 69).trim()}…`;
  return t;
}

function tableMissing(err: { message?: string; code?: string } | null) {
  const msg = String(err?.message || '');
  return err?.code === '42P01' || /zorro_conversations|schema cache|does not exist/i.test(msg);
}

function memKey(userId: string) {
  return `zorro_mem_${userId}`;
}

function readMem(userId: string | undefined): MemPack {
  if (!userId) return guestMem;
  try {
    const raw = sessionStorage.getItem(memKey(userId));
    if (!raw) return { convs: [], msgs: {} };
    const parsed = JSON.parse(raw) as MemPack;
    if (!parsed || !Array.isArray(parsed.convs) || !parsed.msgs) return { convs: [], msgs: {} };
    return parsed;
  } catch {
    return { convs: [], msgs: {} };
  }
}

function writeMem(userId: string | undefined, pack: MemPack) {
  if (!userId) {
    guestMem.convs = pack.convs;
    guestMem.msgs = pack.msgs;
    return;
  }
  try {
    sessionStorage.setItem(memKey(userId), JSON.stringify(pack));
  } catch { /* ignore */ }
}

function upsertMeta(list: ZorroConvMeta[], row: ZorroConvMeta) {
  const next = [row, ...list.filter((x) => x.id !== row.id)];
  next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return next.slice(0, 50);
}

export function welcomeZorroMsg(): ZorroMsg {
  return {
    id: newId(),
    who: 'bot',
    text: 'Ben ZORRO. Hedefin, programın ve kayıtlı sonuçların varsa onları kullanırım; yoksa uydurmam.',
    createdAt: new Date().toISOString(),
  };
}

export function zorroHistoryOnServer() {
  return cloudReady === true;
}

export function newConversationId() {
  return newId();
}

export async function listZorroConversations(userId: string | undefined): Promise<ZorroConvMeta[]> {
  const local = readMem(userId).convs;
  if (!userId || !supabase || cloudReady === false) return local;
  const { data, error } = await supabase
    .from('zorro_conversations')
    .select('id, title, preview, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (!error && data) {
    cloudReady = true;
    return data.map((r) => ({
      id: String(r.id),
      title: String(r.title || 'Yeni sohbet'),
      preview: String(r.preview || ''),
      updatedAt: String(r.updated_at || ''),
    }));
  }
  if (error && tableMissing(error)) cloudReady = false;
  return local;
}

export async function loadZorroMessages(userId: string | undefined, conversationId: string): Promise<ZorroMsg[] | null> {
  if (!conversationId) return [];
  const local = readMem(userId).msgs[conversationId] || [];
  if (!userId || !supabase || cloudReady === false) return local;
  const { data, error } = await supabase
    .from('zorro_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (!error && data) {
    cloudReady = true;
    return data.map((r) => ({
      id: String(r.id),
      who: r.role === 'user' ? 'user' : 'bot',
      text: String(r.content || ''),
      createdAt: String(r.created_at || ''),
    }));
  }
  if (error && tableMissing(error)) {
    cloudReady = false;
    return local;
  }
  if (error) return local.length ? local : null;
  return local;
}

export async function persistZorroTurn(opts: {
  userId: string | undefined;
  conversationId: string;
  title: string;
  userText: string;
  assistantText: string;
  isFirstUserMessage: boolean;
}) {
  const now = new Date().toISOString();
  const userMsg: ZorroMsg = { id: newId(), who: 'user', text: opts.userText, createdAt: now };
  const botMsg: ZorroMsg = { id: newId(), who: 'bot', text: opts.assistantText, createdAt: now };
  const meta: ZorroConvMeta = {
    id: opts.conversationId,
    title: opts.title,
    preview: previewFromText(opts.userText),
    updatedAt: now,
  };

  const pack = readMem(opts.userId);
  pack.convs = upsertMeta(pack.convs, meta);
  pack.msgs[opts.conversationId] = [...(pack.msgs[opts.conversationId] || []), userMsg, botMsg];
  writeMem(opts.userId, pack);

  if (opts.userId && cloudReady !== false && supabase) {
    if (opts.isFirstUserMessage) {
      const ins = await supabase.from('zorro_conversations').insert({
        id: opts.conversationId,
        user_id: opts.userId,
        title: opts.title,
        preview: meta.preview,
      });
      if (ins.error && tableMissing(ins.error)) cloudReady = false;
      else if (ins.error && /duplicate|already exists|23505/i.test(ins.error.message || '')) {
        await supabase.from('zorro_conversations').update({
          title: opts.title,
          preview: meta.preview,
          updated_at: now,
        }).eq('id', opts.conversationId).eq('user_id', opts.userId);
      }
    } else {
      await supabase.from('zorro_conversations').update({
        title: opts.title,
        preview: meta.preview,
        updated_at: now,
      }).eq('id', opts.conversationId).eq('user_id', opts.userId);
    }
    if (cloudReady !== false) {
      const rows = [
        { id: userMsg.id, conversation_id: opts.conversationId, user_id: opts.userId, role: 'user' as const, content: opts.userText.slice(0, 8000) },
        { id: botMsg.id, conversation_id: opts.conversationId, user_id: opts.userId, role: 'assistant' as const, content: opts.assistantText.slice(0, 8000) },
      ];
      const msgIns = await supabase.from('zorro_messages').insert(rows);
      if (msgIns.error && tableMissing(msgIns.error)) cloudReady = false;
      else if (!msgIns.error) return { userMsg, botMsg, meta, cloud: true as const };
    }
  }

  return { userMsg, botMsg, meta, cloud: false as const };
}

export function formatConvDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}
