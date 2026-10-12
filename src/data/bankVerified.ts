import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

function d(i: number) {
  const r = i % 10;
  return r < 3 ? 'Kolay' : r < 8 ? 'Orta' : 'Zor';
}

function pack(id: string, text: string, correct: string, distractors: string[], explain: string, difficulty: string, kind: string): BankQuestion | null {
  const seen = new Set<string>();
  const opts: string[] = [];
  for (const x of [correct, ...distractors]) {
    const t = String(x).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    opts.push(t);
  }
  while (opts.length < 5) {
    const filler = `seçenek ${opts.length + 1}`;
    if (!seen.has(filler)) {
      seen.add(filler);
      opts.push(filler);
    } else break;
  }
  if (opts.length < 5) return null;
  const five = opts.slice(0, 5) as [string, string, string, string, string];
  const a = five.indexOf(correct);
  if (a < 0) return null;
  return q(id, text, five, a, explain, difficulty, kind);
}

function fill(key: string, items: (BankQuestion | null)[]) {
  return items.filter((x): x is BankQuestion => Boolean(x)).slice(0, 50).map((x) => ({ ...x, _bankKey: key }));
}

function linear(): BankQuestion[] {
  const key = 'YKS TYT|Matematik|Denklemler';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (let a = 2; a <= 9 && out.length < 50; a++) {
    for (let x = -6; x <= 12 && out.length < 50; x++) {
      if (x === 0) continue;
      const b = (i % 11) + 1;
      const c = a * x + b;
      const kind = i % 3 === 0 ? 'islem' : 'problem';
      out.push(pack(
        `vm-lin-${a}-${x}-${b}`,
        `${a}x + ${b} = ${c} denkleminde x kaçtır?`,
        String(x),
        [String(x + 1), String(x - 1), String(c - b), String(a + b)],
        `${a}x = ${c - b} → x = ${x}.`,
        d(i),
        kind,
      ));
      i += 1;
    }
  }
  return fill(key, out);
}

function ineq(): BankQuestion[] {
  const key = 'YKS TYT|Matematik|Eşitsizlikler';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (let a = 2; a <= 8 && out.length < 50; a++) {
    for (let k = 1; k <= 12 && out.length < 50; k++) {
      const bound = k + 1;
      out.push(pack(
        `vm-ineq-${a}-${k}`,
        `${a}x − ${a} < ${a * k} eşitsizliğinin çözümü hangisidir?`,
        `x < ${bound}`,
        [`x > ${bound}`, `x < ${k}`, `x > ${k}`, `x = ${bound}`],
        `${a}x < ${a * k + a} → x < ${bound}.`,
        d(i),
        'islem',
      ));
      i += 1;
    }
  }
  return fill(key, out);
}

function percent(): BankQuestion[] {
  const keys = ['YKS TYT|Matematik|Problemler', 'KPSS Genel Yetenek|Matematik|Yüzde-faiz', 'KPSS Genel Yetenek|Matematik|Sayı problemleri'];
  const items: BankQuestion[] = [];
  let i = 0;
  for (const p of [10, 20, 25, 40, 50]) {
    for (const n of [40, 60, 80, 120, 200, 240, 300, 400, 500, 800]) {
      const part = (p * n) / 100;
      if (!Number.isInteger(part)) continue;
      const row = pack(
        `vm-pct-${p}-${n}`,
        `Bir sayının %${p}’si ${part} ise sayı kaçtır?`,
        String(n),
        [String(n / 2), String(n * 2), String(part * p), String(n + p)],
        `${part} = ${p / 100} · x → x = ${n}.`,
        d(i),
        'problem',
      );
      if (row) items.push(row);
      i += 1;
      if (i >= 50) break;
    }
    if (i >= 50) break;
  }
  const out: Record<string, BankQuestion[]> = {};
  for (const key of keys) out[key] = fill(key, items.map((x, idx) => ({ ...x, id: `${x.id}-${idx}` })));
  return Object.values(out).flat();
}

function numbers(): BankQuestion[] {
  const key = 'YKS TYT|Matematik|Sayılar';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (let n = 2; n <= 51; n++) {
    const abs = Math.abs(-n);
    out.push(pack(
      `vm-abs-${n}`,
      `|−${n}| − |${n - 3} − ${n}| işleminin sonucu kaçtır?`,
      String(abs - 3),
      [String(abs), String(n), '0', String(abs + 3)],
      `|−${n}|=${abs}, |−3|=3 → ${abs - 3}.`,
      d(i),
      'islem',
    ));
    i += 1;
  }
  return fill(key, out);
}

