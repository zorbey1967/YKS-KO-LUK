import { describe, expect, it } from 'vitest';
import { examUploadGate } from './examUploadGate';
import { EXAM_SCAN_MAX_BYTES } from './examScanQuota';

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const junk = new TextEncoder().encode('not-an-image');
const uid = '11111111-1111-4111-8111-111111111111';

describe('exam-upload kapısı', () => {
  it('oturum, askı, sahte MIME, imza, boyut, yabancı klasör reddeder; geçerli türler geçer', () => {
    expect(examUploadGate({
      bearer: '', accountActive: true, userId: uid, claimedMime: 'image/png', bytes: png,
    }).status).toBe(401);
    expect(examUploadGate({
      bearer: 't', accountActive: false, userId: uid, claimedMime: 'image/png', bytes: png,
    }).status).toBe(403);
    expect(examUploadGate({
      bearer: 't', accountActive: true, userId: uid, claimedMime: 'application/pdf', bytes: png,
    }).status).toBe(415);
    expect(examUploadGate({
      bearer: 't', accountActive: true, userId: uid, claimedMime: 'image/png', bytes: junk,
    }).status).toBe(415);
    const over = new Uint8Array(EXAM_SCAN_MAX_BYTES + 1);
    over.set(png.subarray(0, 8));
    expect(examUploadGate({
      bearer: 't', accountActive: true, userId: uid, claimedMime: 'image/png', bytes: over,
    }).status).toBe(413);
    expect(examUploadGate({
      bearer: 't', accountActive: true, userId: uid, claimedMime: 'image/png', bytes: png,
      pathUserId: '22222222-2222-4222-8222-222222222222',
    }).status).toBe(403);
    expect(examUploadGate({
      bearer: 't', accountActive: true, userId: uid, claimedMime: 'image/png', bytes: png,
    }).ok).toBe(true);
    expect(examUploadGate({
      bearer: 't', accountActive: true, userId: uid, claimedMime: 'image/jpeg', bytes: jpeg,
    }).ok).toBe(true);
    expect(examUploadGate({
      bearer: 't', accountActive: true, userId: uid, claimedMime: 'image/webp', bytes: webp,
    }).ok).toBe(true);
    expect(examUploadGate({
      bearer: 't', accountActive: true, userId: uid, claimedMime: 'application/pdf', bytes: pdf,
    }).ok).toBe(true);
  });
});
