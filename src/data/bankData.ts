import type { BankManifest, BankQuestion } from '../lib/types';
import { SCHOOL_CURRICULUM } from '../lib/curriculum';
import { q } from './bankQ';
import { SCHOOL_BANK } from './bankSchool';
import { KPSS_BANK, KPSS_CURRICULUM } from './bankKpss';

type Q = BankQuestion;

export const CURRICULUM: Record<string, Record<string, string[]>> = {
  ...Object.fromEntries(Object.entries(SCHOOL_CURRICULUM).filter(([k]) => k !== 'KPSS Adayı' && k !== 'Mezun / YKS')),
  'YKS TYT': {
    Türkçe: ['Sözcükte anlam', 'Cümlede anlam', 'Paragraf'],
    Matematik: ['Temel kavramlar', 'Üslü ve köklü sayılar', 'Problemler', 'Fonksiyon'],
    Geometri: ['Üçgenler', 'Çember'],
    Fen: ['Fizik', 'Kimya', 'Biyoloji'],
    Sosyal: ['Tarih', 'Coğrafya', 'Felsefe'],
  },
  'YKS AYT': {
    Matematik: ['Fonksiyonlar', 'Türev', 'İntegral'],
    Geometri: ['Analitik geometri'],
    'Türk Dili ve Edebiyatı': ['Divan edebiyatı', 'Cumhuriyet'],
    Tarih: ['Osmanlı', 'Millî mücadele'],
    Coğrafya: ['Türkiye coğrafyası'],
    Fizik: ['Hareket ve kuvvet'],
    Kimya: ['Atom ve periyodik sistem'],
    Biyoloji: ['Hücre'],
  },
  ...KPSS_CURRICULUM,
};

