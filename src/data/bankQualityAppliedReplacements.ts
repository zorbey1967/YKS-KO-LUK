import type { BankQuestion } from '../lib/types';

export type AppliedReplacement = {
  quality_id: string;
  target_filler_id: string;
  topic: string;
  row: BankQuestion;
};

/** Manifest 106 replace_filler. Yeni soru yok. */
export const QUALITY_APPLIED_REPLACEMENTS: AppliedReplacement[] = [
  {
    "quality_id": "qf-n002",
    "target_filler_id": "cv-18e534aa",
    "topic": "1. Sınıf|Matematik|Toplama",
    "row": {
      "id": "qf-n002",
      "q": "8 + 8 işleminin sonucu kaçtır?",
      "o": [
        "14",
        "15",
        "16",
        "17",
        "18"
      ],
      "a": 2,
      "e": "8+8=16.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n004",
    "target_filler_id": "cv-84b3a16d",
    "topic": "1. Sınıf|Matematik|Çıkarma",
    "row": {
      "id": "qf-n004",
      "q": "11 − 4 işleminin sonucu kaçtır?",
      "o": [
        "5",
        "6",
        "7",
        "8",
        "9"
      ],
      "a": 2,
      "e": "11−4=7.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-1-tr-mi",
    "target_filler_id": "cv-2881a41f",
    "topic": "1. Sınıf|Türkçe|Okuma yazma",
    "row": {
      "id": "qf-1-tr-mi",
      "q": "Soru eki hangisinde doğru yazılmıştır?",
      "o": [
        "gittinmi",
        "gittin mi",
        "gittin-mi",
        "mi gittinmi",
        "gittinMi"
      ],
      "a": 1,
      "e": "Soru eki “mi/mı” ayrı yazılır. Kaynak: TDK Yazım Kılavuzu.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n005",
    "target_filler_id": "cv-2781a28c",
    "topic": "1. Sınıf|Türkçe|Okuma yazma",
    "row": {
      "id": "qf-n005",
      "q": "Hangisi büyük harfle başlamalıdır?",
      "o": [
        "kitap masada.",
        "ali geldi.",
        "Ankara bir ildir.",
        "okula gittik.",
        "kalem kırmızı."
      ],
      "a": 2,
      "e": "Özel ad ve cümle başı büyük harf. Kaynak: TDK yazım.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-2-mul-6-4",
    "target_filler_id": "cv-2912b1b8",
    "topic": "2. Sınıf|Matematik|Çarpma girişi",
    "row": {
      "id": "qf-2-mul-6-4",
      "q": "6 × 4 işleminin sonucu kaçtır?",
      "o": [
        "18",
        "20",
        "24",
        "26",
        "28"
      ],
      "a": 2,
      "e": "6+6+6+6=24.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n006",
    "target_filler_id": "cv-2a12b34b",
    "topic": "2. Sınıf|Matematik|Çarpma girişi",
    "row": {
      "id": "qf-n006",
      "q": "5 × 7 işleminin sonucu kaçtır?",
      "o": [
        "30",
        "32",
        "35",
        "36",
        "40"
      ],
      "a": 2,
      "e": "5×7=35.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n007",
    "target_filler_id": "cv-2b12b4de",
    "topic": "2. Sınıf|Matematik|Çarpma girişi",
    "row": {
      "id": "qf-n007",
      "q": "9 × 3 işleminin sonucu kaçtır?",
      "o": [
        "24",
        "27",
        "29",
        "30",
        "36"
      ],
      "a": 1,
      "e": "9×3=27.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n008",
    "target_filler_id": "cv-c54254a1",
    "topic": "2. Sınıf|Matematik|Problemler",
    "row": {
      "id": "qf-n008",
      "q": "Bir kutuda 4 sıra, her sırada 5 kalem vardır. Toplam kaç kalem vardır?",
      "o": [
        "9",
        "16",
        "20",
        "24",
        "25"
      ],
      "a": 2,
      "e": "4×5=20.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n010",
    "target_filler_id": "cv-d57c94fa",
    "topic": "2. Sınıf|Türkçe|Yazım",
    "row": {
      "id": "qf-n010",
      "q": "Bağlaç “de/da” hangisinde doğru yazılmıştır?",
      "o": [
        "Kitapta duruyor. (bağlaç)",
        "O da geldi.",
        "Odada. (bağlaç iddiası)",
        "Evde ki.",
        "Bende ki kalem"
      ],
      "a": 1,
      "e": "Bağlaç “de/da” ayrı ve duruma göre yumuşamaz. TDK.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-3-frac-half",
    "target_filler_id": "cv-ba634ffb",
    "topic": "3. Sınıf|Matematik|Kesir girişi",
    "row": {
      "id": "qf-3-frac-half",
      "q": "1/4 + 3/4 işleminin sonucu kaçtır?",
      "o": [
        "1/4",
        "2/4",
        "1",
        "3/8",
        "4"
      ],
      "a": 2,
      "e": "(1+3)/4=1.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n011",
    "target_filler_id": "cv-b9634e68",
    "topic": "3. Sınıf|Matematik|Kesir girişi",
    "row": {
      "id": "qf-n011",
      "q": "2/5 + 1/5 işleminin sonucu kaçtır?",
      "o": [
        "1/5",
        "2/5",
        "3/5",
        "3/10",
        "1"
      ],
      "a": 2,
      "e": "(2+1)/5=3/5.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n012",
    "target_filler_id": "cv-c061e927",
    "topic": "3. Sınıf|Matematik|Çarpma-bölme",
    "row": {
      "id": "qf-n012",
      "q": "36 ÷ 6 işleminin sonucu kaçtır?",
      "o": [
        "4",
        "5",
        "6",
        "7",
        "8"
      ],
      "a": 2,
      "e": "6×6=36.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n013",
    "target_filler_id": "cv-bf61e794",
    "topic": "3. Sınıf|Matematik|Çarpma-bölme",
    "row": {
      "id": "qf-n013",
      "q": "8 × 6 işleminin sonucu kaçtır?",
      "o": [
        "42",
        "46",
        "48",
        "54",
        "56"
      ],
      "a": 2,
      "e": "8×6=48.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-4-fen-kuvvet",
    "target_filler_id": "cv-672f3090",
    "topic": "4. Sınıf|Fen|Kuvvet",
    "row": {
      "id": "qf-4-fen-kuvvet",
      "q": "Cisimlerin hareketini veya şeklini değiştirebilen etkiye ne denir?",
      "o": [
        "Kütle",
        "Kuvvet",
        "Hacim",
        "Sıcaklık",
        "Renk"
      ],
      "a": 1,
      "e": "Kuvvet bir etkidir. MEB 4. sınıf Fen.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n018",
    "target_filler_id": "cv-682f3223",
    "topic": "4. Sınıf|Fen|Kuvvet",
    "row": {
      "id": "qf-n018",
      "q": "Mıknatısın demir tozlarını çekmesi hangi kuvvet türüne örnektir?",
      "o": [
        "İtme ile temas zorunlu",
        "Temas gerektirmeyen (uzaktan) kuvvet",
        "Yalnızca sürtünme",
        "Isı kuvveti",
        "Ses kuvveti"
      ],
      "a": 1,
      "e": "Manyetik kuvvet temas olmadan etkir. MEB fen.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n019",
    "target_filler_id": "cv-973c6c70",
    "topic": "4. Sınıf|Matematik|Kesirler",
    "row": {
      "id": "qf-n019",
      "q": "1/2 ile 2/4 için hangisi doğrudur?",
      "o": [
        "1/2 büyüktür",
        "2/4 büyüktür",
        "Denktirler",
        "Toplam 1/8",
        "Kesir değildir"
      ],
      "a": 2,
      "e": "2/4 sadeleşince 1/2.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n020",
    "target_filler_id": "cv-983c6e03",
    "topic": "4. Sınıf|Matematik|Kesirler",
    "row": {
      "id": "qf-n020",
      "q": "3/8 + 1/8 işleminin sonucu kaçtır?",
      "o": [
        "2/8",
        "4/8",
        "3/16",
        "4/16",
        "1"
      ],
      "a": 1,
      "e": "(3+1)/8=4/8=1/2.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n021",
    "target_filler_id": "cv-aa8a8555",
    "topic": "4. Sınıf|Matematik|Doğal sayılar",
    "row": {
      "id": "qf-n021",
      "q": "247 sayısında onlar basamağındaki rakam hangisidir?",
      "o": [
        "2",
        "4",
        "7",
        "24",
        "47"
      ],
      "a": 1,
      "e": "Yüzler 2, onlar 4, birler 7.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n024",
    "target_filler_id": "cv-f2880f78",
    "topic": "4. Sınıf|Türkçe|Yazım-noktalama",
    "row": {
      "id": "qf-n024",
      "q": "Soru cümlesinin sonuna hangi noktalama gelir?",
      "o": [
        ".",
        ",",
        "?",
        "!",
        ";"
      ],
      "a": 2,
      "e": "Soru eki veya soru anlamı → soru işareti. TDK.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-5-frac-eq",
    "target_filler_id": "cv-7ba11a5f",
    "topic": "5. Sınıf|Matematik|Kesirler",
    "row": {
      "id": "qf-5-frac-eq",
      "q": "3/6 kesri sadeleştirilince hangisine eşittir?",
      "o": [
        "1/3",
        "1/2",
        "2/3",
        "3/3",
        "6/3"
      ],
      "a": 1,
      "e": "3 ile sadeleşir: 1/2.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n025",
    "target_filler_id": "cv-7aa118cc",
    "topic": "5. Sınıf|Matematik|Kesirler",
    "row": {
      "id": "qf-n025",
      "q": "2/3 − 1/3 işleminin sonucu kaçtır?",
      "o": [
        "1/3",
        "1/6",
        "3/3",
        "1",
        "2/6"
      ],
      "a": 0,
      "e": "(2−1)/3=1/3.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n026",
    "target_filler_id": "cv-7da11d85",
    "topic": "5. Sınıf|Matematik|Kesirler",
    "row": {
      "id": "qf-n026",
      "q": "4/10 kesrinin ondalık gösterimi hangisidir?",
      "o": [
        "0,04",
        "0,4",
        "4,10",
        "40",
        "1,4"
      ],
      "a": 1,
      "e": "4/10=0,4.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n027",
    "target_filler_id": "cv-b367c569",
    "topic": "5. Sınıf|Fen|Kuvvetin ölçülmesi",
    "row": {
      "id": "qf-n027",
      "q": "Kuvvetin uluslararası birimi hangisidir?",
      "o": [
        "Kilogram",
        "Newton",
        "Metre",
        "Joule",
        "Watt"
      ],
      "a": 1,
      "e": "SI’de kuvvet birimi newton (N). MEB fen.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n028",
    "target_filler_id": "cv-b267c3d6",
    "topic": "5. Sınıf|Fen|Kuvvetin ölçülmesi",
    "row": {
      "id": "qf-n028",
      "q": "Dinamometre neyi ölçmek için kullanılır?",
      "o": [
        "Sıcaklık",
        "Kuvvet",
        "Zaman",
        "Hacim",
        "Işık şiddeti"
      ],
      "a": 1,
      "e": "Dinamometre yay uzamasından kuvvet ölçer. MEB.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n032",
    "target_filler_id": "cv-fa9209f0",
    "topic": "5. Sınıf|Türkçe|Yazım",
    "row": {
      "id": "qf-n032",
      "q": "“ki” bağlacı hangisinde ayrı yazılmalıdır?",
      "o": [
        "evdeki",
        "kitaptaki",
        "Bildi ki geldi.",
        "onunki",
        "bendeki"
      ],
      "a": 2,
      "e": "Bağlaç “ki” ayrıdır; ilgi eki bitişik. TDK.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-6-int-neg",
    "target_filler_id": "cv-7224a4f6",
    "topic": "6. Sınıf|Matematik|Tam sayılar",
    "row": {
      "id": "qf-6-int-neg",
      "q": "−5 + 8 işleminin sonucu kaçtır?",
      "o": [
        "−13",
        "−3",
        "3",
        "13",
        "40"
      ],
      "a": 2,
      "e": "−5+8=3.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n033",
    "target_filler_id": "cv-7324a689",
    "topic": "6. Sınıf|Matematik|Tam sayılar",
    "row": {
      "id": "qf-n033",
      "q": "(−2) · (−3) işleminin sonucu kaçtır?",
      "o": [
        "−6",
        "−5",
        "5",
        "6",
        "1"
      ],
      "a": 3,
      "e": "Eksi×eksi=artı; 2·3=6.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n034",
    "target_filler_id": "cv-7024a1d0",
    "topic": "6. Sınıf|Matematik|Tam sayılar",
    "row": {
      "id": "qf-n034",
      "q": "−12 + (−7) işleminin sonucu kaçtır?",
      "o": [
        "−19",
        "−5",
        "5",
        "19",
        "84"
      ],
      "a": 0,
      "e": "Aynı işaretli toplama: −19.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n035",
    "target_filler_id": "cv-7124a363",
    "topic": "6. Sınıf|Matematik|Tam sayılar",
    "row": {
      "id": "qf-n035",
      "q": "|−9| değeri kaçtır?",
      "o": [
        "−9",
        "0",
        "9",
        "18",
        "1"
      ],
      "a": 2,
      "e": "Mutlak değer uzaklığıdır: 9.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n036",
    "target_filler_id": "cv-75846f8",
    "topic": "6. Sınıf|Matematik|Çarpanlar katlar",
    "row": {
      "id": "qf-n036",
      "q": "12 ile 18’in en büyük ortak böleni kaçtır?",
      "o": [
        "2",
        "3",
        "6",
        "12",
        "36"
      ],
      "a": 2,
      "e": "12=2²·3, 18=2·3² → 2·3=6.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-7-work",
    "target_filler_id": "cv-3b2c28ac",
    "topic": "7. Sınıf|Matematik|Oran-orantı",
    "row": {
      "id": "qf-7-work",
      "q": "4 işçi bir işi 12 günde bitirir. Aynı tempoda 6 işçi kaç günde bitirir?",
      "o": [
        "6",
        "8",
        "10",
        "12",
        "18"
      ],
      "a": 1,
      "e": "4·12=48 işçi-gün; 48/6=8.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n040",
    "target_filler_id": "cv-3c2c2a3f",
    "topic": "7. Sınıf|Matematik|Oran-orantı",
    "row": {
      "id": "qf-n040",
      "q": "3 işçinin 12 günde bitirdiği işi 6 işçi aynı tempoda kaç günde biter?",
      "o": [
        "2",
        "4",
        "6",
        "8",
        "12"
      ],
      "a": 2,
      "e": "3·12=36; 36/6=6.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n041",
    "target_filler_id": "cv-a082a851",
    "topic": "7. Sınıf|Matematik|Yüzdeler",
    "row": {
      "id": "qf-n041",
      "q": "40 sayısının %25’i kaçtır?",
      "o": [
        "5",
        "8",
        "10",
        "15",
        "20"
      ],
      "a": 2,
      "e": "40·0,25=10.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n042",
    "target_filler_id": "cv-9f82a6be",
    "topic": "7. Sınıf|Matematik|Yüzdeler",
    "row": {
      "id": "qf-n042",
      "q": "Bir ürünün %20’si 14 ise ürünün tamamı kaçtır?",
      "o": [
        "28",
        "56",
        "70",
        "84",
        "140"
      ],
      "a": 2,
      "e": "0,2x=14 → x=70.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n043",
    "target_filler_id": "cv-febec29c",
    "topic": "7. Sınıf|Matematik|Eşitlik-denklem",
    "row": {
      "id": "qf-n043",
      "q": "2x + 4 = 10 denkleminde x kaçtır?",
      "o": [
        "2",
        "3",
        "4",
        "5",
        "6"
      ],
      "a": 1,
      "e": "2x=6 → x=3.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-8-exp",
    "target_filler_id": "vm-pow-2-2-2-8. -6",
    "topic": "8. Sınıf|Matematik|Üslü ifadeler",
    "row": {
      "id": "qf-8-exp",
      "q": "2³ · 2² işleminin sonucu kaçtır?",
      "o": [
        "16",
        "24",
        "32",
        "64",
        "8"
      ],
      "a": 2,
      "e": "Üsler toplanır: 2⁵=32.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n048",
    "target_filler_id": "vm-pow-3-2-2-8. -36",
    "topic": "8. Sınıf|Matematik|Üslü ifadeler",
    "row": {
      "id": "qf-n048",
      "q": "3⁴ değeri kaçtır?",
      "o": [
        "12",
        "27",
        "64",
        "81",
        "243"
      ],
      "a": 3,
      "e": "3·3·3·3=81.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n050",
    "target_filler_id": "vm-sqrt-4",
    "topic": "8. Sınıf|Matematik|Kareköklü",
    "row": {
      "id": "qf-n050",
      "q": "√81 değeri kaçtır?",
      "o": [
        "3",
        "7",
        "8",
        "9",
        "18"
      ],
      "a": 3,
      "e": "9²=81.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n054",
    "target_filler_id": "cv-6699124",
    "topic": "8. Sınıf|Türkçe|Yazım-noktalama",
    "row": {
      "id": "qf-n054",
      "q": "“İstanbul’a gidecek misiniz” cümlesinin sonuna hangisi gelmelidir?",
      "o": [
        ".",
        ",",
        "?",
        "!",
        ";"
      ],
      "a": 2,
      "e": "Soru eki “mi” → soru işareti. TDK Yazım Kılavuzu.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n055",
    "target_filler_id": "cv-bffe0bb4",
    "topic": "9. Sınıf|Matematik|Üslü İfadeler",
    "row": {
      "id": "qf-n055",
      "q": "2⁻³ değeri hangisine eşittir?",
      "o": [
        "−6",
        "−8",
        "1/8",
        "8",
        "1/6"
      ],
      "a": 2,
      "e": "2⁻³=1/2³=1/8.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n056",
    "target_filler_id": "cv-4ff76023",
    "topic": "9. Sınıf|Matematik|Denklemler",
    "row": {
      "id": "qf-n056",
      "q": "3x − 5 = 10 denkleminde x kaçtır?",
      "o": [
        "3",
        "4",
        "5",
        "6",
        "15"
      ],
      "a": 2,
      "e": "3x=15 → x=5.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n057",
    "target_filler_id": "cv-984685ae",
    "topic": "9. Sınıf|Matematik|Kümeler",
    "row": {
      "id": "qf-n057",
      "q": "P⊂Q ve y∈P ise hangisi kesinlikle doğrudur?",
      "o": [
        "y∉Q",
        "y∈Q",
        "P=Q",
        "Q⊂P",
        "P∩Q=∅"
      ],
      "a": 1,
      "e": "Alt kümenin her elemanı üst kümededir.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-10-fn",
    "target_filler_id": "cv-d4d8a88b",
    "topic": "10. Sınıf|Matematik|Fonksiyonlar",
    "row": {
      "id": "qf-10-fn",
      "q": "f(x)=2x−3 ve f(a)=7 ise a kaçtır?",
      "o": [
        "3",
        "4",
        "5",
        "7",
        "10"
      ],
      "a": 2,
      "e": "2a−3=7 → a=5.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n059",
    "target_filler_id": "cv-d3d8a6f8",
    "topic": "10. Sınıf|Matematik|Fonksiyonlar",
    "row": {
      "id": "qf-n059",
      "q": "f(x)=3x−1 ve f(a)=8 ise a kaçtır?",
      "o": [
        "2",
        "3",
        "4",
        "8",
        "9"
      ],
      "a": 1,
      "e": "3a−1=8 → 3a=9 → a=3.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n060",
    "target_filler_id": "cv-356a5835",
    "topic": "10. Sınıf|Matematik|Polinomlar",
    "row": {
      "id": "qf-n060",
      "q": "(x+2)(x+3) çarpımında sabit terim kaçtır?",
      "o": [
        "5",
        "6",
        "x²",
        "2x",
        "3x"
      ],
      "a": 1,
      "e": "2·3=6.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-tyt-gcd",
    "target_filler_id": "vm-gcd-6-12-0",
    "topic": "YKS TYT|Matematik|Temel kavramlar",
    "row": {
      "id": "qf-tyt-gcd",
      "q": "20 ile 30’un en büyük ortak böleni kaçtır?",
      "o": [
        "2",
        "5",
        "10",
        "20",
        "60"
      ],
      "a": 2,
      "e": "20=2²·5, 30=2·3·5 → EBOB=10.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n061",
    "target_filler_id": "vm-gcd-6-18-1",
    "topic": "YKS TYT|Matematik|Temel kavramlar",
    "row": {
      "id": "qf-n061",
      "q": "12 ve 18 sayılarının EKOK’u kaçtır?",
      "o": [
        "6",
        "18",
        "36",
        "54",
        "216"
      ],
      "a": 2,
      "e": "2²·3²=36.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n062",
    "target_filler_id": "vm-gcd-6-24-2",
    "topic": "YKS TYT|Matematik|Temel kavramlar",
    "row": {
      "id": "qf-n062",
      "q": "15 ve 25 sayılarının EBOB’u kaçtır?",
      "o": [
        "1",
        "5",
        "15",
        "25",
        "75"
      ],
      "a": 1,
      "e": "5.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-tyt-lin",
    "target_filler_id": "vm-lin-2--1-6",
    "topic": "YKS TYT|Matematik|Denklemler",
    "row": {
      "id": "qf-tyt-lin",
      "q": "2x + 6 = 14 denkleminde x kaçtır?",
      "o": [
        "2",
        "3",
        "4",
        "5",
        "8"
      ],
      "a": 2,
      "e": "x=4.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n063",
    "target_filler_id": "vm-lin-2-1-7",
    "topic": "YKS TYT|Matematik|Denklemler",
    "row": {
      "id": "qf-n063",
      "q": "5x − 3 = 2x + 9 denkleminde x kaçtır?",
      "o": [
        "2",
        "3",
        "4",
        "6",
        "12"
      ],
      "a": 2,
      "e": "3x=12 → x=4.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-tyt-sqrt",
    "target_filler_id": "vm-pow-2-2-2-YKS-6",
    "topic": "YKS TYT|Matematik|Üslü ve köklü sayılar",
    "row": {
      "id": "qf-tyt-sqrt",
      "q": "√45 ifadesinin sadeleştirilmiş hali hangisidir?",
      "o": [
        "3√5",
        "5√3",
        "9√5",
        "15",
        "√9"
      ],
      "a": 0,
      "e": "√(9·5)=3√5.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n064",
    "target_filler_id": "vm-pow-3-2-2-YKS-36",
    "topic": "YKS TYT|Matematik|Üslü ve köklü sayılar",
    "row": {
      "id": "qf-n064",
      "q": "√50 sadeleştirilmiş hali hangisidir?",
      "o": [
        "5√2",
        "2√5",
        "25√2",
        "10√5",
        "√100"
      ],
      "a": 0,
      "e": "√(25·2)=5√2.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n065",
    "target_filler_id": "vm-pct-10-40-0",
    "topic": "YKS TYT|Matematik|Problemler",
    "row": {
      "id": "qf-n065",
      "q": "Bir sayının %20’si 8 ise sayı kaçtır?",
      "o": [
        "16",
        "32",
        "40",
        "48",
        "80"
      ],
      "a": 2,
      "e": "0,2x=8 → x=40.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n066",
    "target_filler_id": "cv-91d63fa",
    "topic": "YKS TYT|Matematik|Kümeler",
    "row": {
      "id": "qf-n066",
      "q": "A={1,2,3} ve B={3,4} ise A∩B hangisidir?",
      "o": [
        "{1,2}",
        "{3}",
        "{4}",
        "{1,2,3,4}",
        "∅"
      ],
      "a": 1,
      "e": "Ortak eleman 3.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-kpss-pct",
    "target_filler_id": "vm-pct-10-60-1",
    "topic": "KPSS Genel Yetenek|Matematik|Yüzde-faiz",
    "row": {
      "id": "qf-kpss-pct",
      "q": "80 sayısının %20’si kaçtır?",
      "o": [
        "8",
        "12",
        "16",
        "20",
        "40"
      ],
      "a": 2,
      "e": "80·0,2=16.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n067",
    "target_filler_id": "vm-pct-10-80-2",
    "topic": "KPSS Genel Yetenek|Matematik|Yüzde-faiz",
    "row": {
      "id": "qf-n067",
      "q": "200 sayısının %15’i kaçtır?",
      "o": [
        "15",
        "20",
        "25",
        "30",
        "40"
      ],
      "a": 3,
      "e": "200·0,15=30.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-kpss-num",
    "target_filler_id": "vm-pct-10-120-3",
    "topic": "KPSS Genel Yetenek|Matematik|Sayı problemleri",
    "row": {
      "id": "qf-kpss-num",
      "q": "Bir sayının 3 katının 5 eksiği 16 ise sayı kaçtır?",
      "o": [
        "5",
        "7",
        "9",
        "11",
        "21"
      ],
      "a": 1,
      "e": "3x−5=16 → x=7.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n068",
    "target_filler_id": "vm-pct-10-200-4",
    "topic": "KPSS Genel Yetenek|Matematik|Sayı problemleri",
    "row": {
      "id": "qf-n068",
      "q": "Bir sayının 4 katının 2 fazlası 30 ise sayı kaçtır?",
      "o": [
        "6",
        "7",
        "8",
        "9",
        "28"
      ],
      "a": 1,
      "e": "4x+2=30 → 4x=28 → x=7.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n069",
    "target_filler_id": "cv-7bcde8b3",
    "topic": "KPSS Genel Yetenek|Matematik|Oran-orantı",
    "row": {
      "id": "qf-n069",
      "q": "2/5 = x/20 eşitliğinde x kaçtır?",
      "o": [
        "4",
        "8",
        "10",
        "12",
        "40"
      ],
      "a": 1,
      "e": "5x=40 → x=8.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n071",
    "target_filler_id": "cv-59be1684",
    "topic": "KPSS Genel Yetenek|Türkçe|Yazım-noktalama",
    "row": {
      "id": "qf-n071",
      "q": "“mi” soru eki hangisinde yanlıştır?",
      "o": [
        "Geldin mi?",
        "Bu mu?",
        "O muymuş?",
        "Nasılsınmı?",
        "Öyle mi?"
      ],
      "a": 3,
      "e": "Soru eki ayrı yazılır. TDK.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n072",
    "target_filler_id": "cv-715cd763",
    "topic": "YKS TYT|Türkçe|Yazım ve noktalama",
    "row": {
      "id": "qf-n072",
      "q": "Bağlaç “de/da” hangisinde yanlış yazılmıştır?",
      "o": [
        "O da geldi.",
        "Sen de gördün.",
        "Kitapta not var.",
        "Okulda toplantı var.",
        "Sende gel yarın."
      ],
      "a": 4,
      "e": "Bağlaç ayrı yazılır: “Sen de gel”. TDK.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n075",
    "target_filler_id": "vm-gcd-6-30-3",
    "topic": "YKS TYT|Matematik|Bölünebilme",
    "row": {
      "id": "qf-n075",
      "q": "Bir sayı 2 ve 9 ile bölünüyorsa 18 ile de bölünür çünkü 2 ile 9 aralarında asaldır. Bu yargı için hangisi doğrudur?",
      "o": [
        "Yanlıştır",
        "Doğrudur",
        "Yalnızca teklerde",
        "Yalnızca negatifte",
        "Hiçbir zaman"
      ],
      "a": 1,
      "e": "Aralarında asal bölenlerin çarpımı.",
      "difficulty": "Zor",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n076",
    "target_filler_id": "8p-vm-fact-2-0",
    "topic": "8. Sınıf|Matematik|Olasılık",
    "row": {
      "id": "qf-n076",
      "q": "Hilesiz bir zarın 2 gelme olasılığı nedir?",
      "o": [
        "1/2",
        "1/3",
        "1/6",
        "1/12",
        "2/3"
      ],
      "a": 2,
      "e": "6 yüzden biri.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n077",
    "target_filler_id": "8p-vm-fact-3-1",
    "topic": "8. Sınıf|Matematik|Olasılık",
    "row": {
      "id": "qf-n077",
      "q": "3 farklı kitabın sıralanma sayısı kaçtır?",
      "o": [
        "3",
        "6",
        "9",
        "12",
        "27"
      ],
      "a": 1,
      "e": "3!=6.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n078",
    "target_filler_id": "cv-6dbd357d",
    "topic": "4. Sınıf|Matematik|Geometri",
    "row": {
      "id": "qf-n078",
      "q": "Karenin bir iç açısı kaç derecedir?",
      "o": [
        "60",
        "90",
        "120",
        "180",
        "45"
      ],
      "a": 1,
      "e": "360/4=90.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n079",
    "target_filler_id": "cv-6cbd33ea",
    "topic": "4. Sınıf|Matematik|Geometri",
    "row": {
      "id": "qf-n079",
      "q": "Bir üçgende iki iç açı 40° ve 70° ise üçüncü açı kaç derecedir?",
      "o": [
        "50",
        "70",
        "90",
        "110",
        "180"
      ],
      "a": 1,
      "e": "180−40−70=70.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n080",
    "target_filler_id": "cv-f362051f",
    "topic": "7. Sınıf|Matematik|Doğrular ve açılar",
    "row": {
      "id": "qf-n080",
      "q": "Bir doğru üzerinde komşu açılar toplamı kaç derecedir?",
      "o": [
        "90",
        "120",
        "180",
        "270",
        "360"
      ],
      "a": 2,
      "e": "Yan yana bütünler: 180°.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n083",
    "target_filler_id": "cv-8045fa6e",
    "topic": "5. Sınıf|Fen|Işık",
    "row": {
      "id": "qf-n083",
      "q": "Işığın saydam olmayan bir cismin arkasında karanlık bölge oluşturması hangisidir?",
      "o": [
        "Yansıma",
        "Gölge oluşumu",
        "Kırılma zorunlu",
        "Tayf",
        "Soğurma yok"
      ],
      "a": 1,
      "e": "Işık doğrusal yayılır → gölge. MEB 5. sınıf.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n086",
    "target_filler_id": "cv-b6638eca",
    "topic": "2. Sınıf|Matematik|Saat",
    "row": {
      "id": "qf-n086",
      "q": "Saat 3:00 iken akrep hangi sayıyı gösterir?",
      "o": [
        "12",
        "3",
        "6",
        "9",
        "1"
      ],
      "a": 1,
      "e": "Tam 3’te akrep 3’tedir.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n087",
    "target_filler_id": "cv-252effed",
    "topic": "KPSS Genel Yetenek|Matematik|Temel kavramlar",
    "row": {
      "id": "qf-n087",
      "q": "7 ile 9’un çarpımı kaçtır?",
      "o": [
        "54",
        "56",
        "63",
        "72",
        "79"
      ],
      "a": 2,
      "e": "7×9=63.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n088",
    "target_filler_id": "cv-7b486f1a",
    "topic": "KPSS Genel Yetenek|Matematik|İşlem",
    "row": {
      "id": "qf-n088",
      "q": "20 − 4 × 3 işleminin sonucu kaçtır? (işlem önceliği)",
      "o": [
        "48",
        "8",
        "16",
        "12",
        "60"
      ],
      "a": 1,
      "e": "Önce çarpma: 20−12=8.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n089",
    "target_filler_id": "vm-md-2",
    "topic": "YKS TYT|Matematik|Mutlak değer",
    "row": {
      "id": "qf-n089",
      "q": "|3 − 10| değeri kaçtır?",
      "o": [
        "−7",
        "7",
        "13",
        "30",
        "0"
      ],
      "a": 1,
      "e": "|−7|=7.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n090",
    "target_filler_id": "cv-c027bd91",
    "topic": "9. Sınıf|Matematik|Köklü İfadeler",
    "row": {
      "id": "qf-n090",
      "q": "√16 + √9 işleminin sonucu kaçtır?",
      "o": [
        "5",
        "7",
        "12",
        "25",
        "√25"
      ],
      "a": 1,
      "e": "4+3=7.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n091",
    "target_filler_id": "cv-fca9ab0f",
    "topic": "6. Sınıf|Matematik|Ondalık",
    "row": {
      "id": "qf-n091",
      "q": "0,3 + 0,4 işleminin sonucu kaçtır?",
      "o": [
        "0,07",
        "0,12",
        "0,7",
        "7",
        "0,34"
      ],
      "a": 2,
      "e": "0,3+0,4=0,7.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n092",
    "target_filler_id": "cv-cebf020c",
    "topic": "7. Sınıf|Matematik|Rasyonel sayılar",
    "row": {
      "id": "qf-n092",
      "q": "−1/2 + 3/2 işleminin sonucu kaçtır?",
      "o": [
        "1",
        "2",
        "−2",
        "1/2",
        "−1"
      ],
      "a": 0,
      "e": "(−1+3)/2=1.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n093",
    "target_filler_id": "vm-gcd-6-36-4",
    "topic": "8. Sınıf|Matematik|Çarpanlar katlar",
    "row": {
      "id": "qf-n093",
      "q": "24 sayısının pozitif tam sayı bölenlerinden biri olmayan hangisidir?",
      "o": [
        "1",
        "8",
        "12",
        "18",
        "24"
      ],
      "a": 3,
      "e": "24=2³·3; 18=2·3² 24’ü bölmez.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qf-n094",
    "target_filler_id": "cv-a09757a2",
    "topic": "5. Sınıf|Matematik|İşlemler",
    "row": {
      "id": "qf-n094",
      "q": "100 − 25 × 2 işleminin sonucu kaçtır?",
      "o": [
        "150",
        "50",
        "75",
        "125",
        "200"
      ],
      "a": 1,
      "e": "Önce 25×2=50; 100−50=50.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qfp-tyt-fn-05",
    "target_filler_id": "vm-fn-1-0-7",
    "topic": "YKS TYT|Matematik|Fonksiyon",
    "row": {
      "id": "qfp-tyt-fn-05",
      "q": "Aşağıdaki bağıntılardan hangisi bir fonksiyon değildir?",
      "o": [
        "{(1,2),(2,2),(3,4)}",
        "{(1,5),(2,6)}",
        "{(1,2),(1,3)}",
        "{(0,0)}",
        "{(4,1),(5,1)}"
      ],
      "a": 2,
      "e": "Aynı girdi 1 iki farklı çıktıya gidiyor.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qfp-ayt-fn-05",
    "target_filler_id": "ay-vm-fn-1--1-6-4",
    "topic": "YKS AYT|Matematik|Fonksiyonlar",
    "row": {
      "id": "qfp-ayt-fn-05",
      "q": "(f ∘ g)⁻¹ hangisine eşittir? (tersler varsa)",
      "o": [
        "f⁻¹ ∘ g⁻¹",
        "g⁻¹ ∘ f⁻¹",
        "f ∘ g",
        "(f⁻¹ ∘ g)⁻¹ değil zorunlu",
        "g ∘ f"
      ],
      "a": 1,
      "e": "Bileşke tersi, terslerin ters sırada bileşkesidir.",
      "difficulty": "Zor",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qfp-ayt-fn-06",
    "target_filler_id": "ay-vm-fn-1-0-7-5",
    "topic": "YKS AYT|Matematik|Fonksiyonlar",
    "row": {
      "id": "qfp-ayt-fn-06",
      "q": "f(x)=x³ + x için hangisi doğrudur?",
      "o": [
        "Çift fonksiyondur",
        "Sabittir",
        "Birebirdir (tek ve artan)",
        "Örten değildir ℝ→ℝ iddiası zorunlu",
        "Periyodiktir"
      ],
      "a": 2,
      "e": "f′(x)=3x²+1>0; f(−x)=−f(x). Sıkı artan ⇒ birebir.",
      "difficulty": "Zor",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qfp-s1-ol-02",
    "target_filler_id": "cv-9a2534a8",
    "topic": "1. Sınıf|Matematik|Ölçme",
    "row": {
      "id": "qfp-s1-ol-02",
      "q": "Bir ip 3 karış, diğeri 5 karıştır. Hangisi daha uzundur?",
      "o": [
        "3 karış olan",
        "5 karış olan",
        "Eşit uzunlukta",
        "Ölçülemez",
        "Daha kısa olan 5 karış"
      ],
      "a": 1,
      "e": "Aynı birimde 5>3.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-sy-07",
    "target_filler_id": "vm-abs-15",
    "topic": "YKS TYT|Matematik|Sayılar",
    "row": {
      "id": "qpn-tyt-sy-07",
      "q": "Kenarı 8 cm olan kare karolar ile kenarı 12 cm olan kare karolar kullanılarak, boşluk kalmadan kaplanacak en küçük kare zeminin kenarı kaç cm olmalıdır?",
      "o": [
        "8",
        "12",
        "24",
        "48",
        "96"
      ],
      "a": 2,
      "e": "Kenar, 8 ve 12’nin ortak katı olmalıdır. EKOK(8,12)=24. 24=3·8=2·12. EBOB=4 bu kökte istenmez.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-sy-08",
    "target_filler_id": "vm-abs-16",
    "topic": "YKS TYT|Matematik|Sayılar",
    "row": {
      "id": "qpn-tyt-sy-08",
      "q": "3⁸ / 3⁵ işleminin sonucu kaçtır?",
      "o": [
        "3",
        "9",
        "27",
        "3¹³",
        "243"
      ],
      "a": 2,
      "e": "aᵐ/aⁿ=aᵐ⁻ⁿ → 3³=27. (−2)³ veya 2³·2² kopyası değil.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-s1-sy-ob",
    "target_filler_id": "cv-ef0f4bda",
    "topic": "1. Sınıf|Matematik|Sayılar 1-20",
    "row": {
      "id": "qpn-s1-sy-ob",
      "q": "Bir grup nesne 1 onluk ve 6 birlik olarak gösteriliyor. Bu nesnelerin sayısı kaçtır?",
      "o": [
        "7",
        "16",
        "61",
        "106",
        "6"
      ],
      "a": 1,
      "e": "M.1.1.1.7: 10+6=16 (10–20 arası). 12’den sonra 13 sıra sorusu değil.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-s1-ad-cm",
    "target_filler_id": "cv-16e53184",
    "topic": "1. Sınıf|Matematik|Toplama",
    "row": {
      "id": "qpn-s1-ad-cm",
      "q": "6 + 9 ile 9 + 6 işlemleri için hangisi doğrudur?",
      "o": [
        "6+9 daha büyüktür",
        "9+6 daha büyüktür",
        "Toplamları eşittir",
        "Toplamları 0’dır",
        "İşlem yapılamaz"
      ],
      "a": 2,
      "e": "M.1.1.2.3: toplananların yeri değişince toplam değişmez (özellik adı verilmez). 7+5 kopyası değil.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-s1-ad-ms",
    "target_filler_id": "cv-17e53317",
    "topic": "1. Sınıf|Matematik|Toplama",
    "row": {
      "id": "qpn-s1-ad-ms",
      "q": "Ece’nin 9 şekeri vardı. Ablası birkaç şeker verdi. Şimdi 15 şekeri var. Ablası kaç şeker vermiştir?",
      "o": [
        "5",
        "6",
        "9",
        "15",
        "24"
      ],
      "a": 1,
      "e": "M.1.1.2.4: 9+□=15 → 6. Üzerine ekleme; çıkarma cümlesi kurulmaz. 7+5 / 14−6 değil.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qfp-s1-sb-01",
    "target_filler_id": "cv-83b39fda",
    "topic": "1. Sınıf|Matematik|Çıkarma",
    "row": {
      "id": "qfp-s1-sb-01",
      "q": "Ayşe’nin 10 elması vardı, 4’ünü yedi. Kaç elması kaldı?",
      "o": [
        "5",
        "6",
        "7",
        "14",
        "4"
      ],
      "a": 1,
      "e": "10−4=6. Hikâye kökü; 14−6 kopyası değil.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-sy-01",
    "target_filler_id": "vm-abs-2",
    "topic": "YKS TYT|Matematik|Sayılar",
    "row": {
      "id": "qpn-tyt-sy-01",
      "q": "√12 + √27 ifadesinin sadeleştirilmiş değeri hangisidir?",
      "o": [
        "√39",
        "5√3",
        "6√3",
        "5√12",
        "9√3"
      ],
      "a": 1,
      "e": "√12=2√3, √27=3√3 → 5√3. ty-sy-1 (hangisi irrasyonel) ve √50/√45 sadeleştirme kopyası değil.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-s1-sy-r5",
    "target_filler_id": "cv-ec0f4721",
    "topic": "1. Sınıf|Matematik|Sayılar 1-20",
    "row": {
      "id": "qpn-s1-sy-r5",
      "q": "Beşer ritmik saymada 5, 10, 15, ___ dizisinde boşluğa hangisi gelir?",
      "o": [
        "16",
        "18",
        "19",
        "20",
        "14"
      ],
      "a": 3,
      "e": "5’er: 15’ten sonra 20. Tüm şıklar 1–20. 16/18/19 birer veya üçer sapma; 14 geri sayma.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-fn-01",
    "target_filler_id": "vm-fn-1--5-2",
    "topic": "YKS TYT|Matematik|Fonksiyon",
    "row": {
      "id": "qpn-tyt-fn-01",
      "q": "f değer tablosu: x=0 iken f(x)=1; x=4 iken f(x)=−5. f(4) − f(0) kaçtır?",
      "o": [
        "−8",
        "−6",
        "−4",
        "2",
        "6"
      ],
      "a": 1,
      "e": "Tabloda f(4)=−5 ve f(0)=1. −5 − 1 = −6. Çizim dosyası yok.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-sy-02",
    "target_filler_id": "vm-abs-3",
    "topic": "YKS TYT|Matematik|Sayılar",
    "row": {
      "id": "qpn-tyt-sy-02",
      "q": "√8 · √18 çarpımının değeri kaçtır?",
      "o": [
        "√26",
        "8",
        "12",
        "26",
        "4√2"
      ],
      "a": 2,
      "e": "√8·√18=√144=12. Çarpanlar irrasyonel, sonuç rasyonel.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-sy-03",
    "target_filler_id": "vm-abs-4",
    "topic": "YKS TYT|Matematik|Sayılar",
    "row": {
      "id": "qpn-tyt-sy-03",
      "q": "3,6 × 10⁻⁴ sayısı hangisine eşittir?",
      "o": [
        "0,36",
        "0,036",
        "0,0036",
        "0,00036",
        "36"
      ],
      "a": 3,
      "e": "10⁻⁴ = 0,0001; 3,6×0,0001=0,00036.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qfp-tyt-sy-04",
    "target_filler_id": "vm-abs-5",
    "topic": "YKS TYT|Matematik|Sayılar",
    "row": {
      "id": "qfp-tyt-sy-04",
      "q": "47’nin 5 ile bölümünden kalan kaçtır?",
      "o": [
        "0",
        "1",
        "2",
        "4",
        "7"
      ],
      "a": 2,
      "e": "5×9=45; 47−45=2.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-sy-05",
    "target_filler_id": "vm-abs-6",
    "topic": "YKS TYT|Matematik|Sayılar",
    "row": {
      "id": "qpn-tyt-sy-05",
      "q": "120 liralık bir ürün %15 indirimle satılıyor. Satış fiyatı kaç liradır?",
      "o": [
        "15",
        "18",
        "102",
        "105",
        "135"
      ],
      "a": 2,
      "e": "%15’i 18 liradır; 120−18=102. Yüzde + indirim, çıplak “n’nin %k’si” şablonu değil.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-sy-06",
    "target_filler_id": "vm-abs-7",
    "topic": "YKS TYT|Matematik|Sayılar",
    "row": {
      "id": "qpn-tyt-sy-06",
      "q": "24 cm ve 36 cm uzunluğundaki iki şerit, eşit uzunlukta en büyük parçalara ayrılacaktır. Parça uzunluğu en fazla kaç cm olabilir?",
      "o": [
        "4",
        "6",
        "8",
        "12",
        "72"
      ],
      "a": 3,
      "e": "EBOB(24,36)=12. 12 ve 18 / 20 ve 30 EBOB köklerinin sayı değiştirmesi değil; şerit bağlamı.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-fn-02",
    "target_filler_id": "vm-fn-1--4-3",
    "topic": "YKS TYT|Matematik|Fonksiyon",
    "row": {
      "id": "qpn-tyt-fn-02",
      "q": "f(x)=(x − 1)/(x² − 4) gerçek sayılarda tanımlı olmak üzere tanım kümesi hangisidir?",
      "o": [
        "ℝ",
        "ℝ − {1}",
        "ℝ − {2}",
        "ℝ − {−2, 2}",
        "[−2, 2]"
      ],
      "a": 3,
      "e": "Payda (x−2)(x+2)=0 → x≠±2. √(x−1) tanım kümesi kopyası değil.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qfp-tyt-fn-03",
    "target_filler_id": "vm-fn-1--3-4",
    "topic": "YKS TYT|Matematik|Fonksiyon",
    "row": {
      "id": "qfp-tyt-fn-03",
      "q": "Tanım kümesi {0, 1, 2} ve f(x)=x+1 ise görüntü kümesi hangisidir?",
      "o": [
        "{0,1,2}",
        "{1,2,3}",
        "{0,1,2,3}",
        "{2,3,4}",
        "{1}"
      ],
      "a": 1,
      "e": "f(0)=1, f(1)=2, f(2)=3. ty-fn-3 / f(a)=k çözümü değil; görüntü kümesi.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-tyt-fn-04",
    "target_filler_id": "vm-fn-1--2-5",
    "topic": "YKS TYT|Matematik|Fonksiyon",
    "row": {
      "id": "qpn-tyt-fn-04",
      "q": "f:{−1, 0, 2} → ℝ, f(x)=4 − x² olmak üzere görüntü kümesi hangisidir?",
      "o": [
        "{−1, 0, 2}",
        "{0, 3, 4}",
        "{4}",
        "{1, 4}",
        "{0, 4}"
      ],
      "a": 1,
      "e": "f(−1)=3, f(0)=4, f(2)=0 → {0,3,4}. qfp görüntü {1,2,3} / x+1 kopyası değil.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-ayt-fn-01",
    "target_filler_id": "ay-vm-fn-1--5-2-0",
    "topic": "YKS AYT|Matematik|Fonksiyonlar",
    "row": {
      "id": "qpn-ayt-fn-01",
      "q": "f:ℝ → ℝ, f(x)=x² − 4x + 7 fonksiyonunun görüntü kümesi hangisidir?",
      "o": [
        "ℝ",
        "[3, ∞)",
        "[7, ∞)",
        "(−∞, 3]",
        "{3}"
      ],
      "a": 1,
      "e": "Vertex x=2; f(2)=4−8+7=3. Parabol yukarı → [3,∞). Doğrusal ters değil.",
      "difficulty": "Zor",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-ayt-fn-02",
    "target_filler_id": "ay-vm-fn-1--4-3-1",
    "topic": "YKS AYT|Matematik|Fonksiyonlar",
    "row": {
      "id": "qpn-ayt-fn-02",
      "q": "f:[0, ∞) → [0, ∞), f(x)=x² olsun. f⁻¹(25) kaçtır?",
      "o": [
        "−5",
        "5",
        "12,5",
        "25",
        "625"
      ],
      "a": 1,
      "e": "x²=25, x≥0 → x=5. −5 tanımda yok. 2x+c tersi değil.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qfp-ayt-fn-03",
    "target_filler_id": "ay-vm-fn-1--3-4-2",
    "topic": "YKS AYT|Matematik|Fonksiyonlar",
    "row": {
      "id": "qfp-ayt-fn-03",
      "q": "f(x)=√(x − 1) fonksiyonunun gerçek sayılarda tanım kümesi hangisidir?",
      "o": [
        "ℝ",
        "[1, ∞)",
        "(1, ∞)",
        "(−∞, 1]",
        "ℝ − {1}"
      ],
      "a": 1,
      "e": "Kök içi ≥0 → x−1≥0 → x≥1.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-ayt-fn-04",
    "target_filler_id": "ay-vm-fn-1--2-5-3",
    "topic": "YKS AYT|Matematik|Fonksiyonlar",
    "row": {
      "id": "qpn-ayt-fn-04",
      "q": "f tek fonksiyon ve f(5)=−2 ise f(−5)+f(5) kaçtır?",
      "o": [
        "−4",
        "−2",
        "0",
        "2",
        "4"
      ],
      "a": 2,
      "e": "f(−5)=−f(5)=2; 2+(−2)=0. Çift fonksiyon sayısalı (qfp-ayt-fn-02) değil.",
      "difficulty": "Orta",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-s1-sy-r10",
    "target_filler_id": "cv-eb0f458e",
    "topic": "1. Sınıf|Matematik|Sayılar 1-20",
    "row": {
      "id": "qpn-s1-sy-r10",
      "q": "Onar ritmik saymada 10’dan hemen sonra hangi sayı gelir?",
      "o": [
        "11",
        "12",
        "15",
        "20",
        "10"
      ],
      "a": 3,
      "e": "10’ar: 10’dan sonra 20. Tüm şıklar 1–20. 11/12 birer-ikişer; 15 beşer; 10 aynı sayı.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-s1-geo-cs",
    "target_filler_id": "cv-d4fa352a",
    "topic": "1. Sınıf|Matematik|Geometrik şekiller",
    "row": {
      "id": "qpn-s1-geo-cs",
      "q": "Pinpon topu ile kapalı bir kutu karşılaştırıldığında pinpon topu için hangisi doğrudur?",
      "o": [
        "Köşelidir",
        "Yuvarlaktır, köşesi yoktur",
        "Dört kenarlıdır",
        "Üç kenarlıdır",
        "Metre ile adlandırılır"
      ],
      "a": 1,
      "e": "M.1.2.1.2: cisimler adlandırılmadan (küre denmez); yuvarlak / köşeli. Kare kenar sayısı kopyası değil.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-s1-geo-or",
    "target_filler_id": "cv-d5fa36bd",
    "topic": "1. Sınıf|Matematik|Geometrik şekiller",
    "row": {
      "id": "qpn-s1-geo-or",
      "q": "Örüntü: kare, üçgen, kare, üçgen, kare, ___  Boşluğa hangisi gelir?",
      "o": [
        "Kare",
        "Üçgen",
        "Çember",
        "Dikdörtgen",
        "Nokta"
      ],
      "a": 1,
      "e": "M.1.2.3.1: iki ögeli örüntü. Kenar sayma sorusu değil.",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  },
  {
    "quality_id": "qpn-s1-ol-ns",
    "target_filler_id": "cv-9b25363b",
    "topic": "1. Sınıf|Matematik|Ölçme",
    "row": {
      "id": "qpn-s1-ol-ns",
      "q": "Kısa bir kalemin boyunu aralıksız birimlerle ölçmek için hangisi daha uygundur?",
      "o": [
        "Parmak",
        "Adım",
        "Kilogram",
        "Litre",
        "Metre"
      ],
      "a": 0,
      "e": "M.1.3.1.2: standart olmayan uygun araç. Kalem için parmak; metre 1. sınıf kazanımı değil (qfp-s1-ol-01 düzeltmesi).",
      "difficulty": "Kolay",
      "kind": "quality_fix"
    }
  }
];
