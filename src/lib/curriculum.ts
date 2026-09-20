export { GRADES } from './stage';

export const SCHOOL_CURRICULUM: Record<string, Record<string, string[]>> = {
  '1. Sınıf': {
    Türkçe: ['Okuma yazma', 'Sözcük dağarcığı', 'Görsel okuma', 'Kısa metin'],
    Matematik: ['Sayılar 1-20', 'Toplama', 'Çıkarma', 'Geometrik şekiller', 'Ölçme'],
    'Hayat Bilgisi': ['Okulumuz', 'Ailemiz', 'Sağlığımız', 'Doğa'],
  },
  '2. Sınıf': {
    Türkçe: ['Okuduğunu anlama', 'Yazım', 'Noktalama', 'Hikâye'],
    Matematik: ['Sayılar 1-100', 'Çarpma girişi', 'Saat', 'Paralar', 'Problemler'],
    'Hayat Bilgisi': ['Güvenlik', 'Üretim ve tüketim', 'Canlılar', 'Milli bayramlar'],
    İngilizce: ['Selamlaşma', 'Sayılar', 'Renkler'],
  },
  '3. Sınıf': {
    Türkçe: ['Paragraf', 'Anlatım', 'Sözcükte anlam', 'Yazılı anlatım'],
    Matematik: ['Sayılar 1-1000', 'Çarpma-bölme', 'Kesir girişi', 'Çevre', 'Veri'],
    'Hayat Bilgisi': ['Toplum hayatı', 'Kaynaklar', 'Geçmiş ve gelecek'],
    Fen: ['Beş duyu', 'Madde', 'Canlılar'],
    İngilizce: ['Okul', 'Aile', 'Hayvanlar'],
  },
  '4. Sınıf': {
    Türkçe: ['Paragraf', 'Söz sanatlarına giriş', 'Yazım-noktalama', 'Metin türleri'],
    Matematik: ['Doğal sayılar', 'Kesirler', 'Geometri', 'Ölçme', 'Veri'],
    Fen: ['Vücudumuz', 'Maddeyi niteleme', 'Kuvvet', 'Aydınlatma', 'İnsan ve çevre'],
    Sosyal: ['Birey ve toplum', 'Kültür ve miras', 'Yerimizi öğrenelim', 'Bilim ve teknoloji'],
    'Din Kültürü': ['İnanç', 'İbadet', 'Güzel ahlak'],
    İngilizce: ['Günlük konuşma', 'Okuma', 'Kelime'],
  },
  '5. Sınıf': {
    Türkçe: ['Sözcükte anlam', 'Cümlede anlam', 'Paragraf', 'Yazım', 'Noktalama'],
    Matematik: ['Doğal sayılar', 'İşlemler', 'Kesirler', 'Geometri', 'Veri'],
    Fen: ['Güneş, Dünya ve Ay', 'Canlılar dünyası', 'Kuvvetin ölçülmesi', 'Madde ve değişim', 'Işık'],
    Sosyal: ['Şehre yolculuk', 'Bilim ve teknoloji', 'Yaşayan demokrasi', 'Ekonomi'],
    'Din Kültürü': ['Allah inancı', 'Namaz', 'Kur’an’a giriş'],
    İngilizce: ['Greeting', 'Classroom', 'Animals', 'Food'],
  },
  '6. Sınıf': {
    Türkçe: ['Sözcükte anlam', 'Cümlede anlam', 'Paragraf', 'Söz sanatları', 'Yazım'],
    Matematik: ['Tam sayılar', 'Çarpanlar katlar', 'Kesirler', 'Ondalık', 'Cebir girişi', 'Alan'],
    Fen: ['Güneş sistemi', 'Vücudumuzdaki sistemler', 'Kuvvet ve hareket', 'Madde ve ısı', 'Ses'],
    Sosyal: ['İpek Yolu', 'Türklerin Anadolu’ya gelişi', 'Yeryüzünde yaşam', 'Demokrasinin serüveni'],
    'Din Kültürü': ['Peygamberlik', 'Namaz', 'Ahlak'],
    İngilizce: ['Okul hayatı', 'Günlük rutin', 'Yemekler', 'Hayvanlar'],
  },
  '7. Sınıf': {
    Türkçe: ['Fiilimsiler', 'Cümlede anlam', 'Paragraf', 'Anlatım bozukluğu'],
    Matematik: ['Tam sayılar', 'Rasyonel sayılar', 'Cebirsel ifadeler', 'Eşitlik-denklem', 'Oran-orantı', 'Yüzdeler', 'Doğrular ve açılar'],
    Fen: ['Güneş sistemi ve ötesi', 'Hücre ve mitoz', 'Kuvvet ve enerji', 'Saf madde ve karışımlar', 'Işığın kırılması'],
    Sosyal: ['Türk tarihinde yolculuk', 'Osmanlı kültür', 'Ülkemizde nüfus', 'Ekonomi ve sosyal hayat'],
    'Din Kültürü': ['Melek ve ahiret', 'Hac ve kurban', 'Ahlaki tutumlar'],
    İngilizce: ['Görünüş', 'Spor', 'Biyografi', 'Okuma'],
  },
  '8. Sınıf': {
    Türkçe: ['Sözcükte anlam', 'Paragraf', 'Fiil çatısı', 'Cümlenin ögeleri', 'Yazım-noktalama'],
    Matematik: ['Çarpanlar katlar', 'Üslü ifadeler', 'Kareköklü', 'Veri analizi', 'Olasılık', 'Cebir', 'Geometri', 'Dönüşümler'],
    Fen: ['Mevsimler ve iklim', 'DNA ve genetik kod', 'Basınç', 'Madde ve endüstri', 'Basit makineler', 'Enerji dönüşümleri', 'Elektrik yükleri'],
    Sosyal: ['Bir kahraman doğuyor', 'Millî uyanış', 'Atatürkçülük', 'Çağdaş Türkiye', 'Bilim ve teknoloji'],
    'Din Kültürü': ['Kader', 'Zekât ve sadaka', 'Din ve hayat'],
    'İnkılap Tarihi': ['Bir kahraman doğuyor', 'Millî mücadele', 'Atatürkçülük'],
    İngilizce: ['Okuma', 'Dil bilgisi', 'Kelime'],
  },
  '9. Sınıf': {
    'Türk Dili ve Edebiyatı': ['Giriş', 'Hikâye', 'Şiir', 'Masal / Fabl', 'Roman', 'Tiyatro', 'Destan / Efsane'],
    Matematik: ['Sayılar', 'Bölünebilme', 'Üslü İfadeler', 'Köklü İfadeler', 'Denklemler', 'Kümeler', 'Mantık', 'Üçgenler', 'Veri'],
    Fizik: ['Fizik Bilimine Giriş', 'Madde ve Özkütle', 'Hareket ve Kuvvet', 'Enerji', 'Isı ve Sıcaklık'],
    Kimya: ['Kimyanın Temel Kanunları', 'Atom ve Periyodik Sistem', 'Kimyasal Türler', 'Maddenin Halleri'],
    Biyoloji: ['Yaşam Bilimi', 'Hücre', 'Canlılar Dünyası', 'Ekosistem'],
    Tarih: ['Tarih ve Zaman', 'İnsanlığın İlk Dönemleri', 'Orta Çağ', 'İlk ve Orta Çağlarda Türk Dünyası'],
    Coğrafya: ['Doğa ve İnsan', 'Dünya’nın Şekli ve Hareketleri', 'Harita Bilgisi', 'Atmosfer ve İklim'],
    'Din Kültürü': ['İnanç', 'İbadet', 'Ahlak'],
    İngilizce: ['Temel iletişim', 'Okuma', 'Dil bilgisi'],
  },
  '10. Sınıf': {
    'Türk Dili ve Edebiyatı': ['Hikâye', 'Şiir', 'Destan / Efsane', 'Roman', 'Tiyatro', 'Gezi Yazısı', 'Haber'],
    Matematik: ['Fonksiyonlar', 'Polinomlar', 'İkinci Dereceden Denklemler', 'Dörtgenler', 'Çokgenler', 'Olasılık', 'Veri'],
    Fizik: ['Elektrik ve Manyetizma', 'Basınç ve Kaldırma Kuvveti', 'Dalgalar', 'Optik'],
    Kimya: ['Karışımlar', 'Asitler, Bazlar ve Tuzlar', 'Kimya Her Yerde'],
    Biyoloji: ['Hücre Bölünmeleri', 'Kalıtım', 'Ekosistem', 'Canlılarda Enerji'],
    Tarih: ['Yerleşme ve Devletleşme', 'Beylikten Devlete', 'Dünya Gücü Osmanlı', 'Arayış Yılları'],
    Coğrafya: ['Doğal Sistemler', 'Beşeri Sistemler', 'Ekonomik Faaliyetler', 'Afetler'],
    'Din Kültürü': ['İnanç ve ibadet', 'Ahlak', 'Din ve hayat'],
    İngilizce: ['Kişilik', 'Seyahat', 'Okuma', 'Dil bilgisi'],
    Felsefe: ['Felsefeye giriş', 'Bilgi', 'Varlık'],
  },
  '11. Sınıf': {
    'Türk Dili ve Edebiyatı': ['Hikâye', 'Şiir', 'Makale', 'Sohbet / Fıkra', 'Roman', 'Tiyatro'],
    Matematik: ['Trigonometri', 'Analitik Geometri', 'Fonksiyonlarda Uygulamalar', 'Denklem ve Eşitsizlik Sistemleri', 'Çember ve Daire', 'Uzay Geometri', 'Olasılık'],
    Fizik: ['Kuvvet ve Hareket', 'Elektrik ve Manyetizma', 'Dalgalar', 'Optik'],
    Kimya: ['Modern Atom Teorisi', 'Gazlar', 'Sıvı Çözeltiler', 'Kimyasal Tepkimeler', 'Kimya ve Enerji'],
    Biyoloji: ['Denetleyici ve Düzenleyici Sistem', 'Duyu', 'Destek ve Hareket', 'Sindirim', 'Dolaşım'],
    Tarih: ['Değişen Dünya Dengeleri', 'Uluslararası İlişkiler', 'Devrimler Çağında Değişen Devlet-Toplum İlişkileri'],
    Coğrafya: ['Doğal Sistemler', 'Beşeri Sistemler', 'Mekânsal Bir Sentez', 'Çevre ve Toplum'],
    Felsefe: ['Felsefenin anlamı', 'Bilgi felsefesi', 'Varlık', 'Ahlak', 'Siyaset'],
    'Din Kültürü': ['İnanç', 'İbadet', 'Ahlak ve değerler'],
    İngilizce: ['Okuma', 'Yazma', 'Dil bilgisi'],
  },
  '12. Sınıf': {
    'Türk Dili ve Edebiyatı': ['Cumhuriyet Dönemi Edebiyatı', 'Şiir', 'Roman', 'Tiyatro', 'Dünya Edebiyatı', 'Edebî Akımlar'],
    Matematik: ['Üstel ve Logaritmik Fonksiyonlar', 'Diziler', 'Trigonometri', 'Limit ve Süreklilik', 'Türev', 'İntegral', 'Analitik Geometri'],
    Fizik: ['Çembersel Hareket', 'Basit Harmonik Hareket', 'Dalga Mekaniği', 'Atom Fiziğine Giriş', 'Modern Fizik'],
    Kimya: ['Kimya ve Elektrik', 'Karbon Kimyasına Giriş', 'Organik Bileşikler', 'Enerji Kaynakları'],
    Biyoloji: ['Genden Proteine', 'Canlılarda Enerji Dönüşümleri', 'Bitki Biyolojisi', 'Ekoloji'],
    Tarih: ['XX. Yüzyıl Başlarında Dünya', 'Millî Mücadele', 'Atatürkçülük ve Türk İnkılabı', 'İki Savaş Arasındaki Dönem', 'II. Dünya Savaşı Sonrası'],
    Coğrafya: ['Ekstrem Doğa Olayları', 'Küresel Çevre Sorunları', 'Türkiye’de Bölge Sınırları', 'Ekonomik Faaliyetler'],
    'Din Kültürü': ['İnanç', 'İbadet', 'Ahlak'],
    İngilizce: ['Okuma', 'Dil bilgisi', 'Kelime'],
    Felsefe: ['Bilgi', 'Ahlak', 'Siyaset'],
  },
  'Mezun / YKS': {
    'TYT Türkçe': ['Sözcükte anlam', 'Cümlede anlam', 'Paragraf', 'Dil bilgisi', 'Ses bilgisi', 'Yazım ve noktalama', 'Anlatım bozukluğu', 'Anlatım biçimleri'],
    'TYT Matematik': ['Temel kavramlar', 'Sayılar', 'Bölünebilme', 'Üslü ve köklü sayılar', 'Denklemler', 'Eşitsizlikler', 'Problemler', 'Kümeler', 'Fonksiyon', 'Permütasyon ve olasılık', 'Veri', 'Mutlak değer', 'Özdeşlikler'],
    'TYT Geometri': ['Üçgenler', 'Çember', 'Açılar', 'Çokgenler', 'Katı cisimler'],
    'TYT Sosyal': ['Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü'],
    'TYT Fen': ['Fizik', 'Kimya', 'Biyoloji'],
    'AYT Matematik': ['Fonksiyonlar', 'Polinomlar', 'İkinci dereceden denklemler', 'Parabol', 'Trigonometri', 'Logaritma', 'Diziler', 'Limit', 'Türev', 'İntegral', 'Analitik geometri', 'Permütasyon ve kombinasyon', 'Eşitsizlikler'],
    'AYT Edebiyat': ['Şiir bilgisi', 'İslamiyet öncesi', 'Divan edebiyatı', 'Halk edebiyatı', 'Tanzimat', 'Servetifünun', 'Fecriati', 'Millî Edebiyat', 'Cumhuriyet', 'Edebî akımlar'],
    'AYT Tarih-1': ['İlk Türk devletleri', 'Osmanlı', 'Millî mücadele', 'Atatürk dönemi'],
    'AYT Coğrafya-1': ['Doğal sistemler', 'Türkiye coğrafyası', 'Beşeri sistemler', 'Ekonomik faaliyetler'],
    'AYT Sosyal-2': ['Tarih', 'Coğrafya', 'Felsefe Grubu', 'Din Kültürü'],
    'AYT Fizik': ['Hareket ve kuvvet', 'Elektrik', 'Dalgalar', 'Optik', 'Modern fizik'],
    'AYT Kimya': ['Atom ve periyodik sistem', 'Gazlar', 'Çözeltiler', 'Kimyasal tepkimeler', 'Organik bileşikler'],
    'AYT Biyoloji': ['Hücre', 'Kalıtım', 'Sistemler', 'Enerji dönüşümleri', 'Ekoloji'],
    'AYT Felsefe Grubu': ['Felsefe', 'Psikoloji', 'Sosyoloji', 'Mantık'],
    'AYT Din Kültürü': ['İnanç', 'İbadet', 'Ahlak', 'Din ve hayat'],
  },
  'KPSS Adayı': {
    'Genel Yetenek Türkçe': ['Sözcükte anlam', 'Cümlede anlam', 'Paragraf', 'Dil bilgisi', 'Anlatım bozukluğu', 'Yazım-noktalama'],
    'Genel Yetenek Matematik': ['Temel kavramlar', 'Sayı problemleri', 'Yüzde-faiz', 'Oran-orantı', 'Kümeler', 'İşlem', 'Geometri', 'Grafik ve tablo'],
    'Genel Kültür Tarih': ['Osmanlı', 'Kurtuluş Savaşı', 'Atatürk ilke ve inkılapları', 'Çağdaş Türk ve dünya tarihi'],
    'Genel Kültür Coğrafya': ['Türkiye fiziki', 'İklim ve bitki', 'Nüfus ve yerleşme', 'Ekonomik coğrafya'],
    'Vatandaşlık': ['Anayasa esasları', 'Temel haklar', 'Yasama-yürütme-yargı', 'Kamu yönetimi'],
    'Güncel': ['Temel yurttaşlık bilgisi', 'Kurumlar', 'Kültür-sanat'],
    'Eğitim Bilimleri': ['Gelişim psikolojisi', 'Öğrenme psikolojisi', 'Program geliştirme', 'Ölçme ve değerlendirme', 'Rehberlik', 'Sınıf yönetimi'],
  },
};

