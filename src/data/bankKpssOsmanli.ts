import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

export const KPSS_OSMANLI_BANK: Record<string, BankQuestion[]> = {
  'KPSS Genel Kültür|Tarih|Osmanlı': [
    q('kp-os-1', 'Osmanlı Devleti’nin kuruluşunda ilk merkez hangisidir?', ['Bursa', 'Söğüt / Bilecik çevresi', 'Edirne', 'İstanbul', 'Konya'], 1, 'Kayı boyu Söğüt-Domaniç hattı.', 'Kolay', 'bilgi'),
    q('kp-os-2', 'Bursa’nın alınması (1326) hangi hükümdar dönemine rastlar?', ['Osman Bey’in son / Orhan Bey dönemi', 'Yıldırım', 'Fatih', 'Kanuni', 'Yavuz'], 0, 'Orhan Bey döneminde başkent Bursa.', 'Orta', 'bilgi'),
    q('kp-os-3', 'Edirne’nin başkent oluşu hangi yönelimi gösterir?', ['Rumeli’ye açılma', 'Yalnızca Anadolu içi kapanma', 'Denizcilikten vazgeçme zorunlu', 'İlhanlıya bağlanma', 'Haçlı ittifakı'], 0, 'Trakya üssü.', 'Orta', 'yorum'),
    q('kp-os-4', 'Ankara Savaşı (1402) sonrası dönem nasıl adlandırılır?', ['Fetret Devri', 'Tanzimat', 'Islahat', 'Lale Devri yalnızca', 'Meşrutiyet'], 0, 'Yıldırım–Timur; şehzade mücadelesi.', 'Kolay', 'bilgi'),
    q('kp-os-5', 'İstanbul’un fethi (1453) hangi padişah dönemindedir?', ['Fatih Sultan Mehmet', 'Yavuz', 'Kanuni', 'II. Mahmud', 'Abdülhamid II'], 0, '29 Mayıs 1453.', 'Kolay', 'bilgi'),
    q('kp-os-6', 'Yavuz Sultan Selim’in Mısır seferinin sonuçlarından biri nedir?', ['Hilafetin Osmanlı’ya geçmesi süreci', 'Viyana’nın alınması', 'Tanzimat fermanı', 'Kapitülasyonların kaldırılması zorunlu', 'Meclis-i Mebusan'], 0, '1517 Ridaniye sonrası.', 'Orta', 'osym'),
    q('kp-os-7', 'Kanuni döneminde Osmanlı’nın Avrupa’daki simgesel kuşatması hangisidir?', ['I. Viyana Kuşatması (1529)', 'Sakarya Meydan Muharebesi', 'Kutülamare yalnızca I. Dünya', 'Çanakkale kara', 'İnönü'], 0, '1529.', 'Orta', 'bilgi'),
    q('kp-os-8', 'Devşirme sistemi esas olarak neyi hedefler?', ['Merkezi ordu ve bürokrasi kadrosu', 'Tımarı kaldırmak zorunlu', 'İslam’ı yasaklamak', 'Donanmayı yok etmek', 'Ayanlığı kurmak'], 0, 'Kapıkulu kaynağı.', 'Orta', 'yorum'),
    q('kp-os-9', 'Tımar sisteminin temel işlevi hangisidir?', ['Sipahiye gelir karşılığı asker yetiştirme', 'Sanayi devrimi', 'Meşrutiyet ilanı', 'Kapitülasyon', 'Tanzimat maliyesi'], 0, 'Dirlik–asker bağı.', 'Zor', 'bilgi'),
    q('kp-os-10', 'Karlofça Antlaşması (1699) Osmanlı için ne anlama gelir?', ['Büyük toprak kaybı / gerileme simgesi', 'Kuruluş', 'İstanbul fethi', 'Islahat Fermanı', 'I. Meşrutiyet'], 0, 'Kutsal İttifak savaşı sonucu.', 'Orta', 'osym'),
    q('kp-os-11', 'Lale Devri’nin (1718–1730) öne çıkan yönü hangisidir?', ['Batı’ya açılma ve zevk-i sefa / matbaa gibi yenilikler', 'Fatih kanunnamesi', 'Yavuz’un İran seferi', 'Kurtuluş Savaşı', 'Tanzimat’ın ilgası'], 0, 'Pasarofça sonrası.', 'Orta', 'yorum'),
    q('kp-os-12', 'Tanzimat Fermanı (1839) hangi padişah döneminde okunmuştur?', ['Abdülmecid', 'Fatih', 'Yavuz', 'Vahdettin', 'II. Abdülhamid ilk günü'], 0, 'Gülhane, Mustafa Reşid Paşa.', 'Orta', 'bilgi'),
    q('kp-os-13', 'I. Meşrutiyet (1876) ile gelen kurum hangisidir?', ['Meclis-i Mebusan / Kanun-i Esasi', 'TBMM 1920', 'Ayan Meclisi tek başına imparatorluk yok', 'Misak-ı Millî', 'Sevr'], 0, 'II. Abdülhamid başı; kısa süre sonra tatil.', 'Zor', 'osym'),
    q('kp-os-14', 'Osmanlı’da milleti tanımlayan klasik yapı hangisidir?', ['Dinî cemaat temelli millet sistemi', 'Tek etnik ulus-devlet 1299’dan beri', 'Sınıfsız sanayi toplumu', 'Feodal Avrupa kopyası birebir', 'Laik cumhuriyet'], 0, 'Cemaat özerkliği.', 'Zor', 'cikarim'),
    q('kp-os-15', 'Küçük Kaynarca (1774) hangi devlete kapitülasyon benzeri ayrıcalıklar tanır?', ['Rusya', 'İngiltere yalnızca', 'Fransa 1535’ten tek', 'ABD', 'Japonya'], 0, 'Karadeniz ve Ortodoks himayesi iddiası.', 'Zor', 'osym'),
    q('kp-os-16', 'Osmanlı klasik döneminde şehzade sancağa çıkarma uygulamasının amacı nedir?', ['Yönetim tecrübesi ve veraset hazırlığı', 'Avrupa’ya rehine', 'Medresenin kapatılması', 'Donanma eğitimi zorunlu', 'Tımarın ilgası'], 0, 'Sancak beyliği.', 'Orta', 'yorum'),
    q('kp-os-17', 'Haçlılara karşı I. Kosova (1389) hangi padişah dönemindedir?', ['I. Murad', 'Fatih', 'Kanuni', 'II. Mahmud', 'Enver Paşa'], 0, '1389; Murad şehit.', 'Orta', 'bilgi'),
    q('kp-os-18', 'Osmanlı’da “kapitülasyon” kavramı en çok neyi ifade eder?', ['Yabancı tüccar/devlete tanınan ayrıcalıklar', 'Yeniçeri ocağının kuruluşu', 'Tımar dağıtımı', 'Cülus bahşişi', 'İltizamın kaldırılması'], 0, 'Ticari-hukuki imtiyaz.', 'Orta', 'bilgi'),
  ],
};
