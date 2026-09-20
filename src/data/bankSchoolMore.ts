import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

export const SCHOOL_BANK_MORE: Record<string, BankQuestion[]> = {
  '9. Sınıf|Matematik|Bölünebilme': [
    q('s9-mt-2', 'Bir sayı 2 ve 9 ile bölünüyorsa 18 ile de bölünür mü?', ['Her zaman, 2 ile 9 aralarında asal olduğu için', 'Hiçbir zaman', 'Yalnızca tekse', 'Yalnızca basamak toplamı 2 ise', 'Yalnızca negatifse'], 0, 'Aralarında asal bölenlerin çarpımı.', 'Zor'),
  ],
  '9. Sınıf|Fizik|Hareket ve Kuvvet': [
    q('s9-fz-1', 'Net kuvvet sıfırsa cisim için hangisi doğrudur?', ['Mutlaka durur', 'Hızı sabittir (durgun veya düzgün doğrusal)', 'İvmesi artar', 'Yönü rastgele değişir', 'Kütlesi sıfırlanır'], 1, 'Newton I.', 'Zor'),
  ],
  '9. Sınıf|Tarih|Tarih ve Zaman': [
    q('s9-tr-1', 'Milattan önce bir tarihten milattan sonra bir tarihe geçerken yıl hesabında dikkat edilen nedir?', ['Sıfırıncı yılın takvimde yer almayışı', 'Ay adı', 'Saat dilimi', 'Enlem', 'Yaz saati'], 0, '1 ÖÖ → 1 MS arası 1 yıl değil 2 yıl sayısı farkı.', 'Zor'),
  ],
  '10. Sınıf|Matematik|Fonksiyonlar': [
    q('s10-mt-1', 'f: ℝ→ℝ, f(x)=2x+1 örten midir?', ['Hayır, çünkü tek sayılı çıktı yok', 'Evet, her y için x=(y−1)/2 vardır', 'Yalnızca x>0 iken', 'Payda sıfır olur', 'Sabit fonksiyondur'], 1, 'Doğrusal a≠0 örten.', 'Zor'),
  ],
  '10. Sınıf|Kimya|Asitler, Bazlar ve Tuzlar': [
    q('s10-km-1', 'pH = 3 çözelti için hangisi doğrudur?', ['Bazik', 'Asidik', 'Nötr', 'pOH=3 zorunlu', 'Saf su'], 1, 'pH<7 asit.', 'Orta'),
  ],
  '11. Sınıf|Matematik|Analitik Geometri': [
    q('s11-mt-2', 'A(1,2) ve B(4,6) noktaları arasındaki uzaklık kaçtır?', ['5', '4', '3', '7', '√13'], 0, '√(9+16)=5.', 'Orta'),
  ],
  '11. Sınıf|Matematik|Olasılık': [
    q('s11-mt-3', 'İki hilesiz para atılıyor. En az bir yazı gelme olasılığı kaçtır?', ['1/4', '1/2', '3/4', '1', '2/3'], 2, '1 − 1/4 = 3/4.', 'Zor'),
  ],
  '11. Sınıf|Biyoloji|Dolaşım': [
    q('s11-by-1', 'Büyük dolaşımda kan hangi sırayı izler?', ['Kalp → akciğer → kalp', 'Sol karıncık → vücut → sağ kulakçık', 'Sağ karıncık → vücut', 'Karaciğer → alveol doğrudan', 'Lenf → atardamar'], 1, 'Sistemik dolaşım.', 'Zor'),
  ],
  '11. Sınıf|Coğrafya|Doğal Sistemler': [
    q('s11-cg-1', 'Cep yağışı en çok hangi hava kütlesi karşılaşmasında oluşur?', ['Aynı sıcaklıkta iki kuru hava', 'Farklı özellikte hava kütlelerinin karşılaşması', 'Yalnızca dağ yamacı', 'Yalnızca kent adası', 'Okyanus tabanı'], 1, 'Cep.', 'Zor'),
  ],
  '12. Sınıf|Matematik|Limit ve Süreklilik': [
    q('s12-mt-3', 'lim_{x→1} (x²−1)/(x−1) kaçtır?', ['0', '1', '2', 'tanımsız bırakılır', '∞'], 2, 'Belirsizlik giderilince 2.', 'Zor'),
  ],
  '12. Sınıf|Matematik|Üstel ve Logaritmik Fonksiyonlar': [
    q('s12-mt-4', 'log₂ 8 değeri kaçtır?', ['2', '3', '4', '8', '1/3'], 1, '2³=8.', 'Orta'),
  ],
  '12. Sınıf|Biyoloji|Canlılarda Enerji Dönüşümleri': [
    q('s12-by-2', 'Oksijenli solunumda pirüvatın tam yükseltgenmesi nerede tamamlanır?', ['Yalnızca glikolizde', 'Mitokondride (Krebs + ETS)', 'Kofulda', 'Hücre çeperinde', 'Lizozomda'], 1, 'Aerob mitokondri.', 'Zor'),
  ],
  '12. Sınıf|Tarih|Millî Mücadele': [
    q('s12-tr-1', 'Misak-ı Millî kararlarının özü hangisidir?', ['Manda kabulü', 'Ulusal sınır ve bağımsızlık esası', 'Kapitülasyonun genişletilmesi', 'Saltanatın güçlendirilmesi', 'Sevr’in onaylanması'], 1, 'Ulusal pakt.', 'Zor'),
  ],
  '12. Sınıf|Türk Dili ve Edebiyatı|Edebî Akımlar': [
    q('s12-ed-1', 'Realizm akımında anlatıcı genelde nasıl durur?', ['Aşırı öznel lirizm', 'Gözleme dayalı nesnel tutum', 'Tamamen masalsı', 'Yalnızca hece vezni', 'Divan mazmunu'], 1, 'Gözlem.', 'Zor'),
  ],
};
