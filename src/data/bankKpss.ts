import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

export const KPSS_CURRICULUM: Record<string, Record<string, string[]>> = {
  'KPSS Genel Yetenek': {
    Türkçe: ['Sözcükte anlam', 'Cümlede anlam', 'Paragraf', 'Dil bilgisi', 'Anlatım bozukluğu', 'Yazım-noktalama'],
    Matematik: ['Temel kavramlar', 'Sayı problemleri', 'Yüzde-faiz', 'Oran-orantı', 'Kümeler', 'İşlem', 'Geometri', 'Grafik ve tablo'],
  },
  'KPSS Genel Kültür': {
    Tarih: ['Osmanlı', 'Kurtuluş Savaşı', 'Atatürk ilke ve inkılapları', 'Çağdaş tarih'],
    Coğrafya: ['Türkiye fiziki', 'İklim', 'Nüfus', 'Ekonomik coğrafya'],
    Vatandaşlık: ['Anayasa', 'Temel haklar', 'Yasama-yürütme-yargı', 'Kamu yönetimi'],
    Güncel: ['Kurumlar', 'Yurttaşlık'],
  },
  'KPSS Eğitim Bilimleri': {
    'Gelişim psikolojisi': ['Gelişim ilkeleri', 'Dönemler'],
    'Öğrenme psikolojisi': ['Klasik koşullanma', 'Edimsel', 'Bilişsel'],
    'Program geliştirme': ['Hedef', 'İçerik', 'Süreç', 'Değerlendirme'],
    'Ölçme ve değerlendirme': ['Güvenirlik', 'Geçerlik', 'Madde analizi'],
    Rehberlik: ['Hizmet türleri', 'İlkeler'],
    'Sınıf yönetimi': ['İklim', 'İstenmeyen davranış'],
  },
};

