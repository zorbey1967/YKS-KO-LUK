import type { BankQuestion } from './types';
import { isFillerQuestion } from './bankCoverage';
import { QUALITY_FIX_ITEMS } from '../data/bankQualityFixItems';
import { QUALITY_FIX_META } from '../data/bankQualityFixPack';
import { proposeQualityMerge } from './bankQualityMergePlan';

export type SourceKind = 'tdk_yazim' | 'tdk_sozluk' | 'meb_program' | 'meb_tarih';

export type SourceClaimRow = {
  id: string;
  topic: string;
  claim: string;
  officialSource: string;
  kind: SourceKind;
  status: 'source_verified' | 'needs_source_verification' | 'needs_human';
  pageUrl?: string;
  verifiedAt?: string;
  verifiedClaim?: string;
  blockReason?: string;
};

export const MEB_FEN_2018 =
  'https://mufredat.meb.gov.tr/Dosyalar/201812312311937-FEN%20B%C4%B0L%C4%B0MLER%C4%B0%20%C3%96%C4%9ERET%C4%B0M%20PROGRAMI2018.pdf';

/** Bankada aynı kazanımı tekrarlayan kalite maddeleri; ekleme yok. */
export const CONCEPTUAL_OVERLAPS = [
  { qualityId: 'qf-8-fen-p', bankIds: ['lgs-bs-1'], gain: 'katı basıncı P=F/A formülü', note: 'MEB 8 F.8.3.1 matematiksel bağıntıya girilmez; bankada lgs-bs-1 aynı kazanım.' },
  { qualityId: 'qf-n051', bankIds: ['s8-fn-1', 'lgs-bs-13'], gain: 'alan küçülünce katı basıncı artar', note: 's8-fn-1 aynı niteliksel iddia.' },
  { qualityId: 'qf-n073', bankIds: ['el-pr-2', 'os-e0d636e0'], gain: 'öznel / yazar tutumu', note: 'TYT Paragraf’ta öznel-nesnel zaten var; MEB tanım cümlesi yok.' },
] as const;

/** Resmî TDK yazım sayfası bu turda çekildi ve doğru şıkkı destekliyor. */
export const TDK_FETCHED_PAGES = [
  'https://tdk.gov.tr/icerik/yazim-kurallari/soru-eki-mi-mi-mu-munun-yazilisi/',
  'https://tdk.gov.tr/icerik/yazim-kurallari/baglac-olan-da-denin-yazilisi/',
  'https://tdk.gov.tr/icerik/yazim-kurallari/baglac-olan-kinin-yazilisi/',
  'https://tdk.gov.tr/icerik/yazim-kurallari/buyuk-harflerin-kullanildigi-yerler/',
  'https://tdk.gov.tr/icerik/yazim-kurallari/noktalama-isaretleri-aciklamalar/',
] as const;

