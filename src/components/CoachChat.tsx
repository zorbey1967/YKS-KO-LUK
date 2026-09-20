import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { COACH_CHIPS, coachSnapshot, type CoachSnap } from '../lib/coach';
import { askCoach, type CoachSource } from '../lib/coachAi';
import { today, uid } from '../lib/util';
import { displayAge, displayText } from '../lib/types';
import { BrandLogo } from './BrandLogo';

type Msg = { who: 'user' | 'bot'; text: string; source?: CoachSource; model?: string };

function chatKey(userId?: string) {
  return userId ? `yks_v7_chat_${userId}` : 'yks_v7_chat';
}

function loadMsgs(userId?: string): Msg[] {
  try {
    const raw = JSON.parse(localStorage.getItem(chatKey(userId)) || '[]');
    if (Array.isArray(raw) && raw.length) return raw.slice(-40);
  } catch { /* ignore */ }
  return [];
}

export function CoachChat() {
  const { data, setData, toast, profile, go, user } = useApp();
  const snap = coachSnapshot(data);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastPlan, setLastPlan] = useState<{ text: string; minutes: number; icon: string }[] | undefined>();
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    const saved = loadMsgs(user?.id);
    if (saved.length) return saved;
    return [{
      who: 'bot',
      source: user ? 'ai' : 'local',
      text: user
        ? `Selam${profile?.name ? ` ${profile.name.split(' ')[0]}` : ''}. Gerçek koç sunucuda. ${displayText(snap.grade)}, ${displayAge(snap.age)}, ${displayText(snap.dept)}. Ne çalışalım?`
        : `Selam${profile?.name ? ` ${profile.name.split(' ')[0]}` : ''}. Giriş yoksa yerel koç yazar. Gerçek model için Hesabım’dan giriş yap.`,
    }];
  });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(chatKey(user?.id), JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ }
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy, user?.id]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    const nextMsgs: Msg[] = [...msgs, { who: 'user', text: q }];
    setMsgs(nextMsgs);
    setBusy(true);
    try {
      const ans = await askCoach(q, data, nextMsgs);
      setLastPlan(ans.plan);
      setMsgs((m) => [...m, { who: 'bot', text: ans.text, source: ans.source, model: ans.model }]);
    } catch (e) {
      setMsgs((m) => [...m, { who: 'bot', text: e instanceof Error ? e.message : 'Koç yanıt veremedi.', source: 'local' }]);
    } finally {
      setBusy(false);
    }
  }

  function applyPlan() {
    if (!lastPlan?.length) return toast('Aktarılacak plan yok. Önce “bugün plan” yaz.');
    setData((d) => ({
      ...d,
      tasks: [
        ...lastPlan.map((x) => ({
          id: uid('ai_'),
          title: x.text,
          subject: 'Koç',
          minutes: x.minutes,
          priority: 'Normal',
          done: false,
          date: today(),
        })),
        ...d.tasks,
      ],
    }));
    toast(`${lastPlan.length} blok göreve alındı`);
  }

  const chips = COACH_CHIPS[snap.kind as CoachSnap['kind']];

  return (
    <>
      <button className="fab" type="button" aria-label="E-Koç" onClick={() => setOpen((v) => !v)}>
        <BrandLogo size={28} className="brand-logo fab-logo" />
      </button>
      {open && (
        <section className="chat-panel" aria-label="E-Koç sohbet">
          <div className="section-title" style={{ padding: '12px 14px', margin: 0, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <BrandLogo size={28} className="brand-logo" />
              <div>
                <b>E-Koç</b>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{snap.exam} • {displayText(snap.grade)} • {displayAge(snap.age)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="chip" type="button" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }} onClick={() => { setOpen(false); go('settings'); }}>Ayarlar</button>
              <button className="icon-btn" type="button" style={{ background: 'transparent', color: '#fff', border: 0 }} onClick={() => setOpen(false)}>×</button>
            </div>
          </div>
          <div className="chat-msgs" ref={box}>
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.who === 'bot' ? 'chat-bot' : 'chat-user'}`}>
                {m.text}
                {m.who === 'bot' && m.source ? <div className="chat-src">{m.source === 'ai' ? (m.model || 'Gerçek model') : 'Yerel koç'}</div> : null}
              </div>
            ))}
            {busy ? <div className="chat-msg chat-bot">Yazıyor…</div> : null}
          </div>
          <div className="actions" style={{ padding: '0 10px', margin: 0, flexWrap: 'wrap' }}>
            {chips.map((q) => (
              <button key={q} className="chip" type="button" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }} onClick={() => void send(q)}>{q}</button>
            ))}
            <button className="chip" type="button" style={{ background: 'rgba(94,184,122,.28)', color: '#fff' }} onClick={applyPlan}>Göreve aktar</button>
          </div>
          <div className="actions" style={{ padding: 10, margin: 0 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              placeholder="Örn. bugün 2 saat matematik"
              style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'rgba(255,255,255,.14)' }}
            />
            <button className="btn primary" type="button" disabled={busy} onClick={() => void send()}>➤</button>
          </div>
        </section>
      )}
    </>
  );
}