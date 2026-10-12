# Özellik durumu — 2026-10-12

Production yazılmadı. Commit / push / deploy yok. Üyelik ve fiyat değişmedi.

## Uygulandı ve test edildi (yerel)

| Özellik | Kanıt |
| --- | --- |
| Saat damgalı sayaç, duraklatma, 60 sn eşiği | `studyTimer.test.ts` |
| Saat geri alma / aşırı ileri sıçrama | `studyLoop.test.ts` |
| Yenileme JSON kurtarma | `studyLoop.test.ts` |
| Aynı oturum id ikinci yazım / görev tamamı | `commitSession` + `normalizeData` |
| Oturum özeti (soru sayısı isteğe bağlı, tahmin yok) | `patchSession` testi |
| Yanlış defteri (aynı soru güncellenir) | `applyQuizResult` |
| Tekrar kuyruğu 1/3/7/14, erteleme, due | `spacedReview` |
| Ustalığın tekrar geçmişinden üretilmemesi | `topicMastery` null |
| Öneri sırası ve boş veri | `nextStudySuggestion` |
| JSON oturum tekilleştirme (yerel PG migration 024) | `024_student_data_idempotent_pg.sql` + docker |
| Ana sayfa + timer öneri kartı | `StudySuggestCard` |

| Kimlik birleştirme + tombstone | `syncMerge.test.ts` |
| OCC `push_student_data` / kayıp güncelleme | `025_sync_coach_pg.sql` |
| Koç özeti (kayıt yoksa uydurma yok) | `coachBrief.ts` + panel kartı |
| Koç ödevi plana id ile; ZORRO dokunmaz | `coachPlan.ts` |

## Yol haritasında (bu turda yok)

- İki cihaz CRDT / alan bazlı gerçek zamanlı birleşme (şimdi çekişte merge + rev)
- IES / Quizlet tam metin okuma
- Yetkili tarayıcıda `/timer` E2E (üyelik kilidi; bypass yok)
- Production’a 024/025 uygulama

## Bilinen sınırlar

- Canlı oturum taslağı cihaz `localStorage`’ında; kayıtlı oturum buluta JSON gider.
- `025` yoksa istemci eski upsert’e düşer; birleşme yine pull’da yapılır.
- Koç özeti RPC bağlı öğrenci JSON alt kümesini döner; bağlı olmayan `yetkisiz`.
- 36 saatten büyük duvar saati sıçraması süreyi dondurur (NTP/elle ileri alma); 8 saatlik uyku sayılır.
- Öneri AI kullanmaz; kayıt yoksa onboard metni.
