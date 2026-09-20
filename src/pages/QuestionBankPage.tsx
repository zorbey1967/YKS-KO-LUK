import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { flattenBank, loadLevel, loadManifest, topicKey } from '../lib/bank';
import { lastBankTopic, suggestedBankLevels, takeBankJump, weakBankTopics } from '../lib/practice';
import type { BankManifest, BankQuestion, TopicProgress } from '../lib/types';

type Mode = 'normal' | 'marked' | 'wrong' | 'quick';

function emptyMeta(key: string): TopicProgress {
  return { key, answered: 0, correct: 0, wrong: 0, index: 0, completed: false, answeredIds: [], updatedAt: '' };
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

  useEffect(() => {
    void (async () => {
      try {
        const m = await loadManifest();
        setManifest(m);
        const merged: Record<string, BankQuestion[]> = {};
        await Promise.all(m.levels.map(async (l) => {
          Object.assign(merged, await loadLevel(l.slug, l.name));
        }));
        setPack(merged);
        const jump = takeBankJump();
        if (jump?.level) {
          setLevel(jump.level);
          setSubject(jump.subject || null);
          setTopic(jump.topic || null);
          setMode('normal');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Banka yüklenemedi');
      }
    })();
  }, []);

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
          hits.push({ level: lv, subject: sub, topic: t, n: (pack[topicKey(lv, sub, t)] || []).length });
          if (hits.length >= 14) return hits;
        }
      }
    }
    return hits;
  }, [q, manifest, pack]);
  const key = level && subject && topic ? topicKey(level, subject, topic) : '';
  const normalList = key ? pack[key] || [] : [];

  const list = useMemo(() => {
    const base = mode === 'marked'
      ? all.filter((x) => data.qbMarks.includes(x.id))
      : mode === 'wrong'
        ? all.filter((x) => (data.questionStats[x.id]?.wrong || 0) > 0)
        : mode === 'quick'
          ? special
          : normalList;
    if (diff === 'Hepsi') return base;
    return base.filter((x) => (x.difficulty || 'Orta') === diff);
  }, [mode, all, data.qbMarks, data.questionStats, special, normalList, diff]);

  const meta = data.qb[key] || emptyMeta(key);
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
      const next = { ...d, questionStats: { ...d.questionStats, [current.id]: stats } };
      if (mode === 'normal' && key) {
        const m = { ...(d.qb[key] || emptyMeta(key)) };
        if (!m.answeredIds.includes(current.id)) {
          m.answeredIds = [...m.answeredIds, current.id];
          m.answered += 1;
          if (correct) m.correct += 1;
          else m.wrong += 1;
        }
        m.index = Math.min(list.length, index + 1);
        m.completed = m.index >= list.length && list.length > 0;
        m.updatedAt = new Date().toISOString();
        next.qb = { ...d.qb, [key]: m };
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

  function startQuick() {
    const wrong = all.filter((x) => (data.questionStats[x.id]?.wrong || 0) > 0);
    const unseen = all.filter((x) => !data.questionStats[x.id]);
    const rest = all.filter((x) => data.questionStats[x.id] && !(wrong.some((w) => w.id === x.id)));
    const slice = [...wrong, ...unseen, ...rest].slice(0, 20);
    setMode('quick');
    setDiff('Hepsi');
    setSpecial(slice);
    setIndex(0);
    setAnswers({});
    setLevel(null);
    setSubject(null);
    setTopic(null);
  }

  function startTopicWrongs() {
    const slice = (pack[key] || []).filter((x) => (data.questionStats[x.id]?.wrong || 0) > 0);
    if (!slice.length) return toast('Bu konuda henüz yanlış yok.');
    setMode('quick');
    setDiff('Hepsi');
    setSpecial(slice);
    setIndex(0);
    setAnswers({});
    setLevel(null);
    setSubject(null);
    setTopic(null);
  }

  const toolbar = (
    <div className="qb-toolbar">
      <input className="search" placeholder="🔎 Ders veya konu ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <button className="btn secondary" type="button" onClick={() => { setMode('marked'); setIndex(0); setAnswers({}); }}>🔖 İşaretliler <span className="chip">{data.qbMarks.length}</span></button>
      <button className="btn secondary" type="button" onClick={() => { setMode('wrong'); setIndex(0); setAnswers({}); }}>❌ Yanlışlarım</button>
      <button className="btn secondary" type="button" onClick={startQuick}>⚡ Hızlı Test</button>
      <select value={diff} onChange={(e) => { setDiff(e.target.value as typeof diff); setIndex(0); setAnswers({}); }} aria-label="Zorluk">
        <option>Hepsi</option>
        <option>Zor</option>
        <option>Orta</option>
        <option>Kolay</option>
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
            else toast('Test tamamlandı');
          }}
          onMark={toggleMark}
          chip={mode === 'marked' ? 'İşaretliler' : mode === 'wrong' ? 'Yanlışlarım' : (current?._bankKey ? `Tekrar • ${current._bankKey}` : 'Hızlı Test')}
        />
      </>
    );
  }

  if (!level) {
    const groups = [
      { title: 'İlkokul', items: levels.filter((l) => /^[1-4]\. Sınıf/.test(l.name)) },
      { title: 'Ortaokul', items: levels.filter((l) => /^[5-8]\. Sınıf/.test(l.name)) },
      { title: 'Lise', items: levels.filter((l) => /^(9|10|11|12)\. Sınıf/.test(l.name)) },
      { title: 'YKS', items: levels.filter((l) => l.name.startsWith('YKS')) },
      { title: 'KPSS', items: levels.filter((l) => l.name.startsWith('KPSS')) },
    ].filter((g) => g.items.length);
    const suggested = suggestedBankLevels(data.grade).filter((name) => (manifest.levels || []).some((l) => l.name === name));
    const recs = weakBankTopics(data, 4);
    const last = lastBankTopic(data);
    return (
      <>
        {toolbar}
        <div className="hero">
          <div className="chip">ÖSYM üslubu</div>
          <h2>🧠 Soru Bankası</h2>
          <p>{manifest.questionCount} orijinal soru • {manifest.levels.length} seviye. A–E veya 1–5 ile işaretle; açıklama seçince açılır.</p>
        </div>
        {topicHits.length ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Arama</h3><span>{topicHits.length} konu</span></div>
            <div className="qb-topic-grid">
              {topicHits.map((h) => (
                <button key={`${h.level}|${h.subject}|${h.topic}`} className="qb-topic" type="button" onClick={() => resetNav({ level: h.level, subject: h.subject, topic: h.topic })}>
                  <b>{h.topic}</b>
                  <small>{h.level} • {h.subject} • {h.n} soru</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {suggested.length ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title"><h3>Senin seviyen</h3><span>{data.grade}</span></div>
            <div className="qb-level-grid">
              {suggested.map((name) => {
                const l = manifest.levels.find((x) => x.name === name);
                if (!l) return null;
                return (
                  <button key={name} className="qb-choice" type="button" onClick={() => resetNav({ level: name, subject: null, topic: null })}>
                    <b>{name}</b>
                    <small>{l.topics} konu • önerilen</small>
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
              <button className="qb-choice" type="button" style={{ width: '100%', marginBottom: 8 }} onClick={() => resetNav({ level: last.levelName, subject: last.subject, topic: last.topic })}>
                <b>Devam: {last.topic}</b>
                <small>{last.levelName} • {last.subject} • %{last.acc} doğruluk</small>
              </button>
            ) : null}
            {recs.map((r) => (
              <div className="plan-item" key={r.key}>
                <span>{r.topic}<br /><small style={{ color: 'var(--muted)' }}>{r.subject} • {r.wrong} yanlış</small></span>
                <button className="btn secondary" type="button" onClick={() => resetNav({ level: r.levelName, subject: r.subject, topic: r.topic })}>Çöz</button>
              </div>
            ))}
          </div>
        ) : null}
        {groups.map((g) => (
          <div className="card" key={g.title} style={{ marginTop: 16 }}>
            <div className="section-title"><h3>{g.title}</h3><span>{g.items.length} seviye</span></div>
            <div className="qb-level-grid">
              {g.items.map((l) => (
                <button key={l.name} className="qb-choice" type="button" onClick={() => resetNav({ level: l.name, subject: null, topic: null })}>
                  <b>{l.name}</b><small>{l.subjects} ders • {l.topics} konu • {Object.entries(pack).filter(([k]) => k.startsWith(`${l.name}|`)).reduce((n, [, qs]) => n + qs.length, 0)} soru</small>
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
        <div className="actions"><button className="btn" type="button" onClick={() => resetNav({ level: null, subject: null, topic: null })}>← Seviyeler</button><span className="chip">{level}</span></div>
        <div className="card">
          <div className="section-title"><h3>2️⃣ Dersini seç</h3></div>
          <div className="qb-subject-grid">
            {subjects.map((s) => (
              <button key={s} className="qb-choice" type="button" onClick={() => { setSubject(s); setTopic(null); setIndex(0); setAnswers({}); }}>
                <b>{s}</b>
                <small>{(curriculum[s] || []).length} konu • {(curriculum[s] || []).reduce((n, t) => n + (pack[topicKey(level, s, t)] || []).length, 0)} soru</small>
              </button>
            ))}
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
          <div className="section-title"><h3>3️⃣ Konunu seç</h3></div>
          <div className="qb-topic-grid">
            {topics.map((t) => {
              const k = topicKey(level, subject, t);
              const m = data.qb[k];
              const n = (pack[k] || []).length;
              const hard = (pack[k] || []).filter((x) => x.difficulty === 'Zor').length;
              const p = n ? Math.min(100, Math.round(((m?.answered || 0) / n) * 100)) : 0;
              return (
                <button key={t} className="qb-topic" type="button" onClick={() => { setTopic(t); setIndex(diff === 'Hepsi' ? Math.min(m?.index || 0, Math.max(0, n - 1)) : 0); setAnswers({}); }}>
                  <b>{t}</b>
                  <small>{m?.answered || 0} / {n} • {hard} zor • {m?.correct || 0} doğru</small>
                  <div className="progress" style={{ marginTop: 9 }}><i style={{ width: `${p}%` }} /></div>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  if (!normalList.length) {
    return <div className="card"><button className="btn" type="button" onClick={() => setTopic(null)}>← Konular</button><div className="empty">Bu konuda soru yok.</div></div>;
  }

  if (!list.length) {
    return (
      <div className="card">
        <button className="btn" type="button" onClick={() => setTopic(null)}>← Konular</button>
        <div className="empty">Bu zorlukta soru yok. Üstten “Hepsi” veya başka bir düzey seç.</div>
      </div>
    );
  }

  if (meta.completed || index >= normalList.length) {
    const pct = meta.answered ? Math.round((meta.correct / meta.answered) * 100) : 0;
    return (
      <div className="card question-wrap">
        <div className="result-grid">
          <div className="card" style={{ boxShadow: 'none' }}><b>{meta.correct}</b><small>Doğru</small></div>
          <div className="card" style={{ boxShadow: 'none' }}><b>{meta.wrong}</b><small>Yanlış</small></div>
          <div className="card" style={{ boxShadow: 'none' }}><b>{meta.answered}</b><small>Cevap</small></div>
          <div className="card" style={{ boxShadow: 'none' }}><b>%{pct}</b><small>Başarı</small></div>
        </div>
        <div style={{ textAlign: 'center', padding: 28 }}>
          <h2>🎉 Test tamamlandı</h2>
          <p style={{ color: 'var(--muted)' }}>{topic} • {normalList.length} soru</p>
          <button className="btn primary" type="button" onClick={() => {
            setData((d) => {
              const qb = { ...d.qb };
              const m = d.qb[key];
              const acc = m?.answered ? Math.round((m.correct / m.answered) * 100) : 0;
              const topics = topic
                ? d.topics.map((t) => (t.name === topic && t.subject === subject ? { ...t, level: Math.max(t.level, Math.min(100, acc)) } : t))
                : d.topics;
              delete qb[key];
              return { ...d, qb, topics };
            });
            setIndex(0);
            setAnswers({});
          }}>Baştan çöz</button>
          {' '}
          <button className="btn" type="button" onClick={startTopicWrongs}>Yanlışları tekrarla</button>
          {' '}
          <button className="btn" type="button" onClick={() => setTopic(null)}>Konulara dön</button>
        </div>
      </div>
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
        onBack={() => setTopic(null)}
        onChoose={choose}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => {
          if (selected === undefined) return toast('Önce cevabını seç.');
          if (index < list.length - 1) setIndex(index + 1);
          else {
            setData((d) => ({ ...d, qb: { ...d.qb, [key]: { ...(d.qb[key] || emptyMeta(key)), completed: true, index: list.length, updatedAt: new Date().toISOString() } } }));
            toast('Test tamamlandı');
          }
        }}
        onMark={toggleMark}
        chip={`${level} • ${subject} • ${topic}`}
      />
    </>
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
        <button className="btn" type="button" onClick={props.onBack}>← Geri</button>
        <span className="chip">{props.chip}</span>
      </div>
      <div className="card question-wrap">
        <div className="section-title">
          <span>{q.difficulty || 'Orta'}</span>
          <b>Soru {props.index + 1} / {props.total}</b>
          <button className="btn secondary" type="button" onClick={props.onMark}>{props.marked ? '🔖 İşaretli' : '🔖 İşaretle'}</button>
        </div>
        <div className="progress"><i style={{ width: `${Math.round(((props.index + 1) / props.total) * 100)}%` }} /></div>
        {q._bankKey ? <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>{q._bankKey}</div> : null}
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
        {props.locked ? <div className="explain"><b>💡 Açıklama</b><br />{q.e}</div> : null}
        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <button className="btn" type="button" disabled={props.index === 0} onClick={props.onPrev}>← Önceki</button>
          {props.locked ? <button className="btn primary" type="button" onClick={props.onNext}>{props.index === props.total - 1 ? 'Testi bitir ✓' : 'Sonraki →'}</button> : <span className="chip">A–E veya 1–5</span>}
        </div>
      </div>
    </>
  );
}
