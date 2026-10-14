import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

/** Bu tur özgün, müfredat uyumlu paket. Telifli bankadan kopya yok. kind=original. */
export const ORIGINAL_BANK: Record<string, BankQuestion[]> = {
  'YKS TYT|Matematik|Denklemler': [
    q('orig-tyt-eq-1', '3x + 5 = 20 denkleminin çözümü nedir?', ['x = 3', 'x = 5', 'x = 15', 'x = 25/3', 'x = 7'], 1, '3x = 15 → x = 5. Özgün işlem kontrolü.', 'Kolay', 'original'),
    q('orig-tyt-eq-2', '2(x − 4) = 10 ise x kaçtır?', ['1', '7', '9', '12', '14'], 2, 'x − 4 = 5 → x = 9.', 'Kolay', 'original'),
    q('orig-tyt-eq-3', '5x − 3 = 2x + 9 ise x kaçtır?', ['2', '3', '4', '6', '12'], 2, '3x = 12 → x = 4.', 'Kolay', 'original'),
    q('orig-tyt-eq-4', 'x/2 + 3 = 7 ise x kaçtır?', ['2', '4', '8', '10', '20'], 2, 'x/2 = 4 → x = 8.', 'Kolay', 'original'),
  ],
  'YKS TYT|Matematik|Üslü ve köklü sayılar': [
    q('orig-tyt-exp-1', '2⁵ değeri kaçtır?', ['10', '16', '25', '32', '64'], 3, '2⁵ = 32.', 'Kolay', 'original'),
    q('orig-tyt-exp-2', '√81 + √16 işleminin sonucu kaçtır?', ['13', '17', '19', '25', '97'], 0, '9 + 4 = 13.', 'Kolay', 'original'),
  ],
  'YKS TYT|Matematik|Problemler': [
    q('orig-tyt-pr-1', '250 sayısının %20’si kaçtır?', ['20', '25', '40', '50', '70'], 3, '250 × 0,20 = 50.', 'Kolay', 'original'),
    q('orig-tyt-pr-2', 'Bir ürün 120 TL’den %10 indirimle satılırsa fiyatı kaç TL olur?', ['108', '110', '112', '130', '132'], 0, '120 × 0,90 = 108.', 'Kolay', 'original'),
    q('orig-tyt-pr-3', 'Ali 3 günde 45 soru çözüyorsa aynı hızda 5 günde kaç soru çözer?', ['60', '75', '90', '135', '15'], 1, 'Günde 15 soru; 5×15 = 75.', 'Kolay', 'original'),
  ],
  'YKS TYT|Fen|Fizik': [
    q('orig-tyt-fiz-1', 'SI birim sisteminde kuvvet birimi hangisidir?', ['Joule', 'Watt', 'Newton', 'Pascal', 'Coulomb'], 2, 'F = ma; birim kg·m/s² = Newton.', 'Kolay', 'original'),
    q('orig-tyt-fiz-2', 'Yerçekimi ivmesi g yaklaşık 10 m/s² alınırsa 2 kg cismin ağırlığı kaç N’tur?', ['2', '5', '12', '20', '200'], 3, 'G = mg = 2×10 = 20 N.', 'Kolay', 'original'),
    q('orig-tyt-fiz-3', 'Sabit süratle giden araçta net kuvvet (sürtünme yoksa) hangisidir?', ['Hareket yönünde artar', 'Sıfırdır', 'Ağırlığa eşittir zorunlu', 'Negatif sonsuz', 'Kütleyle çarpılır'], 1, 'Newton I: ivme yoksa net kuvvet sıfır.', 'Orta', 'original'),
  ],
  'YKS TYT|Fen|Kimya': [
    q('orig-tyt-kim-1', 'Su molekülünün kapalı formülü hangisidir?', ['HO', 'H2O', 'H2O2', 'OH−', 'H3O'], 1, 'İki hidrojen, bir oksijen.', 'Kolay', 'original'),
    q('orig-tyt-kim-2', 'Nötr atomda proton sayısı hangisine eşittir?', ['Nötron sayısı her zaman', 'Elektron sayısı', 'Kütle numarası', 'İyon yükü', 'Mol sayısı'], 1, 'Nötr atomda p⁺ = e⁻.', 'Kolay', 'original'),
    q('orig-tyt-kim-3', 'Periyodik tabloda soldan sağa (2. periyot) atom yarıçapı genel eğilim nedir?', ['Artar', 'Azalır', 'Sabit kalır', 'Önce sıfırlanır', 'Yalnızca gazlarda artar'], 1, 'Çekirdek yükü artar, elektronlar daha sıkı çekilir.', 'Orta', 'original'),
  ],
  'YKS TYT|Fen|Biyoloji': [
    q('orig-tyt-bio-1', 'Hücrenin genetik materyalini esas olarak nerede taşır (çekirdekli hücre)?', ['Mitokondri dış zarı', 'Çekirdek', 'Koful özsuyu', 'Hücre duvarı', 'Sentrozom iğ ipliği zorunlu'], 1, 'DNA başlıca çekirdektedir; mitokondride de az DNA vardır ama soru “esas”.', 'Kolay', 'original'),
    q('orig-tyt-bio-2', 'Fotosentezde üretilen oksijenin kaynağı hangisidir?', ['Karbondioksit karbonu', 'Su', 'Azot gazı', 'Glikoz halkası doğrudan', 'Klorofil magnezyumu'], 1, 'Su fotolizi O₂ verir (ortaöğretim kabulü).', 'Orta', 'original'),
  ],
  'YKS TYT|Sosyal|Tarih': [
    q('orig-tyt-tar-1', 'Malazgirt Zaferi hangi yılda kazanılmıştır?', ['1071', '1299', '1453', '1517', '1571'], 0, '1071; Anadolu’nun Türkleşmesi sürecinde dönüm.', 'Kolay', 'original'),
    q('orig-tyt-tar-2', 'Osmanlı Devleti’nin kuruluşu geleneksel olarak hangi yıla alınır?', ['1071', '1299', '1453', '1876', '1923'], 1, '1299 Söğüt/Bilecik çevresi geleneksel kuruluş.', 'Kolay', 'original'),
  ],
  'YKS TYT|Sosyal|Coğrafya': [
    q('orig-tyt-cog-1', 'Türkiye’nin en kalabalık kenti hangisidir?', ['Ankara', 'İzmir', 'İstanbul', 'Bursa', 'Antalya'], 2, 'İstanbul hem nüfus hem ekonomi yoğunluğu en yüksektir.', 'Kolay', 'original'),
    q('orig-tyt-cog-2', 'Ege Bölgesi’nde kıyıya dik uzanan dağların en belirgin sonucu hangisidir?', ['Kıyıların engebeli ve girintili çıkıntılı olması', 'Mutlak çöl iklimi', 'Sürekli buzul', 'Gelgit genliğinin okyanus kadar artması', 'Kutup gecesi'], 0, 'Kıvrım dağları kıyıya dik; koy-körfez fazladır.', 'Orta', 'original'),
  ],
  'YKS TYT|Türkçe|Anlatım bozukluğu': [
    q('orig-tyt-anl-1', 'Hangisinde anlatım bozukluğu vardır?', ['Kitabı okudu ve not aldı.', 'Sınava çalıştı çünkü konuları bitirmemişti.', 'Görüşme yaptık ve konuştuk.', 'Sabah erken kalktı.', 'Yağmur yağınca evde kaldı.'], 2, '“Görüşme yapmak” ile “konuşmak” aynı işi tekrarlar (gereksiz söz).', 'Orta', 'original'),
  ],
  'YKS AYT|Matematik|Polinomlar': [
    q('orig-ayt-pol-1', 'P(x) = x² − 5x + 6 polinomunun kökleri hangisidir?', ['1 ve 6', '2 ve 3', '−2 ve −3', '0 ve 6', '2 ve 6'], 1, '(x−2)(x−3)=0.', 'Kolay', 'original'),
    q('orig-ayt-pol-2', 'P(x)=x³−x için P(2) kaçtır?', ['2', '4', '6', '8', '7'], 2, '8 − 2 = 6.', 'Kolay', 'original'),
  ],
  'YKS AYT|Matematik|Logaritma': [
    q('orig-ayt-log-1', 'log₁₀ 1000 değeri kaçtır?', ['2', '3', '10', '100', '1/3'], 1, '10³ = 1000.', 'Kolay', 'original'),
  ],
  'YKS AYT|Fizik|Hareket ve kuvvet': [
    q('orig-ayt-fiz-1', 'İvmesi 2 m/s² olan 4 kg cismin net kuvveti kaç N’tur?', ['2', '6', '8', '16', '0,5'], 2, 'F = m a = 8 N.', 'Kolay', 'original'),
  ],
  'YKS AYT|Kimya|Gazlar': [
    q('orig-ayt-kim-1', 'Aynı koşullarda eşit hacimli ideal gazların mol sayıları (Avogadro) hangisidir?', ['Farklı olmak zorundadır', 'Eşittir', 'Yalnızca ağır gaza bağlıdır', 'Renkle değişir', 'Sıfırdır'], 1, 'Avogadro hipotezi: eşit V, T, P → eşit n.', 'Orta', 'original'),
  ],
  'YKS AYT|Biyoloji|Kalıtım': [
    q('orig-ayt-bio-1', 'Aa × Aa çaprazlamasında (tam baskın) heterozigot genotip oranı nedir?', ['1/4', '1/2', '3/4', '1', '0'], 1, 'AA : Aa : aa = 1 : 2 : 1 → heterozigot 1/2.', 'Orta', 'original'),
  ],
  'YKS AYT|Türk Dili ve Edebiyatı|Divan edebiyatı': [
    q('orig-ayt-ed-1', 'Divan şiirinde beyitlerle yazılan, aruzla ölçülen uzun nazım biçimi hangisidir?', ['Mani', 'Koşma', 'Mesnevi', 'Destan (anonim halk)', 'Serbest şiir'], 2, 'Mesnevi her beyti kendi içinde uyaklı uzun anlatı formudur.', 'Orta', 'original'),
  ],
  'YKS AYT|Tarih|Millî mücadele': [
    q('orig-ayt-tar-1', 'Amasya Genelgesi’nin (1919) temel vurgusu hangisidir?', ['Saltanatın güçlendirilmesi', 'Ulusun bağımsızlığını yine milletin kurtaracağı', 'Manda kabulü', 'Sevr’in onaylanması', 'Halifeliğin kaldırılması (1924)'], 1, '“Milletin istiklalini yine milletin azim ve kararı kurtaracaktır.”', 'Orta', 'original'),
  ],
  'YKS AYT|Coğrafya|Türkiye coğrafyası': [
    q('orig-ayt-cog-1', 'Karadeniz kıyısının bol yağış almasında asıl etkenlerden hangisi öne çıkar?', ['Dağların kıyıya paralel uzanması ve nemli hava kütleleri', 'Sürekli alize çölü', 'Muson yağmurunun tek neden oluşu', 'Enlem olarak kutup dairesi', 'Okyanus akıntısı Humboldt'], 0, 'Kuzey Anadolu Dağları nemi kıyıda bırakır.', 'Orta', 'original'),
  ],
  'YKS AYT|Felsefe Grubu|Mantık': [
    q('orig-ayt-man-1', '“Bütün insanlar ölümlüdür; Sokrates insandır; o hâlde Sokrates ölümlüdür.” çıkarımı hangisidir?', ['Tümevarım', 'Kıyas (tümdengelim)', 'Analoji zorunlu', 'Saf betim', 'Çelişmezlik ihlali'], 1, 'Klasik tasım; tümel + tikel → tikel sonuç.', 'Kolay', 'original'),
  ],
  '8. Sınıf|Matematik|Cebir': [
    q('orig-lgs-mat-1', '3x = 18 ise x kaçtır?', ['3', '6', '9', '15', '21'], 1, 'x = 6. LGS denklem.', 'Kolay', 'original'),
    q('orig-lgs-mat-2', 'Bir sayının 4 katının 7 eksiği 21 ise sayı kaçtır?', ['3,5', '7', '14', '28', '4'], 1, '4x − 7 = 21 → 4x = 28 → x = 7.', 'Orta', 'original'),
  ],
  '8. Sınıf|Fen|Basit makineler': [
    q('orig-lgs-fen-1', 'Kaldıraçta kuvveti azaltmanın yolu hangisidir?', ['Kuvvet kolunu kısaltmak', 'Kuvvet kolunu uzatmak', 'Yükü artırmak zorunlu', 'Dayanak noktasını kaldırmak', 'Sürtünmeyi sonsuz yapmak'], 1, 'Kuvvet × kuvvet kolu = yük × yük kolu.', 'Orta', 'original'),
  ],
  '8. Sınıf|Türkçe|Sözcükte anlam': [
    q('orig-lgs-tr-1', '“İnce bir uyarıyla konuyu kapattı.” cümlesinde “ince” sözcüğü hangi anlamda kullanılmıştır?', ['Kalınlığı az', 'Anlamca nazik / düşünülerek yapılmış', 'Hava durumu', 'Matematik ölçü', 'Renk tonu'], 1, 'Mecaz: incelikli uyarı.', 'Orta', 'original'),
  ],
  '8. Sınıf|İnkılap Tarihi|Millî mücadele': [
    q('orig-lgs-ink-1', 'TBMM hangi tarihte açılmıştır?', ['19 Mayıs 1919', '23 Nisan 1920', '30 Ağustos 1922', '29 Ekim 1923', '1 Kasım 1922'], 1, '23 Nisan 1920, Ankara.', 'Kolay', 'original'),
  ],
  'KPSS Genel Yetenek|Matematik|Yüzde-faiz': [
    q('orig-kpss-yz-1', '80 sayısının %25’i kaçtır?', ['15', '20', '25', '40', '5'], 1, '80 × 0,25 = 20.', 'Kolay', 'original'),
  ],
  'KPSS Genel Kültür|Vatandaşlık|Anayasa': [
    q('orig-kpss-vat-1', '1982 Anayasası’na göre yasama yetkisi asıl olarak hangisine aittir?', ['Cumhurbaşkanlığı kararnamesi her alanda', 'Türkiye Büyük Millet Meclisi', 'Anayasa Mahkemesi yürütmesi', 'İl genel meclisi', 'Sayıştay'], 1, 'Yasama yetkisi TBMM’dedir (Anayasa md. 7 çerçevesi).', 'Orta', 'original'),
  ],
  'KPSS Genel Kültür|Tarih|Kurtuluş Savaşı': [
    q('orig-kpss-tar-1', 'Sakarya Meydan Muharebesi’nin sonucu bakımından hangisi doğrudur?', ['İşgal kuvvetleri Ankara’ya girdi', 'Türk ordusu stratejik savunmayı taarruza çeviren süreci açtı', 'Sevr yürürlüğe girdi', 'Mondros imzalandı', 'Halifelik kaldırıldı'], 1, 'Sakarya (1921) sonra Büyük Taarruz yolu açılır.', 'Orta', 'original'),
  ],
  'KPSS Eğitim Bilimleri|Ölçme ve değerlendirme|Güvenirlik': [
    q('orig-kpss-olc-1', 'Bir ölçme aracının tesadüfi hatalardan arınık olma derecesi hangisidir?', ['Kapsam geçerliği', 'Güvenirlik', 'Yordama geçerliği', 'Kullanışlılık', 'Objektiflik tek başına'], 1, 'Güvenirlik, kararlılık / hata azlığıdır; geçerlik ayrı yapıdır.', 'Orta', 'original'),
  ],
};
