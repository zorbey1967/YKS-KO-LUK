import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';
import { hash32 } from '../lib/util';

function idOf(level: string, subject: string, topic: string, n: number) {
  return `cv-${hash32(`${level}|${subject}|${topic}|${n}`).toString(16)}`;
}

type Item = [string, [string, string, string, string, string], number, string, string];

function byTopic(level: string, subject: string, topic: string): Item[] {
  const t = topic.toLocaleLowerCase('tr-TR');
  const s = subject.toLocaleLowerCase('tr-TR');
  const g = Number((level.match(/^(\d+)/) || [])[1] || 12);
  const n = (hash32(topic) % 7) + 3;

  if (t.includes('paragraf') || t.includes('okuduğunu') || t.includes('kısa metin') || t.includes('hikâye') && s.includes('türk')) {
    return [
      [`Bir metinde yazarın asıl vermek istediği yargıya ne ad verilir?`, ['Konu', 'Ana fikir', 'Olay örgüsü', 'Kişi kadrosu', 'Zaman'], 1, 'Ana fikir metnin bütününden çıkan temel yargıdır.', 'Orta'],
      [`Yardıcı düşünce genellikle ne işe yarar?`, ['Konuyu değiştirir', 'Ana yargıyı örnekler / destekler', 'Noktalama öğretir', 'Başlığı siler', 'Türü yok sayar'], 1, 'Yardımcılar ana fikri somutlar.', 'Orta'],
    ];
  }
  if (t.includes('sözcük') || t.includes('anlam') && s.includes('türk')) {
    return [
      [`“İnce bir düşünce” sözünde “ince” hangi anlamda kullanılmıştır?`, ['Kalınlığın azı', 'Nitelik / hassaslık (mecaz)', 'İplik inceliği', 'Yağmur çisentisi', 'Ses kısıklığı'], 1, 'Bağlam mecazdır.', 'Orta'],
      [`Hangisinde deyim vardır?`, ['Kapıyı kapadı.', 'Rahat bir nefes aldı.', 'Kitabı koydu.', 'Erken kalktı.', 'Yağmur yağdı.'], 1, 'Deyim kalıplaşmış anlam taşır.', 'Kolay'],
    ];
  }
  if (t.includes('yazım') || t.includes('noktalama')) {
    return [
      [`Soru eki “mi” hangisinde doğru yazılmıştır?`, ['Geldinmi', 'Geldin mi', 'Gel-dinmi', 'miGeldin', 'Geldinmi?'], 1, 'Soru eki ayrı yazılır.', 'Kolay'],
      [`“Her şey” hangisinde doğru yazılmıştır?`, ['herşey', 'her şey', 'her-şey', 'herş ey', 'herŞey'], 1, 'Ayrı yazılır.', 'Kolay'],
    ];
  }
  if (t.includes('dil bilgisi') || t.includes('fiilimsi') || t.includes('ögeleri') || t.includes('çatı') || t.includes('anlatım bozuk')) {
    return [
      [`Hangisinde fiilimsi (ortaç/zarf-fiil/isim-fiil) vardır?`, ['Kapıyı kapadı.', 'Okuyan öğrenciler sessizdi.', 'Yarın gelir.', 'Hava soğuk.', 'Bu bir kalem.'], 1, '“Okuyan” sıfat-fiildir.', 'Orta'],
      [`“Kitabı masaya koydu.” cümlesinde “kitabı” ögesi hangisidir?`, ['Özne', 'Belirtili nesne', 'Dolaylı tümleç', 'Zarf tümleci', 'Yüklem'], 1, 'Belirtme eki nesne işaretler.', 'Orta'],
    ];
  }
  if (t.includes('toplama')) {
    return [[`${n} + 5 işleminin sonucu kaçtır?`, [String(n + 3), String(n + 4), String(n + 5), String(n + 6), String(n + 8)], 2, `${n}+5=${n + 5}.`, g <= 4 ? 'Kolay' : 'Orta']];
  }
  if (t.includes('çıkarma')) {
    return [[`${n + 8} − ${n} işleminin sonucu kaçtır?`, ['6', '7', '8', '9', '10'], 2, 'Fark 8’dir.', 'Kolay']];
  }
  if (t.includes('çarpma')) {
    return [[`4 × 3 işleminin sonucu kaçtır?`, ['7', '9', '12', '14', '16'], 2, '4+4+4=12.', 'Kolay']];
  }
  if (t.includes('kesir')) {
    return [
      [`1/2 ile 2/4 için hangisi doğrudur?`, ['1/2 büyüktür', '2/4 büyüktür', 'Denktirler', 'Toplam 1/8', 'Kesir değildir'], 2, 'Sadeleşince eşit.', 'Orta'],
      [`3/4 + 1/4 kaçtır?`, ['1/4', '2/4', '1', '4/8', '3'], 2, 'Paydalar eşit: 1.', 'Kolay'],
    ];
  }
  if (t.includes('ebob') || t.includes('bölünebilme') || t.includes('çarpan')) {
    return [
      [`12 ve 18 sayılarının EBOB’u kaçtır?`, ['2', '3', '6', '12', '36'], 2, '2·3=6.', 'Orta'],
      [`Bir sayı 2 ve 9 ile bölünüyorsa 18 ile de bölünür; çünkü 2 ile 9 aralarında asaldır. Bu yargı için hangisi doğrudur?`, ['Yanlıştır', 'Doğrudur', 'Yalnızca teklerde', 'Yalnızca negatifte', 'Hiçbir zaman'], 1, 'Aralarında asal bölenlerin çarpımı.', 'Zor'],
    ];
  }
  if (t.includes('üslü') || t.includes('köklü') || t.includes('karekök')) {
    return [
      [`2³ · 2² işleminin sonucu hangisidir?`, ['2⁵', '2⁶', '4⁵', '8', '32'], 0, 'Taban aynı, üsler toplanır.', 'Orta'],
      [`√50 sadeleştirilmiş hali hangisidir?`, ['5√2', '2√5', '25√2', '10√5', '√100'], 0, '√(25·2)=5√2.', 'Orta'],
    ];
  }
  if (t.includes('denklem') || t.includes('eşitlik')) {
    return [
      [`2x + 4 = 10 denkleminde x kaçtır?`, ['2', '3', '4', '5', '6'], 1, '2x=6 → x=3.', 'Orta'],
      [`x² − 5x + 6 = 0 kökleri toplamı kaçtır?`, ['−5', '5', '6', '1', '0'], 1, 'Vieta: 5.', 'Zor'],
    ];
  }
  if (t.includes('eşitsizlik')) {
    return [
      [`2x − 4 < 6 eşitsizliğinin çözümü hangisidir?`, ['x < 5', 'x > 5', 'x < 1', 'x > 1', 'x = 5'], 0, '2x<10 → x<5.', 'Zor'],
    ];
  }
  if (t.includes('küme')) {
    return [
      [`A⊂B ve x∈A ise hangisi zorunludur?`, ['x∉B', 'x∈B', 'A=B', 'B⊂A', 'A∩B=∅'], 1, 'Alt küme elemanı üstte de vardır.', 'Orta'],
    ];
  }
  if (t.includes('fonksiyon')) {
    return [
      [`f(x)=2x−1 ise f(3) kaçtır?`, ['4', '5', '6', '7', '8'], 1, '6−1=5.', 'Orta'],
    ];
  }
  if (t.includes('olasılık') || t.includes('permütasyon') || t.includes('kombinasyon')) {
    return [
      [`Hilesiz bir zarın 2 gelme olasılığı nedir?`, ['1/2', '1/3', '1/6', '1/12', '2/3'], 2, '6 yüzden biri.', 'Kolay'],
      [`3 farklı kitabın sıralanma sayısı kaçtır?`, ['3', '6', '9', '12', '27'], 1, '3!=6.', 'Orta'],
    ];
  }
  if (t.includes('veri') || t.includes('grafik') || t.includes('istatistik')) {
    return [
      [`Bir veri grubunun en sık tekrarlanan değerine ne denir?`, ['Medyan', 'Mod', 'Aritmetik ortalama', 'Açıklık', 'Varyans'], 1, 'Mod = tepe değer.', 'Orta'],
    ];
  }
  if (t.includes('üçgen') || t.includes('açı') || t.includes('çember') || t.includes('çokgen') || t.includes('geometr') || t.includes('şekil')) {
    return [
      [`Bir üçgenin iç açıları toplamı kaç derecedir?`, ['90', '180', '270', '360', '120'], 1, 'Öklid düzleminde 180°.', 'Kolay'],
      [`Karenin bir iç açısı kaç derecedir?`, ['60', '90', '120', '180', '45'], 1, 'Dört eşit açı, 360/4=90.', 'Kolay'],
    ];
  }
  if (t.includes('oran') || t.includes('yüzde') || t.includes('problem')) {
    return [
      [`Bir ürünün %20’si 14 ise ürün kaçtır?`, ['28', '56', '70', '84', '140'], 2, '0,2x=14 → 70.', 'Orta'],
      [`Ali bir işi 6, Veli 12 günde bitirir. Birlikte kaç günde biter?`, ['3', '4', '5', '8', '9'], 1, '1/6+1/12=1/4.', 'Zor'],
    ];
  }
  if (t.includes('logaritma') || t.includes('üstel')) {
    return [[`log₂ 8 değeri kaçtır?`, ['2', '3', '4', '8', '1/3'], 1, '2³=8.', 'Orta']];
  }
  if (t.includes('limit')) {
    return [[`lim_{x→1} (x²−1)/(x−1) kaçtır?`, ['0', '1', '2', 'sonsuz', 'tanımsız bırakılır'], 2, 'Belirsizlik giderilince 2.', 'Zor']];
  }
  if (t.includes('türev')) {
    return [[`f(x)=x³−3x için f′(x) nedir?`, ['3x²−3', 'x²−3', '3x²', '3x−3', 'x³−3'], 0, 'Kuvvet kuralı.', 'Orta']];
  }
  if (t.includes('integral')) {
    return [[`∫₀² 2x dx kaçtır?`, ['2', '4', '6', '8', '0'], 1, '[x²]₀²=4.', 'Orta']];
  }
  if (t.includes('trigonometri') || t.includes('sin') || t.includes('cos')) {
    return [[`sin²x + cos²x değeri nedir?`, ['0', '1', '2', 'sin 2x', 'tan x'], 1, 'Temel özdeşlik.', 'Kolay']];
  }
  if (t.includes('polinom')) {
    return [[`P(x)=x²−1 için P(2) kaçtır?`, ['1', '3', '4', '5', '0'], 1, '4−1=3.', 'Kolay']];
  }
  if (t.includes('dizi')) {
    return [[`aₙ=2n+1 için a₃ kaçtır?`, ['5', '6', '7', '8', '9'], 2, '2·3+1=7.', 'Kolay']];
  }
  if (t.includes('parabol')) {
    return [[`y=x² tepe noktası neresidir?`, ['(0,0)', '(1,1)', '(0,1)', '(1,0)', '(−1,0)'], 0, 'a>0, tepe orijin.', 'Orta']];
  }
  if (s.includes('fizik') || (s === 'fen' && (t.includes('kuvvet') || t.includes('hareket') || t.includes('elektrik') || t.includes('ışık') || t.includes('basınç') || t.includes('enerji') || t.includes('dalga') || t.includes('ısı')))) {
    return [
      [`Net kuvvet sıfırsa cisim için hangisi doğrudur?`, ['Mutlaka durur', 'Hızı sabittir (durgun veya düzgün doğrusal)', 'İvme artar', 'Yön rastgele değişir', 'Kütle sıfırlanır'], 1, 'Newton I.', 'Zor'],
      [`Ohm yasasında V = ?`, ['I / R', 'I · R', 'I − R', 'R / I', 'I + R'], 1, 'V=IR.', 'Orta'],
    ];
  }
  if (s.includes('kimya') || (s === 'fen' && (t.includes('madde') || t.includes('atom') || t.includes('asit') || t.includes('gaz') || t.includes('karışım')))) {
    return [
      [`Su (H₂O) molekülünde hidrojen atomu sayısı kaçtır?`, ['1', '2', '3', '4', '8'], 1, 'İki H, bir O.', 'Kolay'],
      [`İdeal gaz denklemi hangisidir?`, ['P+V=nRT', 'PV=nRT', 'P=nV/T', 'n=PVT', 'T=PV/n'], 1, 'PV=nRT.', 'Orta'],
    ];
  }
  if (s.includes('biyoloji') || (s === 'fen' && (t.includes('hücre') || t.includes('canlı') || t.includes('kalıtım') || t.includes('dna') || t.includes('ekoloji') || t.includes('duyu') || t.includes('dolaşım')))) {
    return [
      [`Ökaryot hücrede protein sentezinin yeri hangisidir?`, ['Lizozom', 'Ribozom', 'Koful', 'Sentrozom', 'Çeper'], 1, 'Ribozom translasyon yeridir.', 'Orta'],
      [`Fotosentezde oksijenin kaynağı nedir?`, ['CO₂ karbonu', 'Su fotolizi', 'ATP', 'NADPH', 'Magnezyum'], 1, 'H₂O ayrışması.', 'Zor'],
    ];
  }
  if (t.includes('tarih') || s.includes('tarih') || s.includes('inkılap') || t.includes('osmanlı') || t.includes('mücadele') || t.includes('atatürk')) {
    return [
      [`19 Mayıs 1919 hangi sürecin fiilî başlangıcı kabul edilir?`, ['Tanzimat', 'Millî Mücadele örgütlenmesi', 'I. Meşrutiyet', 'Karlofça', 'Lozan imzası'], 1, 'Samsun’a çıkış.', 'Orta'],
      [`Misak-ı Millî’nin özü hangisidir?`, ['Manda kabulü', 'Ulusal sınır ve bağımsızlık', 'Kapitülasyon genişletme', 'Sevr onayı', 'Saltanat güçlendirme'], 1, 'Ulusal pakt.', 'Zor'],
    ];
  }
  if (s.includes('coğrafya') || t.includes('iklim') || t.includes('harita') || t.includes('nüfus') || t.includes('beşeri') || t.includes('doğal sistem')) {
    return [
      [`Türkiye’de kıyı dağlarının denize paralel uzanması en çok neyi etkiler?`, ['Saat dilimini', 'İç kesimlerin nem almasını zorlaştırır', 'Kutup iklimini', 'Gelgit yüksekliğini sıfırlar', 'Yerçekimini'], 1, 'Yağışın içe geçişi azalır.', 'Zor'],
      [`Akdeniz ikliminin yazı nasıldır?`, ['Serin yağışlı', 'Sıcak kurak', 'Donlu kutup', 'Muson', 'Tundra'], 1, 'Yaz kuraklığı.', 'Kolay'],
    ];
  }
  if (s.includes('felsefe') || t.includes('bilgi felsefe') || t.includes('varlık') || t.includes('siyaset') && s.includes('felsefe')) {
    return [
      [`Bilginin kaynağını duyusal deneyime bağlayan yaklaşım hangisidir?`, ['Rasyonalizm', 'Empirizm', 'Dogmatizm', 'Mistisizm', 'Septisizm yalnızca şüphe'], 1, 'Empirizm.', 'Orta'],
      [`Felsefenin temel etkinliği hangisine yakındır?`, ['Ezber liste', 'Sorgulama ve temellendirme', 'Yalnızca deney tüpü', 'Spor kuralı', 'Ticaret'], 1, 'Eleştirel düşünme.', 'Kolay'],
    ];
  }
  if (s.includes('din')) {
    return [
      [`İslam’da inancın temelini oluşturan kavram hangisidir?`, ['Ticaret', 'Tevhit (Allah’ın birliği)', 'Coğrafya', 'Spor', 'Mimari süs'], 1, 'Tevhit esastır.', 'Kolay'],
      [`Namazın farz oluşu hangi temele dayanır?`, ['Kişisel tercih yalnızca', 'İbadet yükümlülüğü', 'Ticari kural', 'Spor disiplini', 'Estetik'], 1, 'İbadet.', 'Orta'],
    ];
  }
  if (s.includes('ingilizce') || t.includes('greeting') || t.includes('classroom') || t.includes('okuma') && s.includes('ingiliz')) {
    return [
      [`“Good morning” ifadesi ne zaman kullanılır?`, ['Gece yatarken', 'Sabah selamı', 'Yemek ısmarlarken', 'Sayı sayarken', 'Renk sorarken'], 1, 'Sabah karşılığı.', 'Kolay'],
      [`“She is a teacher.” cümlesinde “is” ne işe yarar?`, ['Çoğul ek', '“be” fiili / durum', 'Soru eki mi', 'Geçmiş -ed', 'Emir'], 1, 'Present “be”.', 'Orta'],
    ];
  }
  if (t.includes('şiir') || t.includes('divan') || t.includes('edebiyat') || t.includes('tanzimat') || t.includes('roman') || t.includes('tiyatro') || t.includes('masal') || t.includes('destan')) {
    return [
      [`Gazelde birim hangisidir?`, ['Dörtlük zorunlu', 'Beyit', 'Bent yalnızca', 'Paragraf', 'Sahne'], 1, 'Beyit merkezli nazım.', 'Orta'],
      [`Realizmde anlatıcı genelde nasıl durur?`, ['Aşırı öznel lirizm', 'Gözleme dayalı nesnel tutum', 'Tam masalsı', 'Yalnızca hece', 'Divan mazmunu'], 1, 'Gözlem.', 'Zor'],
    ];
  }
  if (s.includes('hayat') || s.includes('sosyal') && g <= 4) {
    return [
      [`Okulda güvenlik için hangisi doğrudur?`, ['Tanımadığımız kişilerle gitmek', 'Kurallara uymak ve yetkiliye bildirmek', 'Koşarak merdiven inmek zorunlu', 'İlaç paylaşmak', 'Kapıyı kilitlememek'], 1, 'Güvenli davranış.', 'Kolay'],
    ];
  }
  if (t.includes('mantık') && !s.includes('matematik')) {
    return [
      [`Önermenin doğruluk değeri hangilerinden biridir?`, ['Yalnızca renk', 'Doğru veya yanlış', 'Kilogram', 'Derece zorunlu', 'Metre'], 1, 'İki değerli mantık.', 'Orta'],
    ];
  }
  if (t.includes('psikoloji')) {
    return [
      [`Davranışı gözlenebilir uyaran-tepki ile açıklayan yaklaşım hangisidir?`, ['Hümanizm yalnızca', 'Davranışçılık', 'Psikanaliz tek başına her şey', 'Gestalt algı değil', 'Biyoloji değil psikoloji'], 1, 'Behaviorism.', 'Orta'],
    ];
  }
  if (t.includes('sosyoloji')) {
    return [
      [`Sosyolojinin temel inceleme nesnesi hangisidir?`, ['Tek atom', 'Toplum ve toplumsal ilişki', 'Yalnızca hücre', 'Yıldız spektrumu', 'Fiil çekimi'], 1, 'Toplum.', 'Kolay'],
    ];
  }
  if (t.includes('ses bilgisi')) {
    return [
      [`Türkçede büyük ünlü uyumu neyi kontrol eder?`, ['Noktalama', 'Sözcükteki ünlülerin kalınlık-incelik uyumunu', 'Fiil çatısını', 'Paragraf uzunluğunu', 'Harita ölçeğini'], 1, 'Kalın/ince ünlü.', 'Orta'],
    ];
  }

  const others = ['Başka bir ünitenin kuralı', 'Konu dışı bir tanım', 'Sınavda sorulmayan rastgele bilgi', 'Bu dersin hedefiyle ilgisiz örnek'];
  return [
    [
      `“${topic}” konusu (${subject}) için hangisi doğrudur?`,
      [`${topic} bu dersin müfredatındaki kavram, kural ve uygulamaları kapsar.`, others[0], others[1], others[2], others[3]],
      0,
      'Kök, ünitenin kapsamını ölçer; çeldiriciler konu dışıdır.',
      g <= 4 ? 'Kolay' : 'Orta',
    ],
    [
      `Bu ünitede başarı için hangisi en uygundur?`,
      ['Yalnızca ezber slogan', 'Tanım + örnek + benzer soru çözümü', 'Konuyu hiç tekrar etmemek', 'Başka dersin formülünü yapıştırmak', 'Süre tutmadan rastgele işaret'],
      1,
      'ÖSYM tarzı: bilgiyi örnek ve soruyla pekiştirmek.',
      'Orta',
    ],
  ];
}

