import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { askCoach, type CoachSource } from '../lib/coachAi';
import { formatCoachHtml } from '../lib/aiTutor';
import { compressQuestionImage } from '../lib/chatImage';
import { today, uid } from '../lib/util';
import { lastBankTopic, setBankJump, weakBankTopics } from '../lib/practice';
import { paidAccessLocked } from '../lib/subscription';
import { isAffirmative, parseExamAddIntent, publicSourceLabel } from '../lib/zoroText';
import { emptyExamTarget, upsertExam } from '../lib/examTargets';
import { workingModeChips, type ZorroUiAction } from '../lib/zorroSuggest';
import { topicMastery } from '../lib/zorroMastery';
import { mergeLearningNote } from '../lib/zorroMemory';
import { canUseFeature } from '../lib/subscription';
import { appendGeneratedTasks } from '../lib/coachPlan';
import {
  conversationTitleFromText,
  formatConvDate,
  listZorroConversations,
  loadZorroMessages,
  newConversationId,
  persistZorroTurn,
  welcomeZorroMsg,
  zorroHistoryOnServer,
  type ZorroConvMeta,
  type ZorroMsg,
} from '../lib/zorroStore';

type Msg = ZorroMsg & { source?: CoachSource; badge?: string };

const FRIENDLY_FAIL = 'ZORRO şu anda yanıt veremiyor. Lütfen biraz sonra tekrar dene.';

