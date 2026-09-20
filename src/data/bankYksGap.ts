import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

export const YKS_BANK_GAP: Record<string, BankQuestion[]> = {
  'YKS TYT|Türkçe|Ses bilgisi': [
    q('ty-ses-1', 'Büyük ünlü uyumuna uymayan sözcük hangisidir? (kökeni yabancı olabilir)', ['kapı', 'elma', 'kitap', 'anne', 'okul'], 2, 'kitap: a–ı kalın-ince karışımı, alıntı köken.', 'Zor'),
    q('ty-ses-2', 'Hangisinde ünsüz yumuşaması vardır?', ['kitapçı', 'kitabı', 'kitaplık', 'kitapsız', 'kitap'], 1, 'p→b, belirtme ekiyle.', 'Orta'),
    q('ty-ses-3', 'Küçük ünlü uyumu düzlük-yuvarlaklık ilkesidir. Hangisi bu ilkeye aykırı düşen alıntı örneğe yakındır?', ['kutu', 'yüzük', 'otobüs', 'bulut', 'uçun'], 2, 'otobüs ünlü dizisi uyumsuz alıntıdır.', 'Zor'),
  ],
  'YKS TYT|Türkçe|Anlatım biçimleri': [
    q('ty-abx-1', 'Bir olayı oluş sırasına göre aktaran anlatım biçimi hangisidir?', ['Tartışma', 'Öyküleme', 'Tanımlama', 'Karşılaştırma', 'Sayısal kanıt'], 1, 'Öyküleme olay zinciridir.', 'Orta'),
    q('ty-abx-2', '“İnsan, düşünen bir varlıktır.” cümlesi hangi anlatıma yakındır?', ['Öyküleme', 'Tanımlama', 'Betimleme mekân', 'Tartışma tez-antitez', 'Kanıtlama istatistik'], 1, 'Tanım cümlesi.', 'Kolay'),
    q('ty-abx-3', 'Tartışmacı anlatımda yazarın asıl amacı hangisidir?', ['Yalnızca manzara çizmek', 'Kendi görüşünü gerekçeyle savunmak', 'Olay kahramanı yaratmak', 'Deyim listesi vermek', 'Noktalama öğretmek'], 1, 'Tez + gerekçe.', 'Zor'),
  ],
  'YKS TYT|Matematik|Bölünebilme': [
    q('ty-bl-1', 'Bir sayının 9 ile bölünebilmesi için basamaklar toplamı ne olmalıdır?', ['Çift', '9’un katı', '5’in katı', 'Tek', 'Asal'], 1, '9 kuralı.', 'Kolay'),
    q('ty-bl-2', '2 ve 5 ile bölünen pozitif tam sayı 10 ile de bölünür. Nedeni hangisidir?', ['2 ile 5 aralarında asaldır', 'İkisi de çift', 'Toplam 7', 'Fark 3', 'Çarpım 9'], 0, 'Aralarında asal.', 'Zor'),
    q('ty-bl-3', '108 sayısı 4 ile bölünür mü? Son iki basamak kuralına göre hangisi doğrudur?', ['08=8, 8 4’e bölünmez', '08=8, 8 4’e bölünür', 'Yalnızca 1+0+8 bakılır', 'Yalnızca son basamak', 'Asal olduğu için hayır'], 1, 'Son iki basamak 08; 8÷4=2.', 'Orta'),
  ],
  'YKS TYT|Matematik|Eşitsizlikler': [
    q('ty-es-1', 'x − 3 > 2 eşitsizliğinin çözümü hangisidir?', ['x > 5', 'x < 5', 'x > 1', 'x < 1', 'x = 5'], 0, 'x>5.', 'Kolay'),
    q('ty-es-2', '|x| < 3 ifadesinin çözüm kümesi hangisidir?', ['x < 3', 'x > −3', '−3 < x < 3', 'x < −3', 'x > 3'], 2, 'Mutlak değer içi açık aralık.', 'Zor'),
    q('ty-es-3', '−2x ≥ 8 eşitsizliğinde işaret ne olur?', ['x ≥ −4', 'x ≤ −4', 'x ≥ 4', 'x ≤ 4', 'x = −4 yalnızca'], 1, 'Negatifle çarpınca yön değişir.', 'Zor'),
  ],
  'YKS TYT|Matematik|Mutlak değer': [
    q('ty-md-1', '|−5| + |2| işleminin sonucu kaçtır?', ['3', '7', '−3', '10', '1'], 1, '5+2=7.', 'Kolay'),
    q('ty-md-2', '|x−1| = 4 denkleminin kökleri hangisidir?', ['x=5 veya x=−3', 'yalnız x=5', 'yalnız x=−3', 'x=4', 'kök yok'], 0, 'x−1=±4.', 'Zor'),
  ],
  'YKS TYT|Matematik|Özdeşlikler': [
    q('ty-oz-1', '(a+b)² açılımı hangisidir?', ['a²+b²', 'a²+2ab+b²', 'a²−2ab+b²', '2a+2b', 'ab'], 1, 'Kare özdeşliği.', 'Kolay'),
    q('ty-oz-2', 'x²−9 ifadesi hangisine eşittir?', ['(x−9)(x+1)', '(x−3)(x+3)', '(x−9)²', 'x(x−9)', '(x−3)²'], 1, 'Fark karesi değil, kareler farkı.', 'Orta'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|Fecriati': [
    q('ay-fa-1', 'Fecr-i Âti topluluğunun sanat anlayışına en yakın ifade hangisidir?', ['Toplum için sanat yalnızca', 'Sanat şahsi ve muhteremdir', 'Hece vezni zorunlu sade Türkçe', 'Köy romanı', 'Garip ilkeleri'], 1, 'Bildiri cümlesi.', 'Zor'),
    q('ay-fa-2', 'Fecr-i Âti, hangi topluluğun ardından gelir?', ['Garip', 'Servetifünun', 'İkinci Yeni', 'Hisarcılar', 'Yedi Meşaleciler değil önce'], 1, 'Edebiyat-ı Cedide sonrası.', 'Orta'),
    q('ay-fa-3', 'Fecr-i Âti’nin sürekliliği için hangisi söylenebilir?', ['Uzun ömürlü kurumlaştı', 'Kısa sürdü, üyeler dağıldı', 'Cumhuriyet resmi ekolü oldu', 'Divan’ı yeniden kurdu', 'Halk hikâyesini yasakladı'], 1, 'Kısa ömür.', 'Zor'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|Edebî akımlar': [
    q('ay-ak-1', 'Realizmde yazarın tutumu hangisine yakındır?', ['Aşırı öznel lirizm', 'Gözleme dayalı nesnellik', 'Masalsı olağanüstü', 'Saf hece zorunlu', 'Mazmun tekrarı'], 1, 'Gözlem.', 'Zor'),
    q('ay-ak-2', 'Romantizmde öne çıkan özellik hangisidir?', ['Laboratuvar dili', 'Duygu, hayal, bireysel coşku', 'Yalnızca istatistik', 'Klasik kurala tam bağlılık her zaman', 'Natüralizm kalıtımı'], 1, 'Duygu ve hayal.', 'Orta'),
  ],
  'YKS AYT|Matematik|Permütasyon ve kombinasyon': [
    q('ay-pk-1', '5 kişinin bir sıraya dizilme sayısı kaçtır?', ['5', '10', '60', '120', '25'], 3, '5!=120.', 'Orta'),
    q('ay-pk-2', '6 kişiden 2 kişilik kurul kaç farklı şekilde seçilir?', ['12', '15', '30', '6', '2'], 1, 'C(6,2)=15.', 'Zor'),
  ],
  'YKS AYT|Matematik|Eşitsizlikler': [
    q('ay-es-1', 'x² − 4 < 0 eşitsizliğinin çözümü hangisidir?', ['x < −2', 'x > 2', '−2 < x < 2', 'x ≤ −2', 'tüm reel'], 2, 'Parabol a>0, kökler arası.', 'Zor'),
    q('ay-es-2', '2x + 1 ≥ 5 ise x için ne yazılır?', ['x ≥ 2', 'x ≤ 2', 'x > 3', 'x < 1', 'x = 2 yalnızca'], 0, '2x≥4.', 'Kolay'),
  ],
  'YKS AYT|Felsefe Grubu|Felsefe': [
    q('ay-fl-1', 'Ontoloji hangi soruya yönelir?', ['Nasıl biliriz?', 'Varlık nedir?', 'Ne yapmalıyız?', 'Güzel nedir?', 'Devlet nedir?'], 1, 'Varlık felsefesi.', 'Orta'),
    q('ay-fl-2', 'A priori bilgi neye dayanır?', ['Yalnızca deneye', 'Deneyden bağımsız akıl / önsel', 'Söylentiye', 'İstatistik tabloya zorunlu', 'Duyu organına tek başına'], 1, 'Önsel.', 'Zor'),
  ],
  'YKS AYT|Felsefe Grubu|Psikoloji': [
    q('ay-ps-1', 'Pavlov’un klasik koşullanmasında koşulsuz uyarıcı örneği hangisidir?', ['Zil tek başına başta', 'Yiyecek (salya doğuştan)', 'Işık her zaman', 'Kafes rengi', 'Takvim'], 1, 'Doğal tepkiyi uyandıran.', 'Zor'),
    q('ay-ps-2', 'Bilişsel psikoloji asıl neye odaklanır?', ['Yalnızca refleks yayı', 'Zihinsel süreçler (bellek, dikkat)', 'Toplumsal sınıf', 'Hücre zarı', 'İklim'], 1, 'Cognition.', 'Orta'),
  ],
  'YKS AYT|Felsefe Grubu|Sosyoloji': [
    q('ay-so-1', 'Durkheim’a göre toplumsal olgu nasıl ele alınmalıdır?', ['Yalnızca bireysel duygu', 'Şeylermiş gibi, dışsal ve zorlayıcı', 'Biyolojik gen tek neden', 'Rastgele anekdot', 'Edebi metafor'], 1, 'Sosyal fact.', 'Zor'),
    q('ay-so-2', 'Kültür hangisini kapsar?', ['Yalnızca DNA', 'Toplumun öğrendiği değer, norm, simge', 'Yerçekimi sabiti', 'Atom numarası', 'Fiil çekimi kuralı değil toplum'], 1, 'Öğrenilmiş toplumsal birikim.', 'Orta'),
  ],
  'YKS AYT|Felsefe Grubu|Mantık': [
    q('ay-mn-1', 'Tümel olumlu önerme biçimi hangisidir?', ['Hiç S P değildir', 'Bütün S’ler P’dir', 'Bazı S P’dir', 'Bu S P’dir tekil', 'S P olabilir belirsiz'], 1, 'A önermesi.', 'Zor'),
    q('ay-mn-2', 'Geçerli bir tasımda sonuç öncüllerden nasıl çıkar?', ['Rastgele', 'Zorunlu olarak (form korunursa)', 'Oylamayla', 'Deney tüpünden', 'Tarih belgesinden'], 1, 'Formel geçerlilik.', 'Orta'),
  ],
  'YKS AYT|Din Kültürü|İnanç': [
    q('ay-di-1', 'İslam inancında tevhid neyi ifade eder?', ['Çok tanrılı sistemi', 'Allah’ın birliğini', 'Yalnızca peygamber sayısını', 'Ticaret kuralını', 'Coğrafi sınır'], 1, 'Birlik.', 'Kolay'),
    q('ay-di-2', 'Ahiret inancı ahlaka nasıl bağlanır?', ['Sorumluluk ve hesap bilinci', 'Yalnızca tarım takvimi', 'Fizik formülü', 'Noktalama', 'Spor kuralı'], 0, 'Hesap günü.', 'Orta'),
  ],
  'YKS AYT|Din Kültürü|İbadet': [
    q('ay-db-1', 'Orucun farz oluşu hangi aya bağlıdır?', ['Muharrem yalnızca nafile', 'Ramazan', 'Şevval farz', 'Receb farz tek', 'Her ay eşit farz'], 1, 'Ramazan.', 'Kolay'),
    q('ay-db-2', 'Zekâtın nisap şartı neyi gösterir?', ['Her miktar mal farz', 'Belirli eşiği aşan malda yükümlülük', 'Yalnızca tarım yasağı', 'Namaz yerine geçer', 'Hac zorunlu herkese aynı'], 1, 'Eşik.', 'Zor'),
  ],
  'YKS AYT|Din Kültürü|Ahlak': [
    q('ay-da-1', 'İslam ahlakında “emanet” neyi öne çıkarır?', ['Güveni kötüye kullanmamak', 'Yarışı kazanmak', 'Haritayı ezberlemek', 'Ses uyumu', 'Denklem çözmek'], 0, 'Güven.', 'Orta'),
  ],
  'YKS AYT|Din Kültürü|Din ve hayat': [
    q('ay-dh-1', 'Din-hayat ilişkisinde ölçülülük hangisine yakındır?', ['Aşırılık teşviki', 'Denge ve sorumluluk', 'Toplumu yok saymak', 'Bilimi reddetmek zorunlu', 'Ticareti yasaklamak'], 1, 'İtidal.', 'Orta'),
  ],
};