export function makeTopicQuestions(level: string, subject: string, topic: string, need: number): BankQuestion[] {
  const items = byTopic(level, subject, topic);
  const extra: Item = [
    `“${topic}” konusunda hangisi yanlıştır?`,
    [
      'Konunun temel tanım ve kuralları bu ünitenin parçasıdır.',
      'Bu ünite yalnızca başka bir dersin formüllerini ezberletir.',
      'Sınavda bu konu hiç ölçülmez.',
      'Örnek çözmek konuyu bozar.',
      'Tanım öğrenmek gereksizdir.',
    ],
    1,
    'Çeldirici, üniteyi yok sayar; doğru şık yanlışı işaretler.',
    'Zor',
  ];
  const pool = items.length >= 2 ? items : [...items, extra];
  const out: BankQuestion[] = [];
  for (let i = 0; i < need; i++) {
    const it = pool[i % pool.length];
    out.push(q(idOf(level, subject, topic, i + 1), it[0], it[1], it[2], it[3], it[4]));
  }
  return out;
}

export function coverCurriculum(
  curriculum: Record<string, Record<string, string[]>>,
  bank: Record<string, BankQuestion[]>,
): Record<string, BankQuestion[]> {
  const out: Record<string, BankQuestion[]> = { ...bank };
  for (const [level, subjects] of Object.entries(curriculum)) {
    for (const [subject, topics] of Object.entries(subjects)) {
      for (const topic of topics) {
        const key = `${level}|${subject}|${topic}`;
        const have = out[key]?.length || 0;
        if (have >= 2) continue;
        const extra = makeTopicQuestions(level, subject, topic, 2 - have);
        out[key] = [...(out[key] || []), ...extra];
      }
    }
  }
  return out;
}
