import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

/** LGS Fen — Basınç: doğrulanabilir tanım/işlem, tekrar yok. */
export const LGS_FEN_BANK: Record<string, BankQuestion[]> = {
  '8. Sınıf|Fen|Basınç': [
    q('lgs-bs-1', 'Katı basıncı hangi ifadeyle hesaplanır?', ['F / A', 'F · A', 'm · g', 'P · V', 'F + A'], 0, 'P = F/A.', 'Kolay', 'bilgi'),
    q('lgs-bs-2', 'Aynı kuvvetle taban alanı küçülen katının zemine yaptığı basınç nasıl değişir?', ['Artar', 'Azalır', 'Değişmez', 'Sıfırlanır', 'Yalnızca sıcaklığa bağlıdır'], 0, 'Alan paydada; alan azalınca P artar.', 'Kolay', 'yorum'),
    q('lgs-bs-3', 'Sıvı basıncı (açık kap) hangi büyüklüklere bağlıdır?', ['Yalnızca kabın şekline', 'Derinlik, özkütle ve yerçekimi ivmesi', 'Yalnızca sıvı rengine', 'Yalnızca kabın çapına', 'Hava sıcaklığına zorunlu'], 1, 'P = h·ρ·g.', 'Orta', 'bilgi'),
    q('lgs-bs-4', 'Açık deniz seviyesinde atmosfer basıncı yaklaşık kaç kPa kabul edilir (ortaokul)?', ['10', '101', '1', '1000', '0'], 1, 'Yaklaşık 101 kPa / 1 atm.', 'Orta', 'bilgi'),
    q('lgs-bs-5', 'Gaz basıncı kapalı kaba daha fazla gaz basılırsa (sıcaklık sabit) nasıl değişir?', ['Artar', 'Azalır', 'Değişmez', 'Yalnızca sıvıya dönüşür', 'Yerçekimi sıfırlanır'], 0, 'Parçacık çarpışması artar.', 'Kolay', 'yorum'),
    q('lgs-bs-6', 'Kayakların geniş olmasının nedeni hangisidir?', ['Kuvveti artırmak', 'Basıncı azaltmak (alanı büyütmek)', 'Özkütleyi artırmak', 'Sıcaklığı düşürmek', 'Hızı zorunlu kılmak'], 1, 'A artınca P azalır.', 'Kolay', 'yorum'),
    q('lgs-bs-7', 'Sıvı içinde derinlik iki katına çıkarsa ( densite sabit) sıvı basıncı nasıl değişir?', ['İki katına çıkar', 'Yarıya iner', 'Değişmez', 'Dört katına çıkar', 'Sıfırlanır'], 0, 'P ∝ h.', 'Orta', 'islem'),
    q('lgs-bs-8', 'Pascal prensibine göre kapalı sıvıya uygulanan basınç nasıl iletilir?', ['Yalnızca aşağı', 'Her yöne eşit', 'Yalnızca yukarı', 'Yalnızca kabın rengine', 'İletilmez'], 1, 'Kapalı akışkan, basıncı her yöne iletir.', 'Orta', 'bilgi'),
    q('lgs-bs-9', 'Manometre neyi ölçmeye yarar?', ['Sıcaklık', 'Basınç farkı / gaz basıncı', 'Kütle', 'Hacim doğrudan', 'Renk'], 1, 'U-boru veya basınç ölçer.', 'Orta', 'bilgi'),
    q('lgs-bs-10', 'Barometre neyi ölçer?', ['Atmosfer basıncı', 'Sıvı özkütlesi', 'Sürtünme', 'Işık şiddeti', 'Ses hızı'], 0, 'Hava basıncı ölçer.', 'Kolay', 'bilgi'),
    q('lgs-bs-11', 'Yüksek dağda pişirme süresi genellikle neden uzar?', ['Atmosfer basıncı düşer, kaynama noktası düşer', 'Yerçekimi artar', 'Özkütle sonsuz olur', 'Güneş ışığı basıncı yok eder', 'Hacim sıfırlanır'], 0, 'Düşük P → daha düşük kaynama.', 'Zor', 'cikarim'),
    q('lgs-bs-12', 'Aynı derinlikte özkütlesi büyük sıvının yaptığı basınç nasıl olur?', ['Daha büyüktür', 'Daha küçüktür', 'Her zaman eşittir', 'Sıfırdır', 'Yalnızca kaba bağlıdır'], 0, 'P ∝ ρ.', 'Orta', 'yorum'),
    q('lgs-bs-13', 'Keskin bıçağın kesmesi basınç açısından nasıl açıklanır?', ['Alan küçük, basınç büyük', 'Kuvvet sıfır', 'Alan büyük, basınç küçük', 'Özkütle değişir', 'Sıcaklık keser'], 0, 'P = F/A.', 'Kolay', 'yorum'),
    q('lgs-bs-14', 'Açık kaptaki sıvının serbest yüzeyindeki basınç yaklaşık nedir?', ['Mutlak sıfır', 'Atmosfer basıncı', 'Yalnızca sıvı yüksekliği', 'Sonsuz', 'Negatif olmak zorunda'], 1, 'Açık yüzeyde P_atm.', 'Orta', 'bilgi'),
    q('lgs-bs-15', 'Hidrolik kaldırıcının temel dayanağı nedir?', ['Ohm yasası', 'Pascal prensibi', 'Hooke yasası', 'Arşimet’in kaldırma değil basınç iletimi', 'Snell'], 1, 'Kapalı sıvıda basınç iletimi.', 'Zor', 'osym'),
    q('lgs-bs-16', 'Katı basıncının birimi SI’de hangisidir?', ['Pascal (N/m²)', 'Joule', 'Watt', 'Newton yalnızca', 'kg'], 0, '1 Pa = 1 N/m².', 'Kolay', 'bilgi'),
    q('lgs-bs-17', 'Sıvı basıncı kabın şekline (aynı h, aynı sıvı) bağlı mıdır?', ['Hayır, h·ρ·g', 'Evet, her zaman şekle bağlı', 'Yalnızca kare kapta', 'Yalnızca camda', 'Renk belirler'], 0, 'Hidrostatik paradoks: h esas.', 'Zor', 'cikarim'),
    q('lgs-bs-18', 'Lastik botun zemine az batmasının nedeni hangisidir?', ['Taban alanı büyük, basınç küçük', 'Kütle sonsuz', 'Hacim sıfır', 'Sıcaklık düşük zorunlu', 'Renk açık'], 0, 'P azalır.', 'Kolay', 'yorum'),
    q('lgs-bs-19', 'Kapalı kaptaki gazın sıcaklığı artarsa (hacim sabit) basınç nasıl değişir?', ['Artar', 'Azalır', 'Değişmez', 'Negatif olur', 'Yalnızca özkütle düşer'], 0, 'Kinetik enerji / çarpışma artar.', 'Orta', 'yorum'),
    q('lgs-bs-20', 'Su içindeki bir dalgıç 2 m’den 4 m’ye inerse sıvı basıncı (yaklaşık) nasıl değişir?', ['Yaklaşık iki katına çıkar', 'Aynı kalır', 'Yarıya iner', 'Dört katına çıkar zorunlu h² ile', 'Sıfırlanır'], 0, 'h iki katı → P_sıvı iki katı (P=hρg).', 'Orta', 'islem'),
  ],
};
