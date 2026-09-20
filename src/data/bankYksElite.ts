import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

/** Üst düzey (sınav temposu) özgün maddeler — mevcut konu anahtarlarına eklenir. */
export const YKS_BANK_ELITE: Record<string, BankQuestion[]> = {
  'YKS TYT|Türkçe|Paragraf': [
    q('el-pr-1', 'Bir yazar “bu yüzden” ve “oysa” bağlaçlarını art arda kullanıyorsa metinde en olası yapı hangisidir?', ['Yalnızca tanım cümleleri', 'Neden-sonuç ardından karşıtlık / düzeltme', 'Kronolojik liste', 'Soru-cevap tekniği zorunlu', 'Alıntı yasağı'], 1, 'İki bağlaç yön değiştirir: gerekçe + itiraz.', 'Zor'),
    q('el-pr-2', 'Paragrafta “sözde nesnellik” en çok hangisiyle ele verilir?', ['Tarih cümlesi', 'Değer yüklü sıfatlar gizlenmiş yargı gibi sunulunca', 'Noktalı virgül', 'Kısa cümle', 'Alıntı tırnağı'], 1, 'Sözcük seçimi tutumu sızdırır.', 'Zor'),
  ],
  'YKS TYT|Matematik|Problemler': [
    q('el-pb-1', 'Bir havuz A musluğuyla 6 saatte, B ile 12 saatte doluyor. İkisi 2 saat açık kaldıktan sonra A kapanıyor. Kalanı B kaç saatte doldurur?', ['4', '5', '6', '7', '8'], 2, 'Birlikte 1/6+1/12=1/4 havuz/saat; 2 saatte 1/2. Kalan 1/2, B: 6 saat.', 'Zor'),
  ],
  'YKS TYT|Matematik|Fonksiyon': [
    q('el-fn-1', 'f(x)=|x−2|+|x+1| için x∈ℝ iken f’nin en küçük değeri kaçtır?', ['1', '3', '0', '2', '4'], 1, 'Kırılma [−1,2] aralığında f=3 sabittir.', 'Zor'),
  ],
  'YKS TYT|Matematik|Permütasyon ve olasılık': [
    q('el-ol-1', '5 kişilik bir sırada A ve B yan yana oturacaksa kaç farklı diziliş vardır?', ['48', '24', '120', '60', '12'], 0, 'A-B bloğu 2!·4!=48.', 'Zor'),
  ],
  'YKS TYT|Geometri|Üçgenler': [
    q('el-uc-1', 'Bir üçgende iki iç açı 50° ve 60° ise dış açılardan biri kaç derece olabilir?', ['70', '110', '90', '50', '180'], 1, 'İç 70; komşu dış 110.', 'Zor'),
  ],
  'YKS TYT|Fen|Fizik': [
    q('el-fz-1', 'Yatay sürtünmesiz masada m ve 2m, aralarında k yay sabitli yayla bağlı dururken yay sıkıştırılıp bırakılıyor. Kütleler zıt yönde ayrılırken hız oranı v_m / v_{2m} nedir?', ['1/2', '2', '1', '4', '√2'], 1, 'Momentum korunumu: m v = 2m (v/2).', 'Zor'),
  ],
  'YKS AYT|Matematik|Limit': [
    q('el-lm-1', 'lim_{x→∞} (√(x²+2x) − x) değeri kaçtır?', ['0', '1', '∞', '2', '−1'], 1, 'Eşlenikle çarp: 2x/(√+x) → 1.', 'Zor'),
  ],
  'YKS AYT|Matematik|Türev': [
    q('el-tv-1', 'f(x)=x³−3x²+2 için f′(x)=0 köklerinde hangisi yerel maksimumdur?', ['x=0', 'x=2', 'x=1', 'x=3', 'yok'], 0, 'f′=3x(x−2); f″(0)=−6 <0 → max x=0.', 'Zor'),
  ],
  'YKS AYT|Matematik|İntegral': [
    q('el-in-1', '∫₀^{π/2} sin²x dx değeri hangisine eşittir?', ['π/2', 'π/4', '1', '0', 'π'], 1, 'sin²= (1−cos2x)/2 → π/4.', 'Zor'),
  ],
  'YKS AYT|Matematik|Trigonometri': [
    q('el-tg-1', 'tan x + cot x ifadesinin sin 2x cinsinden sade hali hangisidir?', ['2 / sin 2x', 'sin 2x', '2 sin 2x', '1/sin x', 'tan 2x'], 0, '(sin²+cos²)/(sin cos)=2/sin2x.', 'Zor'),
  ],
  'YKS AYT|Fizik|Elektrik': [
    q('el-el-1', 'Özdeş üç direnç R; ikisi seri, bu ikili üçüncüye paralel. Eşdeğer nedir?', ['3R/2', '2R/3', 'R', '3R', 'R/3'], 1, '2R ∥ R = 2R²/3R = 2R/3.', 'Zor'),
  ],
  'YKS AYT|Kimya|Gazlar': [
    q('el-gz-1', 'Aynı T,P’de eşit mol sayılı H₂ ve He için ortalama kinetik enerji karşılaştırması nedir?', ['H₂ daha büyük', 'He daha büyük', 'Eşit (yalnızca T’ye bağlı)', 'Hacme göre değişir zorunlu', 'Basınca göre H₂ her zaman'], 2, 'K_ort = (3/2)kT.', 'Zor'),
  ],
  'YKS AYT|Biyoloji|Kalıtım': [
    q('el-kl-1', 'AaBb × aabb çaprazında (bağımsız genler) AaBb oranı nedir?', ['1/2', '1/4', '1/8', '1/16', '3/4'], 1, 'Aa 1/2, Bb 1/2 → 1/4.', 'Zor'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|Şiir bilgisi': [
    q('el-si-1', 'Redif ile kafiye farkı için hangisi doğrudur?', ['Redif ek/kelime tekrarı, kafiye ses benzerliği', 'İkisi aynıdır', 'Redif yalnızca aruzda', 'Kafiye hece vezni yasağı', 'Redif uyak yerini tutmaz asla'], 0, 'Klasik ayrım.', 'Zor'),
  ],
};
