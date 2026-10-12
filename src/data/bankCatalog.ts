import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';
import { hash32 } from '../lib/util';

type Stem = [string, [string, string, string, string, string], number, string, string];

type Block = { match: string[]; items: Stem[] };

/**
 * Konu adına göre ÖSYM tarzı (5 şık) havuz.
 * Yeni madde: match listesine kelime, items’a [soru, şıklar, doğruIndex, açıklama, zorluk].
 */
export const BANK_CATALOG: Block[] = [
  { match: ['okuma yazma', 'sözcük dağarcığı', 'görsel okuma', 'kısa metin', 'hikâye'], items: [
    ['“Elma” sözcüğü hangi sesle başlar?', ['a', 'e', 'ı', 'o', 'u'], 1, 'Elma /e/ ile başlar.', 'Kolay'],
    ['Kısa metinde “ne oldu?” sorusunun cevabı genelde hangisidir?', ['Yazarın adı', 'Olay', 'Sayfa numarası', 'Kapak rengi', 'Yayınevi'], 1, 'Olay, metindeki eylemdir.', 'Kolay'],
    ['Görselde dur işareti görülürse öğrenci ne yapmalıdır?', ['Koşmak', 'Durmak', 'Şarkı söylemek', 'Saymak', 'Boyamak'], 1, 'Görsel okuma: işaretin anlamı.', 'Kolay'],
  ]},
  { match: ['sayılar 1-20', 'sayılar 1-100', 'sayılar 1-1000', 'doğal sayılar', 'sayılar', 'temel kavramlar'], items: [
    ['13 sayısının basamak değerleri toplamı kaçtır?', ['1', '3', '4', '13', '31'], 2, '1+3=4.', 'Kolay'],
    ['En küçük iki basamaklı doğal sayı hangisidir?', ['0', '1', '9', '10', '11'], 3, '10’dur.', 'Kolay'],
    ['Bir doğal sayının 10 katı, o sayının sağına hangi rakam yazılarak bulunur?', ['1', '0', '2', '5', '9'], 1, '10 ile çarpınca sağa 0 gelir.', 'Orta'],
  ]},
  { match: ['toplama'], items: [
    ['8 + 7 işleminin sonucu kaçtır?', ['14', '15', '16', '17', '18'], 1, '8+7=15.', 'Kolay'],
    ['Toplamada toplananların yerinin değişmesi sonucu değiştirmez. Bu hangi özelliktir?', ['Dağılma', 'Değişme', 'Birleşme değil tek başına', 'Etkisiz eleman', 'Ters eleman'], 1, 'Değişme özelliği.', 'Orta'],
  ]},
  { match: ['çıkarma'], items: [
    ['15 − 9 işleminin sonucu kaçtır?', ['4', '5', '6', '7', '8'], 2, '15−9=6.', 'Kolay'],
    ['Bir çıkarma işleminde eksilen 20, çıkan 8 ise fark kaçtır?', ['10', '12', '18', '28', '8'], 1, '20−8=12.', 'Kolay'],
  ]},
  { match: ['çarpma', 'çarpma girişi', 'çarpma-bölme', 'işlemler', 'işlem'], items: [
    ['6 × 4 işleminin sonucu kaçtır?', ['10', '18', '20', '24', '30'], 3, '6+6+6+6=24.', 'Kolay'],
    ['Çarpmada etkisiz eleman hangisidir?', ['0', '1', '2', '10', '−1'], 1, 'a·1=a.', 'Orta'],
  ]},
  { match: ['kesir', 'kesirler', 'kesir girişi'], items: [
    ['Bir bütünün 3 eşit parçasından 2’si hangi kesirle gösterilir?', ['2/5', '3/2', '2/3', '1/3', '3/3'], 2, 'Pay alınan, payda bütün.', 'Kolay'],
    ['1/2 ile 3/6 için hangisi doğrudur?', ['1/2 büyüktür', '3/6 büyüktür', 'Denktirler', 'Toplam 1/8', 'Kesir değildir'], 2, '3/6=1/2.', 'Orta'],
    ['2/5 + 1/5 kaçtır?', ['1/5', '3/5', '3/10', '1', '2/10'], 1, 'Paydalar eşit: 3/5.', 'Kolay'],
  ]},
  { match: ['ondalık'], items: [
    ['0,3 kesir olarak hangisine eşittir?', ['3/10', '3/100', '1/3', '30/10', '3/5'], 0, 'Ondalık bir basamak: payda 10.', 'Orta'],
    ['1,2 + 0,8 kaçtır?', ['1,0', '2,0', '1,10', '20', '0,20'], 1, '1,2+0,8=2.', 'Kolay'],
  ]},
  { match: ['yüzde', 'yüzdeler', 'yüzde-faiz'], items: [
    ['Bir sayının %10’u o sayının kaçta kaçıdır?', ['1/5', '1/10', '1/2', '10/1', '1/100'], 1, '%10=10/100=1/10.', 'Kolay'],
    ['200 liranın %25’i kaç liradır?', ['25', '40', '50', '75', '100'], 2, '200·1/4=50.', 'Orta'],
  ]},
  { match: ['oran', 'oran-orantı', 'orantı'], items: [
    ['2/3 oranı 8/? ile denkse ? kaçtır?', ['10', '12', '16', '24', '6'], 1, '2/3=8/x → x=12.', 'Orta'],
    ['Harita ölçeği 1:100 000 ise haritada 2 cm yerde kaç km’dir?', ['1', '2', '20', '200', '0,2'], 1, '2 cm → 200 000 cm = 2 km.', 'Zor'],
  ]},
  { match: ['ebob', 'çarpan', 'çarpanlar katlar', 'bölünebilme'], items: [
    ['12 ve 18 sayılarının EBOB’u kaçtır?', ['2', '3', '6', '12', '36'], 2, '2·3=6.', 'Orta'],
    ['Bir sayı 2 ve 5 ile bölünüyorsa 10 ile de bölünür. Bu yargı hangisidir?', ['Yanlış', 'Doğru, 2 ile 5 aralarında asaldır', 'Yalnızca teklerde', 'Yalnızca negatifte', 'Hiçbir zaman'], 1, 'Aralarında asal bölenlerin çarpımı.', 'Zor'],
    ['3 ile bölünebilme kuralı hangisidir?', ['Son rakam çift', 'Rakamlar toplamı 3’ün katı', 'Son iki basamak 3', 'Baştaki rakam 3', 'Tek basamaklı olmak'], 1, 'Klasik kural.', 'Kolay'],
  ]},
  { match: ['üslü', 'köklü', 'karekök', 'kareköklü'], items: [
    ['2³ · 2² işleminin sonucu hangisidir?', ['2⁵', '2⁶', '4⁵', '8', '16'], 0, 'Taban aynı, üsler toplanır.', 'Orta'],
    ['√49 değeri kaçtır? (asal olmayan karekök)', ['5', '6', '7', '8', '9'], 2, '7²=49.', 'Kolay'],
    ['√50 sadeleştirilmiş hali hangisidir?', ['5√2', '2√5', '25√2', '10√5', '√25'], 0, '√(25·2)=5√2.', 'Orta'],
  ]},
  { match: ['denklem', 'eşitlik', 'eşitlik-denklem', 'ikinci dereceden', 'ikinci dereceden denklemler'], items: [
    ['2x + 4 = 10 denkleminde x kaçtır?', ['2', '3', '4', '5', '6'], 1, '2x=6 → x=3.', 'Orta'],
    ['x² − 5x + 6 = 0 kökleri toplamı kaçtır?', ['−5', '5', '6', '1', '0'], 1, 'Vieta: −b/a=5.', 'Zor'],
    ['(x−1)(x+1)=0 kökleri hangisidir?', ['Yalnız 1', 'Yalnız −1', '1 ve −1', '0', '2'], 2, 'x=1 veya x=−1.', 'Orta'],
  ]},
  { match: ['eşitsizlik', 'eşitsizlikler', 'denklem ve eşitsizlik'], items: [
    ['2x − 4 < 6 eşitsizliğinin çözümü hangisidir?', ['x < 5', 'x > 5', 'x < 1', 'x > 1', 'x = 5'], 0, '2x<10 → x<5.', 'Orta'],
    ['x² ≥ 0 eşitsizliği gerçek sayılarda hangisidir?', ['Yalnız x>0', 'Her x için doğru', 'Yalnız x=0', 'Hiçbir x', 'Yalnız tam sayılar'], 1, 'Kare negatif olmaz.', 'Zor'],
  ]},
  { match: ['küme', 'kümeler'], items: [
    ['A={1,2,3} kümesinin eleman sayısı kaçtır?', ['2', '3', '4', '6', '1'], 1, '|A|=3.', 'Kolay'],
    ['A∩B, A ve B’nin hangisidir?', ['Birleşimi', 'Kesişimi', 'Farkı', 'Tümleyen', 'Kartezyen'], 1, 'Ortak elemanlar.', 'Kolay'],
  ]},
  { match: ['fonksiyon', 'fonksiyonlar', 'fonksiyonlarda uygulamalar', 'üstel ve logaritmik'], items: [
    ['f(x)=2x+1 için f(3) kaçtır?', ['5', '6', '7', '8', '9'], 2, '2·3+1=7.', 'Kolay'],
    ['Bire bir fonksiyon için hangisi doğrudur?', ['Her görüntüye birden fazla girdi', 'Farklı girdiler farklı görüntü', 'Sabit olmak zorunlu', 'Türev sıfır', 'Tanım kümesi boş'], 1, 'injective.', 'Zor'],
    ['f(x)=aˣ (a>0, a≠1) hangisidir?', ['Doğrusal', 'Üstel', 'Parabol zorunlu', 'Ters orantı', 'Sabit'], 1, 'Üstel fonksiyon.', 'Orta'],
  ]},
  { match: ['polinom', 'polinomlar', 'özdeşlik'], items: [
    ['2x²+3x−1 ifadesinin derecesi kaçtır?', ['1', '2', '3', '0', '−1'], 1, 'En büyük kuvvet 2.', 'Kolay'],
    ['(a+b)² özdeşliği hangisidir?', ['a²+b²', 'a²+2ab+b²', 'a²−2ab+b²', '2ab', 'a²−b²'], 1, 'Tam kare.', 'Orta'],
  ]},
  { match: ['parabol'], items: [
    ['y=x²−4x+3 parabolünün tepe noktası absisi kaçtır?', ['1', '2', '3', '4', '−2'], 1, 'x=−b/2a=4/2=2.', 'Zor'],
    ['Parabolün x eksenini kestiği noktalar hangisidir?', ['Kökler', 'Tepe ordinatı', 'Yalnız simetri', 'Odak', 'Doğrultman'], 0, 'f(x)=0 kökler.', 'Orta'],
  ]},
  { match: ['trigonometri'], items: [
    ['sin²x + cos²x değeri kaçtır?', ['0', '1', '2', 'sin 2x', 'tan x'], 1, 'Temel özdeşlik.', 'Kolay'],
    ['tan x = sin x / ? boşluğu hangisidir?', ['cos x', 'cot x', '1', 'sec x', 'x'], 0, 'tan=sin/cos.', 'Kolay'],
    ['sin 2x hangisine eşittir?', ['2 sin x', '2 sin x cos x', 'sin²x', 'cos 2x', '1/2 sin x'], 1, 'Çift açı.', 'Zor'],
  ]},
  { match: ['logaritma', 'üstel'], items: [
    ['log₁₀ 100 değeri kaçtır?', ['1', '2', '10', '100', '0'], 1, '10²=100.', 'Kolay'],
    ['log a + log b hangisine eşittir? (aynı taban, pozitif)', ['log(ab)', 'log(a+b)', 'log(a/b)', 'a log b', '0'], 0, 'Çarpım kuralı.', 'Orta'],
  ]},
  { match: ['dizi', 'diziler'], items: [
    ['2, 5, 8, 11… dizisinin genel terimi hangisidir?', ['3n−1', '2n', 'n+2', '3n', 'n²'], 0, 'aₙ=3n−1.', 'Orta'],
    ['Aritmetik dizide ortak fark sabittir. 3,7,11 için fark kaçtır?', ['3', '4', '5', '7', '2'], 1, '7−3=4.', 'Kolay'],
  ]},
  { match: ['limit', 'limit ve süreklilik'], items: [
    ['lim_{x→2} (x+3) değeri kaçtır?', ['2', '3', '5', '6', '0'], 2, 'Polinomda yerine koyma.', 'Kolay'],
    ['lim_{x→0} (sin x)/x değeri kaçtır?', ['0', '1', '∞', 'x', 'π'], 1, 'Standart limit.', 'Zor'],
  ]},
  { match: ['türev'], items: [
    ['f(x)=x² için f′(x) hangisidir?', ['x', '2x', '2', 'x²', '0'], 1, 'Kuvvet kuralı.', 'Kolay'],
    ['Türev geometrik olarak hangisidir?', ['Alan', 'Eğim (anlık değişim)', 'Hacim', 'Ortalama hız zorunlu her zaman', 'Kök'], 1, 'Teğet eğimi.', 'Orta'],
    ['f′(a)=0 ve f″(a)<0 ise x=a’da hangisi vardır?', ['Yerel min', 'Yerel max', 'Dönüm yok asla', 'Asimptot', 'Tanımsızlık'], 1, 'İkinci türev testi.', 'Zor'],
  ]},
  { match: ['integral'], items: [
    ['∫ 2x dx belirsiz integrali hangisidir?', ['x²+C', '2x+C', 'x+C', '2+C', 'x³+C'], 0, 'Türevin tersi.', 'Kolay'],
    ['Belirli integral geometrik olarak (pozitif fonksiyonda) hangisidir?', ['Eğim', 'Eğri altında alan', 'Kök sayısı', 'Asimptot', 'Tepe'], 1, 'Riemann toplamı.', 'Orta'],
  ]},
  { match: ['analitik'], items: [
    ['A(1,2) ve B(4,6) noktaları arası uzaklık kaçtır?', ['3', '4', '5', '6', '7'], 2, '√(9+16)=5.', 'Orta'],
    ['y=2x+1 doğrusunun eğimi kaçtır?', ['1', '2', '1/2', '−1', '0'], 1, 'y=mx+n formunda m.', 'Kolay'],
  ]},
  { match: ['üçgen', 'üçgenler', 'doğrular ve açılar', 'açılar'], items: [
    ['Bir üçgenin iç açıları toplamı kaç derecedir?', ['90', '120', '180', '270', '360'], 2, 'Euclid düzlemi.', 'Kolay'],
    ['İkizkenar üçgende taban açıları için hangisi doğrudur?', ['Farklıdır zorunlu', 'Eşittir', '90 olmak zorunda', '0 olabilir', 'Toplam 360'], 1, 'Eşit kenarlara komşu açılar eşit.', 'Orta'],
    ['Komşu bütünler iki açının toplamı kaçtır?', ['90', '180', '270', '360', '45'], 1, 'Doğrusal çift.', 'Kolay'],
  ]},
  { match: ['çember', 'çember ve daire'], items: [
    ['Çemberde yarıçap 5 ise çap kaçtır?', ['5', '10', '15', '25', 'π'], 1, 'Çap=2r.', 'Kolay'],
    ['Merkez açı, gördüğü yayın ölçüsüne hangisidir?', ['Eşittir', 'Yarısıdır', 'İkisidir', '90 fazlası', 'Teğet'], 0, 'Merkez açı = yay.', 'Orta'],
  ]},
  { match: ['çokgen', 'çokgenler', 'dörtgen', 'dörtgenler', 'çevre', 'alan'], items: [
    ['Karenin tüm açıları kaç derecedir?', ['60', '90', '120', '180', '45'], 1, 'Dik açı.', 'Kolay'],
    ['n kenarlı düzgün çokgende bir iç açı formülü hangisidir?', ['(n−2)·180/n', 'n·90', '360/n yalnızca merkez', '180/n', '2n'], 0, 'İç açılar toplamı (n−2)180.', 'Zor'],
  ]},
  { match: ['katı', 'katı cisimler', 'uzay geometri'], items: [
    ['Küpün 6 yüzü vardır. Kenar 2 ise hacim kaçtır?', ['6', '8', '12', '24', '4'], 1, '2³=8.', 'Orta'],
    ['Dikdörtgenler prizmasında hacim hangisidir?', ['a+b+c', 'abc', '2(ab+bc+ca)', 'a²', 'çevre'], 1, 'V=a·b·c.', 'Kolay'],
  ]},
  { match: ['olasılık', 'permutasyon', 'permütasyon', 'kombinasyon', 'veri', 'grafik ve tablo', 'grafik'], items: [
    ['Yazı-tura atışında tura gelme olasılığı nedir?', ['0', '1/4', '1/2', '1', '2'], 2, 'İki eşit çıktı.', 'Kolay'],
    ['5 kişinin sıraya dizilişi kaçtır?', ['5', '10', '25', '120', '60'], 3, '5!=120.', 'Orta'],
    ['Aritmetik ortalama, verilerin hangisidir?', ['En sık değer', 'Toplam/adet', 'Ortanca her zaman', 'En büyük', 'Açıklık'], 1, 'Ortalama tanımı.', 'Kolay'],
  ]},
  { match: ['saat', 'paralar', 'ölçme', 'problemler', 'sayı problemleri'], items: [
    ['Saat 3 iken akrep ile yelkovan arasındaki açı yaklaşık kaç derecedir?', ['0', '45', '90', '180', '30'], 2, 'Her saat 30°; 3·30=90.', 'Orta'],
    ['2 saat 30 dakika kaç dakikadır?', ['90', '120', '150', '180', '230'], 2, '120+30=150.', 'Kolay'],
  ]},
  { match: ['geometrik şekiller', 'geometri', 'dönüşümler'], items: [
    ['Üç kenarı olan kapalı şeklin adı nedir?', ['Kare', 'Üçgen', 'Daire', 'Beşgen', 'Küp'], 1, 'Üçgen.', 'Kolay'],
    ['Öteleme dönüşümü şeklin hangisini korur?', ['Yalnız rengi', 'Boyut ve biçim (eşlik)', 'Alanı sıfırlar', 'Kenar sayısını değiştirir zorunlu', 'Açıları 90 yapar'], 1, 'İzometri.', 'Orta'],
  ]},
  { match: ['tam sayılar', 'rasyonel', 'mutlak değer', 'cebir', 'cebirsel', 'cebir girişi'], items: [
    ['−3 + 5 işleminin sonucu kaçtır?', ['−8', '2', '8', '−2', '0'], 1, 'İşaretli toplama.', 'Kolay'],
    ['|−4| değeri kaçtır?', ['−4', '4', '0', '8', '1'], 1, 'Mutlak değer uzaklık.', 'Kolay'],
    ['3x + x ifadesi sadeleşince hangisidir?', ['3x', '4x', '3x²', 'x', '4'], 1, 'Benzer terimler.', 'Orta'],
  ]},
  { match: ['paragraf', 'cümlede anlam', 'sözcükte anlam', 'anlatım', 'okuduğunu anlama', 'yazılı anlatım', 'anlatım biçimleri', 'anlatım bozukluğu'], items: [
    ['Bir metinde yazarın asıl vermek istediği yargıya ne ad verilir?', ['Konu', 'Ana fikir', 'Olay örgüsü', 'Kişi kadrosu', 'Zaman'], 1, 'Ana fikir bütünün yargısıdır.', 'Orta'],
    ['Hangisi koşul bildirir?', ['Yağmur yağdı, evde kaldık.', 'Çalışırsan netin artar.', 'Deneme zordu.', 'Kitabı okudum.', 'Sabah çıktı.'], 1, '“-rsan” koşuldur.', 'Kolay'],
    ['Hangisinde deyim vardır?', ['Kapıyı kapadı.', 'Rahat bir nefes aldı.', 'Kitabı koydu.', 'Erken kalktı.', 'Yağmur yağdı.'], 1, 'Kalıplaşmış anlam.', 'Kolay'],
    ['Anlatım bozukluğunda “gereksiz sözcük” örneği hangisidir?', ['Geri iade etmek', 'Kitabı okudu', 'Yarın gelecek', 'Su içti', 'Kapı açık'], 0, 'İade zaten geri vermektir.', 'Zor'],
    ['Paragrafta “öznel anlatım” en çok hangisiyle belli olur?', ['Ölçülebilir veri', 'Değer yargısı ve izlenim', 'Tarih cümlesi', 'Tanım', 'Alıntı künyesi'], 1, 'Yazar tutumu sızar.', 'Orta'],
    ['“Çünkü / zira” bağlaçları hangi düşünceyi kurar?', ['Karşıtlık', 'Neden-sonuç', 'Örneksiz liste', 'Zaman atlama', 'Tanımsız geçiş'], 1, 'Gerekçe.', 'Kolay'],
    ['Konu ile ana fikir farkı hangisidir?', ['Aynıdır', 'Konu “ne”, ana fikir “ne denir”', 'Konu her zaman yargıdır', 'Ana fikir başlıktır zorunlu', 'Konu noktalamadır'], 1, 'Konu alan, fikir yargı.', 'Zor'],
    ['Hangisi karşılaştırma anlatımına örnektir?', ['Yağmur yağdı.', 'Lise, ortaokula göre daha yoğundur.', 'Kapı açık.', 'Su aktı.', 'Saat üç.'], 1, 'İki durum kıyaslanır.', 'Kolay'],
  ]},
  { match: ['yazım', 'noktalama', 'yazım-noktalama', 'yazım ve noktalama'], items: [
    ['Soru eki “mi” hangisinde doğru yazılmıştır?', ['Geldinmi', 'Geldin mi', 'Gel-dinmi', 'miGeldin', 'GeldinMi'], 1, 'Soru eki ayrı yazılır.', 'Kolay'],
    ['“Her şey” hangisinde doğru yazılmıştır?', ['herşey', 'her şey', 'her-şey', 'herş ey', 'herŞey'], 1, 'Ayrı yazılır.', 'Kolay'],
  ]},
  { match: ['dil bilgisi', 'fiilimsi', 'fiilimsiler', 'ögeleri', 'cümlenin ögeleri', 'çatı', 'fiil çatısı', 'ses bilgisi'], items: [
    ['Hangisinde sıfat-fiil (ortaç) vardır?', ['Kapıyı kapadı.', 'Okuyan öğrenciler sessizdi.', 'Yarın gelir.', 'Hava soğuk.', 'Bu bir kalem.'], 1, '“Okuyan” ortaçtır.', 'Orta'],
    ['“Kitabı masaya koydu.” cümlesinde “kitabı” ögesi hangisidir?', ['Özne', 'Belirtili nesne', 'Dolaylı tümleç', 'Zarf tümleci', 'Yüklem'], 1, 'Belirtme eki.', 'Orta'],
    ['Büyük ünlü uyumu neyi kontrol eder?', ['Noktalama', 'Ünlülerin kalınlık-incelik uyumu', 'Fiil çatısı', 'Paragraf boyu', 'Harita ölçeği'], 1, 'Kalın/ince ünlü.', 'Orta'],
  ]},
  { match: ['şiir', 'şiir bilgisi', 'divan', 'halk edebiyatı', 'tanzimat', 'servetifünun', 'fecriati', 'millî edebiyat', 'cumhuriyet', 'edebî akımlar', 'roman', 'tiyatro', 'masal', 'destan', 'hikâye', 'makale', 'sohbet', 'gezi', 'haber', 'dünya edebiyatı'], items: [
    ['Gazelde nazım birimi hangisidir?', ['Dörtlük zorunlu', 'Beyit', 'Bent yalnızca', 'Paragraf', 'Sahne'], 1, 'Beyit.', 'Orta'],
    ['Redif ile kafiye farkı hangisidir?', ['Redif ek/kelime tekrarı, kafiye ses benzerliği', 'İkisi aynıdır', 'Redif yalnızca aruzda', 'Kafiye hece yasağı', 'Redif uyak değildir asla'], 0, 'Klasik ayrım.', 'Zor'],
    ['Realizmde anlatıcı genelde nasıldır?', ['Aşırı öznel', 'Gözleme dayalı nesnel tutum', 'Tam masalsı', 'Yalnızca hece', 'Divan mazmunu'], 1, 'Gözlem.', 'Zor'],
  ]},
  { match: ['kuvvet', 'hareket', 'enerji', 'basınç', 'dalga', 'dalgalar', 'optik', 'elektrik', 'manyetizma', 'ısı', 'sıcaklık', 'madde', 'özkütle', 'modern fizik', 'atom fiziği', 'harmonik', 'çembersel', 'basit makineler', 'elektrik yükleri'], items: [
    ['Duran cisme kuvvet uygulanırsa hangisi değişebilir?', ['Kütle zorunlu artar', 'Hareket durumu', 'Atom numarası', 'Renk zorunlu', 'Sıcaklık her zaman 0'], 1, 'Newton I-II.', 'Kolay'],
    ['Özkütle formülü hangisidir?', ['m/V', 'V/m', 'm·V', 'm+V', 'F/a'], 0, 'd=m/V.', 'Orta'],
    ['Işık bir ortamdan diğerine geçerken yön değiştiriyorsa bu nedir?', ['Yansıma', 'Kırılma', 'Soğurulma yalnızca', 'Kırınım zorunlu her zaman', 'Girişim değil asla'], 1, 'Kırılma.', 'Orta'],
    ['Ohm yasası hangisidir?', ['V=I·R', 'P=mgh', 'F=kx', 'E=mc²', 'p=mv'], 0, 'Gerilim=akım·direnç.', 'Kolay'],
  ]},
  { match: ['hücre', 'canlı', 'fotosentez', 'kalıtım', 'dna', 'ekosistem', 'ekoloji', 'sistemler', 'enerji dönüşümleri', 'mitoz', 'gen', 'bitki', 'sindirim', 'dolaşım', 'duyu', 'beş duyu', 'güneş', 'dünya ve ay', 'mevsim', 'iklim', 'saf madde', 'karışım', 'asit', 'baz', 'tuz', 'gaz', 'organik', 'periyodik', 'atom', 'kimyasal', 'çözelti', 'tepkimeler'], items: [
    ['Hücrenin yönetim merkezi hangisidir?', ['Mitokondri', 'Çekirdek', 'Koful', 'Hücre zarı yalnızca', 'Ribozom değil DNA’sız'], 1, 'DNA çekirdekte (ökaryot).', 'Kolay'],
    ['Fotosentezde üretilen gaz hangisidir?', ['Azot', 'Oksijen', 'Helyum', 'Argon', 'Karbon monoksit zorunlu'], 1, 'O₂ açığa çıkar.', 'Kolay'],
    ['Asitlerin pH’ı 7’ye göre nasıldır?', ['Eşit', 'Küçük (pH<7)', 'Hep 14', 'Tanımsız', 'Negatif olmak zorunda değil her asitte ama <7'], 1, 'Asit pH<7.', 'Orta'],
    ['Mendel’de Aa × aa çaprazında Aa oranı nedir?', ['1', '1/2', '1/4', '3/4', '0'], 1, 'Yarı yarıya.', 'Zor'],
  ]},
  { match: ['okul', 'aile', 'sağlık', 'doğa', 'güvenlik', 'üretim', 'tüketim', 'bayram', 'toplum', 'kaynak', 'demokrasi', 'ekonomi', 'kültür', 'miras', 'yerimizi', 'bilim ve teknoloji', 'şehir', 'ipek', 'anadolu', 'nüfus', 'osmanlı', 'atatürk', 'millî', 'kahraman', 'inkılap', 'tarih', 'coğrafya', 'harita', 'atmosfer', 'afet', 'çevre'], items: [
    ['Okulda tanımadığı birinin “gel” demesi durumunda en doğru davranış hangisidir?', ['Hemen gitmek', 'Güvenilir yetişkine haber vermek', 'Adres vermek', 'Koşarak uzaklaşmayı gizlemek', 'Para almak'], 1, 'Güvenli davranış.', 'Kolay'],
    ['Haritada ölçek ne işe yarar?', ['Rengi boyar', 'Gerçek uzunluğu hesaplatır', 'İklimi değiştirir', 'Nüfusu sayar', 'Saati gösterir'], 1, 'Küçültme oranı.', 'Orta'],
    ['Mustafa Kemal’in Samsun’a çıkışı millî mücadelenin hangisidir?', ['Bitişi', 'Fiilî başlangıç dönümlerinden', 'Lozan’ın maddesi', 'Cumhuriyet bayramı günü', 'Halifeliğin kaldırılışı'], 1, '19 Mayıs 1919.', 'Orta'],
  ]},
  { match: ['inanç', 'ibadet', 'ahlak', 'namaz', 'kuran', 'peygamber', 'melek', 'ahiret', 'hac', 'kurban', 'zekât', 'kader', 'din ve hayat', 'allah'], items: [
    ['İslam’da namaz günde kaç vakittir?', ['2', '3', '5', '7', '1'], 2, 'Beş vakit.', 'Kolay'],
    ['Zekâtın temel işlevi hangisidir?', ['Savaş ilanı', 'Mali ibadet / paylaşım', 'Oruç tutmamak', 'Hac yerine geçmek zorunlu', 'Namaz kıldırmamak'], 1, 'Mali ibadet.', 'Orta'],
  ]},
  { match: ['english', 'greeting', 'classroom', 'selamlaşma', 'renkler', 'hayvanlar', 'yemek', 'food', 'okuma', 'kelime', 'dil bilgisi', 'temel iletişim', 'kişilik', 'seyahat', 'yazma', 'görünüş', 'spor', 'biyografi', 'günlük', 'okul hayatı'], items: [
    ['“Good morning” ne zaman kullanılır?', ['Gece yatarken', 'Sabah selamı', 'Yemek ısmarlarken', 'Sayı sayarken', 'Renk sorarken'], 1, 'Sabah.', 'Kolay'],
    ['“She is a teacher.” cümlesinde “is” ne işe yarar?', ['Çoğul ek', 'be fiili / durum', 'Soru eki', 'Geçmiş -ed', 'Emir'], 1, 'Present be.', 'Orta'],
    ['“They ___ students.” boşluğuna hangisi gelir?', ['is', 'am', 'are', 'be', 'was'], 2, 'Çoğul are.', 'Kolay'],
  ]},
  { match: ['felsefe', 'bilgi', 'varlık', 'siyaset', 'mantık', 'psikoloji', 'sosyoloji'], items: [
    ['Önermenin doğruluk değeri hangilerindendir?', ['Renk', 'Doğru veya yanlış', 'Kilogram', 'Derece zorunlu', 'Metre'], 1, 'İki değerli mantık.', 'Orta'],
    ['Davranışı uyaran-tepki ile açıklayan yaklaşım hangisidir?', ['Hümanizm yalnızca', 'Davranışçılık', 'Yalnızca psikanaliz', 'Gestalt değil', 'Biyoloji'], 1, 'Behaviorism.', 'Orta'],
    ['Sosyolojinin temel nesnesi hangisidir?', ['Tek atom', 'Toplum ve ilişki', 'Hücre', 'Yıldız', 'Fiil çekimi'], 1, 'Toplum.', 'Kolay'],
  ]},
  { match: ['anayasa', 'temel haklar', 'yasama', 'yürütme', 'yargı', 'kamu', 'vatandaşlık', 'yurttaşlık', 'kurumlar'], items: [
    ['Türkiye’de yasama organı hangisidir?', ['Cumhurbaşkanlığı ofisi tek başına', 'TBMM', 'Yargıtay', 'Valilik', 'Belediye meclisi her zaman'], 1, 'Yasama TBMM.', 'Kolay'],
    ['Kuvvetler ayrılığı hangi organları ayırır?', ['Okul-aile', 'Yasama-yürütme-yargı', 'İl-ilçe', 'Kamu-özel şirket aynı', 'Asker-sivil değil bu soruda'], 1, 'Klasik ayrım.', 'Orta'],
  ]},
  { match: ['gelişim', 'öğrenme psikolojisi', 'program geliştirme', 'ölçme ve değerlendirme', 'rehberlik', 'sınıf yönetimi'], items: [
    ['Piaget’de somut işlemler dönemi kabaca hangi yaştır?', ['0–2', '2–7', '7–11', '15–20', 'Doğum anı'], 2, 'Somut işlemler ~7–11.', 'Zor'],
    ['Formatif değerlendirme ne zaman yapılır?', ['Yalnız yıl sonunda', 'Süreç içinde izleme', 'Hiç yapılmaz', 'Sadece KPSS’de', 'Yalnız diploma'], 1, 'Süreç değerlendirme.', 'Orta'],
  ]},
];

export function catalogQuestions(level: string, subject: string, topic: string, need: number): BankQuestion[] {
  if (need <= 0) return [];
  const blob = `${subject} ${topic}`.toLocaleLowerCase('tr-TR');
  const hit = BANK_CATALOG.find((b) => b.match.some((m) => blob.includes(m)));
  const items = (hit?.items || []).slice(0, Math.max(need, 0));
  return items.map((it, i) => {
    const id = `ct-${hash32(`${level}|${subject}|${topic}|${it[0]}|${i}`).toString(16)}`;
    return q(id, it[0], it[1], it[2], it[3], it[4], 'osym');
  });
}