function powers(): BankQuestion[] {
  const keys = ['YKS TYT|Matematik|Üslü ve köklü sayılar', '8. Sınıf|Matematik|Üslü ifadeler'];
  const items: BankQuestion[] = [];
  let i = 0;
  for (let a = 2; a <= 5; a++) {
    for (let m = 1; m <= 6; m++) {
      for (let n = 1; n <= 5; n++) {
        if (items.length >= 50) break;
        const exp = m + n;
        const row = pack(
          `vm-pow-${a}-${m}-${n}`,
          `${a}^${m} · ${a}^${n} işleminin sonucu hangisidir?`,
          `${a}^${exp}`,
          [`${a}^${m * n}`, `${(a * a)}^${exp}`, `${a * m * n}`, String(a ** Math.min(exp, 8))],
          'Taban aynıysa üsler toplanır.',
          d(i),
          'bilgi',
        );
        if (row) items.push(row);
        i += 1;
      }
    }
  }
  const out: BankQuestion[] = [];
  for (const key of keys) out.push(...fill(key, items.map((x, idx) => ({ ...x, id: `${x.id}-${key.slice(0, 3)}-${idx}` }))));
  return out;
}

function fn(): BankQuestion[] {
  const key = 'YKS TYT|Matematik|Fonksiyon';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (let a = 1; a <= 8; a++) {
    for (let b = -5; b <= 6; b++) {
      if (out.length >= 50) break;
      const x = (i % 7) + 2;
      const val = a * x + b;
      out.push(pack(
        `vm-fn-${a}-${b}-${x}`,
        `f(x)=${a}x ${b >= 0 ? '+' : '−'} ${Math.abs(b)} ise f(${x}) kaçtır?`,
        String(val),
        [String(val + a), String(a + b), String(a * x), String(val - b || 1)],
        `${a}·${x} ${b >= 0 ? '+' : '−'} ${Math.abs(b)} = ${val}.`,
        d(i),
        'islem',
      ));
      i += 1;
    }
  }
  return fill(key, out);
}

function aytFn(): BankQuestion[] {
  const key = 'YKS AYT|Matematik|Fonksiyonlar';
  return fill(key, fn().map((x, i) => ({ ...x, id: `ay-${x.id}-${i}` })));
}

function perm(): BankQuestion[] {
  const key = 'YKS TYT|Matematik|Permütasyon ve olasılık';
  const fact = [1, 1, 2, 6, 24, 120, 720];
  const out: (BankQuestion | null)[] = [];
  for (let n = 2; n <= 6; n++) {
    out.push(pack(
      `vm-fact-${n}`,
      `${n} farklı nesnenin sıralanma sayısı kaçtır?`,
      String(fact[n]),
      [String(n * n), String(n * 2), String(fact[n] / 2 || n), String(n + fact[n])],
      `${n}! = ${fact[n]}.`,
      n <= 3 ? 'Kolay' : n <= 5 ? 'Orta' : 'Zor',
      'islem',
    ));
  }
  for (let n = 6; n <= 20; n++) {
    out.push(pack(
      `vm-dice-${n}`,
      `Hilesiz bir zar ${n} kez atılıyor. Tek bir atışta 6 gelme olasılığı nedir?`,
      '1/6',
      ['1/2', `${n}/6`, '1/n', '6/n'],
      'Zarın 6 yüzü vardır; n atış bu tek atış olasılığını değiştirmez.',
      d(n),
      'yorum',
    ));
  }
  out.push(pack(
    'vm-coin-1',
    'Hilesiz bir paranın yazı gelme olasılığı nedir?',
    '1/2',
    ['1/3', '2/3', '1/6', '0'],
    'İki eşit sonuç.',
    'Kolay',
    'bilgi',
  ));
  return fill(key, out);
}

