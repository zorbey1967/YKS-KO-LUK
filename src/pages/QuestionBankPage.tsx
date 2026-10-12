import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { flattenBank, loadLevel, loadManifest, pickSeries, topicKey } from '../lib/bank';
import { lastBankTopic, parseBankKey, suggestedBankLevels, takeBankJump, weakBankTopics } from '../lib/practice';
import { applyQuizResult, MISTAKE_REASONS, setMistakeReason } from '../lib/mistakeBook';
import { hash32 } from '../lib/util';
import type { BankManifest, BankQuestion, MistakeReason, TopicProgress } from '../lib/types';

type Mode = 'normal' | 'marked' | 'wrong' | 'quick';
const SERIES = [10, 20, 30, 50] as const;

function emptyMeta(key: string): TopicProgress {
  return { key, answered: 0, correct: 0, wrong: 0, index: 0, completed: false, answeredIds: [], updatedAt: '' };
}

function countPrefix(counts: Record<string, number> | undefined, prefix: string) {
  return Object.entries(counts || {}).filter(([k]) => k.startsWith(prefix)).reduce((n, [, c]) => n + c, 0);
}

export function QuestionBankPage() {
  const { data, setData, toast } = useApp();
  const [manifest, setManifest] = useState<BankManifest | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('normal');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [pack, setPack] = useState<Record<string, BankQuestion[]>>({});
  const [special, setSpecial] = useState<BankQuestion[]>([]);
  const [diff, setDiff] = useState<'Hepsi' | 'Zor' | 'Orta' | 'Kolay'>('Hepsi');
  const [series, setSeries] = useState<number | 'all' | null>(null);
  const [session, setSession] = useState<BankQuestion[] | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const m = await loadManifest();
        setManifest(m);
        const jump = takeBankJump();
        if (jump?.level) {
          const dataPack = await loadLevel(m.levels.find((l) => l.name === jump.level)?.slug || '', jump.level);
          setPack(dataPack);
          setLevel(jump.level);
          setSubject(jump.subject || null);
          setTopic(jump.topic || null);
          setMode(jump.mode === 'wrong' ? 'wrong' : 'normal');
        }
      } catch {
        setError('Soru bankası yüklenemedi');
      }
    })();
  }, []);

  async function openLevel(name: string, next?: { subject?: string | null; topic?: string | null }) {
    const slug = manifest?.levels.find((l) => l.name === name)?.slug || '';
    setPack(await loadLevel(slug, name));
    resetNav({ level: name, subject: next?.subject ?? null, topic: next?.topic ?? null });
  }

  async function ensureAllPack() {
    if (!manifest) return pack;
    const merged: Record<string, BankQuestion[]> = { ...pack };
    await Promise.all(manifest.levels.map(async (l) => {
      Object.assign(merged, await loadLevel(l.slug, l.name));
    }));
    setPack(merged);
    return merged;
  }

  const counts = manifest?.topicCounts;
  const all = useMemo(() => flattenBank(pack), [pack]);
  const q = search.toLocaleLowerCase('tr-TR');
  const levels = (manifest?.levels || []).filter((l) => l.name.toLocaleLowerCase('tr-TR').includes(q));
  const topicHits = useMemo(() => {
    if (q.length < 2 || !manifest) return [] as { level: string; subject: string; topic: string; n: number }[];
    const hits: { level: string; subject: string; topic: string; n: number }[] = [];
    for (const [lv, subs] of Object.entries(manifest.curriculum)) {
      for (const [sub, tops] of Object.entries(subs)) {
        for (const t of tops) {
          const blob = `${lv} ${sub} ${t}`.toLocaleLowerCase('tr-TR');
          if (!blob.includes(q)) continue;
          hits.push({ level: lv, subject: sub, topic: t, n: counts?.[topicKey(lv, sub, t)] || 0 });
          if (hits.length >= 14) return hits;
        }
      }
    }
    return hits;
  }, [q, manifest, counts]);
  const key = level && subject && topic ? topicKey(level, subject, topic) : '';
  const pool = key ? pack[key] || [] : [];
  const filteredPool = diff === 'Hepsi' ? pool : pool.filter((x) => (x.difficulty || 'Orta') === diff);

  const list = useMemo(() => {
    if (mode === 'marked') return all.filter((x) => data.qbMarks.includes(x.id)).filter((x) => diff === 'Hepsi' || (x.difficulty || 'Orta') === diff);
    if (mode === 'wrong') return all.filter((x) => (data.questionStats[x.id]?.wrong || 0) > 0).filter((x) => diff === 'Hepsi' || (x.difficulty || 'Orta') === diff);
    if (mode === 'quick') return special;
    return session || [];
  }, [mode, all, data.qbMarks, data.questionStats, special, session, diff]);

  const current = list[index];
  const selected = answers[index];
  const locked = selected !== undefined;

  function resetNav(next: Partial<{ level: string | null; subject: string | null; topic: string | null; mode: Mode }>) {
    setLevel(next.level !== undefined ? next.level : level);
    setSubject(next.subject !== undefined ? next.subject : subject);
    setTopic(next.topic !== undefined ? next.topic : topic);
    setMode(next.mode || 'normal');
    setIndex(0);
    setAnswers({});
    setSpecial([]);
    setSeries(null);
    setSession(null);
    setDone(false);
  }

  function startSeries(n: number | 'all') {
    const cap = n === 'all' ? filteredPool.length : Math.min(n, filteredPool.length);
    const picked = pickSeries(filteredPool, cap, hash32(`${key}|${diff}|${n}`));
    setSeries(n);
    setSession(picked);
    setIndex(0);
    setAnswers({});
    setDone(false);
  }

  function choose(i: number) {
    if (!current || locked) return;
    const correct = i === current.a;
    setAnswers((a) => ({ ...a, [index]: i }));
    setData((d) => {
      const stats = { ...(d.questionStats[current.id] || { attempts: 0, correct: 0, wrong: 0, lastAnswer: null, lastSeen: null }) };
      stats.attempts += 1;
      stats.lastAnswer = i;
      stats.lastSeen = new Date().toISOString();
      if (correct) stats.correct += 1;
      else stats.wrong += 1;
      const parsed = parseBankKey(current._bankKey || key);
      let next = { ...d, questionStats: { ...d.questionStats, [current.id]: stats } };
      next = applyQuizResult(next, {
        questionId: current.id,
        correct,
        subject: parsed.subject || subject || '',
        topic: parsed.topic || topic || '',
        level: parsed.level || level || '',
      });
      if (mode === 'normal' && key) {
        const m = { ...(d.qb[key] || emptyMeta(key)) };
        if (!m.answeredIds.includes(current.id)) {
          m.answeredIds = [...m.answeredIds, current.id];
          m.answered += 1;
          if (correct) m.correct += 1;
          else m.wrong += 1;
        }
        m.index = Math.min(list.length, index + 1);
        m.updatedAt = new Date().toISOString();
        next.qb = { ...next.qb, [key]: m };
      }
      return next;
    });
  }

  function toggleMark() {
    if (!current) return;
    setData((d) => {
      const has = d.qbMarks.includes(current.id);
      return { ...d, qbMarks: has ? d.qbMarks.filter((id) => id !== current.id) : [...d.qbMarks, current.id] };
    });
    toast(data.qbMarks.includes(current.id) ? 'İşaret kaldırıldı' : 'Soru işaretlendi');
  }

  async function startQuick() {
    const full = await ensureAllPack();
    const poolAll = flattenBank(full);
    const wrong = poolAll.filter((x) => (data.questionStats[x.id]?.wrong || 0) > 0);
    const unseen = poolAll.filter((x) => !data.questionStats[x.id]);
    const rest = poolAll.filter((x) => data.questionStats[x.id] && !(wrong.some((w) => w.id === x.id)));
    const slice = [...wrong, ...unseen, ...rest].slice(0, 20);
    setMode('quick');
    setDiff('Hepsi');
    setSpecial(slice);
    setIndex(0);
    setAnswers({});
    setLevel(null);
    setSubject(null);
    setTopic(null);
    setDone(false);
  }

  function startTopicWrongs() {
    const slice = pool.filter((x) => (data.questionStats[x.id]?.wrong || 0) > 0);
    if (!slice.length) return toast('Bu konuda henüz yanlış yok.');
    setMode('quick');
    setDiff('Hepsi');
    setSpecial(slice);
    setIndex(0);
    setAnswers({});
    setLevel(null);
    setSubject(null);
    setTopic(null);
    setDone(false);
  }

  const sessionStats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    list.forEach((item, i) => {
      const a = answers[i];
      if (a === undefined) blank += 1;
      else if (a === item.a) correct += 1;
      else wrong += 1;
    });
    const answered = correct + wrong;
    return { correct, wrong, blank, answered, pct: answered ? Math.round((correct / answered) * 100) : 0 };
  }, [list, answers]);

  const toolbar = (
    <div className="qb-toolbar">
      <input className="search" placeholder="Ders veya konu ara…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Soru bankasında ara" />
      <button className="btn secondary" type="button" onClick={() => { void ensureAllPack().then(() => { setMode('marked'); setIndex(0); setAnswers({}); setDone(false); }); }}>İşaretliler <span className="chip">{data.qbMarks.length}</span></button>
      <button className="btn secondary" type="button" onClick={() => { void ensureAllPack().then(() => { setMode('wrong'); setIndex(0); setAnswers({}); setDone(false); }); }}>Yanlışlarım</button>
      <button className="btn secondary" type="button" onClick={() => void startQuick()}>Hızlı test</button>
      <select value={diff} onChange={(e) => { setDiff(e.target.value as typeof diff); setIndex(0); setAnswers({}); setSeries(null); setSession(null); setDone(false); }} aria-label="Zorluk">
        <option>Hepsi</option>
        <option>Kolay</option>
        <option>Orta</option>
        <option>Zor</option>
      </select>
    </div>
  );

  if (error) return <div className="notice">{error}</div>;
  if (!manifest) return <div className="empty">Soru bankası yükleniyor…</div>;

  if (mode !== 'normal') {
    if (!list.length) {
      return (
        <>
          {toolbar}
          <div className="card">
            <button className="btn" type="button" onClick={() => resetNav({ level: null, subject: null, topic: null, mode: 'normal' })}>← Soru Bankası</button>
            <div className="empty">{mode === 'marked' ? 'Henüz işaretli soru yok.' : mode === 'wrong' ? 'Henüz yanlış çözdüğün soru yok.' : 'Hızlı test için soru yok.'}</div>
          </div>
        </>
      );
    }
    if (done) {
      return (
        <ResultCard
          stats={sessionStats}
          topic={mode === 'wrong' ? 'Yanlışlarım' : mode === 'marked' ? 'İşaretliler' : 'Hızlı test'}
          difficulty={diff}
          onRetry={() => { setIndex(0); setAnswers({}); setDone(false); }}
          onBack={() => resetNav({ level: null, subject: null, topic: null, mode: 'normal' })}
          onWrongs={mode === 'quick' ? startTopicWrongs : undefined}
        />
      );
    }
    return (
      <>
        {toolbar}
        <QuestionCard
          q={current}
          index={index}
          total={list.length}
          selected={selected}
          locked={locked}
          marked={!!current && data.qbMarks.includes(current.id)}
          onBack={() => resetNav({ level: null, subject: null, topic: null, mode: 'normal' })}
          onChoose={choose}
          onPrev={() => setIndex((i) => Math.max(0, i - 1))}
          onNext={() => {
            if (selected === undefined) return toast('Önce cevabını seç.');
            if (index < list.length - 1) setIndex(index + 1);
            else setDone(true);
          }}
          onMark={toggleMark}
          chip={mode === 'marked' ? 'İşaretliler' : mode === 'wrong' ? 'Yanlışlarım' : 'Hızlı Test'}
          mistakeReason={current ? data.mistakes.find((m) => m.questionId === current.id)?.reason : undefined}
          onReason={(reason) => current && setData((d) => setMistakeReason(d, current.id, reason))}
        />
      </>
    );
  }

  if (!level) {
    const groups = [
      { title: 'YKS', items: levels.filter((l) => l.name.startsWith('YKS')) },
      { title: 'KPSS', items: levels.filter((l) => l.name.startsWith('KPSS')) },
      { title: 'Okul (1–12)', items: levels.filter((l) => /^\d+\. Sınıf/.test(l.name)) },
    ].filter((g) => g.items.length);
    const suggested = suggestedBankLevels(data.grade).filter((name) => (manifest.levels || []).some((l) => l.name === name));
    const recs = weakBankTopics(data, 4);
    const last = lastBankTopic(data);
    return (
      <>
        {toolbar}
        <div className="hero">
          <div className="chip">Seviye → ders → konu</div>
          <h2>Soru Bankası</h2>
          <p>{manifest.questionCount} soru. Sınav veya sınıf → ders → konu. Arama ile doğrudan konuya in.</p>
        </div>
        {topicHits.length ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Arama</h3><span>{topicHits.length} konu</span></div>
            <div className="qb-topic-grid">
              {topicHits.map((h) => (
                <button key={`${h.level}|${h.subject}|${h.topic}`} className="qb-topic" type="button" onClick={() => void openLevel(h.level, { subject: h.subject, topic: h.topic })}>
                  <b>{h.topic}</b>
                  <small>{h.level} • {h.subject} • {h.n} soru</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {suggested.length ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Senin seviyen</h3><span>{data.grade || 'kayıt yok'}</span></div>
            <div className="qb-level-grid">
              {suggested.map((name) => {
                const l = manifest.levels.find((x) => x.name === name);
                if (!l) return null;
                return (
                  <button key={name} className="qb-choice" type="button" onClick={() => void openLevel(name)}>
                    <b>{name}</b>
                    <small>{countPrefix(counts, `${name}|`)} soru</small>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {last || recs.length ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Kaldığın yer</h3></div>
            {last ? (
              <button className="qb-choice" type="button" style={{ width: '100%', marginBottom: 8 }} onClick={() => void openLevel(last.levelName, { subject: last.subject, topic: last.topic })}>
                <b>Devam: {last.topic}</b>
                <small>{last.levelName} • {last.subject} • %{last.acc} doğruluk</small>
              </button>
            ) : null}
            {recs.map((r) => (
              <div className="plan-item" key={r.key}>
                <span>{r.topic}<br /><small style={{ color: 'var(--muted)' }}>{r.subject} • {r.wrong} yanlış</small></span>
                <button className="btn secondary" type="button" onClick={() => void openLevel(r.levelName, { subject: r.subject, topic: r.topic })}>Çöz</button>
              </div>
            ))}
          </div>
        ) : null}
        {groups.map((g) => (
          <div className="card" key={g.title} style={{ marginTop: 16 }}>
            <div className="section-title"><h3>{g.title}</h3><span>{g.items.length} seviye</span></div>
            <div className="qb-level-grid">
              {g.items.map((l) => (
                <button key={l.name} className="qb-choice" type="button" onClick={() => void openLevel(l.name)}>
                  <b>{l.name}</b><small>{l.subjects} ders • {countPrefix(counts, `${l.name}|`)} soru</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }

  const curriculum = manifest.curriculum[level] || {};
  if (!subject) {
    const subjects = Object.keys(curriculum).filter((s) => s.toLocaleLowerCase('tr-TR').includes(q));
    return (
      <>
        {toolbar}
        <div className="actions"><button className="btn" type="button" onClick={() => resetNav({ level: null, subject: null, topic: null })}>← Sınavlar</button><span className="chip">{level}</span></div>
        <div className="card">
          <div className="section-title"><h3>Ders</h3></div>
          <div className="qb-subject-grid">
            {subjects.length ? subjects.map((s) => {
              const n = (curriculum[s] || []).reduce((acc, t) => acc + (counts?.[topicKey(level, s, t)] || 0), 0);
              return (
                <button key={s} className="qb-choice" type="button" onClick={() => { setSubject(s); setTopic(null); setSeries(null); setSession(null); }}>
                  <b>{s}</b>
                  <small>{(curriculum[s] || []).length} konu • {n} soru</small>
                </button>
              );
            }) : <div className="empty">Bu seviyede ders yok.</div>}
          </div>
        </div>
      </>
    );
  }

  if (!topic) {
    const topics = (curriculum[subject] || []).filter((t) => t.toLocaleLowerCase('tr-TR').includes(q));
    return (
      <>
        {toolbar}
        <div className="actions"><button className="btn" type="button" onClick={() => { setSubject(null); setTopic(null); }}>← Dersler</button><span className="chip">{subject}</span></div>
        <div className="card">
          <div className="section-title"><h3>Konu</h3></div>
          <div className="qb-topic-grid">
            {topics.length ? topics.map((t) => {
              const k = topicKey(level, subject, t);
              const n = pack[k]?.length || counts?.[k] || 0;
              return (
                <button key={t} className="qb-topic" type="button" onClick={() => { setTopic(t); setSeries(null); setSession(null); setDone(false); setAnswers({}); setIndex(0); }}>
                  <b>{t}</b>
                  <small>{n} soru</small>
                </button>
              );
            }) : <div className="empty">Bu derste konu yok.</div>}
          </div>
        </div>
      </>
    );
  }

  if (!filteredPool.length) {
    return (
      <div className="card">
        <button className="btn" type="button" onClick={() => setTopic(null)}>← Konular</button>
        <div className="empty">{pool.length ? 'Bu zorlukta soru yok.' : 'Bu konuda henüz soru yok.'}</div>
      </div>
    );
  }

  if (series === null) {
    return (
      <>
        {toolbar}
        <div className="actions"><button className="btn" type="button" onClick={() => setTopic(null)}>← Konular</button><span className="chip">{level} → {subject} → {topic}</span></div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{topic}</h3>
          <p className="muted">Bu konuda {filteredPool.length} soru bulunuyor{diff !== 'Hepsi' ? ` (${diff})` : ''}.</p>
          <div className="actions">
            {SERIES.map((n) => (
              <button key={n} className="btn" type="button" disabled={filteredPool.length < 1} onClick={() => startSeries(n)}>
                {n} soru{filteredPool.length < n ? ` (${filteredPool.length} var)` : ''}
              </button>
            ))}
            <button className="btn primary" type="button" onClick={() => startSeries('all')}>Tümü ({filteredPool.length})</button>
          </div>
        </div>
      </>
    );
  }

  if (done) {
    return (
      <ResultCard
        stats={sessionStats}
        topic={topic}
        difficulty={diff === 'Hepsi' ? 'Karışık' : diff}
        onRetry={() => startSeries(series)}
        onBack={() => { setTopic(null); setSeries(null); setSession(null); setDone(false); }}
        onWrongs={startTopicWrongs}
      />
    );
  }

  return (
    <>
      {toolbar}
      <QuestionCard
        q={current}
        index={index}
        total={list.length}
        selected={selected}
        locked={locked}
        marked={!!current && data.qbMarks.includes(current.id)}
        onBack={() => { setSeries(null); setSession(null); setDone(false); }}
        onChoose={choose}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => {
          if (selected === undefined) return toast('Önce cevabını seç.');
          if (index < list.length - 1) setIndex(index + 1);
          else setDone(true);
        }}
        onMark={toggleMark}
        chip={`${level} • ${subject} • ${topic}${current?.kind ? ` • ${current.kind}` : ''}`}
        mistakeReason={current ? data.mistakes.find((m) => m.questionId === current.id)?.reason : undefined}
        onReason={(reason) => current && setData((d) => setMistakeReason(d, current.id, reason))}
      />
    </>
  );
}

function ResultCard(props: {
  stats: { correct: number; wrong: number; blank: number; pct: number };
  topic: string;
  difficulty: string;
  onRetry: () => void;
  onBack: () => void;
  onWrongs?: () => void;
}) {
  const { stats } = props;
  return (
    <div className="card question-wrap">
      <div className="result-grid">
        <div className="card" style={{ boxShadow: 'none' }}><b>{stats.correct}</b><small>Doğru</small></div>
        <div className="card" style={{ boxShadow: 'none' }}><b>{stats.wrong}</b><small>Yanlış</small></div>
        <div className="card" style={{ boxShadow: 'none' }}><b>{stats.blank}</b><small>Boş</small></div>
        <div className="card" style={{ boxShadow: 'none' }}><b>%{stats.pct}</b><small>Başarı</small></div>
      </div>
      <div style={{ textAlign: 'center', padding: 24 }}>
        <h2>Test bitti</h2>
        <p className="muted">{props.topic} • {props.difficulty} • bu serinin gerçek işaretleri</p>
        <button className="btn primary" type="button" onClick={props.onRetry}>Aynı seriyi baştan</button>
        {' '}
        {props.onWrongs ? <button className="btn" type="button" onClick={props.onWrongs}>Yanlışlarım</button> : null}
        {' '}
        <button className="btn" type="button" onClick={props.onBack}>Geri</button>
      </div>
    </div>
  );
}

function QuestionCard(props: {
  q?: BankQuestion;
  index: number;
  total: number;
  selected: number | undefined;
  locked: boolean;
  marked: boolean;
  chip: string;
  onBack: () => void;
  onChoose: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onMark: () => void;
  mistakeReason?: string;
  onReason?: (reason: MistakeReason | '') => void;
}) {
  const q = props.q;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (!q) return;
      const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
      const i = map[e.key.toLowerCase()];
      if (i !== undefined && i < q.o.length && !props.locked) props.onChoose(i);
      if (e.key === 'ArrowRight' && props.locked) props.onNext();
      if (e.key === 'ArrowLeft') props.onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, props]);
  if (!q) return null;
  return (
    <>
      <div className="actions">
        <button className="btn" type="button" onClick={props.onBack}>Geri</button>
        <span className="chip">{props.chip}</span>
      </div>
      <div className="card question-wrap">
        <div className="section-title">
          <span>{q.difficulty || 'Orta'}{q.kind ? ` • ${q.kind}` : ''}</span>
          <b>Soru {props.index + 1} / {props.total}</b>
          <button className="btn secondary" type="button" aria-pressed={props.marked} onClick={props.onMark}>{props.marked ? 'İşaretli' : 'İşaretle'}</button>
        </div>
        <div className="progress"><i style={{ width: `${Math.round(((props.index + 1) / props.total) * 100)}%` }} /></div>
        <div className="question-text">{q.q}</div>
        <div className="answers">
          {q.o.map((opt, i) => (
            <button
              key={opt + i}
              className={`answer ${props.locked ? (i === q.a ? 'correct' : i === props.selected ? 'wrong' : '') : ''}`}
              disabled={props.locked}
              type="button"
              onClick={() => props.onChoose(i)}
            >
              <span className="letter">{String.fromCharCode(65 + i)}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
        {props.locked ? <div className="explain"><b>Açıklama</b><br />{q.e}</div> : null}
        {props.locked && props.selected !== q.a && props.onReason ? (
          <div className="field" style={{ marginTop: 12 }}>
            <span>Yanlış nedeni (isteğe bağlı)</span>
            <div className="timer-kinds" role="group" aria-label="Yanlış nedeni">
              {MISTAKE_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`chip-btn ${props.mistakeReason === r.id ? 'on' : ''}`}
                  onClick={() => props.onReason?.(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <button className="btn" type="button" disabled={props.index === 0} onClick={props.onPrev}>← Önceki</button>
          {props.locked ? <button className="btn primary" type="button" onClick={props.onNext}>{props.index === props.total - 1 ? 'Sonuç' : 'Sonraki →'}</button> : <span className="chip">A–E</span>}
        </div>
      </div>
    </>
  );
}