import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

/** Ek YKS soruları: yeni konular + mevcut konulara üst düzey maddeler. */
export const YKS_BANK_MORE: Record<string, BankQuestion[]> = {
  'YKS TYT|Matematik|Problemler': [
    q('ty-pb-5', 'Bir işi Ali 6, Veli 12 günde bitirir. Birlikte 3 gün çalıştıktan sonra Ali ayrılır. Kalan işi Veli kaç günde bitirir?', ['3', '4', '6', '9', '12'], 0, 'Birlikte hız 1/4 iş/gün; 3 günde 3/4 biter. Kalan 1/4’ü Veli 1/12 hızıyla 3 günde bitirir.', 'Zor'),
    q('ty-pb-6', 'Bir mal %20 kârla 144 TL’ye satılıyor. Maliyeti kaç TL’dir?', ['100', '110', '120', '125', '130'], 2, '1,2x=144 → x=120.', 'Orta'),
    q('ty-pb-7', 'Karışım: %20 tuzlu 40 kg çözeltiye kaç kg tuz eklenirse %40 tuzlu olur?', ['40/3', '8', '10', '40/6', '16'], 0, '8+x=(40+x)·0,4 → 8+x=16+0,4x → 0,6x=8 → x=40/3.', 'Zor'),
  ],
  'YKS TYT|Türkçe|Paragraf': [
    q('ty-pr-6', 'Paragrafta “somutlaştırma” en çok hangi yolla yapılır?', ['Soyut kavramı tanımla bırakmak', 'Örnek, benzetme veya gözlemlenebilir durum vermek', 'Nokta sayısını artırmak', 'Yalnızca soru sormak', 'Başlığı kaldırmak'], 1, 'Somutlaştırma, soyutu örneğe bağlar.', 'Zor'),
    q('ty-pr-7', '“Yazarın tutumu” sorusunda asıl bakılması gereken nedir?', ['Cümle uzunluğu', 'Sözcük seçimi ve yargıların olumlama/olumsuzlama yönü', 'Paragrafın sayfa yeri', 'Noktalı virgül sayısı', 'Baş harflerin büyüklüğü'], 1, 'Tutum, dilsel seçimlerden çıkar.', 'Zor'),
  ],
  'YKS TYT|Türkçe|Dil bilgisi': [
    q('ty-dg-5', 'Hangisinde zarf-fiil vardır?', ['Koşarak geldi.', 'Koşan çocuk yoruldu.', 'Koşu başladı.', 'Koşar.', 'Koşmuş.'], 0, '“-arak” zarf-fiildir.', 'Zor'),
    q('ty-dg-6', '“Bu işi senin yapmanı istiyorum.” cümlesinde isim-fiil hangisidir?', ['senin', 'işi', 'yapma', 'istiyorum', 'bu'], 2, 'yap-ma isim-fiildir.', 'Zor'),
  ],
  'YKS TYT|Matematik|Denklemler': [
    q('ty-dn-4', 'x² − 5x + 6 = 0 denkleminin kökleri toplamı kaçtır?', ['−5', '5', '6', '−6', '1'], 1, 'Vieta: −b/a = 5.', 'Zor'),
    q('ty-dn-5', '|2x − 4| = 6 denkleminin çözüm kümesi hangisidir?', ['{5}', '{−1}', '{5, −1}', '{1}', '∅'], 2, '2x−4=6 veya 2x−4=−6.', 'Zor'),
  ],
  'YKS TYT|Matematik|Fonksiyon': [
    q('ty-fn-4', 'f(x)=x², g(x)=x+1 için (f∘g)(2) kaçtır?', ['5', '9', '6', '3', '4'], 1, 'g(2)=3, f(3)=9.', 'Zor'),
    q('ty-fn-5', 'f(x)=2x−1 birebir ve örten ise f⁻¹(7) kaçtır?', ['3', '4', '8', '13', '2'], 1, '2x−1=7 → x=4.', 'Zor'),
  ],
  'YKS TYT|Matematik|Permütasyon ve olasılık': [
    q('ty-ol-4', 'Bir zar iki kez atılıyor. Toplamın 8 gelme olasılığı kaçtır?', ['5/36', '6/36', '1/6', '7/36', '8/36'], 0, '(2,6)(3,5)(4,4)(5,3)(6,2) → 5/36.', 'Zor'),
    q('ty-ol-5', 'n kişilik bir sırada n! oturma biçimi ne varsayar?', ['Kişiler ayırt edilemez', 'Kişiler ayırt edilebilir, sıra doğrusal', 'Dairesel zorunlu', 'İkili yer değiştirme yok', 'Tek kişi sabit'], 1, 'Doğrusal permütasyon.', 'Zor'),
  ],
  'YKS TYT|Geometri|Üçgenler': [
    q('ty-uc-4', 'Bir dik üçgende dik kenarlar 6 ve 8 ise hipotenüs kaçtır?', ['10', '12', '14', '7', '9'], 0, '6-8-10.', 'Orta'),
    q('ty-uc-5', 'Kenarları 5, 12, 13 olan üçgen için hangisi doğrudur?', ['Geniş açılı', 'Dik üçgen', 'Eşkenar', 'İkizkenar zorunlu', 'Dar değil, geniş'], 1, '5²+12²=13².', 'Zor'),
  ],
  'YKS TYT|Geometri|Katı cisimler': [
    q('ty-kt-1', 'Kenar uzunluğu 3 birim olan küpün hacmi kaçtır?', ['9', '18', '27', '36', '54'], 2, 'a³=27.', 'Kolay'),
    q('ty-kt-2', 'Yarıçapı r, yüksekliği h olan dik dairesel silindirin hacmi hangisidir?', ['πr h', 'πr²h', '2πrh', '(1/3)πr²h', '4πr²'], 1, 'Taban alanı × yükseklik.', 'Orta'),
    q('ty-kt-3', 'Küpün yüzey alanı 96 ise bir kenar kaçtır?', ['4', '√96', '16', '8', '6'], 0, '6a²=96 → a²=16 → a=4.', 'Zor'),
    q('ty-kt-4', 'Koni hacminin silindir hacmine oranı (aynı r, h) nedir?', ['1/2', '1/3', '2/3', '1/4', '1'], 1, 'V_koni = (1/3)πr²h.', 'Zor'),
  ],
  'YKS TYT|Fen|Fizik': [
    q('ty-fz-5', 'Sürtünmesiz yatayda F kuvveti m kütleli cisme a ivmesi veriyor. Kütle 2m olursa aynı F ile ivme ne olur?', ['2a', 'a/2', 'a', '4a', '0'], 1, 'a=F/m.', 'Zor'),
    q('ty-fz-6', 'düzgün dairesel harekette merkezcil ivme hangisine bağlıdır?', ['Yalnızca kütleye', 'v²/r', 'Yalnızca g’ye', 'Sürtünmeye zorunlu', 'Hacme'], 1, 'a_c = v²/r.', 'Zor'),
  ],
  'YKS TYT|Fen|Kimya': [
    q('ty-km-5', '0,5 mol NaOH’de kaç tane OH⁻ iyonu vardır? (N_A Avogadro)', ['0,5', 'N_A', '0,5 N_A', '2 N_A', '5 N_A'], 2, 'NaOH → 1 OH⁻; 0,5 mol → 0,5 N_A.', 'Zor'),
    q('ty-km-6', 'Endotermik tepkimede ısı hangisine yazılır?', ['Ürün tarafına enerji çıkar', 'Girenlere ısı alınır', 'Katalizöre', 'Yalnızca gazlara', 'Denge sabitsiz'], 1, 'Isı girenlerle birlikte düşünülür.', 'Zor'),
  ],
  'YKS TYT|Fen|Biyoloji': [
    q('ty-by-5', 'Mayozun mitozdan temel farkı hangisidir?', ['Tek hücre oluşur her zaman', 'Kromozom sayısı yarıya iner, çeşitlilik artar', 'DNA hiç eşlenmez', 'Yalnızca bitkide olur', 'ATP harcanmaz'], 1, 'Mayoz redüksiyon ve rekombinasyon.', 'Zor'),
    q('ty-by-6', 'Enzimlerin çalışma hızını düşüren aşırı sıcaklık genelde ne yapar?', ['pH’ı nötrler', 'Protein yapıyı denatüre eder', 'Substratı çoğaltır', 'Kofaktör üretir', 'ATP sentezler'], 1, 'Denatürasyon.', 'Zor'),
  ],
  'YKS TYT|Sosyal|Tarih': [
    q('ty-trh-5', 'Mustafa Kemal’in Samsun’a çıkışı hangi sürecin fiilî başlangıcı kabul edilir?', ['Tanzimat', 'Millî Mücadele örgütlenmesi', 'I. Meşrutiyet', 'Karlofça', 'Lozan’dan önceki tek olay değil; 19 Mayıs 1919'], 1, '19 Mayıs 1919.', 'Zor'),
    q('ty-trh-6', 'Kapitülasyonların Osmanlı ekonomisine etkisi genelde hangisidir?', ['Yerli sanayiyi güçlendirme', 'Yabancıya imtiyaz, yerli üretimi zayıflatma', 'Tarımı tamamen durdurma', 'Donanmayı büyütme', 'Medreseleri kapatma'], 1, 'Eşitsiz ticari imtiyaz.', 'Zor'),
  ],
  'YKS AYT|Matematik|Fonksiyonlar': [
    q('ay-fn-4', 'f(x)= (x−1)/(x+2) tanım kümesi hangisidir?', ['ℝ', 'ℝ − {−2}', 'ℝ − {1}', 'ℝ − {0}', '[−2,∞)'], 1, 'Payda sıfır olamaz.', 'Zor'),
    q('ay-fn-5', 'f çift fonksiyon ise f(−x) nedir?', ['−f(x)', 'f(x)', '1/f(x)', 'f′(x)', '0'], 1, 'Çift: f(−x)=f(x).', 'Orta'),
  ],
  'YKS AYT|Matematik|İkinci dereceden denklemler': [
    q('ay-ik-1', 'x² − 4x + 3 = 0 kökleri hangisidir?', ['1 ve 3', '−1 ve −3', '2 ve 2', '0 ve 4', '3 ve 4'], 0, '(x−1)(x−3)=0.', 'Orta'),
    q('ay-ik-2', 'Diskriminant Δ<0 ise gerçek kök sayısı nedir?', ['2', '1', '0', 'sonsuz', '3'], 2, 'Reel kök yok.', 'Kolay'),
    q('ay-ik-3', 'ax²+bx+c=0 için kökler çarpımı nedir?', ['−b/a', 'c/a', 'b/c', 'a/c', '−c/a'], 1, 'Vieta: c/a.', 'Zor'),
    q('ay-ik-4', 'Kökleri 2 ve −5 olan ikinci dereceden denklem (a=1) hangisidir?', ['x²+3x−10=0', 'x²−3x−10=0', 'x²+7x+10=0', 'x²−7x−10=0', 'x²+3x+10=0'], 0, '(x−2)(x+5)=x²+3x−10.', 'Zor'),
  ],
  'YKS AYT|Matematik|Parabol': [
    q('ay-pb-1', 'y=x²−4x+3 parabolünün tepesi hangisidir?', ['(2, −1)', '(−2, 1)', '(4, 3)', '(0, 3)', '(1, 0)'], 0, 'x=−b/2a=2; y=4−8+3=−1.', 'Zor'),
    q('ay-pb-2', 'a>0 iken parabolün kolları ne yöndedir?', ['Aşağı', 'Yukarı', 'Yatay', 'Sola', 'Sağa'], 1, 'Pozitif a.', 'Kolay'),
    q('ay-pb-3', 'y=−2(x−1)²+5 tepe noktası neresidir?', ['(1, 5)', '(−1, 5)', '(1, −5)', '(2, 5)', '(0, 5)'], 0, 'y=a(x−h)²+k.', 'Orta'),
    q('ay-pb-4', 'Parabol x-eksenini iki noktada kesiyorsa Δ için ne söylenir?', ['Δ=0', 'Δ>0', 'Δ<0', 'a=0', 'c=0 zorunlu'], 1, 'İki reel kök.', 'Zor'),
  ],
  'YKS AYT|Matematik|Trigonometri': [
    q('ay-tg-4', 'sin 2x özdeşliği hangisidir?', ['2 sin x', '2 sin x cos x', 'sin²x', 'cos 2x', 'tan x'], 1, 'Çift açı.', 'Zor'),
    q('ay-tg-5', 'cos²x − sin²x ifadesi nedir?', ['cos 2x', 'sin 2x', '1', 'tan 2x', '0'], 0, 'cos 2x.', 'Zor'),
  ],
  'YKS AYT|Matematik|Limit': [
    q('ay-lm-4', 'lim_{x→0} (sin 3x)/x değeri kaçtır?', ['0', '1', '3', '1/3', 'yok'], 2, '(sin 3x)/(3x)·3 → 3.', 'Zor'),
    q('ay-lm-5', 'Pay ve payda aynı dereceden polinom, x→∞ limitinde ne olur?', ['0', 'Baş katsayılar oranı', 'sonsuz her zaman', 'paydanın katsayısı', 'tanımsız'], 1, 'Asimptotik oran.', 'Zor'),
  ],
  'YKS AYT|Matematik|Türev': [
    q('ay-tv-4', 'f(x)=e^{2x} için f′(x) nedir?', ['e^{2x}', '2e^{2x}', '2x e^{2x}', 'e^x', '1/e^{2x}'], 1, 'Zincir kuralı.', 'Zor'),
    q('ay-tv-5', 'Yerel maksimumda f′ için hangisi gerekir (türevlenebilir iç nokta)?', ['f′>0', 'f′=0 (kritik nokta, ikinci türev testi ile teyit)', 'f′ tanımsız zorunlu', 'f″>0 zorunlu min değil max', 'f=0'], 1, 'Kritik nokta + f″<0 max.', 'Zor'),
  ],
  'YKS AYT|Matematik|İntegral': [
    q('ay-in-4', '∫ e^{3x} dx nedir?', ['e^{3x}', '(1/3)e^{3x}+C', '3e^{3x}+C', 'e^x/3+C', 'ln|3x|+C'], 1, 'Zincirin tersi.', 'Zor'),
    q('ay-in-5', 'Belirli integral ∫_a^b f, geometrik olarak (f≥0) neyi verir?', ['Eğim', 'Eğri altında alan', 'Tepe noktası', 'Asimptot', 'Kök sayısı'], 1, 'Alan yorumu.', 'Orta'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|İslamiyet öncesi': [
    q('ay-is-1', 'İslamiyet öncesi Türk edebiyatının temel ürünlerinden biri hangisidir?', ['Mesnevi', 'Destan', 'Gazel mecmuası zorunlu', 'Roman', 'Makale'], 1, 'Sözlü destan geleneği.', 'Orta'),
    q('ay-is-2', 'Göktürk Yazıtları hangi özelliğiyle öne çıkar?', ['İlk Türkçe roman', 'Türkçenin ilk yazılı belgelerindendir', 'Divan nazım şekli', 'Aruz vezni zorunlu', 'Tanzimat fermanı'], 1, 'Orhun.', 'Zor'),
    q('ay-is-3', 'Sav, sagu, koşuk hangisine aittir?', ['Divan nazmı', 'İslamiyet öncesi sözlü ürün türleri', 'Servetifünun nesri', 'Fecriati bildirisi', 'Garip şiiri'], 1, 'Koşuk/sagu/sav.', 'Zor'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|Halk edebiyatı': [
    q('ay-hk-1', 'Âşık edebiyatında doğaçlama şiire ne ad verilir?', ['Kaside', 'Atışma / deyiş geleneği', 'Gazel', 'Mesnevi', 'Şarkı'], 1, 'Saz şiiri.', 'Orta'),
    q('ay-hk-2', 'Mani nazım biriminin dize sayısı genelde kaçtır?', ['2', '4', '5', '7', '15'], 1, 'Dörtlük.', 'Kolay'),
    q('ay-hk-3', 'Halk hikâyesi ile destan farkı için hangisi doğrudur?', ['Hikâye daha çok nazımdır her zaman', 'Destan olağanüstü ve kollektif; hikâye daha bireysel/aşk-kahramanlık karışımı olabilir', 'İkisi romanın alt türüdür', 'Mani destandır', 'Masal tarihî belgedir'], 1, 'Tür ayrımı.', 'Zor'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|Servetifünun': [
    q('ay-sf-1', 'Servetifünun sanat anlayışını özetleyen hangisidir?', ['Toplum için sanat yalnızca', 'Sanat için sanat, ağır dil, parnas/sembolizm etkisi', 'Hece vezni zorunlu sade Türkçe', 'Köy romanı', 'Garip ilkeleri'], 1, 'Edebiyat-ı Cedide.', 'Zor'),
    q('ay-sf-2', 'Servetifünun’un önemli şairlerinden biri hangisidir?', ['Karacaoğlan', 'Tevfik Fikret', 'Yunus Emre', 'Nedim yalnızca Divan', 'Orhan Veli'], 1, 'Fikret.', 'Orta'),
    q('ay-sf-3', 'Recaizade Mahmut Ekrem’in Servetifünun’a etkisi hangisidir?', ['Topluluğu kapatmak', 'Estetik/eleştiri ile gençleri yönlendirmek', 'Aruzu yasaklamak', 'Halk hikâyesi yazdırmak', 'Yalnızca tarih öğretmek'], 1, 'Üstat rolü.', 'Zor'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|Divan edebiyatı': [
    q('ay-dv-4', 'Gazelde her beytin anlamca bağımsızlığı neyi gösterir?', ['Nazım şeklinin bir özelliği', 'Vezinsizlik', 'Hece zorunluluğu', 'Roman kurgusu', 'Destan birliği'], 0, 'Beyit merkezli yapı.', 'Zor'),
  ],
  'YKS AYT|Tarih|İlk Türk devletleri': [
    q('ay-it-1', 'Asya Hunları ile ilgili hangisi doğrudur?', ['Denizci bir imparatorluktu', 'Mete döneminde teşkilat güçlendi', 'Yalnızca Anadolu’da kuruldu', 'Osmanlı’nın devamıdır', 'Yazıtları Latin harflidir'], 1, 'Mete / Teoman hattı.', 'Orta'),
    q('ay-it-2', 'İkili teşkilat (doğu-batı) hangi Türk devlet geleneğinde görülür?', ['Yalnızca Cumhuriyet', 'Bozkır devletlerinde sık', 'Yalnızca Selçuklu medresesi', 'Bizans themaları', 'Hilafet sistemi'], 1, 'Göktürk-Hun modeli.', 'Zor'),
    q('ay-it-3', 'Uygurların yerleşik hayata geçmesi neyi kolaylaştırmıştır?', ['Yalnızca yağmayı', 'Tarım, ticaret ve basılı kültür izlerini', 'Donanma', 'Kapitülasyon', 'Meşrutiyet'], 1, 'Kent ve tarım.', 'Zor'),
  ],
  'YKS AYT|Tarih|Osmanlı': [
    q('ay-os-4', 'Devşirme sisteminin temel amacı hangisidir?', ['Tımarı kaldırmak', 'Merkeze bağlı kul sistemi oluşturmak', 'Ayanı güçlendirmek', 'Kapitülasyon vermek', 'Medreseleri kapatmak'], 1, 'Kapıkulu.', 'Zor'),
  ],
  'YKS AYT|Coğrafya|Doğal sistemler': [
    q('ay-ds-1', 'İç kuvvetlere örnek hangisidir?', ['Akarsu aşındırması', 'Tektonizma / volkanizma', 'Rüzgâr biriktirmesi', 'Buzul aşındırması', 'Dalga aşındırması'], 1, 'Endojen.', 'Orta'),
    q('ay-ds-2', 'Ekvatoral iklimde yıllık sıcaklık farkı neden küçüktür?', ['Gece yoktur', 'Güneş ışınları yıl boyunca dik açılara yakındır', 'Kar örtüsü fazladır', 'Alizeler soğutur zorunlu', 'Yükselti her yerde fazladır'], 1, 'Enlem etkisi.', 'Zor'),
    q('ay-ds-3', 'Laterit topraklar hangi iklimle ilişkilidir?', ['Çöl', 'Ekvatoral / savan sıcak nemli', 'Tundra', 'Akdeniz her zaman', 'Kutup'], 1, 'Yoğun yıkanma.', 'Zor'),
  ],
  'YKS AYT|Coğrafya|Ekonomik faaliyetler': [
    q('ay-ef-1', 'Birincil ekonomik faaliyet hangisidir?', ['Banka', 'Tarım ve madencilik', 'Turizm acentesi', 'Yazılım', 'Perakende'], 1, 'Ham madde üretimi.', 'Kolay'),
    q('ay-ef-2', 'Türkiye’de sanayinin Marmara’da toplanmasının temel nedeni hangisi değildir?', ['Pazar ve liman', 'Ulaşım ağı', 'Tarihî birikim', 'Kutup iklimi', 'İş gücü'], 3, 'Marmara kutup değildir.', 'Zor'),
    q('ay-ef-3', 'Sürdürülebilir tarımda asıl amaç hangisidir?', ['Yalnızca verimi bir yıl şişirmek', 'Kaynakları yıpratmadan üretimi sürdürmek', 'Nadası yasaklamak her yerde', 'İhracatı durdurmak', 'Sera yasağı'], 1, 'Uzun erimli denge.', 'Orta'),
  ],
  'YKS AYT|Coğrafya|Türkiye coğrafyası': [
    q('ay-tc-3', 'Karadeniz’de tarımın dar kıyı şeridinde yoğunlaşmasının nedeni hangisidir?', ['Yağışın azlığı', 'Engebenin fazla, ovaların dar olması', 'Güneşlenme rekoru', 'Çölleşme', 'Permafrost'], 1, 'Dağlar kıyıya paralel.', 'Zor'),
  ],
  'YKS AYT|Fizik|Optik': [
    q('ay-op-1', 'Snell yasası n₁ sinθ₁ = n₂ sinθ₂ neyi bağlar?', ['Kırılma', 'Yalnızca yansıma', 'Fotoelektrik', 'Ampul direnci', 'Manyetik akı'], 0, 'Kırılma.', 'Orta'),
    q('ay-op-2', 'İnce kenarlı mercek (havada, yakınsak) paralelle gelen ışını nereye gönderir?', ['Odaktan geçecek şekilde', 'Sonsuza sapmadan', 'Daima dağıtır', 'Yansıtır ayna gibi zorunlu', 'Soğurur'], 0, 'F noktasında toplanır.', 'Zor'),
    q('ay-op-3', 'Toplam iç yansıma için hangisi gerekir?', ['Az yoğun → çok yoğun, kritik açı üstü', 'Çok yoğun → az yoğun, geliş açısı kritikten büyük', 'Her iki ortam aynı n', 'θ=0', 'Ayna zorunlu'], 1, 'n yüksekten düşüğe.', 'Zor'),
  ],
  'YKS AYT|Fizik|Modern fizik': [
    q('ay-mf-1', 'Fotoelektrikte eşik frekansın altındaki ışık ne yapar?', ['Elektron söker her zaman', 'Elektron sökmez (şiddet artınca da)', 'Yalnızca X ışını üretir', 'Çekirdeği böler', 'Kütleyi artırır'], 1, 'E=hf < φ.', 'Zor'),
    q('ay-mf-2', 'de Broglie dalga boyu λ = h/p hangi nesneler için anlamlıdır?', ['Yalnızca ses', 'Momentumlu parçacıklar (dalga-parçacık)', 'Yalnızca gezegenler', 'Isı ışını değil momentum', 'Makro top her zaman gözlenir'], 1, 'p=h/λ.', 'Zor'),
    q('ay-mf-3', 'Bir çekirdeğin bağlanma enerjisi artarsa kararlılık nasıl değişir?', ['Azalır', 'Artar (nükleon başına yüksek bağlanma daha kararlı)', 'Değişmez', 'Fisyon yasaklanır her zaman', 'Yarı ömür sıfırlanır'], 1, 'BE/A.', 'Zor'),
  ],
  'YKS AYT|Fizik|Elektrik': [
    q('ay-el-3', 'İki özdeş direnç seri bağlanırsa eşdeğer direnç nedir?', ['R/2', '2R', 'R', '4R', '0'], 1, 'Seri toplanır.', 'Orta'),
  ],
  'YKS AYT|Kimya|Çözeltiler': [
    q('ay-cz-1', 'Molalite birimi nedir?', ['mol çözünen / L çözelti', 'mol çözünen / kg çözücü', 'g / L', 'mol / mol', '% hacim'], 1, 'm = n/kg çözücü.', 'Zor'),
    q('ay-cz-2', 'Kaynama noktası yükselmesi koligatif özellik midir?', ['Hayır', 'Evet; tanecik derişimine bağlı', 'Yalnızca renk değişimidir', 'Yalnızca pH’tır', 'Katalizördür'], 1, 'ΔT_b = K_b · m.', 'Zor'),
    q('ay-cz-3', 'Doymuş çözeltiye aynı sıcaklıkta çözünen eklenirse ne olur?', ['Derişme sonsuz artar', 'Genelde çöker / çözünmez (denge)', 'Kaynama düşer zorunlu', 'Molalite sıfırlanır', 'Gaz çıkar her tuzda'], 1, 'Denge.', 'Orta'),
    q('ay-cz-4', 'Seyreltmede n = M·V için hangisi korunur?', ['Molarite', 'Çözünen mol sayısı (yaklaşık)', 'Hacim', 'Yoğunluk her zaman', 'pH her çözeltide'], 1, 'M1V1=M2V2.', 'Zor'),
  ],
  'YKS AYT|Kimya|Kimyasal tepkimeler': [
    q('ay-tp-1', 'Denge tepkimesinde katalizör neyi değiştirir?', ['K_c değerini', 'Dengeye ulaşma hızını (ileri-geri aynı)', 'Ürün molünü sonsuz', 'ΔH işaretini zorunlu', 'Sıcaklığı yok eder'], 1, 'Aktivasyon enerjisi.', 'Zor'),
    q('ay-tp-2', 'Le Chatelier: ısı alan (endotermik) dengeye ısı verilirse denge nereye kayar?', ['Girenlere', 'Ürünlere', 'Değişmez', 'Katalizöre', 'K_c düşer her zaman ve durur'], 1, 'Isı giren gibi düşünülür; ürün artar.', 'Zor'),
    q('ay-tp-3', 'Tepkime hızı genelde derişimle nasıl değişir?', ['Hiç değişmez', 'Çoğu basit tepkimede artar', 'Sıcaklıktan bağımsızdır', 'Yalnızca katılarda artar', 'Basınç düşerse her zaman artar'], 1, 'Hız yasası.', 'Orta'),
  ],
  'YKS AYT|Biyoloji|Sistemler': [
    q('ay-sy-1', 'İnsanda oksijenli kanın sol atriuma gelmesi hangi damarla olur?', ['Ana atardamar', 'Akciğer atardamarı', 'Akciğer toplardamarı', 'Üst ana toplardamar', 'Kapı toplardamarı'], 2, 'Pulmoner ven.', 'Zor'),
    q('ay-sy-2', 'Nefronun süzme işlemi esas olarak nerede başlar?', ['Henle kulbu yalnızca', 'Bowman kapsülü / glomerulus', 'Toplama kanalı', 'Üreter', 'Mesane'], 1, 'Filtrasyon.', 'Orta'),
    q('ay-sy-3', 'İnsülin hangi bezden salgılanır?', ['Tiroid', 'Pankreas (Langerhans β)', 'Adrenal medulla yalnızca', 'Hipofiz arka lob', 'Timus'], 1, 'Kan şekerini düşürür.', 'Zor'),
    q('ay-sy-4', 'Sinerjik kas çifti ne yapar?', ['Karşıt hareket', 'Aynı yönde destek', 'Kemik üretir', 'Sinir iletmez', 'Lenf pompalar zorunlu'], 1, 'Birlikte çalışır.', 'Orta'),
  ],
  'YKS AYT|Biyoloji|Enerji dönüşümleri': [
    q('ay-en-1', 'Glikoliz nerede gerçekleşir?', ['Mitokondri iç zar', 'Sitoplazma', 'Çekirdek', 'Lizozom', 'Golgi'], 1, 'Glikoz → pirüvat.', 'Orta'),
    q('ay-en-2', 'Fotosentezde O₂’nin kaynağı nedir?', ['CO₂ karbonu', 'H₂O’nun fotolizi', 'ATP', 'NADPH karbonu', 'Klorofil magnezyumu'], 1, 'Su ayrışması.', 'Zor'),
    q('ay-en-3', 'Krebs döngüsü aerob solunumda nerede işler?', ['Sitoplazma', 'Mitokondri matrisi', 'Kloroplast stroma her hücrede', 'Hücre zarı dış yüz', 'Koful'], 1, 'Matriks.', 'Zor'),
    q('ay-en-4', 'Fermantasyonda net ATP kazancı glikolize göre neden düşüktür?', ['NADH oksidatif fosforilasyona gitmez; pirüvat tam yükseltgenmez', 'Glikoliz durur', 'O₂ fazla harcanır', 'Mitokondri çoğalır', 'DNA eşlenir'], 0, 'Eksik yükseltgenme.', 'Zor'),
  ],
};
