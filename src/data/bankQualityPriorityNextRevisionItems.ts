import { q } from './bankQ';
import type { QualityStatus, QualityVerify } from './bankQualityFixItems';
import { QUALITY_FIX_KIND } from './bankQualityFixItems';
import type { QualityNextItem } from './bankQualityPriorityNextItems';
import { QUALITY_PRIORITY_NEXT_ITEMS } from './bankQualityPriorityNextItems';

const K = QUALITY_FIX_KIND;

export const QPN_REVISE_IDS = [
  'qpn-tyt-sy-07',
  'qpn-tyt-fn-01',
  'qpn-s1-go-13',
  'qpn-s1-go-19',
  'qpn-s1-sy-r5',
  'qpn-s1-sy-r10',
] as const;

function it(
  topic: string,
  id: string,
  text: string,
  options: [string, string, string, string, string],
  a: number,
  e: string,
  difficulty: string,
  verify: QualityVerify,
  status: QualityStatus,
  kazanım: string,
  qualityNote: string,
  expected?: number,
): QualityNextItem {
  return { topic, verify, status, expected, kazanım, qualityNote, row: q(id, text, options, a, e, difficulty, K) };
}

/** Altı revise madde. QUALITY_PRIORITY_NEXT_ITEMS üzerine yazılmaz. */
export const QUALITY_PRIORITY_NEXT_REVISION_ITEMS: QualityNextItem[] = [
  it(
    'YKS TYT|Matematik|Sayılar',
    'qpn-tyt-sy-07',
    'Kenarı 8 cm olan kare karolar ile kenarı 12 cm olan kare karolar kullanılarak, boşluk kalmadan kaplanacak en küçük kare zeminin kenarı kaç cm olmalıdır?',
    ['8', '12', '24', '48', '96'],
    2,
    'Kenar, 8 ve 12’nin ortak katı olmalıdır. EKOK(8,12)=24. 24=3·8=2·12. EBOB=4 bu kökte istenmez.',
    'Orta',
    'math',
    'machine_ok',
    'TYT Sayılar: EKOK uygulaması',
    'Kare karo + kare zemin; dikdörtgen/EBOB belirsizliği yok. machine_ok yalnızca işlem.',
    24,
  ),
  it(
    'YKS TYT|Matematik|Fonksiyon',
    'qpn-tyt-fn-01',
    'f değer tablosu: x=0 iken f(x)=1; x=4 iken f(x)=−5. f(4) − f(0) kaçtır?',
    ['−8', '−6', '−4', '2', '6'],
    1,
    'Tabloda f(4)=−5 ve f(0)=1. −5 − 1 = −6. Çizim dosyası yok.',
    'Orta',
    'math',
    'machine_ok',
    'TYT Fonksiyon: değer tablosu',
    'Grafik dosyası ve “grafikten” ifadesi yok. machine_ok yalnızca aritmetik.',
    -6,
  ),
  it(
    '1. Sınıf|Türkçe|Görsel okuma',
    'qpn-s1-go-13',
    '“Ece kalemi aldı. Deftere yazdı. Top yerde kaldı.” Metne göre Ece ne yaptı?',
    ['Top oynadı', 'Deftere yazdı', 'Uyudu', 'Yemek yedi', 'Koştu'],
    1,
    'Metin eylemi açık: deftere yazdı. Resim/görsel yok; T.1.3.13 görsel maddesi tamamlanmış sayılmaz.',
    'Kolay',
    'meb',
    'needs_source_verification',
    'T.1.3.13',
    'Görsel dosyası yok; görsel okuma diye sunulmaz. Ders kitabı yok. source_verified/machine_ok yok.',
  ),
  it(
    '1. Sınıf|Türkçe|Görsel okuma',
    'qpn-s1-go-19',
    'Kapıda “KOŞMA” yazısı asılıdır. Bu yazı neyi söyler?',
    ['Koşabilirsiniz', 'Koşulmaması gerekir', 'Yemek zamanıdır', 'Oyun başlar', 'Kapı açıktır'],
    1,
    'Yazıdaki sözcük koşmamayı bildirir. Çizim/işaret görseli yok; yeşil ışık kuralı yok. Kitap sayfası çekilmedi.',
    'Kolay',
    'meb',
    'needs_source_verification',
    'T.1.3.19',
    'Yazılı uyarı; tarif edilmiş figür yok. source_verified yok.',
  ),
  it(
    '1. Sınıf|Matematik|Sayılar 1-20',
    'qpn-s1-sy-r5',
    'Beşer ritmik saymada 5, 10, 15, ___ dizisinde boşluğa hangisi gelir?',
    ['16', '18', '19', '20', '14'],
    3,
    '5’er: 15’ten sonra 20. Tüm şıklar 1–20. 16/18/19 birer veya üçer sapma; 14 geri sayma.',
    'Kolay',
    'math',
    'machine_ok',
    'M.1.1.1.3',
    '25 kaldırıldı. machine_ok ritmik işlem; yazma sınırı şıklarda.',
    20,
  ),
  it(
    '1. Sınıf|Matematik|Sayılar 1-20',
    'qpn-s1-sy-r10',
    'Onar ritmik saymada 10’dan hemen sonra hangi sayı gelir?',
    ['11', '12', '15', '20', '10'],
    3,
    '10’ar: 10’dan sonra 20. Tüm şıklar 1–20. 11/12 birer-ikişer; 15 beşer; 10 aynı sayı.',
    'Kolay',
    'math',
    'machine_ok',
    'M.1.1.1.3',
    '30 kaldırıldı. machine_ok ritmik işlem.',
    20,
  ),
];

export function resolvedQualityPriorityNextItems(): QualityNextItem[] {
  const rev = new Map(QUALITY_PRIORITY_NEXT_REVISION_ITEMS.map((x) => [x.row.id, x]));
  return QUALITY_PRIORITY_NEXT_ITEMS.map((x) => rev.get(x.row.id) ?? x);
}
