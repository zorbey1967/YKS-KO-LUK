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
      screenShareEncoding: VideoPresets.h1080.encoding,
    },
  });
}

function isScreenSource(source: Track.Source) {
  return source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio;
}

export function syncRemoteMedia(
  lk: Room,
  mainEl: HTMLVideoElement | null,
  audioEl: HTMLAudioElement | null,
  cameraEl: HTMLVideoElement | null,
  localScreen = false,
) {
  const localIdentity = lk.localParticipant.identity;
  const localSid = lk.localParticipant.sid;
  let anyone = false;
  let hasCamera = false;
  let hasScreen = false;
  let screenBy = '';

  const remotes = [...lk.remoteParticipants.values()].filter((participant) => {
    if (!isRemoteParticipant(participant)) return false;
    if (participant.identity && participant.identity === localIdentity) return false;
    if (participant.sid && localSid && participant.sid === localSid) return false;
    return true;
  });

  for (const participant of remotes) {
    anyone = true;
    for (const pub of participant.trackPublications.values()) {
      if (pub instanceof RemoteTrackPublication && !pub.isSubscribed) pub.setSubscribed(true);
      if (isScreenSource(pub.source) && pub.kind === Track.Kind.Video && pub.track && !pub.isMuted) {
        hasScreen = true;
        screenBy = participant.name || participant.identity || 'Karşı taraf';
      }
    }
  }

  for (const participant of remotes) {
    for (const pub of participant.trackPublications.values()) {
      const track = pub.track;
      if (!track) continue;
      if (pub.kind === Track.Kind.Audio && audioEl) track.attach(audioEl);
      if (pub.kind !== Track.Kind.Video) continue;
      if (isScreenSource(pub.source)) {
        if (mainEl) track.attach(mainEl);
        if (!pub.isMuted) {
          hasScreen = true;
          screenBy = participant.name || participant.identity || screenBy;
        }
        continue;
      }
      if (pub.source === Track.Source.Camera) {
        const stageIsScreen = hasScreen || localScreen;
        const target = stageIsScreen && cameraEl ? cameraEl : mainEl;
        if (target) track.attach(target);
        if (!pub.isMuted) hasCamera = true;
      }
    }
  }

  if (localScreen && !hasScreen && mainEl) attachLocalScreen(lk, mainEl);

  return { anyone, hasCamera, hasScreen, screenBy };
}

export function attachLocalCamera(lk: Room, videoEl: HTMLVideoElement | null) {
  const cam = lk.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
  if (cam && videoEl) cam.attach(videoEl);
}

export function attachLocalScreen(lk: Room, videoEl: HTMLVideoElement | null) {
  const share = lk.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
  if (share && videoEl) share.attach(videoEl);
}

export function isLocalScreenSharing(lk: Room) {
  const pub = lk.localParticipant.getTrackPublication(Track.Source.ScreenShare);
  return Boolean(pub?.track && !pub.isMuted);
}

export type MediaToggleResult = { ok: true } | { ok: false; reason: 'denied' | 'missing' | 'cancelled' | 'other' };

function classifyMediaErr(err: unknown): MediaToggleResult {
  const name = err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err || '');
  const blob = `${name} ${msg}`;
  if (/AbortError/i.test(name) || /cancelled|canceled/i.test(blob)) return { ok: false, reason: 'cancelled' };
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

export async function trySetScreenShare(lk: Room, enabled: boolean): Promise<MediaToggleResult> {
  try {
    await lk.localParticipant.setScreenShareEnabled(enabled, { audio: true });
    return { ok: true };
  } catch (err) {
    logMeetingErr('setScreenShareEnabled', err);
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
