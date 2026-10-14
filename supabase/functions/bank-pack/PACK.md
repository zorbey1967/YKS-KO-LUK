# Soru bankası üretim paketi

Kaynak: `src/data/*` (`bankData.ts` birleştirir). Silinmez, uydurma veri konmaz.

## JSON şeması (`yks-bank-pack-v7`)

```
{
  schema: "yks-bank-pack-v7",
  version: 7,
  generatedAt: string,
  source: "src/data/bankData.ts",
  manifest: { version, generatedAt, questionCount, levels[{name,slug,subjects,topics}], curriculum, topicCounts },
  levels: {
    [slug]: {
      name,
      questions: { "[seviye]|[ders]|[konu]": [{ id, q, o[], a, e, difficulty?, kind? }] }
    }
  }
}
```

- `q` soru, `o` şıklar, `a` doğru şık indeksi, `e` açıklama.
- Müfredat anahtarı: `seviye|ders|konu`.

## Neden üretimde içerik yoktu

İstemci üretim derlemesi `src/data` sorularını gömmez. `bank-pack` paketi (`pack.json`) yoksa **503** döner. Boş manifest başarı değildir.

## Tekrarlanabilir komut

```
npm run pack:bank
npm run verify:bank
```

Sürüm: `schema` + `version` = `yks-bank-pack-v7` / `7`. Değişmez sayılar: 7007 soru, 17 seviye, 501 konu. `pack.meta.json` `sha256` + `bytes` + `repro` + `liveDeployed: false`.

Çıktı:

- `supabase/functions/bank-pack/pack.json` (gitignore; deploy artefaktı; Git indeksinde olamaz)
- `supabase/functions/bank-pack/pack.meta.json` (sayı, bayt, sha256)

Vite `dist` paketi gömmez. `pack.json` olmadan veya `parseBankPack` başarısızsa edge **503**. Komut çalışmadan “paket hazır” denmez. Canlı edge’de paket henüz yok.

## Yükleme hedefi ve erişim

| | |
|---|---|
| Hedef | Supabase Edge Function `bank-pack` klasöründeki `pack.json` (Vite `dist` değil) |
| Sürüm | `schema` + `version` 7; `sha256` meta |
| Erişim | JWT `getUser` + `caller_account_active` + `studentFeatureOk`. Koç 403, askı 403, üyeliksiz 402, paket yok 503 |
| İstemci | Üretim yalnızca `functions.invoke('bank-pack')`. Geliştirme aynı şemayı `src/data` kaynakından okur |

Deploy öncesi: `npm run pack:bank` sonra `bank-pack` fonksiyonunu yayınla. Bu depoda deploy yapılmaz.

## Geliştirme vs üretim

Aynı soru nesnesi. Geliştirme: dinamik `bankData` (kaynak). Üretim: edge `pack.json` (aynı kaynaktan üretilmiş kopya). İstemci JS’ye geri gömülmez.