function gcd(): BankQuestion[] {
  const keys = ['YKS TYT|Matematik|Temel kavramlar', 'YKS TYT|Matematik|Bölünebilme', '8. Sınıf|Matematik|Çarpanlar katlar'];
  const pairs: [number, number, number][] = [];
  for (let a = 6; a <= 40; a += 2) {
    for (let b = a + 6; b <= 48; b += 6) {
      const g = gcdNum(a, b);
      if (g > 1) pairs.push([a, b, g]);
    }
  }
  const items = pairs.slice(0, 50).map(([a, b, g], i) => pack(
    `vm-gcd-${a}-${b}`,
    `${a} ve ${b} sayılarının EBOB’u kaçtır?`,
    String(g),
    [String(a), String(b), String(g * 2), String(Math.min(a, b) / 2 || 2)],
    `Ortak bölenlerin en büyüğü ${g}.`,
    d(i),
    'islem',
  ));
  const out: BankQuestion[] = [];
  for (const key of keys) out.push(...fill(key, items.map((x, idx) => x ? { ...x, id: `${x.id}-${idx}` } : null)));
  return out;
}

function gcdNum(a: number, b: number): number {
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return Math.abs(a);
}

function absVal(): BankQuestion[] {
  const key = 'YKS TYT|Matematik|Mutlak değer';
  const out: (BankQuestion | null)[] = [];
  for (let n = 1; n <= 50; n++) {
    out.push(pack(
      `vm-md-${n}`,
      `|${n} − ${n + 4}| + |−${n}| işleminin sonucu kaçtır?`,
      String(4 + n),
      [String(n), String(4), String(2 * n), '0'],
      `4 + ${n} = ${4 + n}.`,
      d(n),
      'islem',
    ));
  }
  return fill(key, out);
}

function limit(): BankQuestion[] {
  const key = 'YKS AYT|Matematik|Limit';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (let k = 1; k <= 25; k++) {
    out.push(pack(
      `vm-lim-${k}`,
      `lim_{x→${k}} (x² − ${k * k}) / (x − ${k}) kaçtır?`,
      String(2 * k),
      ['0', String(k), String(k * k), 'tanımsız'],
      'x²−a² = (x−a)(x+a); sadeleşince x+a → 2a = ' + String(2 * k) + '.',
      d(i),
      'islem',
    ));
    i += 1;
  }
  for (let k = 1; k <= 25; k++) {
    const c = 3 * k * k;
    out.push(pack(
      `vm-lim3-${k}`,
      `lim_{x→${k}} (x³ − ${k ** 3}) / (x − ${k}) kaçtır?`,
      String(c),
      [String(k ** 3), String(2 * k), String(3 * k), '0'],
      'Türev anlamında 3a² = ' + String(c) + '.',
      d(i),
      'osym',
    ));
    i += 1;
  }
  return fill(key, out);
}

function deriv(): BankQuestion[] {
  const key = 'YKS AYT|Matematik|Türev';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (let n = 2; n <= 6; n++) {
    for (let a = 1; a <= 8; a++) {
      const c = (i % 5) + 1;
      const val = a * n * (c ** (n - 1));
      out.push(pack(
        `vm-der-${a}-${n}-${c}`,
        `f(x)=${a}x^${n} ise f′(${c}) kaçtır?`,
        String(val),
        [String(a * (c ** n)), String(n * (c ** n)), String(a * n), String(val + n)],
        `f′(x)=${a * n}x^${n - 1} → f′(${c})=${val}.`,
        d(i),
        'islem',
      ));
      i += 1;
      if (out.length >= 50) break;
    }
  }
  return fill(key, out);
}

function integ(): BankQuestion[] {
  const key = 'YKS AYT|Matematik|İntegral';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 8; b++) {
      const val = a * b * b;
      if (val % 2 !== 0) continue;
      const ans = val / 2;
      out.push(pack(
        `vm-int-${a}-${b}`,
        `∫₀^${b} ${a}x dx kaçtır?`,
        String(ans),
        [String(a * b), String(val), String(a), '0'],
        `[${a / 2 || `${a}/2`} x²]₀^${b} = ${ans}.`,
        d(i),
        'islem',
      ));
      i += 1;
      if (out.length >= 50) break;
    }
  }
  return fill(key, out);
}

function poly(): BankQuestion[] {
  const key = 'YKS AYT|Matematik|Polinomlar';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (let r = -4; r <= 6; r++) {
    for (let s = r + 1; s <= 7; s++) {
      const sum = r + s;
      const prod = r * s;
      out.push(pack(
        `vm-pol-${r}-${s}`,
        `x² − (${sum})x + (${prod}) = 0 denkleminin kökleri toplamı kaçtır?`,
        String(sum),
        [String(prod), String(-sum), String(r), String(s)],
        'Vieta: kökler toplamı katsayı işaretine göre ' + String(sum) + '.',
        d(i),
        'osym',
      ));
      i += 1;
      if (out.length >= 50) break;
    }
  }
  return fill(key, out);
}