export const BANK: Record<string, Q[]> = {
  ...SCHOOL_BANK,
  ...KPSS_BANK,
  'YKS TYT|Türkçe|Sözcükte anlam': [
    q('ty-tr-1', 'Aşağıdaki cümlelerin hangisinde “ince” sözcüğü mecaz anlamda kullanılmıştır?', ['İnce bir iplikle düğüm attı.', 'İnce bir düşünceyle konuyu kapattı.', 'İnce kâğıdı ikiye katladı.', 'İnce yağmur camları ıslattı.', 'İnce bir tahta parçası kırıldı.'], 1, 'Mecaz kullanımda “ince”, fiziksel kalınlık değil; düşüncenin niteliğini belirtir.', 'Orta'),
    q('ty-tr-2', 'Aşağıdaki cümlelerin hangisinde deyim vardır?', ['Kapıyı ağır ağır kapadı.', 'Sınavdan sonra rahat bir nefes aldı.', 'Kitabı masanın üzerine koydu.', 'Sabah erken kalktı.', 'Yağmur bütün gün yağdı.'], 1, '“Rahat bir nefes almak” deyimdir; gerçek solunum değil, ferahlamayı anlatır.', 'Kolay'),
    q('ty-tr-3', '“Yüzeysel” sözcüğünün anlamca en yakını hangisidir?', ['derinlemesine', 'ayrıntılı', 'üstünkörü', 'kapsamlı', 'titiz'], 2, 'Yüzeysel; konuyu derinlemesine ele almayan, üstünkörü yaklaşımı karşılar.', 'Orta'),
    q('ty-tr-4', 'Hangisinde “kendi” sözcüğü dönüşlülük zamiri değildir?', ['Kendi kararını verdi.', 'Kendi evine döndü.', 'Kendi raporu masada duruyor.', 'Kendi kendini eleştirdi.', 'Kendi payına düşeni aldı.'], 2, '“Kendi raporu”nda “kendi” iyelik/belirtme işlevindedir, dönüşlülük zamiri değildir.', 'Zor'),
    q('ty-tr-5', '“Abartmak” fiilinin anlamca karşıtı hangisine daha yakındır?', ['büyütmek', 'olduğu gibi aktarmak', 'süslemek', 'çoğaltmak', 'vurgulamak'], 1, 'Abartmak, gerçeği olduğundan büyük göstermektir; karşıtı gerçeğe uygun aktarmaktır.', 'Orta'),
  ],
  'YKS TYT|Türkçe|Cümlede anlam': [
    q('ty-cm-1', '“Bu soruyu çözmek zaman ister.” cümlesinde asıl vurgulanan nedir?', ['Sorunun kolaylığı', 'Çözümün süre gerektirmesi', 'Zamanın azlığı', 'Sorunun yanlışlığı', 'Çözümün imkânsızlığı'], 1, 'Yargı, çözümün süreye bağlı olduğunu bildirir.', 'Kolay'),
    q('ty-cm-2', 'Hangisi koşul bildirir?', ['Yağmur yağdı, evde kaldık.', 'Çalışırsan netlerin artar.', 'Deneme zordu.', 'Kitabı okudum.', 'Sabah erken çıktı.'], 1, '“-rsan” eki koşul ilişkisi kurar.', 'Kolay'),
    q('ty-cm-3', '“Sadece net değil, süre de önemli.” cümlesinin anlamı hangisine yakındır?', ['Süre önemsizdir.', 'Yalnızca net yeterlidir.', 'Hem doğruluk hem hız değerlidir.', 'Süre neti belirlemez.', 'Net hiç önemli değildir.'], 2, '“Sadece … değil, … da” yapısı iki ögeyi birlikte önemser.', 'Orta'),
  ],
  'YKS TYT|Türkçe|Paragraf': [
    q('ty-pr-1', 'Bir paragrafın ana düşüncesi en güvenilir nasıl bulunur?', ['İlk kelimeye bakarak', 'Yazarın vermek istediği temel yargıya bakarak', 'Cümle sayısını sayarak', 'Noktalama işaretlerini tarayarak', 'Paragrafın uzunluğuna bakarak'], 1, 'Ana düşünce, metnin bütününden çıkan temel yargıdır.', 'Kolay'),
    q('ty-pr-2', 'Yardımcı düşünce ile ana düşünce arasındaki fark nedir?', ['Yardımcı düşünce metni destekler, ana düşünce omurgadır.', 'İkisi aynıdır.', 'Yardımcı düşünce her zaman ilk cümlededir.', 'Ana düşünce yalnızca örneklerde gizlidir.', 'Yardımcı düşünce konu dışıdır.'], 0, 'Yardımcı düşünceler ana yargıyı örnek, açıklama veya kanıtla destekler.', 'Orta'),
    q('ty-pr-3', 'Paragrafta “ancak” bağlacı çoğunlukla ne yapar?', ['Aynı yönde ek bilgi verir', 'Karşıtlık veya sınırlama getirir', 'Zaman bildirir', 'Soru sorar', 'Konuyu bitirir'], 1, '“Ancak” çoğu kullanımda karşıtlık/sınırlama bağlacıdır.', 'Kolay'),
  ],
  'YKS TYT|Matematik|Temel kavramlar': [
    q('ty-mt-1', '12 ve 18 sayılarının EBOB’u kaçtır?', ['2', '3', '6', '12', '36'], 2, '12=2²·3, 18=2·3² → ortak en büyük çarpan 2·3=6.', 'Kolay'),
    q('ty-mt-2', '12 ve 18 sayılarının EKOK’u kaçtır?', ['18', '24', '36', '54', '216'], 2, 'EKOK=2²·3²=36.', 'Kolay'),
    q('ty-mt-3', '√(49) + 3² işleminin sonucu kaçtır?', ['10', '16', '58', '13', '15'], 1, '7+9=16.', 'Kolay'),
    q('ty-mt-4', 'Bir sayının %20’si 14 ise sayı kaçtır?', ['28', '56', '70', '84', '140'], 2, '0,2x=14 → x=70.', 'Orta'),
    q('ty-mt-5', '2x − 6 = 10 denkleminde x kaçtır?', ['2', '6', '8', '16', '4'], 2, '2x=16 → x=8.', 'Kolay'),
  ],
  'YKS TYT|Matematik|Üslü ve köklü sayılar': [
    q('ty-us-1', '2³ · 2² işleminin sonucu kaçtır?', ['2⁵', '2⁶', '4⁵', '8', '32'], 0, 'Aynı tabanda çarpımda üsler toplanır: 3+2=5.', 'Kolay'),
    q('ty-us-2', '(3²)³ kaçtır?', ['3⁵', '3⁶', '9³', '18', '27'], 1, 'Üs üssü çarpılır: 2·3=6 → 3⁶=729, şık 3⁶.', 'Orta'),
    q('ty-us-3', '√50 sadeleştirilmiş hali hangisidir?', ['5√2', '2√5', '25√2', '10√5', '√25·√2 değil'], 0, '√50=√(25·2)=5√2.', 'Orta'),
    q('ty-us-4', '8^(2/3) kaçtır?', ['2', '4', '16', '32', '64'], 1, '8^(1/3)=2, karesi 4.', 'Zor'),
  ],
  'YKS TYT|Matematik|Problemler': [
    q('ty-pb-1', 'Bir işi Ali 6 günde, Veli 12 günde bitiriyor. Birlikte kaç günde bitirirler?', ['3', '4', '5', '8', '9'], 1, '1/6+1/12=1/4 → 4 gün.', 'Orta'),
    q('ty-pb-2', 'Saatte 60 km giden araç 2,5 saatte kaç km gider?', ['120', '130', '140', '150', '180'], 3, '60·2,5=150.', 'Kolay'),
    q('ty-pb-3', 'Bir ürün %20 zam, ardından %20 indirim görürse net değişim nedir?', ['Değişmez', '%4 azalır', '%4 artar', '%20 azalır', '%40 azalır'], 1, '1,2·0,8=0,96 → %4 azalma.', 'Zor'),
  ],
  'YKS TYT|Matematik|Fonksiyon': [
    q('ty-fn-1', 'f(x)=2x+1 için f(3) kaçtır?', ['5', '6', '7', '8', '9'], 2, '2·3+1=7.', 'Kolay'),
    q('ty-fn-2', 'f(x)=x² için f(−2) kaçtır?', ['−4', '4', '−2', '2', '0'], 1, '(−2)²=4.', 'Kolay'),
    q('ty-fn-3', 'f(x)=3x−4 ve f(a)=5 ise a kaçtır?', ['1', '2', '3', '4', '5'], 2, '3a−4=5 → 3a=9 → a=3.', 'Orta'),
  ],
  'YKS TYT|Geometri|Üçgenler': [
    q('ty-uc-1', 'Bir üçgenin iç açıları toplamı kaç derecedir?', ['90', '120', '180', '270', '360'], 2, 'Öklid düzleminde üçgen iç açıları 180°’dir.', 'Kolay'),
    q('ty-uc-2', 'Kenarları 3, 4, 5 olan üçgen hangi türdedir?', ['Geniş açılı', 'Eşkenar', 'İkizkenar geniş', 'Dar ve eşkenar', 'Dik üçgen'], 4, '3²+4²=5² Pythagoras; dik üçgendir.', 'Kolay'),
    q('ty-uc-3', 'Eşkenar üçgende bir iç açı kaç derecedir?', ['30', '45', '60', '90', '120'], 2, '180/3=60.', 'Kolay'),
    q('ty-uc-4', 'İkizkenar üçgende taban açıları 50° ise tepe açısı kaçtır?', ['50', '60', '80', '100', '130'], 2, '50+50+x=180 → x=80.', 'Orta'),
  ],
  'YKS TYT|Geometri|Çember': [
    q('ty-cb-1', 'Yarıçapı 7 olan çemberin çapı kaçtır?', ['7', '14', '21', '49', 'π7'], 1, 'Çap = 2r = 14.', 'Kolay'),
    q('ty-cb-2', 'Çevre açısı, gördüğü yayın ölçüsünün kaç katıdır?', ['Eşittir', 'Yarısıdır', 'İki katıdır', 'Üç katıdır', 'Dörde bölünür'], 1, 'Çevre açı, gördüğü yayın yarısıdır.', 'Orta'),
    q('ty-cb-3', 'Merkez açı 80° ise gördüğü yay kaç derecedir?', ['40', '80', '100', '160', '280'], 1, 'Merkez açı, gördüğü yaya eşittir.', 'Kolay'),
  ],
  'YKS TYT|Fen|Fizik': [
    q('ty-fz-1', 'Sürat, yolun süreye oranıdır. 120 m’yi 4 saniyede alan cismin ortalama sürati nedir?', ['20 m/s', '30 m/s', '40 m/s', '480 m/s', '16 m/s'], 1, '120/4=30 m/s.', 'Kolay'),
    q('ty-fz-2', 'Durgun bir cisme net kuvvet uygulanmazsa ne olur?', ['Hızlanır', 'Yavaşlar', 'Hareket durumu değişmez', 'Kütlesi artar', 'Yönü mutlaka değişir'], 2, 'Newton I: net kuvvet yoksa hareket durumu korunur.', 'Orta'),
    q('ty-fz-3', 'Ses boşlukta yayılır mı?', ['Evet, ışıktan hızlı', 'Evet, yavaş', 'Hayır, ortam gerekir', 'Yalnızca uzayda', 'Yalnızca suda'], 2, 'Ses mekanik dalgadır; boşlukta yayılmaz.', 'Kolay'),
  ],
  'YKS TYT|Fen|Kimya': [
    q('ty-km-1', 'Suyun formülü hangisidir?', ['HO', 'H2O', 'H2O2', 'CO2', 'NaCl'], 1, 'Su iki hidrojen ve bir oksijenden oluşur.', 'Kolay'),
    q('ty-km-2', 'Atomun pozitif yüklü taneciği hangisidir?', ['Elektron', 'Nötron', 'Proton', 'Molekül', 'İyon değil, proton'], 2, 'Proton +1 yüklüdür.', 'Kolay'),
    q('ty-km-3', 'Periyodik tabloda aynı grupta bulunan elementler için hangisi doğrudur?', ['Aynı proton sayısı', 'Benzer değerlik elektron sayısı / benzer kimyasal özellik', 'Aynı kütle numarası', 'Hepsi metaldir', 'Hepsi gazdır'], 1, 'Gruplar benzer değerlik elektron düzenine sahiptir.', 'Orta'),
  ],
  'YKS TYT|Fen|Biyoloji': [
    q('ty-by-1', 'Hücrenin kalıtım maddesi nerede bulunur (öteki çekirdekli hücrede)?', ['Mitokondri yalnızca', 'Çekirdek', 'Golgi', 'Koful', 'Hücre zarı'], 1, 'DNA’nın ana deposu çekirdektir (mitokondride de az DNA vardır; soru ana depo sorar).', 'Kolay'),
    q('ty-by-2', 'Fotosentezde üretilen gaz hangisidir?', ['Azot', 'Karbondioksit', 'Oksijen', 'Metan', 'Helyum'], 2, 'Fotosentez O2 açığa çıkarır.', 'Kolay'),
    q('ty-by-3', 'En küçük canlı birimi hangisidir?', ['Doku', 'Organ', 'Hücre', 'Sistem', 'Organizasyon'], 2, 'Hücre teorisine göre canlılığın temel birimi hücredir.', 'Kolay'),
  ],
  'YKS TYT|Sosyal|Tarih': [
    q('ty-ta-1', 'Malazgirt Savaşı hangi yılda yapılmıştır?', ['1071', '1299', '1453', '1517', '1571'], 0, '1071 Alparslan–Romen Diyojen.', 'Kolay'),
    q('ty-ta-2', 'İstanbul’un fethi hangi padişah dönemindedir?', ['Yavuz', 'Kanuni', 'Fatih Sultan Mehmet', 'Yıldırım', 'II. Mahmud'], 2, '1453 fetih Fatih dönemidir.', 'Kolay'),
    q('ty-ta-3', 'Kurtuluş Savaşı’nın fiilî başlangıcı hangisi kabul edilir?', ['Lozan', '19 Mayıs 1919 Samsun’a çıkış', 'Mondros', 'Sevr', 'Mudanya'], 1, '19 Mayıs 1919 millî mücadelenin simgesel başlangıcıdır.', 'Orta'),
  ],
  'YKS TYT|Sosyal|Coğrafya': [
    q('ty-cg-1', 'Türkiye hangi yarım kürelerdedir?', ['Güney ve batı', 'Kuzey ve doğu', 'Güney ve doğu', 'Yalnızca güney', 'Ekvator kuşağı'], 1, 'Türkiye kuzey yarım kürede ve Greenwich’in doğusundadır.', 'Orta'),
    q('ty-cg-2', 'İklimi en çok etkileyen faktörlerden biri hangisidir?', ['Nüfus yoğunluğu', 'Enlem', 'Plaka adı', 'Dil ailesi', 'Para birimi'], 1, 'Enlem, güneş ışınlarının geliş açısını belirler.', 'Kolay'),
    q('ty-cg-3', 'Akarsuyun denize döküldüğü yer nedir?', ['Kaynak', 'Yatak', 'Ağız', 'Delta her zaman', 'Vadi'], 2, 'Dökülme noktası ağızdır; delta birikim şeklidir.', 'Kolay'),
  ],
  'YKS TYT|Sosyal|Felsefe': [
    q('ty-fl-1', 'Bilginin kaynağını duyu deneyimine dayandıran yaklaşım hangisidir?', ['Rasyonalizm', 'Empirizm', 'Septisizm', 'Entüisyonizm', 'Dogmatizm'], 1, 'Empirizm bilgiyi deneyime bağlar.', 'Orta'),
    q('ty-fl-2', '“Bilinemeyeceğini savunmak” hangi tutuma yakındır?', ['Dogmatizm', 'Septisizm', 'Pozitivizm', 'Pragmatizm', 'Hümanizm'], 1, 'Septisizm kuşkuyu merkeze alır.', 'Orta'),
  ],
  'YKS AYT|Matematik|Fonksiyonlar': [
    q('ay-fn-1', 'f: ℝ→ℝ, f(x)=2x−3 birebir midir?', ['Hayır', 'Evet, doğrusal eğim sıfır değil', 'Yalnızca x>0 iken', 'Yalnızca tam sayılarda', 'Değil çünkü sabit'], 1, 'Eğimi 2 ≠ 0 olan doğru birebirdir.', 'Kolay'),
    q('ay-fn-2', '(f∘g)(x)=f(g(x)) ise g(x)=x+1, f(x)=x² iken (f∘g)(2) kaçtır?', ['3', '4', '9', '5', '8'], 2, 'g(2)=3, f(3)=9.', 'Kolay'),
    q('ay-fn-3', 'f(x)=x³−x fonksiyonu orijine göre simetrik midir (tek fonksiyon)?', ['Çift', 'Tek', 'Ne tek ne çift', 'Sabit', 'Periyodik zorunlu'], 1, 'f(−x)=−x³+x=−(x³−x)=−f(x).', 'Zor'),
  ],
  'YKS AYT|Matematik|Türev': [
    q('ay-tv-1', 'f(x)=x² türevi nedir?', ['x', '2x', '2', 'x²', '0'], 1, 'Kuvvet kuralı: 2x.', 'Kolay'),
    q('ay-tv-2', 'f(x)=sin x türevi nedir?', ['−sin x', 'cos x', 'tan x', '1/cos x', '−cos x'], 1, '(sin x)′=cos x.', 'Kolay'),
    q('ay-tv-3', 'f(x)=3x⁴−2x için f′(1) kaçtır?', ['10', '12', '8', '6', '14'], 0, 'f′=12x³−2 → 12−2=10.', 'Orta'),
  ],
  'YKS AYT|Matematik|İntegral': [
    q('ay-in-1', '∫ 2x dx belirsiz integrali nedir?', ['x²+C', '2x²+C', 'x+C', '2+C', 'ln|x|+C'], 0, '∫2x=x²+C.', 'Kolay'),
    q('ay-in-2', '∫₀¹ 3x² dx değeri kaçtır?', ['0', '1', '2', '3', '1/3'], 1, '[x³]₀¹=1.', 'Orta'),
    q('ay-in-3', 'Türev ile integral ilişkisi hangisidir?', ['Hiçbir ilişkileri yok', 'Analizin temel teoremi: integral türevlinin ters işlemidir', 'İntegral her zaman daha büyüktür', 'Türev her zaman sıfırdır', 'İkisi aynı işlemdir'], 1, 'Analizin temel teoremi.', 'Orta'),
  ],
  'YKS AYT|Geometri|Analitik geometri': [
    q('ay-ag-1', 'A(0,0) ve B(3,4) noktaları arası uzaklık kaçtır?', ['5', '7', '12', '1', '√7'], 0, '√(9+16)=5.', 'Kolay'),
    q('ay-ag-2', 'y=2x+1 doğrusunun eğimi kaçtır?', ['1', '2', '1/2', '−2', '0'], 1, 'y=mx+n biçiminde m=2.', 'Kolay'),
    q('ay-ag-3', 'x+y−4=0 doğrusu hangi noktadan geçer?', ['(0,0)', '(2,2)', '(4,4)', '(1,1)', '(3,0) değil  (1,3)'], 1, '2+2−4=0.', 'Orta'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|Divan edebiyatı': [
    q('ay-dv-1', 'Divan edebiyatında övgü amacıyla yazılan nazım biçimi hangisidir?', ['Masal', 'Kaside', 'Haiku', 'Serbest şiir', 'Mani'], 1, 'Kaside, övgü amacıyla yazılan Divan nazım biçimidir.', 'Orta'),
    q('ay-dv-2', 'Gazelin ilk beytine ne ad verilir?', ['Mahlas', 'Matla', 'Makta', 'Redif', 'Hane'], 1, 'Matla gazelin ilk beytidir.', 'Kolay'),
    q('ay-dv-3', 'Şairin mahlasını kullandığı beyit genellikle hangisidir?', ['İlk beyit', 'Son beyit (makta)', 'Orta beyit zorunlu', 'Nakarat', 'Serlevha'], 1, 'Makta mahlas beytidir.', 'Kolay'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|Cumhuriyet': [
    q('ay-cm-1', 'Millî Edebiyat’ın dil anlayışı hangisine yakındır?', ['Ağır Osmanlıca', 'Sade Türkçe', 'Yalnızca Fransızca', 'Latince terimler', 'Aruz zorunluluğu her metinde'], 1, 'Millî Edebiyat sade dil ve heceyi öne çıkarır.', 'Kolay'),
    q('ay-cm-2', 'Cumhuriyet döneminde köy gerçekliğini işleyen yazarlardan biri hangisidir?', ['Fuzûlî', 'Bâkî', 'Yaşar Kemal', 'Nedîm', 'Şeyh Galip'], 2, 'Yaşar Kemal Cumhuriyet dönemi romancısıdır.', 'Orta'),
  ],
  'YKS AYT|Tarih|Osmanlı': [
    q('ay-os-1', 'Osmanlı Devleti’nin kuruluş yılı geleneksel olarak hangisidir?', ['1071', '1299', '1453', '1517', '1683'], 1, '1299 geleneksel kuruluştur.', 'Kolay'),
    q('ay-os-2', 'Yavuz Sultan Selim döneminde Mısır’ın alınması hangi yılı işaret eder?', ['1453', '1517', '1571', '1699', '1839'], 1, '1517 Ridaniye sonrası hilafet tartışması.', 'Orta'),
  ],
  'YKS AYT|Tarih|Millî mücadele': [
    q('ay-mm-1', 'Amasya Genelgesi’nin özü hangisidir?', ['Saltanat güçlensin', 'Milletin bağımsızlığını yine milletin azmi kurtaracaktır', 'Manda kabul', 'Sevr uygulansın', 'TBMM kapatılsın'], 1, 'Amasya, millî irade vurgusudur.', 'Orta'),
    q('ay-mm-2', 'TBMM hangi yıl açılmıştır?', ['1919', '1920', '1923', '1924', '1938'], 1, '23 Nisan 1920.', 'Kolay'),
  ],
  'YKS AYT|Coğrafya|Türkiye coğrafyası': [
    q('ay-tc-1', 'Türkiye’nin en kalabalık kenti hangisidir?', ['Ankara', 'İzmir', 'İstanbul', 'Bursa', 'Antalya'], 2, 'İstanbul en kalabalık ildir.', 'Kolay'),
    q('ay-tc-2', 'Karadeniz ikliminin belirgin özelliği hangisidir?', ['Yıl boyu yağış, küçük sıcaklık farkı', 'Yalnızca kış yağışı', 'Çölleşme', 'Muson yağmuru', 'Kutup soğuğu'], 0, 'Karadeniz’de her mevsim yağış görülür.', 'Orta'),
  ],
  'YKS AYT|Fizik|Hareket ve kuvvet': [
    q('ay-hk-1', 'Kütlesi 2 kg cisme 10 N net kuvvet uygulanırsa ivme kaç m/s² olur?', ['2', '5', '8', '12', '20'], 1, 'a=F/m=10/2=5.', 'Kolay'),
    q('ay-hk-2', 'Yatay sürtünmesiz zeminde sabit hızla giden cismin net kuvveti nedir?', ['Ağırlığına eşit', 'Sıfır', 'Kütlesine eşit', 'ivme ile orantılı ve sıfır değil', 'Hava direncine eşit zorunlu'], 1, 'Sabit hız ⇒ a=0 ⇒ Fnet=0.', 'Orta'),
  ],
  'YKS AYT|Kimya|Atom ve periyodik sistem': [
    q('ay-at-1', 'Nötr bir atomda proton sayısı hangisine eşittir?', ['Nötron', 'Elektron', 'Kütle numarası her zaman', 'Grup numarası her zaman', 'Periyot numarası'], 1, 'Nötr atomda e⁻ = p⁺.', 'Kolay'),
    q('ay-at-2', 'İzotopların ortak özelliği nedir?', ['Aynı kütle numarası', 'Aynı proton sayısı, farklı nötron', 'Aynı nötron, farklı proton', 'Farklı element olmaları', 'Aynı fiziksel hâl zorunlu'], 1, 'İzotoplar aynı Z, farklı A.', 'Orta'),
  ],
  'YKS AYT|Biyoloji|Hücre': [
    q('ay-hc-1', 'Mitokondrinin temel görevi nedir?', ['Fotosentez', 'ATP üretimi', 'Protein paketleme yalnızca Golgi gibi', 'DNA’yı yok etmek', 'Su depolamak'], 1, 'Hücresel solunumla ATP üretir.', 'Kolay'),
    q('ay-hc-2', 'Bitki hücresinde olup hayvan hücresinde bulunmayan yapı hangisidir?', ['Çekirdek', 'Mitokondri', 'Hücre çeperi', 'Ribozom', 'Hücre zarı'], 2, 'Selüloz çeper bitkiye özgüdür.', 'Kolay'),
  ],
};

export function bundledManifest(): BankManifest {
  const slugify = (name: string) => name
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i').replaceAll('ğ', 'g').replaceAll('ü', 'u')
    .replaceAll('ş', 's').replaceAll('ö', 'o').replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const levels = Object.keys(CURRICULUM).map((name) => {
    const subjects = Object.keys(CURRICULUM[name]);
    return {
      name,
      slug: slugify(name),
      subjects: subjects.length,
      topics: subjects.reduce((n, s) => n + CURRICULUM[name][s].length, 0),
    };
  });
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    questionCount: Object.values(BANK).reduce((n, list) => n + list.length, 0),
    levels,
    curriculum: CURRICULUM,
  };
}

export function questionsForLevel(level: string): Record<string, Q[]> {
  const out: Record<string, Q[]> = {};
  for (const [key, list] of Object.entries(BANK)) {
    if (key.startsWith(`${level}|`)) out[key] = list;
  }
  return out;
}
