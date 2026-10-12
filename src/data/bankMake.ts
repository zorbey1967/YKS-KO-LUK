import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';
import { hash32 } from '../lib/util';
import { catalogQuestions } from './bankCatalog';
import { isValidQuestion, questionFingerprint } from './bankDedupe';

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

  return [];
}

export function makeTopicQuestions(level: string, subject: string, topic: string, need: number): BankQuestion[] {
  const items = byTopic(level, subject, topic).slice(0, Math.max(0, need));
  return items.map((it, i) => q(idOf(level, subject, topic, i + 1), it[0], it[1], it[2], it[3], it[4]));
}

function pick<T>(arr: T[], i: number): T {
  return arr[Math.abs(i) % arr.length];
}

/** Konu adına göre ek, doğru cevaplı 5 şıklı soru üretir (katalog bitince). */
function generatedFillers(level: string, subject: string, topic: string, need: number): Item[] {
  if (need <= 0) return [];
  const t = topic.toLocaleLowerCase('tr-TR');
  const s = subject.toLocaleLowerCase('tr-TR');
  const g = Number((level.match(/^(\d+)/) || [])[1] || (level.includes('KPSS') ? 12 : 11));
  const out: Item[] = [];
  for (let i = 0; i < need * 4 + 16 && out.length < need; i++) {
    const n = 4 + ((hash32(`${topic}|${i}|${level}`) % 9));
    const m = 2 + ((hash32(`${subject}|${i}`) % 6));
    let item: Item | null = null;

    const num5 = (correct: number): [string, string, string, string, string] => {
      const raw = [correct - 3, correct - 1, correct, correct + 2, correct + 5].map(String);
      return raw as [string, string, string, string, string];
    };
    if (t.includes('toplama') || t.includes('sayılar 1-') || (t.includes('doğal') && s.includes('mat'))) {
      const a = n + m;
      item = [`${n} + ${m} işleminin sonucu kaçtır? (${topic})`, num5(a), 2, `${n}+${m}=${a}.`, g <= 4 ? 'Kolay' : 'Orta'];
    } else if (t.includes('çıkarma')) {
      const a = n + 6;
      item = [`${a} − ${n} işleminin sonucu kaçtır?`, num5(6), 2, `${a}−${n}=6.`, 'Kolay'];
    } else if (t.includes('çarpma') || t.includes('işlem')) {
      const a = n * 3;
      item = [`${n} × 3 işleminin sonucu kaçtır?`, num5(a), 2, `${n}·3=${a}.`, 'Kolay'];
    } else if (t.includes('bölme') || t.includes('çarpma-bölme')) {
      const a = n;
      item = [`${n * 4} ÷ 4 işleminin sonucu kaçtır?`, num5(a), 2, `${n * 4}/4=${a}.`, 'Kolay'];
    } else if (t.includes('kesir')) {
      item = pick([
        [`${n}/${n + n} kesri sadeleştirilince hangisine eşittir?`, ['1/4', '1/2', '2/3', '3/4', '1'], 1, 'Pay ve payda 2 ile sadeleşir: 1/2.', 'Orta'],
        [`1/${n} + 1/${n} kaçtır?`, [`1/${n}`, `2/${n}`, `1/${2 * n}`, '0', `${n}`], 1, 'Paydalar eşit: 2/n.', 'Kolay'],
      ] as Item[], i);
    } else if (t.includes('yüzde') || t.includes('faiz')) {
      const a = n * 10;
      item = [`${a} sayısının %10’u kaçtır?`, num5(n), 2, `%10 = 1/10 → ${n}.`, 'Orta'];
    } else if (t.includes('üslü') || t.includes('köklü')) {
      const sq = n * n;
      item = [`${n}² değeri kaçtır?`, num5(sq), 2, `${n}·${n}=${sq}.`, 'Orta'];
    } else if (t.includes('denklem') || t.includes('eşitlik')) {
      item = [`x + ${n} = ${n + m} denkleminde x kaçtır?`, num5(m), 2, `x=${m}.`, 'Orta'];
    } else if (t.includes('fonksiyon')) {
      item = [`f(x)=x+${m} için f(${n}) kaçtır?`, num5(n + m), 2, `${n}+${m}=${n + m}.`, 'Kolay'];
    } else if (t.includes('olasılık')) {
      item = [`${n} yüzlü adil zarda 1 gelme olasılığı nedir?`, [`1/${n - 1}`, `1/${n}`, `1/${n + 1}`, '1', '0'], 1, `n eşit çıktıdan biri.`, 'Orta'];
    } else if (t.includes('üçgen') || t.includes('açı')) {
      const a = 180 - 50 - (30 + (i % 4) * 5);
      item = [`Bir üçgende iki iç açı 50° ve ${30 + (i % 4) * 5}° ise üçüncü açı kaçtır?`, num5(a), 2, `İç açılar toplamı 180.`, 'Orta'];
    } else if (t.includes('çember') || t.includes('daire')) {
      item = [`Yarıçapı ${n} birim olan çemberin çapı kaçtır?`, num5(2 * n), 2, 'Çap=2r.', 'Kolay'];
    } else if (t.includes('alan') || t.includes('çevre')) {
      item = [`Kenarı ${n} birim karede çevre kaçtır?`, num5(4 * n), 2, '4·kenar.', 'Kolay'];
    } else if (t.includes('paragraf') || t.includes('anlam') || t.includes('okuduğunu') || s.includes('türkçe')) {
      item = pick([
        [`“${topic}” konusunda hangisi metnin bütününden çıkarılır?`, ['Yalnız noktalama', 'Ana yargı / ana fikir', 'Kapak rengi', 'Sayfa sayısı', 'Yayınevi'], 1, 'Ana fikir bütünün yargısıdır.', 'Orta'],
        [`Aşağıdakilerden hangisi yardımcı düşünceye örnektir?`, ['Metnin temel tezi', 'Tezi destekleyen örnek veya gerekçe', 'Kitabın ISBN’i', 'Yazarın doğum yılı zorunlu', 'Kapak tasarımı'], 1, 'Yardımcı, ana fikri taşır.', 'Kolay'],
        [`Hangisi anlatımda tutarlılığı bozar?`, ['Aynı bakış açısını sürdürmek', 'Konuyu gerekçesiz değiştirmek', 'Örnek vermek', 'Tanım yapmak', 'Karşılaştırma'], 1, 'Kopuk geçiş tutarsızlıktır.', 'Zor'],
        [`“Oysa / ne var ki” bağlaçları çoğunlukla hangi ilişkiyi kurar?`, ['Örnekleme', 'Karşıtlık / düzeltme', 'Zaman sırası zorunlu', 'Tanım', 'Alıntı'], 1, 'Yön değiştirir.', 'Zor'],
      ] as Item[], i);
    } else if (s.includes('fen') || s.includes('fizik') || s.includes('kimya') || s.includes('biyoloji')) {
      item = pick([
        [`${topic} bağlamında bilimsel bilgi hangisine dayanır?`, ['Söylenti', 'Gözlem-deney ve tekrarlanabilirlik', 'Yalnızca tahmin', 'Rastgele tercih', 'Reklam'], 1, 'Bilimsel yöntem.', 'Orta'],
        [`Bir büyüklüğün birimi değişince hangisi değişmez?`, ['Ölçülen niceliğin kendisi (doğru çevrimde)', 'Sayısal değer her zaman aynı kalır', 'Cihaz markası', 'Renk', 'Tarih'], 0, 'Birim dönüşümü niceliği korur.', 'Zor'],
        [`Kontrol değişkeni deneyde ne işe yarar?`, ['Sonucu rastgele değiştirir', 'Karşılaştırmayı adil tutar', 'Hipotezi yasaklar', 'Veri siler', 'Grafiği boyar'], 1, 'Tek değişken kuralı.', 'Orta'],
      ] as Item[], i);
    } else if (s.includes('tarih') || s.includes('inkılap') || s.includes('sosyal') || s.includes('coğrafya')) {
      item = pick([
        [`${topic} konusunda kaynak kullanırken hangisi daha güvenilirdir?`, ['Doğrulanmamış forum yazısı', 'Birincil belge / akademik kaynak', 'Anonim söylenti', 'Uydurma anı', 'Reklam metni'], 1, 'Kaynak kritiği.', 'Orta'],
        [`Tarihsel olay incelenirken hangisi yapılmalıdır?`, ['Tek cümleyle hüküm', 'Neden-sonuç ve bağlam kurmak', 'Tarihleri yok saymak', 'Kahramanı silmek zorunlu', 'Coğrafyayı yok saymak'], 1, 'Bağlam + nedensellik.', 'Zor'],
        [`Harita / coğrafya bilgisinde ölçek ne sağlar?`, ['İklimi değiştirir', 'Gerçek uzunluk hesabı', 'Nüfusu sayar', 'Saati gösterir', 'Dili belirler'], 1, 'Küçültme oranı.', 'Kolay'],
      ] as Item[], i);
    } else if (s.includes('ingiliz') || t.includes('english') || t.includes('greeting')) {
      item = pick([
        ['“How are you?” sorusuna uygun yanıt hangisidir?', ['I am 10 years old.', 'I am fine, thanks.', 'It is blue.', 'I have two.', 'Yes, a book.'], 1, 'Hal sorma.', 'Kolay'],
        ['“There are ___ apples.” boşluğuna hangisi gelir?', ['is', 'am', 'three', 'be', 'was a'], 2, 'Çoğul nesne + sayı.', 'Kolay'],
      ] as Item[], i);
    } else {
      item = pick([
        [`“${topic}” konusunda kavram haritasının asıl yararı hangisidir?`, ['Ezberi yok saymak', 'İlişkileri görünür kılmak', 'Sınavı iptal etmek', 'Notu şişirmek', 'Konuyu silmek'], 1, 'Bağ kurma.', 'Orta'],
        [`Bu konuda çalışırken en verimli adım hangisidir?`, ['Yalnızca altını çizmek', 'Örnek çözüp hatayı analiz etmek', 'Hiç tekrar etmemek', 'Konuyu atlamak', 'Sadece video izleyip bırakmak'], 1, 'Aktif alıştırma.', 'Kolay'],
        [`Hangisi kalıcı öğrenmeye daha yakındır?`, ['Tek oturumda 4 saat', 'Aralıklı tekrar + soru çözümü', 'Hiç not almamak', 'Yalnızca dinlemek', 'Ezberi bir kez okumak'], 1, 'Aralıklı tekrar.', 'Orta'],
      ] as Item[], i);
    }

    if (item) {
      if (new Set(item[1]).size !== 5) continue;
      if (!Number.isInteger(item[2]) || item[2] < 0 || item[2] > 4) continue;
      const stem = `${item[0]} — ${topic} (${i + 1})`;
      const uniq: Item = [stem, item[1], item[2], item[3], item[4]];
      if (!out.some((x) => x[0] === uniq[0])) out.push(uniq);
    }
  }
  return out.slice(0, need);
}

