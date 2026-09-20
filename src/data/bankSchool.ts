import { q } from './bankQ';
import type { BankQuestion } from '../lib/types';

/** 1–12. sınıf: ÖSYM üslubunda (kök + çeldirici) örnekler; her derste en az bir konu. */
export const SCHOOL_BANK: Record<string, BankQuestion[]> = {
  '1. Sınıf|Türkçe|Okuma yazma': [
    q('s1-tr-1', 'Aşağıdaki sözcüklerin hangisi “okul” sözcüğü ile aynı sesle başlar?', ['araba', 'elma', 'orman', 'üzüm', 'inek'], 2, '“Okul” ve “orman” /o/ sesiyle başlar. ÖSYM tarzı ses farkındalığı.', 'Kolay'),
  ],
  '1. Sınıf|Matematik|Toplama': [
    q('s1-mt-1', '7 + 5 işleminin sonucu aşağıdakilerden hangisidir?', ['10', '11', '12', '13', '15'], 2, '7’ye 5 eklendiğinde 12 elde edilir.', 'Kolay'),
  ],
  '2. Sınıf|Türkçe|Okuduğunu anlama': [
    q('s2-tr-1', '“Ayşe kitabı masanın üzerine koydu.” cümlesinde Ayşe ne yapmıştır?', ['Kitabı okumuştur', 'Kitabı masaya bırakmıştır', 'Masa almıştır', 'Kitabı yırtmıştır', 'Dışarı çıkmıştır'], 1, 'Yüklem “koydu”; eylem masaya bırakmadır.', 'Kolay'),
  ],
  '2. Sınıf|Matematik|Çarpma girişi': [
    q('s2-mt-1', '3 + 3 + 3 + 3 toplamı aşağıdakilerin hangisine eşittir?', ['3 × 3', '4 × 3', '4 + 3', '12 × 0', '3 × 1'], 1, 'Dört tane 3’ün toplamı 4×3’tür.', 'Kolay'),
  ],
  '3. Sınıf|Türkçe|Paragraf': [
    q('s3-tr-1', 'Bir metinde yazarın asıl vermek istediği düşünceye ne ad verilir?', ['Konu', 'Ana fikir', 'Başlık', 'Olay', 'Kişi'], 1, 'Ana fikir, metnin bütününden çıkan temel yargıdır.', 'Orta'),
  ],
  '3. Sınıf|Matematik|Kesir girişi': [
    q('s3-mt-1', 'Bir bütün iki eşit parçaya ayrılırsa her parça aşağıdakilerden hangisidir?', ['1/3', '1/2', '2/2', '1/4', '2/1'], 1, 'İki eşit parça yarım, 1/2’dir.', 'Kolay'),
  ],
  '4. Sınıf|Türkçe|Paragraf': [
    q('s4-tr-1', 'Aşağıdaki cümlelerin hangisinde “göz” sözcüğü mecaz anlamda kullanılmıştır?', ['Göz doktoruna gitti.', 'Masanın gözüne kalem koydu.', 'Bu işe bir göz at.', 'Gözlük camı kırıldı.', 'Göz rengi mavidir.'], 2, '“Göz atmak” deyiminde “göz” organ değil; kısaca bakmak anlamındadır.', 'Orta'),
  ],
  '4. Sınıf|Matematik|Kesirler': [
    q('s4-mt-1', '1/2 ile 2/4 kesirleri için hangisi doğrudur?', ['1/2 daha büyüktür', '2/4 daha büyüktür', 'Eşittirler', 'Toplamları 1/8’dir', 'Hiçbiri kesir değildir'], 2, '2/4 sadeleşince 1/2 olur; denk kesirlerdir.', 'Orta'),
  ],
  '4. Sınıf|Fen|Kuvvet': [
    q('s4-fn-1', 'Duran bir topa vurulduğunda topun hareket etmesi aşağıdakilerden hangisiyle açıklanır?', ['Isı alışverişi', 'Kuvvet uygulanması', 'Ses yansıması', 'Işık soğurulması', 'Buharlaşma'], 1, 'Kuvvet, cisimlerin hareket durumunu değiştirir.', 'Kolay'),
  ],
  '5. Sınıf|Türkçe|Sözcükte anlam': [
    q('s5-tr-1', '“İnce bir düşünceyle konuyu kapattı.” cümlesindeki altı çizili sözcük hangi anlamda kullanılmıştır?', ['Kalınlığın az olması', 'Anlam derinliği / hassaslık', 'İplik inceliği', 'Yağmurun çisenti olması', 'Sesin kısık olması'], 1, 'Burada “ince”, fiziksel kalınlık değil; düşüncenin niteliğidir.', 'Orta'),
  ],
  '5. Sınıf|Matematik|Kesirler': [
    q('s5-mt-1', '3/4 + 1/4 işleminin sonucu aşağıdakilerden hangisidir?', ['1/4', '2/4', '1', '4/8', '3'], 2, 'Paydalar eşit: (3+1)/4 = 1.', 'Kolay'),
  ],
  '5. Sınıf|Fen|Kuvvetin ölçülmesi': [
    q('s5-fn-1', 'Kuvvetin birimi aşağıdakilerden hangisidir?', ['Metre', 'Kilogram', 'Newton', 'Saniye', 'Joule yalnızca enerji'], 2, 'SI sisteminde kuvvet birimi newton’dur (N).', 'Kolay'),
  ],
  '6. Sınıf|Matematik|Tam sayılar': [
    q('s6-mt-1', '−8 + 3 işleminin sonucu kaçtır?', ['−11', '−5', '5', '11', '0'], 1, 'Negatif 8’e 3 eklenince −5 kalır.', 'Kolay'),
  ],
  '6. Sınıf|Fen|Madde ve ısı': [
    q('s6-fn-1', 'Isı alan bir maddenin tanecikleri için hangisi doğrudur?', ['Hareketleri yavaşlar', 'Hareketleri genellikle artar', 'Kütleleri değişir', 'Cisim kaybolur', 'Hacim her zaman azalır'], 1, 'Isı, taneciklerin kinetik enerjisini artırır.', 'Orta'),
  ],
  '6. Sınıf|Sosyal|İpek Yolu': [
    q('s6-so-1', 'İpek Yolu’nun tarihsel işlevi aşağıdakilerden hangisine daha yakındır?', ['Yalnızca askerî sefer', 'Kıtalar arası ticaret ve kültür alışverişi', 'Denizaltı kablosu', 'Hava yolu ağı', 'Demiryolu millîleşmesi'], 1, 'İpek Yolu Doğu-Batı ticaret ve kültür köprüsüdür.', 'Orta'),
  ],
  '7. Sınıf|Matematik|Oran-orantı': [
    q('s7-mt-1', '2/5 = x/20 eşitliğinde x kaçtır?', ['4', '8', '10', '40', '5'], 1, 'İçler dışlar: 2·20 = 5x → x=8.', 'Orta'),
  ],
  '7. Sınıf|Fen|Hücre ve mitoz': [
    q('s7-fn-1', 'Mitoz bölünmenin canlı için temel sonucu hangisidir?', ['Üreme hücrelerinin oluşması', 'Kalıtım maddesinin eşit paylaşılarak büyüme/onarıma katkı', 'Kromozom sayısının yarıya inmesi', 'Yalnızca bitkide görülmesi', 'Enerjinin yok olması'], 1, 'Mitozda kromozom sayısı korunur; büyüme ve onarım sağlanır.', 'Orta'),
  ],
  '8. Sınıf|Matematik|Üslü ifadeler': [
    q('s8-mt-1', '2³ · 2² ifadesinin denk olduğu üslü yazım hangisidir?', ['2⁵', '2⁶', '4⁵', '2¹', '4⁶'], 0, 'Aynı tabanda çarpımda üsler toplanır: 3+2=5.', 'Kolay'),
  ],
  '8. Sınıf|Fen|Basınç': [
    q('s8-fn-1', 'Katı basıncı ile ilgili hangisi doğrudur?', ['Kuvvet artınca basınç azalır', 'Temas yüzeyi küçülünce basınç artar', 'Basınç kütleye bağlı değildir', 'Yalnızca sıvılarda görülür', 'Birimi metre karedir'], 1, 'P=F/A; alan azalınca basınç artar.', 'Orta'),
  ],
  '8. Sınıf|İnkılap Tarihi|Millî mücadele': [
    q('s8-it-1', '19 Mayıs 1919’un millî mücadeledeki yeri aşağıdakilerden hangisidir?', ['Lozan’ın imzası', 'Samsun’a çıkış / mücadelenin simgesel başlangıcı', 'TBMM’nin kapanışı', 'Saltanatın güçlenmesi', 'Sevr’in kabulü'], 1, 'Atatürk’ün Samsun’a çıkışı millî mücadelenin başlangıcı kabul edilir.', 'Kolay'),
  ],
  '9. Sınıf|Matematik|Üslü İfadeler': [
    q('s9-mt-1', '(3²)³ işleminin sonucu aşağıdakilerden hangisine eşittir?', ['3⁵', '3⁶', '9³', '6³', '3⁹'], 1, 'Üs üssü çarpılır: 2·3=6 → 3⁶.', 'Orta'),
  ],
  '9. Sınıf|Fizik|Hareket ve Kuvvet': [
    q('s9-fz-1', 'Durgun bir cisme net kuvvet uygulanmazsa Newton’un birinci yasasına göre ne olur?', ['Mutlaka düşer', 'Hareket durumu değişmez', 'Kütlesi artar', 'İvmesi 9,8 olmak zorundadır', 'Yönü rastgele değişir'], 1, 'Net kuvvet yoksa eylemsizlik gereği durum korunur.', 'Orta'),
  ],
  '9. Sınıf|Türk Dili ve Edebiyatı|Hikâye': [
    q('s9-ed-1', 'Hikâyede olayın geçtiği zaman ve yer unsuruna ne ad verilir?', ['Tema', 'Anlatıcı', 'Olay örgüsü', 'Zaman ve mekân', 'Bakış açısı'], 3, 'Olayın gerçekleştiği çevre zaman ve mekândır.', 'Orta'),
  ],
  '10. Sınıf|Matematik|Fonksiyonlar': [
    q('s10-mt-1', 'f(x)=2x+1 için f(3) değeri kaçtır?', ['5', '6', '7', '8', '9'], 2, '2·3+1=7.', 'Kolay'),
  ],
  '10. Sınıf|Kimya|Asitler, Bazlar ve Tuzlar': [
    q('s10-km-1', 'Sulu çözeltisinde H⁺ derişimi OH⁻ derişiminden büyük olan madde hangisidir?', ['Baz', 'Asit', 'Tuz her zaman', 'Nötr su', 'Metal oksit her zaman'], 1, 'Asitlerde [H⁺] > [OH⁻].', 'Orta'),
  ],
  '11. Sınıf|Matematik|Trigonometri': [
    q('s11-mt-1', 'sin²x + cos²x ifadesinin değeri nedir?', ['0', '1', '2', 'sin 2x', 'tan x'], 1, 'Temel trigonometrik özdeşlik 1’dir.', 'Kolay'),
  ],
  '11. Sınıf|Felsefe|Bilgi felsefesi': [
    q('s11-fl-1', 'Bilginin kaynağını duyusal deneyime dayandıran yaklaşım aşağıdakilerden hangisidir?', ['Rasyonalizm', 'Empirizm', 'Entüisyonizm', 'Dogmatizm', 'Septisizm'], 1, 'Empirizm bilgiyi deneyime bağlar (ÖSYM felsefe kökü).', 'Orta'),
  ],
  '12. Sınıf|Matematik|Türev': [
    q('s12-mt-1', 'f(x)=x³−3x fonksiyonunun türevi f′(x) aşağıdakilerden hangisidir?', ['3x²−3', 'x²−3', '3x²', '3x−3', 'x³−3'], 0, 'Kuvvet kuralı: 3x²−3.', 'Orta'),
  ],
  '12. Sınıf|Biyoloji|Genden Proteine': [
    q('s12-by-1', 'DNA’daki bilgi protein sentezine aktarılırken önce hangisi oluşur?', ['tRNA antikatı', 'mRNA (transkripsiyon)', 'Ribozom alt birimi', 'Peptid bağı doğrudan DNA’da', 'Lizozom enzimi'], 1, 'Santral dogma: DNA → mRNA → protein.', 'Orta'),
  ],
  '9. Sınıf|Kimya|Atom ve Periyodik Sistem': [
    q('s9-km-1', 'Periyodik tabloda aynı grupta yer alan elementler için hangisi doğrudur?', ['Aynı kütle numarası', 'Benzer değerlik elektron sayısı', 'Aynı proton sayısı', 'Hepsi ametal', 'Aynı yoğuşma noktası'], 1, 'Gruplar benzer değerlik düzeni taşır.', 'Orta'),
  ],
  '9. Sınıf|Biyoloji|Hücre': [
    q('s9-by-1', 'Ökaryot hücrede protein sentezinin gerçekleştiği organel hangisidir?', ['Lizozom', 'Ribozom', 'Koful', 'Sentrozom', 'Hücre çeperi'], 1, 'Ribozom translasyon yeridir.', 'Orta'),
  ],
  '10. Sınıf|Fizik|Elektrik ve Manyetizma': [
    q('s10-fz-1', 'Ohm yasasına göre gerilim (V), akım (I) ve direnç (R) ilişkisi hangisidir?', ['V = I / R', 'V = I · R', 'I = V · R', 'R = V · I', 'V = I − R'], 1, 'V = I R.', 'Orta'),
  ],
  '10. Sınıf|Biyoloji|Kalıtım': [
    q('s10-by-1', 'Heterozigot bireyde görülen alel çifti hangisidir?', ['AA', 'aa', 'Aa', 'XX zorunlu', 'YY'], 2, 'Aa heterozigottur.', 'Kolay'),
  ],
  '11. Sınıf|Kimya|Gazlar': [
    q('s11-km-1', 'İdeal gaz denklemi hangisidir?', ['P + V = nRT', 'PV = nRT', 'P = nV / T', 'n = PVT', 'T = PV / n'], 1, 'PV = nRT.', 'Orta'),
  ],
  '11. Sınıf|Fizik|Kuvvet ve Hareket': [
    q('s11-fz-1', 'Sabit ivmeli harekette Δx = v₀t + ½at² bağıntısı ne zaman kullanılır?', ['İvme zamana göre değişirken', 'İvme sabitken yer değiştirme için', 'Dairesel yörüngede zorunlu', 'Sürtünme yoksa geçersiz', 'Kütle değişirken yalnızca'], 1, 'Sabit a için konum-zaman.', 'Zor'),
  ],
  '12. Sınıf|Matematik|İntegral': [
    q('s12-mt-2', '∫₀² (2x) dx değeri kaçtır?', ['2', '4', '6', '8', '0'], 1, '[x²]₀² = 4.', 'Orta'),
  ],
  '12. Sınıf|Fizik|Modern Fizik': [
    q('s12-fz-1', 'Fotoelektrik olayda sökülen elektronun kinetik enerjisi neye bağlıdır?', ['Yalnızca ışığın şiddetine', 'Işığın frekansına (eşik üstü) ve iş fonksiyonuna', 'Yalnızca metalin rengine', 'Ortam sıcaklığına tek başına', 'Dalgaboyunun karesine zorunlu'], 1, 'K = h f − φ.', 'Zor'),
  ],
  '12. Sınıf|Kimya|Organik Bileşikler': [
    q('s12-km-1', 'Alkanların genel formülü hangisidir?', ['CnH2n', 'CnH2n+2', 'CnH2n−2', 'CnH2nO', 'C6H6 her zaman'], 1, 'Doymuş açık zincir: CnH2n+2.', 'Orta'),
  ],
};
