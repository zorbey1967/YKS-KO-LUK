import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'legacy', 'app-v31.html');
if (!fs.existsSync(source)) {
  console.error('legacy/app-v31.html yok. Bu script yalnızca arşivden banka çıkarır.');
  process.exit(1);
}
const html = fs.readFileSync(source, 'utf8');

const start = html.indexOf('const QB={}');
const end = html.indexOf('\nconst CURRICULUM=');
if (start < 0 || end < 0 || end <= start) {
  console.error('QB bloğu bulunamadı:', source);
  process.exit(1);
}

const QB = new Function(`${html.slice(start, end)}\nreturn QB;`)();
const outDir = path.join(root, 'public', 'bank');
fs.mkdirSync(outDir, { recursive: true });

function slug(s) {
  return String(s)
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const byLevel = {};
const curriculum = {};
let total = 0;

for (const [key, list] of Object.entries(QB)) {
  const parts = String(key).split('|');
  const level = parts.shift();
  const subject = parts.shift();
  const topic = parts.join('|');
  if (!level || !subject || !topic || !Array.isArray(list)) continue;
  curriculum[level] ??= {};
  curriculum[level][subject] ??= [];
  if (!curriculum[level][subject].includes(topic)) curriculum[level][subject].push(topic);
  byLevel[level] ??= {};
  byLevel[level][key] = list;
  total += list.length;
}

const manifest = {
  version: 2,
  generatedAt: new Date().toISOString(),
  questionCount: total,
  levels: Object.keys(curriculum).map((level) => ({
    name: level,
    slug: slug(level),
    subjects: Object.keys(curriculum[level]).length,
    topics: Object.values(curriculum[level]).reduce((n, t) => n + t.length, 0),
  })),
  curriculum,
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
for (const [level, data] of Object.entries(byLevel)) {
  fs.writeFileSync(path.join(outDir, `${slug(level)}.json`), JSON.stringify(data));
}

console.log(`Bank extracted: ${total} questions, ${Object.keys(byLevel).length} levels -> public/bank`);