function quad(): BankQuestion[] {
  const key = 'YKS AYT|Matematik|İkinci dereceden denklemler';
  return fill(key, poly().map((x, i) => ({ ...x, id: `qd-${x.id}-${i}` })));
}

function loga(): BankQuestion[] {
  const key = 'YKS AYT|Matematik|Logaritma';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (const b of [2, 3, 5, 10]) {
    for (let k = 1; k <= 6; k++) {
      const n = b ** k;
      if (n > 1_000_000) continue;
      out.push(pack(
        `vm-log-${b}-${k}`,
        `log_${b} ${n} değeri kaçtır?`,
        String(k),
        [String(b), String(n), String(k + 1), '0'],
        `${b}^${k} = ${n}.`,
        d(i),
        'bilgi',
      ));
      i += 1;
    }
  }
  while (out.length < 50) {
    const k = (out.length % 5) + 1;
    out.push(pack(
      `vm-logid-${out.length}`,
      `log_a a^${k} (a>0, a≠1) değeri kaçtır?`,
      String(k),
      ['0', '1', 'a', String(k + 1)],
      'log_a a^k = k.',
      d(out.length),
      'bilgi',
    ));
  }
  return fill(key, out);
}

function seq(): BankQuestion[] {
  const key = 'YKS AYT|Matematik|Diziler';
  const out: (BankQuestion | null)[] = [];
  let i = 0;
  for (let a = 1; a <= 8; a++) {
    for (let b = -3; b <= 6; b++) {
      const n = (i % 6) + 3;
      const val = a * n + b;
      out.push(pack(
        `vm-seq-${a}-${b}-${n}`,
        `aₙ = ${a}n ${b >= 0 ? '+' : '−'} ${Math.abs(b)} için a_${n} kaçtır?`,
        String(val),
        [String(a + b), String(a * n), String(n + b), String(val + a)],
        `${a}·${n} ${b >= 0 ? '+' : '−'} ${Math.abs(b)} = ${val}.`,
        d(i),
        'islem',
      ));
      i += 1;
      if (out.length >= 50) break;
    }
  }
  return fill(key, out);
}

function trig(): BankQuestion[] {
  const key = 'YKS AYT|Matematik|Trigonometri';
  const facts: [string, string, string[], string][] = [
    ['sin 30° değeri nedir?', '1/2', ['√3/2', '1', '0', '√2/2'], 'Birim çember / özel açı.'],
    ['cos 60° değeri nedir?', '1/2', ['√3/2', '1', '0', '√2/2'], 'cos 60° = 1/2.'],
    ['tan 45° değeri nedir?', '1', ['0', '√3', '1/√3', 'tanımsız'], 'sin=cos.'],
    ['sin 90° değeri nedir?', '1', ['0', '1/2', '√2/2', '−1'], 'Birim çember tepe noktası.'],
    ['cos 0° değeri nedir?', '1', ['0', '1/2', '−1', '√3/2'], 'Birim çember.'],
    ['sin²x + cos²x değeri nedir?', '1', ['0', '2', 'sin 2x', 'tan x'], 'Temel özdeşlik.'],
    ['sin 0° değeri nedir?', '0', ['1', '1/2', '√2/2', '−1'], 'Özel açı.'],
    ['cos 90° değeri nedir?', '0', ['1', '1/2', '−1', '√3/2'], 'Özel açı.'],
    ['tan 0° değeri nedir?', '0', ['1', 'tanımsız', '√3', '1/2'], 'sin 0 / cos 0.'],
    ['sin 180° değeri nedir?', '0', ['1', '−1', '1/2', '√2/2'], 'Birim çember.'],
    ['cos 180° değeri nedir?', '−1', ['1', '0', '1/2', '√3/2'], 'Birim çember.'],
    ['tan 180° değeri nedir?', '0', ['tanımsız', '1', '−1', '√3'], 'sin 180 / cos 180.'],
    ['sin 45° değeri nedir?', '√2/2', ['1/2', '√3/2', '1', '0'], 'Özel açı.'],
    ['cos 45° değeri nedir?', '√2/2', ['1/2', '√3/2', '1', '0'], 'Özel açı.'],
    ['sin 60° değeri nedir?', '√3/2', ['1/2', '√2/2', '1', '0'], 'Özel açı.'],
    ['cos 30° değeri nedir?', '√3/2', ['1/2', '√2/2', '1', '0'], 'Özel açı.'],
    ['tan 30° değeri nedir?', '1/√3', ['√3', '1', '0', 'tanımsız'], 'sin 30 / cos 30.'],
    ['tan 60° değeri nedir?', '√3', ['1/√3', '1', '0', '1/2'], 'sin 60 / cos 60.'],
    ['1 − sin²x ifadesi hangisine eşittir?', 'cos²x', ['tan²x', 'sin 2x', '1', '0'], 'Özdeşlik.'],
    ['1 − cos²x ifadesi hangisine eşittir?', 'sin²x', ['tan x', '1', '0', 'cos 2x'], 'Özdeşlik.'],
  ];
  const out = facts.map((f, i) => pack(`vm-trig-${i}`, f[0], f[1], f[2], f[3], d(i), i < 8 ? 'bilgi' : 'osym'));
  return fill(key, out);
}

