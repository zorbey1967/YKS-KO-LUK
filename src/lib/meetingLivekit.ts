import { AudioPresets, isRemoteParticipant, RemoteTrackPublication, Room, Track, VideoPresets } from 'livekit-client';

export function logMeetingErr(where: string, err: unknown) {
  if (import.meta.env.DEV) console.error('[meeting]', where, err);
}

export function createMeetingRoom() {
  return new Room({
    adaptiveStream: false,
    dynacast: true,
    stopLocalTrackOnUnpublish: true,
    videoCaptureDefaults: {
      facingMode: 'user',
      resolution: VideoPresets.h720.resolution,
    },
    audioCaptureDefaults: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
    publishDefaults: {
      dtx: true,
      red: true,
      simulcast: true,
      videoCodec: 'vp8',
      videoEncoding: VideoPresets.h720.encoding,
      audioPreset: AudioPresets.speech,
    },
  });
}

export function syncRemoteMedia(
  lk: Room,
  videoEl: HTMLVideoElement | null,
  audioEl: HTMLAudioElement | null,
) {
  const localIdentity = lk.localParticipant.identity;
  const localSid = lk.localParticipant.sid;
  let anyone = false;
  let hasVideo = false;
  for (const participant of lk.remoteParticipants.values()) {
    if (!isRemoteParticipant(participant)) continue;
    if (participant.identity && participant.identity === localIdentity) continue;
    if (participant.sid && localSid && participant.sid === localSid) continue;
    anyone = true;
    for (const pub of participant.trackPublications.values()) {
      if (pub.kind !== Track.Kind.Video && pub.kind !== Track.Kind.Audio) continue;
      if (pub instanceof RemoteTrackPublication && !pub.isSubscribed) {
        pub.setSubscribed(true);
      }
      const track = pub.track;
      if (!track) continue;
      if (track.kind === Track.Kind.Video && videoEl) {
        track.attach(videoEl);
        if (!pub.isMuted) hasVideo = true;
      }
      if (track.kind === Track.Kind.Audio && audioEl) track.attach(audioEl);
    }
  }
  return { anyone, hasVideo };
}

export function attachLocalCamera(lk: Room, videoEl: HTMLVideoElement | null) {
  const cam = lk.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
  if (cam && videoEl) cam.attach(videoEl);
}

export type MediaToggleResult = { ok: true } | { ok: false; reason: 'denied' | 'missing' | 'other' };

function classifyMediaErr(err: unknown): MediaToggleResult {
  const name = err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err || '');
  const blob = `${name} ${msg}`;
  if (/NotAllowed|PermissionDenied|denied/i.test(blob)) return { ok: false, reason: 'denied' };
  if (/NotFound|DevicesNotFound|Overconstrained/i.test(blob)) return { ok: false, reason: 'missing' };
  return { ok: false, reason: 'other' };
}

export async function tryEnableCamera(lk: Room, videoEl: HTMLVideoElement | null): Promise<MediaToggleResult> {
  try {
    await lk.localParticipant.setCameraEnabled(true);
    attachLocalCamera(lk, videoEl);
    return { ok: true };
  } catch (err) {
    logMeetingErr('setCameraEnabled', err);
    return classifyMediaErr(err);
  }
}

export async function tryEnableMicrophone(lk: Room): Promise<MediaToggleResult> {
  try {
    await lk.localParticipant.setMicrophoneEnabled(true);
    return { ok: true };
  } catch (err) {
    logMeetingErr('setMicrophoneEnabled', err);
    return classifyMediaErr(err);
  }
}

export async function ensureAudioPlayback(lk: Room) {
  try {
    await lk.startAudio();
  } catch {
    /* tarayıcı otomatik sesi ilk tıklamaya kadar engelleyebilir */
  }
}