export const KPSS_BANK: Record<string, BankQuestion[]> = {
  'KPSS Genel Yetenek|Türkçe|Sözcükte anlam': [
    q('kp-tr-1', 'Aşağıdaki cümlelerin hangisinde “açık” sözcüğü “belirgin, ortada” anlamında kullanılmıştır?', ['Kapı açık kalmış.', 'Açık deniz dalgalıydı.', 'Niyeti açıktı, gizlemiyordu.', 'Açık artırma başladı.', 'Açık sarı bir boya seçti.'], 2, 'ÖSYM GY Türkçe: çokanlamlılıkta bağlam “belirgin”dir.', 'Orta'),
    q('kp-tr-2', '“Yüzeysel bir bakış, sorunun kökenini göremez.” cümlesinde “yüzeysel” sözcüğünün anlamca en yakını hangisidir?', ['ayrıntılı', 'üstünkörü', 'kapsamlı', 'eleştirel', 'nesnel'], 1, 'Yüzeysel ≈ üstünkörü / derine inmeyen.', 'Orta'),
  ],
  'KPSS Genel Yetenek|Türkçe|Paragraf': [
    q('kp-tr-3', 'Bir paragrafın ana düşüncesi en güvenilir biçimde nasıl belirlenir?', ['İlk cümle her zaman ana düşüncedir', 'Metnin bütününden çıkan temel yargıya bakılarak', 'En uzun cümle seçilerek', 'Noktalama sayılarak', 'Başlıkla birebir özdeş sanılarak'], 1, 'Ana düşünce tüm paragraftan çıkar; ilk cümle yalnızca giriş olabilir.', 'Orta'),
  ],
  'KPSS Genel Yetenek|Türkçe|Dil bilgisi': [
    q('kp-tr-4', 'Aşağıdaki cümlelerin hangisinde fiilimsi vardır?', ['Kitabı masaya koydu.', 'Okuyan öğrenciler sessizdi.', 'Yarın gelir.', 'Kapı açık.', 'Bu bir elma.'], 1, '“Okuyan” sıfat-fiildir (fiilimsi).', 'Orta'),
  ],
  'KPSS Genel Yetenek|Matematik|Yüzde-faiz': [
    q('kp-mt-1', 'Bir ürün %20 zam gördükten sonra %20 indirim uygulanırsa net değişim nedir?', ['Değişmez', '%4 azalır', '%4 artar', '%20 azalır', '%40 azalır'], 1, '1,20 × 0,80 = 0,96 → %4 azalma. Klasik ÖSYM çeldiricisi “değişmez”.', 'Zor'),
  ],
  'KPSS Genel Yetenek|Matematik|Oran-orantı': [
    q('kp-mt-2', 'Bir işi Ali 6, Veli 12 günde bitirmektedir. Birlikte çalışırlarsa iş kaç günde biter?', ['3', '4', '5', '8', '9'], 1, '1/6 + 1/12 = 1/4 → 4 gün.', 'Orta'),
  ],
  'KPSS Genel Yetenek|Matematik|Temel kavramlar': [
    q('kp-mt-3', '12 ile 18’in EBOB’u kaçtır?', ['2', '3', '6', '12', '36'], 2, '12=2²·3, 18=2·3² → EBOB=6.', 'Kolay'),
  ],
  'KPSS Genel Yetenek|Matematik|Geometri': [
    q('kp-mt-4', 'Kenarları 3, 4, 5 birim olan üçgen için hangisi doğrudur?', ['Geniş açılıdır', 'Eşkenardır', 'İkizkenardır', 'Dik üçgendir', 'Açılar 60°’dir'], 3, '3²+4²=5² → dik üçgen.', 'Kolay'),
  ],
  'KPSS Genel Kültür|Tarih|Kurtuluş Savaşı': [
    q('kp-ta-1', 'TBMM’nin açılış tarihi aşağıdakilerden hangisidir?', ['19 Mayıs 1919', '23 Nisan 1920', '30 Ağustos 1922', '29 Ekim 1923', '24 Temmuz 1923'], 1, '23 Nisan 1920 TBMM açılışı (ÖSYM GK).', 'Kolay'),
    q('kp-ta-2', 'Amasya Genelgesi’nin özü hangisine yakındır?', ['Manda kabul edilsin', 'Milletin bağımsızlığını yine milletin azmi kurtaracaktır', 'Sevr uygulansın', 'Saltanat güçlensin', 'TBMM kapatılsın'], 1, 'Millî irade ve bağımsızlık vurgusu.', 'Orta'),
  ],
  'KPSS Genel Kültür|Tarih|Atatürk ilke ve inkılapları': [
    q('kp-ta-3', '“Egemenlik kayıtsız şartsız milletindir.” ilkesi aşağıdakilerden hangisiyle doğrudan ilişkilidir?', ['Laiklik', 'Milliyetçilik', 'Halkçılık / millî egemenlik', 'Devletçilik', 'İnkılapçılık yalnızca ekonomik'], 2, 'Egemenliğin millete ait olması millî egemenlik / halkçılık zeminidir.', 'Orta'),
  ],
  'KPSS Genel Kültür|Coğrafya|Türkiye fiziki': [
    q('kp-cg-1', 'Türkiye’nin matematiksel konumu için hangisi doğrudur?', ['Güney yarım küre ve batı boylamları', 'Kuzey yarım küre ve doğu boylamları', 'Ekvator üzeri', 'Yalnızca güney', 'Tümüyle kutup dairesi'], 1, 'Türkiye 36°–42°K, 26°–45°D civarındadır.', 'Orta'),
  ],
  'KPSS Genel Kültür|Vatandaşlık|Anayasa': [
    q('kp-vt-1', '1982 Anayasası’na göre yasama yetkisi kime aittir?', ['Cumhurbaşkanı', 'Türkiye Büyük Millet Meclisi', 'Anayasa Mahkemesi', 'Bakanlar Kurulu (yürütme)', 'Yargıtay'], 1, 'Yasama yetkisi TBMM’dedir.', 'Kolay'),
    q('kp-vt-2', 'Kuvvetler ayrılığı ilkesi aşağıdakilerden hangisini hedefler?', ['Tek elde toplanmış yetki', 'Yasama, yürütme ve yargının işlevsel ayrımı', 'Yalnızca askerî vesayet', 'Belediye özerkliği', 'Anayasa değişikliğinin yasaklanması'], 1, 'Kuvvetler ayrılığı yetkinin paylaşımı ve denetim içindir.', 'Orta'),
  ],
  'KPSS Eğitim Bilimleri|Öğrenme psikolojisi|Klasik koşullanma': [
    q('kp-eb-1', 'Klasik koşullanmada nötr uyarıcının koşulsuz uyarıcıyla eşlenerek tepki uyandırması kimin çalışmasıyla özdeşleşmiştir?', ['Skinner', 'Pavlov', 'Bandura', 'Piaget', 'Bruner'], 1, 'Pavlov’un köpek deneyleri klasik koşullanmadır.', 'Kolay'),
  ],
  'KPSS Eğitim Bilimleri|Ölçme ve değerlendirme|Güvenirlik': [
    q('kp-eb-2', 'Bir ölçme aracının aynı koşullarda tutarlı sonuç vermesi hangisidir?', ['Geçerlik', 'Güvenirlik', 'Kullanışlılık', 'Objektiflik yalnızca puanlayıcı', 'Kapsam'], 1, 'Güvenirlik = tutarlılık; geçerlik ise isteneni ölçmedir.', 'Orta'),
  ],
  'KPSS Eğitim Bilimleri|Gelişim psikolojisi|Gelişim ilkeleri': [
    q('kp-eb-3', 'Gelişimin “baştan ayağa” ilerlemesi hangi ilkeyle anılır?', ['Proksimodistal', 'Sefalokaudal', 'Kritik dönem yokluğu', 'Kalıtımın tek belirleyiciliği', 'Çevrenin etkisizliği'], 1, 'Sefalokaudal: baş-gövde-ayak yönü.', 'Orta'),
  ],
};
