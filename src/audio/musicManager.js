// Music manager — fades between looping MP3 tracks
const FADE_DURATION = 1.0; // seconds

let current = null; // { audio: HTMLAudioElement, trackId: string }

function createAudio(src) {
  const a = new Audio(src);
  a.loop = true;
  a.volume = 0;
  return a;
}

function fadeTo(audio, targetVol, durationMs, onDone) {
  const steps = 30;
  const interval = durationMs / steps;
  const start = audio.volume;
  const delta = (targetVol - start) / steps;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    audio.volume = Math.max(0, Math.min(1, start + delta * step));
    if (step >= steps) {
      clearInterval(timer);
      audio.volume = targetVol;
      onDone?.();
    }
  }, interval);

  return timer;
}

export function playMusic(trackId) {
  if (current?.trackId === trackId) return;

  const src = `/music/${trackId}.mp3`;

  // Fade out and stop current track
  if (current) {
    const old = current.audio;
    fadeTo(old, 0, FADE_DURATION * 1000, () => {
      old.pause();
      old.src = '';
    });
  }

  // Start new track
  const audio = createAudio(src);
  current = { audio, trackId };

  audio.play().then(() => {
    fadeTo(audio, 0.7, FADE_DURATION * 1000);
  }).catch(() => {
    // Autoplay blocked — retry on next user interaction
    const retry = () => {
      audio.play().then(() => fadeTo(audio, 0.7, FADE_DURATION * 1000));
      window.removeEventListener('pointerdown', retry);
    };
    window.addEventListener('pointerdown', retry, { once: true });
  });
}

export function stopMusic() {
  if (!current) return;
  const old = current.audio;
  current = null;
  fadeTo(old, 0, FADE_DURATION * 1000, () => {
    old.pause();
    old.src = '';
  });
}