function triangle(): BankQuestion[] {
  const key = 'YKS TYT|Geometri|Üçgenler';
  const out: (BankQuestion | null)[] = [];
  for (let a = 20; a <= 80; a += 4) {
    const b = 180 - 2 * a;
    if (b <= 0 || b === a) continue;
    out.push(pack(
      `vm-tri-${a}`,
      `İkizkenar üçgende taban açıları ${a}° ise tepe açısı kaç derecedir?`,
      String(b),
      [String(a), String(180 - a), '90', String(2 * a)],
      `180 − 2·${a} = ${b}.`,
      d(a),
      'islem',
    ));
  }
  while (out.length < 20) {
    const i = out.length;
    out.push(pack(
      `vm-tri-sum-${i}`,
      'Öklid düzleminde bir üçgenin iç açıları toplamı kaç derecedir?',
      '180',
      ['90', '270', '360', '120'],
      'İç açılar toplamı 180°.',
      'Kolay',
      'bilgi',
    ));
  }
  return fill(key, out);
}

function lgsAlg(): BankQuestion[] {
  const key = '8. Sınıf|Matematik|Cebir';
  return fill(key, linear().map((x, i) => ({ ...x, id: `lgs-${x.id}-${i}` })));
}

function lgsRoot(): BankQuestion[] {
  const key = '8. Sınıf|Matematik|Kareköklü';
  const out: (BankQuestion | null)[] = [];
  const squares = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225];
  squares.forEach((n, i) => {
    const r = Math.sqrt(n);
    out.push(pack(
      `vm-sqrt-${n}`,
      `√${n} değeri kaçtır?`,
      String(r),
      [String(n / 2), String(r + 1), String(r * 2), String(n)],
      `${r}² = ${n}.`,
      d(i),
      'islem',
    ));
  });
  for (let a = 2; a <= 12; a++) {
    out.push(pack(
      `vm-sqrt2-${a}`,
      `√(${a * a * 2}) sadeleştirilmiş hali hangisidir?`,
      `${a}√2`,
      [`${a}√4`, `2√${a}`, String(a * 2), `√${a}`],
      `√(${a * a}·2) = ${a}√2.`,
      d(a),
      'islem',
    ));
  }
  return fill(key, out);
}

function lgsProb(): BankQuestion[] {
  const key = '8. Sınıf|Matematik|Olasılık';
  return fill(key, perm().slice(0, 40).map((x, i) => ({ ...x, id: `8p-${x.id}-${i}` })));
}

function group(list: BankQuestion[]) {
  const out: Record<string, BankQuestion[]> = {};
  for (const item of list) {
    const key = item._bankKey || '';
    if (!key) continue;
    const { _bankKey, ...rest } = item;
    out[key] = [...(out[key] || []), rest];
  }
  return out;
}

export const VERIFIED_BANK: Record<string, BankQuestion[]> = group([
  ...linear(),
  ...ineq(),
  ...percent(),
  ...numbers(),
  ...powers(),
  ...fn(),
  ...aytFn(),
  ...perm(),
  ...gcd(),
  ...absVal(),
  ...limit(),
  ...deriv(),
  ...integ(),
  ...poly(),
  ...quad(),
  ...loga(),
  ...seq(),
  ...trig(),
  ...triangle(),
  ...lgsAlg(),
  ...lgsRoot(),
  ...lgsProb(),
]);