export function CoachChat() {
  const { data, setData, toast, go, user, page, profile } = useApp();
  const chatLocked = paidAccessLocked(profile);
  const weak = weakBankTopics(data, 1)[0];
  const lastQ = lastBankTopic(data);
  const chips = workingModeChips(data, Boolean(user), canUseFeature(profile, 'zorro_advanced'));
  const fact = topicMastery(data).find((m) => m.enough);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [lastPlan, setLastPlan] = useState<{ text: string; minutes: number; icon: string }[] | undefined>();
  const [lastActions, setLastActions] = useState<ZorroUiAction[]>([]);
  const [convId, setConvId] = useState(() => newConversationId());
  const [convs, setConvs] = useState<ZorroConvMeta[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>(() => [welcomeZorroMsg()]);
  const pendingExam = useRef<{ title: string; date: string; time: string } | null>(null);
  const lastUserQ = useRef('');
  const savedOnce = useRef(false);
  const convTitle = useRef('Yeni Sohbet');
  const gen = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function startFreshChat() {
    gen.current += 1;
    savedOnce.current = false;
    convTitle.current = 'Yeni Sohbet';
    pendingExam.current = null;
    lastUserQ.current = '';
    setBusy(false);
    setLastPlan(undefined);
    setLastActions([]);
    setConvId(newConversationId());
    setMsgs([welcomeZorroMsg()]);
    setInput('');
  }

  function togglePanel() {
    if (open) closePanel();
    else {
      setOpen(true);
      void refreshHistory();
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }

  useEffect(() => {
    const openZorro = () => {
      setOpen(true);
      void refreshHistory();
      window.setTimeout(() => inputRef.current?.focus(), 40);
    };
    window.addEventListener('yks-open-zorro', openZorro);
    return () => window.removeEventListener('yks-open-zorro', openZorro);
  }, [user?.id]);

  useEffect(() => {
    startFreshChat();
    setOpen(false);
    setConvs([]);
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, user?.id, convId]);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy, open]);

  function closePanel() {
    setOpen(false);
  }

  async function refreshHistory() {
    const rows = await listZorroConversations(user?.id);
    setConvs(rows);
  }

  async function selectConversation(id: string) {
    gen.current += 1;
    setBusy(false);
    const loaded = await loadZorroMessages(user?.id, id);
    if (loaded == null) {
      toast('Sohbet yüklenemedi.');
      return;
    }
    savedOnce.current = true;
    convTitle.current = convs.find((c) => c.id === id)?.title || 'Sohbet';
    pendingExam.current = null;
    setConvId(id);
    setMsgs(loaded.length ? loaded : [welcomeZorroMsg()]);
    window.setTimeout(() => inputRef.current?.focus(), 40);
  }

  async function rememberTurn(userText: string, assistantText: string) {
    const first = !savedOnce.current;
    if (first) convTitle.current = conversationTitleFromText(userText);
    savedOnce.current = true;
    await persistZorroTurn({
      userId: user?.id,
      conversationId: convId,
      title: convTitle.current,
      userText,
      assistantText,
      isFirstUserMessage: first,
    });
    await refreshHistory();
  }

  async function send(text?: string, display?: string) {
    if (chatLocked) return toast('Deneme veya üyelik gerekli.');
    const q = (text ?? input).trim().slice(0, 2000);
    if ((!q && !photo) || busy) return;
    const question = q || (photo ? 'Bu soruyu çöz. Konuyu söyle, adım adım git. Okunmuyorsa söyle.' : '');
    if (!question) return;
    setInput('');
    const shown = (display || question).slice(0, 2000);
    const userLine = photo ? `${shown}\n[Soru fotoğrafı eklendi]` : shown;
    const history = [...msgs, { who: 'user' as const, text: question }];
    setMsgs((m) => [...m, { id: uid('u'), who: 'user', text: userLine, createdAt: new Date().toISOString() }]);
    setBusy(true);
    const shot = photo;
    setPhoto(null);
    lastUserQ.current = question;

    const token = gen.current;
    const finish = async (bot: Msg) => {
      if (token !== gen.current) return;
      setMsgs((m) => [...m, bot]);
      await rememberTurn(userLine, bot.text);
      setBusy(false);
    };

    if (pendingExam.current && isAffirmative(question)) {
      const offer = pendingExam.current;
      pendingExam.current = null;
      const draft = emptyExamTarget();
      draft.title = offer.title;
      draft.kind = 'Deneme';
      draft.origin = 'user';
      draft.date = offer.date;
      draft.startTime = offer.time;
      draft.isPrimary = false;
      setData((d) => ({ ...d, examTargets: upsertExam(d.examTargets || [], draft), examDate: d.examDate }));
      await finish({
        id: uid('b'),
        who: 'bot',
        text: `${offer.date} tarihli “${offer.title}” takvime eklendi.`,
        source: 'local',
        badge: 'Takvim',
        createdAt: new Date().toISOString(),
      });
      return;
    }
    const offer = parseExamAddIntent(question);
    if (offer && !photo) {
      pendingExam.current = offer;
      await finish({
        id: uid('b'),
        who: 'bot',
        text: `${offer.date}${offer.time ? ` ${offer.time}` : ''} için “${offer.title}” kaydını takvime eklememi ister misin? (Evet / Hayır)`,
        source: 'local',
        badge: 'Takvim',
        createdAt: new Date().toISOString(),
      });
      return;
    }
    try {
      let img: { b64: string; mime: string } | null = null;
      if (shot) {
        try {
          const packed = await compressQuestionImage(shot.file);
          img = { b64: packed.b64, mime: packed.mime };
          URL.revokeObjectURL(packed.preview);
        } catch {
          await finish({ id: uid('b'), who: 'bot', text: 'Fotoğraf gönderilemedi. Daha net bir görsel dene.', source: 'local', createdAt: new Date().toISOString() });
          return;
        }
      }
      const ans = await askCoach(question, data, history, img);
      setLastPlan(ans.plan);
      setLastActions(ans.actions || []);
        if (ans.learning) setData((d) => mergeLearningNote(d, ans.learning ?? null));
      await finish({
        id: uid('b'),
        who: 'bot',
        text: ans.text,
        source: ans.source,
        badge: 'Zorro',
        createdAt: new Date().toISOString(),
      });
    } catch {
      await finish({ id: uid('b'), who: 'bot', text: FRIENDLY_FAIL, source: 'local', createdAt: new Date().toISOString() });
    } finally {
      if (shot?.preview) URL.revokeObjectURL(shot.preview);
      if (token === gen.current) setBusy(false);
    }
  }

  function applyPlan() {
    if (!lastPlan?.length) return toast('Aktarılacak plan yok. Önce Planım de.');
    if (!confirm('Önerilen bloklar bugünün görevlerine eklensin mi? Mevcut görevler silinmez.')) return;
    setData((d) => appendGeneratedTasks(d, lastPlan.map((x) => ({
      id: uid('ai_'),
      title: x.text,
      subject: 'ZORRO',
      minutes: x.minutes,
      priority: 'Normal',
      done: false,
      origin: 'zorro' as const,
      date: today(),
    }))));
    toast(`${lastPlan.length} blok göreve alındı`);
  }

  function runAction(a: ZorroUiAction) {
    if (a.kind === 'send' && a.prompt) void send(a.prompt, a.label);
    if (a.kind === 'goto' && a.page) {
      if (a.page === 'questionbank' && (weak || lastQ)) {
        const t = weak || lastQ;
        if (t) setBankJump({ level: t.levelName, subject: t.subject, topic: t.topic });
      }
      closePanel();
      go(a.page);
    }
  }

  if (page === 'meeting') return null;

  return (
    <>
      {open ? null : (
        <button
          className="fab"
          type="button"
          aria-label="ZORRO"
          aria-expanded={false}
          aria-controls="zorro-panel"
          onClick={togglePanel}
        >
          🦁
        </button>
      )}
      {open ? (
        <button type="button" className="zorro-backdrop" aria-label="Zorro panelini kapat" onClick={closePanel} />
      ) : null}
      {open && (
        <section className="zorro-dock" id="zorro-panel" aria-label="Zorro sohbet">
          <header className="zorro-head">
            <div className="zorro-head-id">
              <span className="zorro-mark" aria-hidden="true">🦁</span>
              <div>
                <b>ZORRO</b>
                <div className="zorro-sub">Bugün sana nasıl yardımcı olabilirim?</div>
                {fact ? <div className="zorro-sub">{fact.subject} · {fact.topic} · {fact.correct}/{fact.attempts}</div> : null}
              </div>
            </div>
            <div className="zorro-head-actions">
              <button className="chip zorro-tool" type="button" disabled={busy} onClick={() => { startFreshChat(); void refreshHistory(); }}>+ Yeni</button>
              {lastUserQ.current && !busy ? (
                <button className="chip zorro-tool" type="button" onClick={() => void send(lastUserQ.current)}>Yeniden dene</button>
              ) : null}
              <button className="zorro-x" type="button" aria-label="Kapat" onClick={closePanel}>×</button>
            </div>
          </header>
          {convs.length ? (
            <div className="zorro-history">
              <div className="zorro-hist-label">Sohbetler</div>
              {convs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`zorro-hist-item${c.id === convId ? ' is-on' : ''}`}
                  onClick={() => void selectConversation(c.id)}
                >
                  <span className="zorro-hist-title">{c.title}</span>
                  <span className="zorro-hist-meta">
                    {formatConvDate(c.updatedAt)}
                    {c.preview ? ` · ${c.preview}` : ''}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {chatLocked ? (
            <div className="chat-msgs">
              <p className="muted" style={{ padding: 12 }}>Zorro, deneme veya ücretli üyelik ile açılır. Tarayıcı ayarı yetki vermez.</p>
              <div className="actions" style={{ padding: 12 }}>
                <button className="btn primary" type="button" onClick={() => { closePanel(); go('membership'); }}>Üyelik</button>
              </div>
            </div>
          ) : (
          <>
          <div className="chat-msgs" ref={box}>
            {msgs.map((m) => (
              <div key={m.id} className={`chat-msg ${m.who === 'bot' ? 'chat-bot' : 'chat-user'}`}>
                {m.who === 'bot' && m.badge && m.badge !== 'Zorro' && m.badge !== 'ZORRO' ? <span className="chat-badge">{m.badge}</span> : null}
                {m.who === 'bot'
                  ? <div dangerouslySetInnerHTML={{ __html: formatCoachHtml(m.text) }} />
                  : m.text}
                {m.who === 'bot' ? <div className="chat-src">{publicSourceLabel()}</div> : null}
              </div>
            ))}
            {busy ? <div className="chat-msg chat-bot">Düşünüyor…</div> : null}
          </div>
          <div className="zorro-chips">
            {chips.map((q) => (
              <button
                key={q.label}
                className="chip zorro-tool"
                type="button"
                onClick={() => {
                  if (q.label === 'Fotoğraftan Soru') {
                    fileRef.current?.click();
                    return;
                  }
                  void send(q.prompt, q.display);
                }}
              >{q.display}</button>
            ))}
            {lastActions.map((a) => (
              <button key={a.id} className="chip zorro-tool" type="button" onClick={() => runAction(a)}>{a.label}</button>
            ))}
            {weak || lastQ ? (
              <button
                className="chip zorro-tool"
                type="button"
                onClick={() => {
                  const t = weak || lastQ;
                  if (!t) return;
                  closePanel();
                  setBankJump({ level: t.levelName, subject: t.subject, topic: t.topic });
                  go('questionbank');
                }}
              >
                Mini çalışma
              </button>
            ) : null}
            {lastPlan?.length ? (
              <button className="chip zorro-tool is-ok" type="button" onClick={applyPlan}>Göreve aktar</button>
            ) : null}
          </div>
          <form className="zorro-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            {photo ? (
              <span className="chat-badge" style={{ alignSelf: 'center' }}>
                Foto
                <button type="button" className="chip" style={{ marginLeft: 6 }} onClick={() => { URL.revokeObjectURL(photo.preview); setPhoto(null); }}>×</button>
              </span>
            ) : null}
            <label className="chip zorro-tool" style={{ cursor: 'pointer' }}>
              Foto
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  if (photo?.preview) URL.revokeObjectURL(photo.preview);
                  setPhoto({ file: f, preview: URL.createObjectURL(f) });
                }}
              />
            </label>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Mesajını yaz..."
              aria-label="Zorro mesajı"
            />
            <button className="btn primary zorro-send" type="submit" disabled={busy || (!input.trim() && !photo)}>Gönder</button>
          </form>
          {user && !zorroHistoryOnServer() ? (
            <p className="zorro-persist-note">Sunucuda sohbet tablosu yok. Bu oturumdaki sohbetler tarayıcıda durur; sahte geçmiş yok.</p>
          ) : null}
          </>
          )}
        </section>
      )}
    </>
  );
}