export function curriculumForGrade(grade: string) {
  const g = SCHOOL_CURRICULUM[grade] ? grade : '12. Sınıf';
  if (g === 'Mezun / YKS') return SCHOOL_CURRICULUM['Mezun / YKS'];
  if (g === '11. Sınıf' || g === '12. Sınıf') {
    return { ...SCHOOL_CURRICULUM[g], ...SCHOOL_CURRICULUM['Mezun / YKS'] };
  }
  return SCHOOL_CURRICULUM[g];
}

export const CALC_CONFIG = {
  TYT: [
    { key: 'Türkçe', max: 40 },
    { key: 'Matematik', max: 40 },
    { key: 'Sosyal Bilimler', max: 20 },
    { key: 'Fen Bilimleri', max: 20 },
  ],
  AYT: [
    { key: 'Matematik', max: 40 },
    { key: 'Edebiyat-Sosyal 1', max: 40 },
    { key: 'Sosyal 2', max: 40 },
    { key: 'Fen Bilimleri', max: 40 },
  ],
  GY: [
    { key: 'Türkçe', max: 30 },
    { key: 'Matematik', max: 30 },
  ],
  GK: [
    { key: 'Tarih', max: 27 },
    { key: 'Coğrafya', max: 18 },
    { key: 'Vatandaşlık', max: 9 },
    { key: 'Güncel', max: 6 },
  ],
} as const;

export type CalcType = keyof typeof CALC_CONFIG;
