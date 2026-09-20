import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

export const KPSS_BANK_MORE: Record<string, BankQuestion[]> = {
  'KPSS Genel Yetenek|Türkçe|Cümlede anlam': [
    q('kp-cm-1', '“Çalışmazsa neti artmaz.” cümlesindeki anlam ilişkisi hangisidir?', ['Karşılaştırma', 'Koşul', 'Amaç', 'Zaman eşitliği', 'Ünlem'], 1, '“-mazsa” koşuldur.', 'Zor'),
  ],
  'KPSS Genel Yetenek|Türkçe|Anlatım bozukluğu': [
    q('kp-ab-1', 'Hangisinde anlatım bozukluğu vardır?', ['Toplantıya katıldı.', 'Yanlış hataları düzeltti.', 'Kitabı okudu.', 'Yolda yürüdü.', 'Sınav bitti.'], 1, 'Yanlış + hata tekrar.', 'Orta'),
  ],
  'KPSS Genel Yetenek|Türkçe|Yazım-noktalama': [
    q('kp-yn-1', 'Soru eki hangisinde doğru yazılmıştır?', ['Geldinmi', 'Geldin mi', 'Gel-dinmi', 'miGeldin', 'Geldinmi?'], 1, 'Ayrı yazılır.', 'Kolay'),
  ],
  'KPSS Genel Yetenek|Matematik|Sayı problemleri': [
    q('kp-sy-1', 'Bir sayının 3 katının 5 eksiği 16 ise sayı kaçtır?', ['3', '7', '5', '9', '11'], 1, '3x−5=16 → x=7.', 'Zor'),
  ],
  'KPSS Genel Yetenek|Matematik|Kümeler': [
    q('kp-km-1', 'A⊂B ve x∈A ise hangisi zorunludur?', ['x∉B', 'x∈B', 'A=B', 'B⊂A', 'A∩B=∅'], 1, 'Alt küme.', 'Orta'),
  ],
  'KPSS Genel Yetenek|Matematik|İşlem': [
    q('kp-is-1', 'a ⊕ b = 2a + b ise 3 ⊕ 4 kaçtır?', ['7', '10', '11', '14', '5'], 1, '2·3+4=10.', 'Orta'),
  ],
  'KPSS Genel Yetenek|Matematik|Grafik ve tablo': [
    q('kp-gr-1', 'Bir sütun grafikte tüm sütunlar eşitse dağılım için ne söylenir?', ['Tek mod yok, değerler denk', 'Mutlaka çarpıktır', 'Medyan tanımsız', 'Ortalama sıfır', 'Örneklem yok'], 0, 'Eşit sıklık.', 'Zor'),
  ],
  'KPSS Genel Kültür|Tarih|Osmanlı': [
    q('kp-os-1', 'Tanzimat Fermanı’nın temel yönelimi hangisidir?', ['Saltanatı kaldırmak', 'Hukukta eşitlik ve modernleşme vaadi', 'Hilafeti ilan', 'Sevr’i imza', 'Misak-ı Millî'], 1, '1839.', 'Zor'),
  ],
  'KPSS Genel Kültür|Tarih|Çağdaş tarih': [
    q('kp-cg-1', 'II. Dünya Savaşı sonrası kurulan uluslararası örgüt hangisidir?', ['Cemiyet-i Akvam yalnızca', 'Birleşmiş Milletler', 'Varşova öncesi NATO tek', 'Sevr komisyonu', 'Osmanlı meclisi'], 1, 'BM 1945.', 'Orta'),
  ],
  'KPSS Genel Kültür|Coğrafya|İklim': [
    q('kp-ik-1', 'Akdeniz ikliminin yazı nasıldır?', ['Serin yağışlı', 'Sıcak kurak', 'Donlu', 'Muson', 'Tundra'], 1, 'Yaz kuraklığı.', 'Kolay'),
  ],
  'KPSS Genel Kültür|Coğrafya|Nüfus': [
    q('kp-np-1', 'Türkiye’de nüfusun kıyı ve batıda yoğunlaşmasının temel nedeni hangisi değildir?', ['Sanayi ve hizmet', 'İklim ve ulaşım', 'Tarım olanakları', 'Kutup soğuğu', 'Tarihî kentler'], 3, 'Türkiye kutup değildir.', 'Zor'),
  ],
  'KPSS Genel Kültür|Coğrafya|Ekonomik coğrafya': [
    q('kp-eg-1', 'Türkiye’de ihracatta sanayi ürünlerinin payının artması neyi gösterir?', ['Yalnızca tarım ülkesi', 'Ekonomide yapısal dönüşüm', 'Maden yasağı', 'Turizm bitişi', 'Nüfus azalması zorunlu'], 1, 'İmalat payı.', 'Zor'),
  ],
  'KPSS Genel Kültür|Vatandaşlık|Temel haklar': [
    q('kp-hk-1', 'Anayasa’da temel hakların özüne dokunmama ilkesi neyi sınırlar?', ['Yasama ve sınırlama rejimini', 'Sadece tüzükleri', 'Uluslararası hukuku yok sayar', 'Seçim barajını', 'Bütçeyi'], 0, 'Öze dokunma yasağı.', 'Zor'),
  ],
  'KPSS Genel Kültür|Vatandaşlık|Yasama-yürütme-yargı': [
    q('kp-yy-1', 'Yargı bağımsızlığı kime karşı güvence ister?', ['Yalnızca savcıya', 'Yasama ve yürütmenin müdahalesine', 'Avukata', 'Seçmene', 'Belediyeye yalnızca'], 1, 'Kuvvetler ayrılığı.', 'Orta'),
  ],
  'KPSS Genel Kültür|Vatandaşlık|Kamu yönetimi': [
    q('kp-ku-1', 'Yetki genişliği hangi yönetim kademesinde öne çıkar?', ['Mahalle muhtarlığı zorunlu', 'Taşra / valilik hattında merkeziyetin yumuşaması', 'TBMM başkanlığı', 'Anayasa Mahkemesi', 'TCMB para politikası'], 1, 'İdari vesayet dengesi.', 'Zor'),
  ],
  'KPSS Genel Kültür|Güncel|Kurumlar': [
    q('kp-kr-1', 'Sayıştay’ın temel işlevi hangisidir?', ['Yasa yapmak', 'Kamu gelir-gider denetimi', 'Dış politika', 'Askere alma', 'Müfredat yazmak'], 1, 'Denetim.', 'Orta'),
  ],
  'KPSS Genel Kültür|Güncel|Yurttaşlık': [
    q('kp-yt-1', 'Seçme hakkı için Anayasa’daki yaş kuralı hangisidir?', ['15', '18', '21 zorunlu her seçim', '25', '30'], 1, '18 yaş.', 'Kolay'),
  ],
  'KPSS Eğitim Bilimleri|Gelişim psikolojisi|Dönemler': [
    q('kp-gp-1', 'Ergenlikte soyut işlemler dönemi kimin kuramındadır?', ['Pavlov', 'Piaget', 'Skinner', 'Watson', 'Thorndike'], 1, 'Piaget.', 'Orta'),
  ],
  'KPSS Eğitim Bilimleri|Öğrenme psikolojisi|Edimsel': [
    q('kp-ed-1', 'Pekiştirecin davranışı izlemesi hangi öğrenmeye aittir?', ['Klasik koşullanma', 'Edimsel koşullanma', 'İçgörü yalnızca', 'Latent değil edimsel', 'Model alma değil'], 1, 'Skinner.', 'Zor'),
  ],
  'KPSS Eğitim Bilimleri|Öğrenme psikolojisi|Bilişsel': [
    q('kp-bl-1', 'Bilginin şemalara yerleştirilmesi hangi yaklaşıma yakındır?', ['Davranışçı salt refleks', 'Bilişsel / yapılandırma', 'Duyuşsal değil yalnızca not', 'Psikomotor', 'Yok sayma'], 1, 'Ausubel/Piaget hattı.', 'Zor'),
  ],
  'KPSS Eğitim Bilimleri|Program geliştirme|Hedef': [
    q('kp-hd-1', 'Hedef yazımında davranışın gözlenebilir olması neden istenir?', ['Ezberi artırmak', 'Ölçülebilirlik ve açıklık', 'İçeriği gizlemek', 'Süreyi yok etmek', 'Notu şişirmek'], 1, 'Hedef-davranış.', 'Orta'),
  ],
  'KPSS Eğitim Bilimleri|Program geliştirme|İçerik': [
    q('kp-ic-1', 'Spiral programda içerik nasıl ilerler?', ['Bir kez verilir bitirilir', 'Aynı tema derinleşerek tekrar ele alınır', 'Rastgele ünite', 'Yalnızca sınav haftası', 'Öğretmen günlük notu'], 1, 'Bruner.', 'Zor'),
  ],
  'KPSS Eğitim Bilimleri|Program geliştirme|Süreç': [
    q('kp-sc-1', 'Öğrenme-öğretme sürecinde öğrenci etkinliği artarsa yaklaşım hangisine kayar?', ['Düz anlatım tekeli', 'Öğrenci merkezli yaşantı', 'Yalnızca ödev yasağı', 'Sınav iptali', 'Program yok'], 1, 'Yaşantı.', 'Orta'),
  ],
  'KPSS Eğitim Bilimleri|Program geliştirme|Değerlendirme': [
    q('kp-dg-1', 'Biçimlendirici (formatif) değerlendirmenin asıl zamanı nedir?', ['Sadece diploma', 'Süreç içinde düzeltme için', 'Mezuniyetten sonra', 'Kayıtta bir kez', 'Veliler günü'], 1, 'İzleme.', 'Zor'),
  ],
  'KPSS Eğitim Bilimleri|Ölçme ve değerlendirme|Geçerlik': [
    q('kp-gc-1', 'Bir testin ölçmek istediğini ölçmesi hangisidir?', ['Güvenirlik', 'Geçerlik', 'Ayırt edicilik değil kapsam', 'Madde güçlüğü', 'Şans başarısı'], 1, 'Validity.', 'Orta'),
  ],
  'KPSS Eğitim Bilimleri|Ölçme ve değerlendirme|Madde analizi': [
    q('kp-md-1', 'Madde ayırt ediciliği negatifse ne düşünülür?', ['Madde mükemmel', 'Üst grup alta göre daha çok yanlışlamış olabilir; madde sorunlu', 'Güçlük 1’dir zorunlu', 'Güvenirlik 1', 'Kapsam tam'], 1, 'Negatif r.', 'Zor'),
  ],
  'KPSS Eğitim Bilimleri|Rehberlik|Hizmet türleri': [
    q('kp-rh-1', 'Oryantasyon hizmeti ne zaman yoğundur?', ['Mezuniyetten 10 yıl sonra', 'Kuruma yeni uyum döneminde', 'Emekli olunca', 'Yalnızca disiplin cezasında', 'Rapor haftası'], 1, 'Uyum.', 'Kolay'),
  ],
  'KPSS Eğitim Bilimleri|Rehberlik|İlkeler': [
    q('kp-il-1', 'Gönüllülük ilkesi rehberlikte neyi vurgular?', ['Zorunlu itiraf', 'Öğrencinin istemeden zorlanmaması', 'Notla ceza', 'Velisiz karar yok her zaman', 'Test yasağı'], 1, 'Gönüllü katılım.', 'Orta'),
  ],
  'KPSS Eğitim Bilimleri|Sınıf yönetimi|İklim': [
    q('kp-sk-1', 'Olumlu sınıf ikliminde öne çıkan nedir?', ['Korku', 'Güven ve aidiyet', 'Sürekli ceza', 'Sessizlik yasağı değil iletişim', 'Kapı kilidi'], 1, 'Psikolojik güvenlik.', 'Orta'),
  ],
  'KPSS Eğitim Bilimleri|Sınıf yönetimi|İstenmeyen davranış': [
    q('kp-id-1', 'İstenmeyen davranışta ilk adım genelde hangisidir?', ['Okuldan atmak', 'Davranışı tanımlayıp nedeni anlamak', 'Aileyi mahkemeye vermek', 'Dersi iptal', 'Notu sıfırlamak zorunlu'], 1, 'Önce analiz.', 'Zor'),
  ],
};
