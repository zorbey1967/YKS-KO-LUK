/**
 * qfp kapsam hataları — mevcut QUALITY_PRIORITY_ITEMS dosyası değiştirilmez.
 * Bu kayıtlar ayrı düzeltme raporudur; birleştirme yoktur.
 */
export const PRIORITY_SCOPE_REMEDIATION = [
  {
    id: 'qfp-s1-sz-02',
    action: 'exclude_do_not_merge',
    reason:
      '“Ev ≈ yuva/konut” eş/yakın anlamdır. MEB Türkçe 2019’da eş anlam T.2.3.9 (2. sınıf); 1. sınıfta T.1.3.11 yalnızca zıt tahmindir.',
    replacementId: 'qpn-s1-sz-11',
    replacementNote: 'Bağlamdan dolu×boş zıt tahmini; sözlük maddesi yok → needs_source_verification.',
  },
  {
    id: 'qfp-s1-go-02',
    action: 'exclude_do_not_merge',
    reason:
      'Elma/armut tablosu Türkçe görsel okuma değil. Tablo okuma T.4.3.34 (4. sınıf Türkçe); M.1.4.1.1 matematik veridir.',
    replacementId: 'qpn-s1-go-13',
    replacementNote: 'Kalem+açık defter görseli tarif edildi; T.1.3.13. Ders kitabı resmi yok → needs_source_verification.',
  },
  {
    id: 'qfp-s1-ol-01',
    action: 'redesign_and_defer_metre',
    reason:
      'Kapı yüksekliği için metre 1. sınıf M.1.3.1 değildir. Metre/cm M.2.3.1.2 (2. sınıf). 1. sınıf M.1.3.1.2 standart olmayan birim seçer.',
    replacementId: 'qpn-s1-ol-ns',
    replacementNote: 'Kalem boyu → parmak. Metre 1. sınıf paketinde doğru şık değil, çeldirici.',
    deferSuggestion: {
      level: '2. Sınıf',
      kazanım: 'M.2.3.1.2',
      idea: 'Sınıf kapısının yüksekliği metre ile ifade edilir (standart birim tanıma). Bu turda 2. sınıf maddesi üretilmedi.',
    },
  },
  {
    id: 'qfp-s1-go-01',
    action: 'exclude_do_not_merge',
    reason:
      'Görselsiz “yeşil ışık = geç” kuralı T.1.3.19 sembol yorumundan çok Hayat Bilgisi kural ezberidir. Program yeşil=geç demez.',
    replacementId: 'qpn-s1-go-19',
    replacementNote:
      'Kırmızı daire + üstü çizili koşan çocuk figürü tarif edildi; yasak işareti. Kitap sayfası yok → needs_source_verification.',
  },
] as const;