export const SOURCE_CLAIMS: SourceClaimRow[] = [
  { id: 'qf-1-tr-mi', topic: '1. Sınıf|Türkçe|Okuma yazma', claim: 'Soru eki mi/mı/mu/mü ayrı yazılır (gittin mi).', officialSource: 'TDK Yazım: soru eki', kind: 'tdk_yazim', status: 'source_verified', pageUrl: TDK_FETCHED_PAGES[0], verifiedAt: '2026-10-13', verifiedClaim: 'Bu ek gelenekleşmiş olarak ayrı yazılır.' },
  { id: 'qf-n005', topic: '1. Sınıf|Türkçe|Okuma yazma', claim: 'Cümle ve yer adı (Ankara) büyük harfle başlar.', officialSource: 'TDK Yazım: büyük harf', kind: 'tdk_yazim', status: 'source_verified', pageUrl: TDK_FETCHED_PAGES[3], verifiedAt: '2026-10-13', verifiedClaim: 'Cümle büyük harfle başlar; yer adları büyük harfle başlar.' },
  { id: 'qf-2-tr-ana', topic: '2. Sınıf|Türkçe|Okuduğunu anlama', claim: 'Metnin bütününden çıkan temel yargı = ana fikir.', officialSource: 'MEB Türkçe öğretim programı / ders kitabı tanımı', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n009', topic: '2. Sınıf|Türkçe|Yazım', claim: '“her şey” ayrı yazılır.', officialSource: 'TDK Yazım: ayrı yazılan birleşik kelimeler', kind: 'tdk_yazim', status: 'needs_source_verification', pageUrl: 'https://tdk.gov.tr/icerik/yazim-kurallari/ayri-yazilan-birlesik-kelimeler/', blockReason: 'Sayfa çekildi; “her şey” madde olarak geçmiyor.' },
  { id: 'qf-n010', topic: '2. Sınıf|Türkçe|Yazım', claim: 'Bağlaç da/de ayrı yazılır, ta/te olmaz (“O da geldi”).', officialSource: 'TDK Yazım: bağlaç da/de', kind: 'tdk_yazim', status: 'source_verified', pageUrl: TDK_FETCHED_PAGES[1], verifiedAt: '2026-10-13', verifiedClaim: 'Bağlaç olan da/de ayrı yazılır; ta/te biçiminde yazılmaz.' },
  { id: 'qf-n014', topic: '3. Sınıf|Türkçe|Paragraf', claim: 'Bakım → büyüme ana ileti / neden-sonuç okuması.', officialSource: 'MEB Türkçe paragraf / anlam (özgün kök; kitap cümlesi değil)', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n015', topic: '3. Sınıf|Türkçe|Paragraf', claim: '“çünkü” gerekçe / neden-sonuç bağlar.', officialSource: 'TDK Güncel Türkçe Sözlük: çünkü', kind: 'tdk_sozluk', status: 'needs_source_verification' },
  { id: 'qf-n016', topic: '3. Sınıf|Türkçe|Paragraf', claim: 'Öyküde kahramanın eylemi = olay.', officialSource: 'MEB hikâye öğeleri (olay, kişi, yer, zaman)', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n017', topic: '3. Sınıf|Türkçe|Paragraf', claim: 'önce/sonra = zaman sırası.', officialSource: 'MEB anlatımda anlam ilişkileri', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-4-fen-kuvvet', topic: '4. Sınıf|Fen|Kuvvet', claim: 'Hareket veya şekil değiştiren etki = kuvvet.', officialSource: 'MEB Fen 2018 F.4.3.1.1', kind: 'meb_program', status: 'source_verified', pageUrl: MEB_FEN_2018, verifiedAt: '2026-10-14', verifiedClaim: 'Kuvvetin cisimlere hareket kazandırması ve şekillerini değiştirmesi.' },
  { id: 'qf-n018', topic: '4. Sınıf|Fen|Kuvvet', claim: 'Manyetik çekim temas gerektirmeyen kuvvettir.', officialSource: 'MEB Fen 2018 F.4.3.2', kind: 'meb_program', status: 'source_verified', pageUrl: MEB_FEN_2018, verifiedAt: '2026-10-14', verifiedClaim: 'Mıknatısın uyguladığı kuvvet temas gerektirmez.' },
  { id: 'qf-4-tr-goz', topic: '4. Sınıf|Türkçe|Paragraf', claim: '“gözden kaçırmak” deyiminde göz mecazdır.', officialSource: 'TDK Atasözleri ve Deyimler Sözlüğü', kind: 'tdk_sozluk', status: 'needs_source_verification' },
  { id: 'qf-n022', topic: '4. Sınıf|Türkçe|Paragraf', claim: '“oysa” karşıtlık / beklenmeyeni belirtir.', officialSource: 'TDK Güncel Türkçe Sözlük: oysa', kind: 'tdk_sozluk', status: 'needs_source_verification' },
  { id: 'qf-n023', topic: '4. Sınıf|Türkçe|Paragraf', claim: 'Paragrafın ilk cümlesi konuyu açar.', officialSource: 'MEB paragraf / metin yapısı', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n024', topic: '4. Sınıf|Türkçe|Yazım-noktalama', claim: 'Soru cümlesinin sonuna soru işareti konur.', officialSource: 'TDK Yazım: noktalama / soru işareti', kind: 'tdk_yazim', status: 'source_verified', pageUrl: TDK_FETCHED_PAGES[4], verifiedAt: '2026-10-13', verifiedClaim: 'Soru eki veya sözü içeren cümlelerin sonuna soru işareti konur.' },
  { id: 'qf-n027', topic: '5. Sınıf|Fen|Kuvvetin ölçülmesi', claim: 'Kuvvet SI birimi newton (N).', officialSource: 'MEB Fen 2018 F.5.3.1.1', kind: 'meb_program', status: 'source_verified', pageUrl: MEB_FEN_2018, verifiedAt: '2026-10-14', verifiedClaim: 'Kuvvet birimi olarak Newton (N) kullanılır.' },
  { id: 'qf-n028', topic: '5. Sınıf|Fen|Kuvvetin ölçülmesi', claim: 'Dinamometre kuvvet ölçer.', officialSource: 'MEB Fen 2018 F.5.3.1.1', kind: 'meb_program', status: 'source_verified', pageUrl: MEB_FEN_2018, verifiedAt: '2026-10-14', verifiedClaim: 'Kuvvetin büyüklüğünü dinamometre ile ölçer.' },
  { id: 'qf-n029', topic: '5. Sınıf|Türkçe|Sözcükte anlam', claim: '“ince düşünce”de ince mecaz / niteliklidir.', officialSource: 'TDK Güncel Türkçe Sözlük: ince', kind: 'tdk_sozluk', status: 'needs_source_verification' },
  { id: 'qf-n030', topic: '5. Sınıf|Türkçe|Sözcükte anlam', claim: '“rahat bir nefes almak” deyimdir.', officialSource: 'TDK Atasözleri ve Deyimler Sözlüğü', kind: 'tdk_sozluk', status: 'needs_source_verification' },
  { id: 'qf-n031', topic: '5. Sınıf|Türkçe|Paragraf', claim: 'Yardımcı düşünce ana yargıyı örnekler / gerekçelendirir.', officialSource: 'MEB Türkçe paragraf', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n032', topic: '5. Sınıf|Türkçe|Yazım', claim: 'Bağlaç ki ayrı yazılır (“Bildi ki geldi”).', officialSource: 'TDK Yazım: bağlaç ki', kind: 'tdk_yazim', status: 'source_verified', pageUrl: TDK_FETCHED_PAGES[2], verifiedAt: '2026-10-13', verifiedClaim: 'Bağlaç olan ki ayrı yazılır.' },
  { id: 'qf-6-fen-isi', topic: '6. Sınıf|Fen|Madde ve ısı', claim: 'Isı alan katıda tanecik titreşimi artar.', officialSource: 'MEB 6. sınıf Fen: madde ve ısı', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n037', topic: '6. Sınıf|Fen|Madde ve ısı', claim: 'Isı enerjidir; sıcaklık ortalama kinetik enerjinin ölçüsüdür.', officialSource: 'MEB 6. sınıf Fen (ısı ≠ sıcaklık)', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n039', topic: '6. Sınıf|Türkçe|Paragraf', claim: 'Savı çürütmek için karşı gerekçe ve kanıt gerekir.', officialSource: 'MEB tartışmacı anlatım', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n044', topic: '7. Sınıf|Fen|Hücre ve mitoz', claim: 'Kalıtım maddesi başlıca çekirdektedir (ortaokul sadeleştirmesi).', officialSource: 'MEB 7. sınıf Fen: hücre', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n045', topic: '7. Sınıf|Fen|Hücre ve mitoz', claim: 'Mitoz: kalıtım korunarak hücre sayısı artar (2 özdeş hücre).', officialSource: 'MEB 7. sınıf Fen: mitoz', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n046', topic: '7. Sınıf|Türkçe|Paragraf', claim: '“öte yandan” yeni / karşıt yön açar.', officialSource: 'TDK Güncel Türkçe Sözlük: öte yandan', kind: 'tdk_sozluk', status: 'needs_source_verification' },
  { id: 'qf-n047', topic: '7. Sınıf|Türkçe|Anlatım bozukluğu', claim: '“itirazım yok, ancak karşıyım” çelişen yargıdır.', officialSource: 'MEB anlatım bozukluğu', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-8-fen-p', topic: '8. Sınıf|Fen|Basınç', claim: 'Katı basıncı P = F / A.', officialSource: 'MEB Fen 2018 F.8.3.1', kind: 'meb_program', status: 'needs_source_verification', pageUrl: MEB_FEN_2018, blockReason: 'F.8.3.1 “Matematiksel bağıntılara girilmez”; P=F/A şıkkı programda yok. Kavramsal kopya: lgs-bs-1.' },
  { id: 'qf-n051', topic: '8. Sınıf|Fen|Basınç', claim: 'Kuvvet sabit, alan küçülünce katı basıncı artar.', officialSource: 'MEB Fen 2018 F.8.3.1.1', kind: 'meb_program', status: 'needs_source_verification', pageUrl: MEB_FEN_2018, blockReason: 'Kazanım değişken keşfi; artış yönü yazılmamış. Kavramsal kopya: s8-fn-1.' },
  { id: 'qf-n052', topic: '8. Sınıf|İnkılap Tarihi|Millî mücadele', claim: 'TBMM 23 Nisan 1920’de açıldı.', officialSource: 'MEB T.C. İnkılap Tarihi ders kitabı (tarih; tutanak ayrı)', kind: 'meb_tarih', status: 'needs_source_verification' },
  { id: 'qf-n053', topic: '8. Sınıf|Türkçe|Paragraf', claim: 'Somut örnek soyut yargıyı anlaşılır kılar.', officialSource: 'MEB örnekleme anlatım tekniği', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n054', topic: '8. Sınıf|Türkçe|Yazım-noktalama', claim: 'Soru eki mi içeren cümlenin sonuna soru işareti konur.', officialSource: 'TDK soru eki + noktalama', kind: 'tdk_yazim', status: 'source_verified', pageUrl: TDK_FETCHED_PAGES[0], verifiedAt: '2026-10-13', verifiedClaim: 'Soru eki ayrı; soru eki içeren cümle sonuna soru işareti.' },
  { id: 'qf-n058', topic: '9. Sınıf|Fizik|Hareket ve Kuvvet', claim: 'Net kuvvet 0 ise hız sabit kalır (Newton I).', officialSource: 'MEB 9. sınıf Fizik', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n070', topic: 'KPSS Genel Yetenek|Türkçe|Paragraf', claim: '“ancak” sınırlama / karşıtlık işlevi görür.', officialSource: 'TDK Güncel Türkçe Sözlük: ancak', kind: 'tdk_sozluk', status: 'needs_source_verification' },
  { id: 'qf-n071', topic: 'KPSS Genel Yetenek|Türkçe|Yazım-noktalama', claim: '“Nasılsınmı” yanlıştır; soru eki ayrıdır.', officialSource: 'TDK Yazım: soru eki', kind: 'tdk_yazim', status: 'source_verified', pageUrl: TDK_FETCHED_PAGES[0], verifiedAt: '2026-10-13', verifiedClaim: 'Soru eki ayrı yazılır.' },
  { id: 'qf-n072', topic: 'YKS TYT|Türkçe|Yazım ve noktalama', claim: 'Bağlaç “Sende gel” yanlış; “Sen de gel” doğru.', officialSource: 'TDK Yazım: bağlaç da/de', kind: 'tdk_yazim', status: 'source_verified', pageUrl: TDK_FETCHED_PAGES[1], verifiedAt: '2026-10-13', verifiedClaim: 'Bağlaç da/de ayrı yazılır.' },
  { id: 'qf-n073', topic: 'YKS TYT|Türkçe|Paragraf', claim: 'Öznel anlatım yazar yorumu / değerlendirmesidir.', officialSource: 'MEB Türkçe T.8.3.21.b', kind: 'meb_program', status: 'needs_source_verification', blockReason: 'Öznel/nesnel tespit kazanımı var; “yazar yorumu” tanımı yok. Kavramsal yakın: el-pr-2, os-e0d636e0.' },
  { id: 'qf-n081', topic: '3. Sınıf|Fen|Beş duyu', claim: 'Koku organı burundur.', officialSource: 'MEB 3. sınıf Fen: duyu organları', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n082', topic: '3. Sınıf|Fen|Madde', claim: 'Kaynama / buharlaşma: sıvı → gaz.', officialSource: 'MEB 3. sınıf Fen: madde hâlleri', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n083', topic: '5. Sınıf|Fen|Işık', claim: 'Saydam olmayan cismin arkasında gölge oluşur.', officialSource: 'MEB Fen 2018 F.5.5.3–F.5.5.4', kind: 'meb_program', status: 'source_verified', pageUrl: MEB_FEN_2018, verifiedAt: '2026-10-14', verifiedClaim: 'Saydam olmayan maddeler; tam gölgenin nasıl oluştuğu.' },
  { id: 'qf-n085', topic: '1. Sınıf|Hayat Bilgisi|Sağlığımız', claim: 'Dişler günde en az iki kez fırçalanır.', officialSource: 'MEB Hayat Bilgisi HB.1.3.1', kind: 'meb_program', status: 'needs_source_verification', pageUrl: 'https://mufredat.meb.gov.tr/Dosyalar/2018122171428547-HAYAT%20B%C4%B0LG%C4%B0S%C4%B0%C3%96%C4%9ERET%C4%B0M%20PROGRAMI.pdf', blockReason: '“Dişleri usulüne uygun fırçalama” var; “günde en az iki kez” yok.' },
  { id: 'qf-n095', topic: 'YKS TYT|Türkçe|Sözcükte anlam', claim: '“çetin iş”te çetin = zor / güç.', officialSource: 'TDK Güncel Türkçe Sözlük: çetin', kind: 'tdk_sozluk', status: 'needs_source_verification' },
  { id: 'qf-n096', topic: '6. Sınıf|Türkçe|Yazım', claim: 'İlgi eki +ki bitişiktir (evdeki); bağlaç ki ayrıdır.', officialSource: 'TDK Yazım: ilgi eki -ki (bu turda sayfa bulunamadı) + bağlaç ki', kind: 'tdk_yazim', status: 'needs_source_verification' },
  { id: 'qf-n097', topic: '4. Sınıf|Fen|Vücudumuz', claim: 'Kanı pompalayan organ kalptir.', officialSource: 'MEB 4. sınıf Fen: vücudumuz', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n098', topic: '7. Sınıf|Fen|Kuvvet ve enerji', claim: 'Çekül yerçekimi / düşey doğrultuyu gösterir.', officialSource: 'MEB 7. sınıf Fen: kuvvet', kind: 'meb_program', status: 'needs_source_verification' },
  { id: 'qf-n099', topic: '8. Sınıf|Fen|Basit makineler', claim: 'Kaldıraçta kuvvet kolu uzarsa gereken kuvvet azalır.', officialSource: 'MEB 8. sınıf Fen: basit makineler', kind: 'meb_program', status: 'needs_source_verification' },
];

/** 2026-10-14: kalan 34 iddia. Durum needs_source_verification kalır; sözlük/ders kitabı doğrulanmış sayılmaz. */
export const PENDING_SOURCE_REVIEWS = [
  { id: 'qf-2-tr-ana', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null as string | null, note: 'MEB ders kitabı yok; program “ana fikir = temel yargı” cümlesini vermiyor.' },
  { id: 'qf-n009', kind: 'tdk_yazim' as const, officialClass: 'tdk_yazim', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'TDK ayrı yazılan birleşik kelimeler çekildi; “her şey” madde değil.', pageUrl: 'https://tdk.gov.tr/icerik/yazim-kurallari/ayri-yazilan-birlesik-kelimeler/' },
  { id: 'qf-n014', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Özgün kök; kitap cümlesi değil. Program doğru şıkkı yazmıyor.' },
  { id: 'qf-n015', kind: 'tdk_sozluk' as const, officialClass: 'tdk_sozluk', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'sozluk.gov.tr 500; madde metni yok.' },
  { id: 'qf-n016', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Hikâye öğeleri kazanımı varsayımı; resmî tanım cümlesi yok.' },
  { id: 'qf-n017', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Zaman sırası ilişki adı programda bu şıkla yazılmamış.' },
  { id: 'qf-4-tr-goz', kind: 'tdk_sozluk' as const, officialClass: 'tdk_sozluk', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Atasözleri ve Deyimler Sözlüğü çekilmedi.' },
  { id: 'qf-n022', kind: 'tdk_sozluk' as const, officialClass: 'tdk_sozluk', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'sozluk.gov.tr “oysa” maddesi yok.' },
  { id: 'qf-n023', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Giriş cümlesi işlevi program tanımı olarak yok.' },
  { id: 'qf-n029', kind: 'tdk_sozluk' as const, officialClass: 'tdk_sozluk', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'sozluk.gov.tr “ince” maddesi yok.' },
  { id: 'qf-n030', kind: 'tdk_sozluk' as const, officialClass: 'tdk_sozluk', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Deyim sözlüğü çekilmedi.' },
  { id: 'qf-n031', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Yardımcı düşünce tanımı kitap/program cümlesi olarak yok.' },
  { id: 'qf-6-fen-isi', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'F.6.4.1 tanecikli/hareketli yapı var; “ısı alan katıda titreşim artar” yok.', pageUrl: MEB_FEN_2018 },
  { id: 'qf-n037', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'Isı≠sıcaklık F.5.4.3.1 (5. sınıf). 6. sınıf F.6.4.3 iletim/yalıtım; “ısı enerjidir…” cümlesi yok. Sınıf kayması.', pageUrl: MEB_FEN_2018 },
  { id: 'qf-n039', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Tartışmacı anlatım / çürütme tanımı çekilmedi.' },
  { id: 'qf-n044', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'F.7.2.1 DNA/gen/kromozom kavram; “kalıtım maddesi başlıca çekirdekte” yok.', pageUrl: MEB_FEN_2018 },
  { id: 'qf-n045', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'F.7.2.2 mitozun önemi/evreler; “2 özdeş hücre / kalıtım korunur” yok.', pageUrl: MEB_FEN_2018 },
  { id: 'qf-n046', kind: 'tdk_sozluk' as const, officialClass: 'tdk_sozluk', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'sozluk.gov.tr “öte yandan” yok.' },
  { id: 'qf-n047', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Anlatım bozukluğu / çelişen yargı tanımı yok.' },
  { id: 'qf-8-fen-p', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: 'F.8.3.1 matematiksel bağıntılara girilmez; soru P=F/A ister.', pageUrl: MEB_FEN_2018, note: 'Kavramsal kopya lgs-bs-1.' },
  { id: 'qf-n051', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'F.8.3.1.1 değişken keşfi; “alan küçülünce basınç artar” yönü yok. Kopya: s8-fn-1.', pageUrl: MEB_FEN_2018 },
  { id: 'qf-n052', kind: 'meb_tarih' as const, officialClass: 'meb_tarih', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'MEB İnkılap ders kitabı / tutanak yok. İnsan kuyruğuna alınmadı; tarih iddiası kaynak bekliyor.' },
  { id: 'qf-n053', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'Örnekleme tekniği tanım cümlesi yok.' },
  { id: 'qf-n058', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'MEB Fizik 9.3.3.1 dengelenmiş kuvvet–hareket; “net kuvvet 0 ⇒ hız sabit” cümlesi yok.', pageUrl: 'https://mufredat.meb.gov.tr/Dosyalar/201812103112910-orta%C3%B6%C4%9Fretim_fizik_son.pdf' },
  { id: 'qf-n070', kind: 'tdk_sozluk' as const, officialClass: 'tdk_sozluk', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'sozluk.gov.tr “ancak” yok.' },
  { id: 'qf-n073', kind: 'meb_program' as const, officialClass: 'meb_program', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'T.8.3.21.b öznel/nesnel tespit; “yazar yorumu” tanımı yok. Yakın: el-pr-2, os-e0d636e0.' },
  { id: 'qf-n081', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'F.3.2.1 burun kavram listesinde; “koku organı burundur” yazılmamış. Yapısal ayrıntıya girilmez.', pageUrl: MEB_FEN_2018 },
  { id: 'qf-n082', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: '3. sınıf F.3.4.2 hâlleri sınıflandırır, hâl değişimine girmez; kaynama F.5.4’tedir.', pageUrl: MEB_FEN_2018, note: 'Doğru şık 3. sınıf programında yok.' },
  { id: 'qf-n085', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: 'HB.1.3.1 usulüne uygun fırçalama; “günde en az iki kez” yok.', pageUrl: 'https://mufredat.meb.gov.tr/Dosyalar/2018122171428547-HAYAT%20B%C4%B0LG%C4%B0S%C4%B0%C3%96%C4%9ERET%C4%B0M%20PROGRAMI.pdf', note: 'Sıklık iddiası programda yok.' },
  { id: 'qf-n095', kind: 'tdk_sozluk' as const, officialClass: 'tdk_sozluk', reached: false, supportsCorrectAnswer: false, contradiction: null, note: 'sozluk.gov.tr “çetin” yok.' },
  { id: 'qf-n096', kind: 'tdk_yazim' as const, officialClass: 'tdk_yazim', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'Bağlaç ki ayrı (tdk.gov.tr + yazim.tdk.gov.tr). İlgi eki -ki sayfası 404. Aitlik eki ünlü uyumunda anılır; “evdeki bitişik” karşıtı tam değil.', pageUrl: 'https://tdk.gov.tr/icerik/yazim-kurallari/baglac-olan-kinin-yazilisi/' },
  { id: 'qf-n097', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: 'Kalp/dolaşım F.6.2.3 (6. sınıf); 4. sınıf Fen “kanı pompalayan organ” yazmıyor.', pageUrl: MEB_FEN_2018, note: 'Sınıf kayması.' },
  { id: 'qf-n098', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: null, note: 'F.7.3.1 yer çekimi/ağırlık; çekül aracı yok.', pageUrl: MEB_FEN_2018 },
  { id: 'qf-n099', kind: 'meb_program' as const, officialClass: 'meb_program', reached: true, supportsCorrectAnswer: false, contradiction: 'F.8.5.1.1.ç matematiksel bağıntılara girilmez; kuvvet kolu–kuvvet ters bağıntısı yazılmamış.', pageUrl: MEB_FEN_2018, note: 'Avantaj örnekleri var, nicel iddia yok.' },
] as const;

export const SOURCE_CONTRADICTIONS = PENDING_SOURCE_REVIEWS.filter((r) => r.contradiction);

export const HUMAN_CLAIMS: SourceClaimRow[] = [
  { id: 'qf-n038', topic: '6. Sınıf|Sosyal|İpek Yolu', claim: 'İpek Yolu başlıca ticaret ve kültür alışverişi ağıdır.', officialSource: 'MEB 6. sınıf Sosyal Bilgiler + tarihî coğrafya', kind: 'meb_tarih', status: 'needs_human' },
  { id: 'qf-8-ink-mm', topic: '8. Sınıf|İnkılap Tarihi|Millî mücadele', claim: 'Misak-ı Millî son Osmanlı Mebusan Meclisinde (28 Ocak 1920) kabul edildi.', officialSource: 'MEB İnkılap Tarihi + meclis tutanağı / resmî tarih', kind: 'meb_tarih', status: 'needs_human' },
];

export type PendingMappingNote = {
  addQualityId: string;
  topic: string;
  action: 'replace_filler' | 'add_if_no_filler';
  dropFillerId: string | null;
  verdict: 'bekle' | 'ekleme';
  reason: string;
  requirement: string;
  levelOk: boolean;
  nearBankIds: string[];
};

export function pendingMappingNotes(bank: Record<string, BankQuestion[]>): PendingMappingNote[] {
  const plan = proposeQualityMerge(bank);
  const wanted = new Set(['qf-n038', 'qf-8-ink-mm', 'qf-n049', 'qf-8-fen-p', 'qf-n051', 'qf-n073']);
  const extra: Record<string, Pick<PendingMappingNote, 'verdict' | 'reason' | 'requirement' | 'levelOk' | 'nearBankIds'>> = {
    'qf-n038': {
      verdict: 'bekle',
      reason: 'İnsan teyidi; değiştirme yok.',
      requirement: 'MEB 6. sınıf Sosyal + tarihî İpek Yolu tanımının sahip onayı.',
      levelOk: true,
      nearBankIds: [],
    },
    'qf-8-ink-mm': {
      verdict: 'bekle',
      reason: 'İnsan teyidi; değiştirme yok.',
      requirement: 'MEB İnkılap + 28 Ocak 1920 Mebusan kabulünün tutanak/ders kitabı teyidi.',
      levelOk: true,
      nearBankIds: ['os-ad1b9320'],
    },
    'qf-n049': {
      verdict: 'bekle',
      reason: 'Paketteki önceki iki üslü madde konudaki doldurmaları aldı; 5⁰ için sıra dolunca drop yok. Soru seviye uygun, tam parmak izi çakışması yok. Ekleme toplamı 7007’yi artırır.',
      requirement: 'Sahip onayı: konu 53→54 ve toplam 7007→7008 kabulü. Zorla eklenmez.',
      levelOk: true,
      nearBankIds: [],
    },
    'qf-8-fen-p': {
      verdict: 'ekleme',
      reason: 'Doldurma yok ve lgs-bs-1 ile aynı iddia (P=F/A formülü); kavramsal kopya.',
      requirement: 'Farklı nicelik/bağlam veya mevcut lgs-bs-1’in doldurma olmadığı için bu satır hiç eklenmez.',
      levelOk: true,
      nearBankIds: ['lgs-bs-1'],
    },
    'qf-n051': {
      verdict: 'ekleme',
      reason: 'Doldurma yok ve s8-fn-1 ile aynı iddia (alan küçülünce basınç artar).',
      requirement: 'Yeni kök veya bu eklemenin iptali. Zorla onay yok.',
      levelOk: true,
      nearBankIds: ['s8-fn-1', 'lgs-bs-13'],
    },
    'qf-n073': {
      verdict: 'ekleme',
      reason: 'Doldurma yok; TYT Paragraf’ta öznel/nesnel tutum soruları var. MEB ders kitabı çekilmedi.',
      requirement: 'Kaynak doğrulaması + yakın kök yoksa sahip onayı. Zorla eklenmez.',
      levelOk: true,
      nearBankIds: (bank['YKS TYT|Türkçe|Paragraf'] || [])
        .filter((q) => /öznel|kanımca|nesnel/i.test(q.q))
        .map((q) => q.id)
        .slice(0, 6),
    },
  };
  return plan.replacements.filter((r) => wanted.has(r.addQualityId)).map((r) => {
    const x = extra[r.addQualityId];
    return {
      addQualityId: r.addQualityId,
      topic: r.topic,
      action: r.action,
      dropFillerId: r.dropFillerId,
      ...x,
    };
  });
}

export function sourceAuditSummary() {
  const verified = SOURCE_CLAIMS.filter((c) => c.status === 'source_verified');
  const waitSource = SOURCE_CLAIMS.filter((c) => c.status === 'needs_source_verification');
  const items = QUALITY_FIX_ITEMS;
  const statusMismatch = items.filter((i) => {
    const claim = [...SOURCE_CLAIMS, ...HUMAN_CLAIMS].find((c) => c.id === i.row.id);
    if (!claim) return i.status !== 'machine_ok';
    return claim.status !== i.status;
  }).map((i) => i.row.id);
  return {
    formerSourceCited: 47,
    sourceVerified: verified.length,
    needsSourceVerification: waitSource.length,
    needsHuman: HUMAN_CLAIMS.map((c) => c.id),
    waitingSourceOrHuman: waitSource.length + HUMAN_CLAIMS.length,
    sozlukGovTrFetched: false,
    mebTextbookFetched: false,
    mebProgramFetched: true,
    conceptualOverlaps: CONCEPTUAL_OVERLAPS.length,
    pendingReviews: PENDING_SOURCE_REVIEWS.length,
    contradictions: SOURCE_CONTRADICTIONS.map((c) => c.id),
    statusMismatch,
    mergedIntoBank: QUALITY_FIX_META.mergedIntoBank,
  };
}

export function topicNonFillerCount(bank: Record<string, BankQuestion[]>, topic: string) {
  const list = bank[topic] || [];
  return {
    total: list.length,
    filler: list.filter(isFillerQuestion).length,
    nonFiller: list.filter((q) => !isFillerQuestion(q)).length,
  };
}
