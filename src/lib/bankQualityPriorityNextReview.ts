import type { QualityStatus } from '../data/bankQualityFixItems';

export type ReviewVerdict = 'keep' | 'revise' | 'exclude';

export type QpnReviewRow = {
  id: string;
  independent: 'pass' | 'fail' | 'pass_with_defect';
  keyedAnswer: string;
  independentSolution: string;
  optionDefects: string;
  levelFit: string;
  sourceStatus: QualityStatus | 'n/a_math';
  verdict: ReviewVerdict;
  proposedChange: string | null;
};

/**
 * QPN ikinci denetim. QUALITY_PRIORITY_NEXT_ITEMS üzerine yazılmaz; onay yok.
 * Kaynak açılmadan source_verified yok. Tarif görsel ≠ gerçek görsel.
 */
export const QPN_SECOND_REVIEW_META = {
  reviewedPack: 'QUALITY_PRIORITY_NEXT_ITEMS',
  count: 28,
  appliedToPack: false,
  mergedIntoBank: false,
  mainPackSha256: '734e471add09e0af5d80fb9149793dc10000ee21a61896bbd81302ba6ea3dbd2',
} as const;

export const QPN_SECOND_REVIEW: QpnReviewRow[] = [
  {
    id: 'qpn-tyt-sy-01',
    independent: 'pass',
    keyedAnswer: '5√3',
    independentSolution: '√12=2√3, √27=3√3, toplam 5√3. Sayısal ≈8,660 eşleşir. √39, 6√3, 5√12, 9√3 ayrı değerler.',
    optionDefects: 'Yok. √39 kök altında toplama; 6√3/9√3 katsayı hataları.',
    levelFit: 'TYT Sayılar, köklü sadeleştirme+toplama uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-tyt-sy-02',
    independent: 'pass',
    keyedAnswer: '12',
    independentSolution: '√8·√18=√144=12; veya 2√2·3√2=12. 4√2≈5,66 ikinci doğru değil.',
    optionDefects: 'Yok. √26 ve 26 kök/taban toplama tuzakları.',
    levelFit: 'TYT uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-tyt-sy-03',
    independent: 'pass',
    keyedAnswer: '0,00036',
    independentSolution: '3,6×10⁻⁴: virgül 4 basamak sola → 0,00036. 0,0036 = 3,6×10⁻³.',
    optionDefects: 'Yok. Basamak kaydırma çeldiricileri anlamlı.',
    levelFit: 'TYT bilimsel gösterim uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-tyt-sy-04',
    independent: 'pass',
    keyedAnswer: '200',
    independentSolution: '(5×10³)·(4×10⁻²)=20×10¹=200. 5000×0,04=200.',
    optionDefects: 'Yok. 20 üssü unutma; 2×10⁶ üs işaretini ters yorumlama.',
    levelFit: 'TYT uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-tyt-sy-05',
    independent: 'pass',
    keyedAnswer: '102',
    independentSolution: '%15·120=18; satış 120−18=102. %15 puan çıkarma 105 değildir.',
    optionDefects: 'Yok. 18 indirim tutarı; 135 zam tuzakları.',
    levelFit: 'TYT yüzde uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-tyt-sy-06',
    independent: 'pass',
    keyedAnswer: '12',
    independentSolution: 'EBOB(24,36)=12. Eşit en uzun parça klasik EBOB bağlamı. 6 ve 8 böler ama en büyük değil; 72 EKOK.',
    optionDefects: 'Yok; ikinci doğru yok.',
    levelFit: 'TYT uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-tyt-sy-07',
    independent: 'pass_with_defect',
    keyedAnswer: '24 (EKOK okuması)',
    independentSolution:
      'Aynı yönelimli 8×12 dikdörtgenlerle kare doldurma: kenar EKOK(8,12)=24. 24/8=3, 24/12=2, 6 parça. Matematik tutarlı.',
    optionDefects:
      'Şık 4 = EBOB, “dikdörtgeni kare karolarla döşeme” okumasında da doğru olur. “en küçük kareye döşenecektir” hedefi belirsiz.',
    levelFit: 'TYT EKOK uygun; kök net değil.',
    sourceStatus: 'n/a_math',
    verdict: 'revise',
    proposedChange:
      'Kökü “8×12 dikdörtgen kartonlarla kenarı tam sayı en küçük kare zemin boşluksuz kaplanır; zemin kenarı?” yap. EBOB okumasını kapat. Pakete bu turda yazılmadı.',
  },
  {
    id: 'qpn-tyt-sy-08',
    independent: 'pass',
    keyedAnswer: '27',
    independentSolution: '3⁸/3⁵=3³=27. 3¹³ üs toplama; 243=3⁵.',
    optionDefects: 'Yok.',
    levelFit: 'TYT üslü kural uygun. (−2)³ kopyası değil.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-tyt-fn-01',
    independent: 'pass_with_defect',
    keyedAnswer: '−6',
    independentSolution: 'Verilen noktalar: f(4)=−5, f(0)=1 → −5−1=−6. Üç nokta tek polinom zorunlu kılmaz; soru yalnızca bu değerleri ister.',
    optionDefects:
      'İkinci doğru yok. Asıl kusur: pakette grafik yok. Kök koordinatları yazdığı için grafik olmadan çözülür; “grafik yorumlama” iddiası tutulmaz.',
    levelFit: 'TYT nokta okuma kolay; grafik kazanımı karşılanmaz.',
    sourceStatus: 'n/a_math',
    verdict: 'revise',
    proposedChange:
      'Ya gerçek grafik ekle (eksen + üç nokta) ya da kökü “değer tablosuna göre” diye düzelt. Şimdiki haliyle grafik maddesi sayma. Pakete yazılmadı.',
  },
  {
    id: 'qpn-tyt-fn-02',
    independent: 'pass',
    keyedAnswer: 'ℝ − {−2, 2}',
    independentSolution: 'Payda (x−2)(x+2)=0 ⇒ x≠±2. x=1 payı sıfır, payda −3 ≠0; tanımda kalır. Sadeleşme yok.',
    optionDefects: 'ℝ−{1} iptal tuzağı; ℝ−{2} eksik. İkinci doğru yok.',
    levelFit: 'TYT rasyonel tanım uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-tyt-fn-03',
    independent: 'pass',
    keyedAnswer: '12',
    independentSolution: 'x<0: f(−3)=3. x=0 ayrı: 5. x>0: f(2)=4. Toplam 12. Sınırlar x=0’ı iki eşitsizliğe sokmaz.',
    optionDefects: 'Yazım bitişik ama koşullar açık. 10/14 sınır karışıklığı; ikinci doğru yok.',
    levelFit: 'TYT parçalı uygun. el-fn-1 min kopyası değil.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: 'İsteğe bağlı: satır satır parçalı gösterim. Zorunlu değil.',
  },
  {
    id: 'qpn-tyt-fn-04',
    independent: 'pass',
    keyedAnswer: '{0, 3, 4}',
    independentSolution: 'f(−1)=3, f(0)=4, f(2)=0 → {0,3,4}. {0,4} 3’ü düşürür.',
    optionDefects: 'Yok.',
    levelFit: 'TYT sonlu görüntü uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-ayt-fn-01',
    independent: 'pass',
    keyedAnswer: '[3, ∞)',
    independentSolution: 'f(x)=(x−2)²+3. Tepe (2,3), a>0 ⇒ görüntü [3,∞). f(0)=7 tuzağı [7,∞).',
    optionDefects: 'Yok.',
    levelFit: 'AYT ikinci derece görüntü uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-ayt-fn-02',
    independent: 'pass',
    keyedAnswer: '5',
    independentSolution: 'x²=25, tanım [0,∞) ⇒ x=5. −5 tanım dışı. f⁻¹=[0,∞) üzerinde √.',
    optionDefects: 'Yok. −5 yanlış dal.',
    levelFit: 'AYT kısıtlı ters uygun. 2x+c değil.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-ayt-fn-03',
    independent: 'pass',
    keyedAnswer: '3',
    independentSolution: '(f∘g)(x)=(x−1)³=8 ⇒ x−1=2 ⇒ x=3. Sıra: g sonra f. g⁻¹(f⁻¹(8)): f⁻¹(8)=2, g⁻¹(2)=3. Şık 2 yalnız f⁻¹(8).',
    optionDefects: 'Yok.',
    levelFit: 'AYT sayısal bileşke tersi uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-ayt-fn-04',
    independent: 'pass',
    keyedAnswer: '0',
    independentSolution: 'Tek: f(−5)=−f(5)=2; 2+(−2)=0. Çift sanılırsa −4 (şıkta var).',
    optionDefects: 'Yok.',
    levelFit: 'AYT tek fonksiyon sayısal uygun. qfp çift kopyası değil.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-s1-sz-11',
    independent: 'pass',
    keyedAnswer: 'boş',
    independentSolution: '“Şekerleri yedi” bütünü ima eder; kutu boş kalır. Dolu çelişir.',
    optionDefects: 'İsteğe bağlı kök sıkılaştırma: “şekerlerin hepsini yedi”. İkinci doğru yok.',
    levelFit: 'T.1.3.11 zıt tahmin türü. Eş anlam değil.',
    sourceStatus: 'needs_source_verification',
    verdict: 'keep',
    proposedChange: 'Ders kitabı sayfası yok; source_verified yapılmaz. Program ≠ şık kanıtı.',
  },
  {
    id: 'qpn-s1-go-13',
    independent: 'pass_with_defect',
    keyedAnswer: 'Deftere yazmaktadır (anahtar)',
    independentSolution:
      'Tarif: kalem + açık defter yazmayı destekler ama “yazıyor” eylemi çizilmemiş; bakıyor/çiziyor da mümkün. Pakette resim dosyası yok.',
    optionDefects: 'Anahtar tartışmalı. Görsel okuma tamamlanmış gibi sunulmamalı.',
    levelFit: 'T.1.3.13 gerçek görsel ister. Metin tarifi kısa metne (T.1.3.15) daha yakın.',
    sourceStatus: 'needs_source_verification',
    verdict: 'revise',
    proposedChange:
      'Gerçek görsel ekle veya maddeyi kısa metin yap ve eylemi metinde yaz (“kalemi deftere sürüyor”). Onaysız pakete yazılmadı.',
  },
  {
    id: 'qpn-s1-km-15',
    independent: 'pass',
    keyedAnswer: 'Can',
    independentSolution: 'Metin: “Can salıncakta.” Kim sorusu; neden yok.',
    optionDefects: 'Yok. Ece kaydırak; çeldirici tutarlı.',
    levelFit: 'T.1.3.15 + ne/kim sınırı uygun.',
    sourceStatus: 'needs_source_verification',
    verdict: 'keep',
    proposedChange: 'Özgün cümle; kitap sayfası yok. source_verified yok.',
  },
  {
    id: 'qpn-s1-go-19',
    independent: 'pass_with_defect',
    keyedAnswer: 'Koşmanın yasak olduğunu',
    independentSolution:
      'Kırmızı daire + üstü çizili koşan çocuk yasak işaretidir. Yeşil ışık şıkkı eski hatayı elemiş. Pakette işaret görseli yok; yalnızca metin tarifi var.',
    optionDefects: 'Anahtar tarif doğru; T.1.3.19 “görsel/işaret” tam karşılanmaz.',
    levelFit: 'Kazanım türü örtüşür; Hayat Bilgisi tabela ezberi değil ama görsel eksik.',
    sourceStatus: 'needs_source_verification',
    verdict: 'revise',
    proposedChange: 'Gerçek yasak-koşu işareti ekle veya görsel yokken görsel okuma diye sunma. Pakete yazılmadı.',
  },
  {
    id: 'qpn-s1-sy-r5',
    independent: 'pass_with_defect',
    keyedAnswer: '20',
    independentSolution: '5,10,15,20 beşer. Tek doğru 20.',
    optionDefects: '25, M.1.1.1.3-ç yazma sınırı >20. 1. sınıfın reddetmesi beklenen bir yazımı seçenek yapmak yaşa aykırı.',
    levelFit: 'Kazanım doğru; 25 çeldiricisi uygun değil.',
    sourceStatus: 'n/a_math',
    verdict: 'revise',
    proposedChange: '25 → 14 veya 17 (≤20 yanlış). Pakete yazılmadı.',
  },
  {
    id: 'qpn-s1-sy-r10',
    independent: 'pass_with_defect',
    keyedAnswer: '20',
    independentSolution: '10’dan onar sonraki 20. 30 yazımı 1. sınıf yazma dışı.',
    optionDefects: '30 aynı yazma sınırı kusuru. 11/12/15 anlamlı birer/beşer tuzakları.',
    levelFit: 'Kazanım doğru; 30 çeldiricisi uygun değil.',
    sourceStatus: 'n/a_math',
    verdict: 'revise',
    proposedChange: '30 → 18 veya 16. Pakete yazılmadı.',
  },
  {
    id: 'qpn-s1-sy-ob',
    independent: 'pass',
    keyedAnswer: '16',
    independentSolution: '1 onluk+6 birlik=16. 7=1+6; 61 yer değiştirme.',
    optionDefects: '61 ve 106 yazma >20. Onluk-birlik tuzağı için 61 klasik; gerilim var ama ikinci doğru yok.',
    levelFit: 'M.1.1.1.7 uygun. 106 ağır çeldirici.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: 'İsteğe bağlı: 106→10, 61 kalsın veya 17 yapılsın. Zorunlu exclude değil.',
  },
  {
    id: 'qpn-s1-ad-cm',
    independent: 'pass',
    keyedAnswer: 'Toplamları eşittir',
    independentSolution: '6+9=15=9+6. Özellik adı yok, uygun.',
    optionDefects: '“İşlem yapılamaz” zayıf ama ikinci doğru değil.',
    levelFit: 'M.1.1.2.3 uygun. 7+5 kopyası değil.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-s1-ad-ms',
    independent: 'pass',
    keyedAnswer: '6',
    independentSolution: '9+□=15 → 6. Üzerine ekleme; çıkarma kökü yok.',
    optionDefects: 'Yok. 24=9+15 birleştirme tuzağı.',
    levelFit: 'M.1.1.2.4 uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-s1-geo-cs',
    independent: 'pass',
    keyedAnswer: 'Yuvarlaktır, köşesi yoktur',
    independentSolution: 'Pinpon yuvarlak/köşesiz; kutu köşeli. Küre adı yok.',
    optionDefects: '“Metre ile adlandırılır” geometri dışı zayıf çeldirici. İkinci doğru yok.',
    levelFit: 'M.1.2.1.2 uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: 'İsteğe bağlı: metre şıkkı → “köşelidir gibi kutuya benzer”.',
  },
  {
    id: 'qpn-s1-geo-or',
    independent: 'pass',
    keyedAnswer: 'Üçgen',
    independentSolution: 'kare,üçgen tekrar; boşluk üçgen. Kare devam ettirme tuzağı.',
    optionDefects: '“Nokta” zayıf. İkinci doğru yok.',
    levelFit: 'M.1.2.3.1 uygun.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
  {
    id: 'qpn-s1-ol-ns',
    independent: 'pass',
    keyedAnswer: 'Parmak',
    independentSolution: 'Kısa kalem: parmak tekrarlı birim. Adım/metre orantısız; kg/L nicelik yanlış. Metre doğru şık değil.',
    optionDefects: 'Karış yok; “daha uygun” tek uzunluk birimi parmak. İkinci doğru yok.',
    levelFit: 'M.1.3.1.2 uygun. qfp metre hatası tekrarlanmadı.',
    sourceStatus: 'n/a_math',
    verdict: 'keep',
    proposedChange: null,
  },
];

export function qpnSecondReviewSummary() {
  const verdict: Record<ReviewVerdict, number> = { keep: 0, revise: 0, exclude: 0 };
  const independent: Record<string, number> = {};
  for (const row of QPN_SECOND_REVIEW) {
    verdict[row.verdict] += 1;
    independent[row.independent] = (independent[row.independent] || 0) + 1;
  }
  return {
    count: QPN_SECOND_REVIEW.length,
    verdict,
    independent,
    sourceVerifiedClaimed: QPN_SECOND_REVIEW.filter((r) => r.sourceStatus === 'source_verified').length,
    reviseIds: QPN_SECOND_REVIEW.filter((r) => r.verdict === 'revise').map((r) => r.id),
    excludeIds: QPN_SECOND_REVIEW.filter((r) => r.verdict === 'exclude').map((r) => r.id),
    appliedToPack: QPN_SECOND_REVIEW_META.appliedToPack,
  };
}