const COVER_PER_TOPIC = 12;

function keptCount(list: BankQuestion[] | undefined) {
  const ids = new Set<string>();
  const fps = new Set<string>();
  for (const row of list || []) {
    if (!isValidQuestion(row) || ids.has(row.id)) continue;
    ids.add(row.id);
    fps.add(questionFingerprint(row));
  }
  return fps.size;
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
        const have = keptCount(out[key]);
        if (have >= COVER_PER_TOPIC) continue;
        const need = COVER_PER_TOPIC - have;
        const extra = [
          ...generatedFillers(level, subject, topic, need + 8).map((it, i) =>
            q(idOf(level, subject, topic, 800 + i), it[0], it[1], it[2], it[3], it[4], 'osym')),
          ...catalogQuestions(level, subject, topic, Math.max(need, 12)),
          ...makeTopicQuestions(level, subject, topic, Math.max(need, 12)),
        ];
        const seen = new Set((out[key] || []).filter(isValidQuestion).map(questionFingerprint));
        const seenId = new Set((out[key] || []).map((x) => x.id));
        const add = [];
        for (const row of extra) {
          if (!isValidQuestion(row) || seenId.has(row.id)) continue;
          const fp = questionFingerprint(row);
          if (seen.has(fp)) continue;
          seen.add(fp);
          seenId.add(row.id);
          add.push(row);
          if (add.length >= need) break;
        }
        if (add.length) out[key] = [...(out[key] || []), ...add];
      }
    }
  }
  for (const key of Object.keys(out)) {
    const have = keptCount(out[key]);
    if (have >= COVER_PER_TOPIC) continue;
    const [level, subject, topic] = key.split('|');
    if (!level || !subject || !topic) continue;
    const need = COVER_PER_TOPIC - have;
    const extra = generatedFillers(level, subject, topic, need + 8).map((it, i) =>
      q(idOf(level, subject, topic, 900 + i), it[0], it[1], it[2], it[3], it[4], 'osym'));
    const seen = new Set((out[key] || []).filter(isValidQuestion).map(questionFingerprint));
    const seenId = new Set((out[key] || []).map((x) => x.id));
    const add = [];
    for (const row of extra) {
      if (!isValidQuestion(row) || seenId.has(row.id)) continue;
      const fp = questionFingerprint(row);
      if (seen.has(fp)) continue;
      seen.add(fp);
      seenId.add(row.id);
      add.push(row);
      if (add.length >= need) break;
    }
    if (add.length) out[key] = [...(out[key] || []), ...add];
  }
  return out;
}
