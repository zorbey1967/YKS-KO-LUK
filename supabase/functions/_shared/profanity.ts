/** Edge lexikon — istemci contentModeration ile hizalı; ham küfür loglanmaz. */

const TR = "ıİIğĞüÜşŞöÖçÇâÂîÎûÛéÉ";
const LAT = "iiiiigguussooccaaiiuuee";

export function normalizeKey(raw: string) {
  let s = String(raw || "").toLowerCase();
  for (let i = 0; i < TR.length; i++) s = s.split(TR[i]!).join(LAT[i]!);
  return s.replace(/[^a-z0-9]/g, "");
}

const EXACT_SEVERE = new Set([
  "amk", "amq", "orospu", "orospucocugu", "orospuevladi", "sikerim", "siktir", "siktigim",
  "aminakoyim", "aminakoyayim", "yarrak", "yarak", "amcik", "pezevenk", "serefsiz",
  "ibne", "gotveren", "fuck", "bitch", "asshole",
]);
const EXACT_MILD = new Set(["aq", "mk", "mq", "oc", "pic", "got", "shit"]);
const LONG_SEVERE = [
  "aminakoy", "orospucocuk", "orospuevlad", "siktigimin", "siktirgit", "gotveren", "yarragi",
];
const SAFE = new Set(["ali", "veli", "ayse", "fatma", "mehmet", "ahmet", "can", "cem", "asik", "klasik", "psikoloji", "nasil", "sikayet"]);

export type Scan = {
  blocked: boolean;
  severe: boolean;
  confidence: number;
  category: string;
  label: string;
};

export function scanProfanity(raw: string): Scan {
  const text = String(raw || "").trim();
  if (text.length < 2) return { blocked: false, severe: false, confidence: 0, category: "none", label: "" };
  const compact = normalizeKey(text);
  if (SAFE.has(compact)) return { blocked: false, severe: false, confidence: 0, category: "none", label: "" };
  if (EXACT_SEVERE.has(compact)) {
    return { blocked: true, severe: true, confidence: 0.97, category: "profanity", label: "ağır küfür" };
  }
  if (EXACT_MILD.has(compact)) {
    return { blocked: true, severe: false, confidence: 0.85, category: "profanity", label: "uygunsuz ifade" };
  }
  for (const tok of text.toLowerCase().split(/[\s,.;:!?'"()_\-]+/).filter(Boolean)) {
    const c = normalizeKey(tok);
    if (SAFE.has(c)) continue;
    if (EXACT_SEVERE.has(c)) {
      return { blocked: true, severe: true, confidence: 0.97, category: "profanity", label: "ağır küfür" };
    }
    if (EXACT_MILD.has(c)) {
      return { blocked: true, severe: false, confidence: 0.85, category: "profanity", label: "uygunsuz ifade" };
    }
  }
  for (const w of LONG_SEVERE) {
    if (w.length >= 5 && compact.includes(w)) {
      return { blocked: true, severe: true, confidence: 0.94, category: "profanity", label: "ağır küfür" };
    }
  }
  return { blocked: false, severe: false, confidence: 0, category: "none", label: "" };
}

export function shouldAutoSuspend(s: Scan) {
  return s.blocked && s.severe && s.confidence >= 0.92;
}
